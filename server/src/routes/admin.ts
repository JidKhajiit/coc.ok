import { Hono } from 'hono'
import { z } from 'zod'
import { eq, ne, and, inArray } from 'drizzle-orm'
import type { Db, DbClient } from '../db/index.js'
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
} from '../db/schema.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import type { AppVariables } from '../middleware/session.js'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid()

const assignRolesSchema = z.object({
  roleIds: z.array(uuidSchema),
})

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(256).optional(),
  permissionIds: z.array(uuidSchema).optional(),
})

const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(256).optional(),
  permissionIds: z.array(uuidSchema).optional(),
})

const backupImportSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
})

type TableRows = Record<string, Array<Record<string, unknown>>>

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`
}

async function getPublicTableNames(client: DbClient) {
  const rows = await client<{ tableName: string }[]>`
    select tablename as "tableName"
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `
  return rows.map((row) => row.tableName)
}

async function getForeignKeyDependencies(client: DbClient) {
  const rows = await client<{ tableName: string; dependsOn: string }[]>`
    select distinct
      child.relname as "tableName",
      parent.relname as "dependsOn"
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where con.contype = 'f'
      and child_ns.nspname = 'public'
      and parent_ns.nspname = 'public'
      and child.relname <> parent.relname
  `

  const deps = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = deps.get(row.tableName) ?? new Set<string>()
    set.add(row.dependsOn)
    deps.set(row.tableName, set)
  }
  return deps
}

function sortTablesForImport(tableNames: string[], dependencies: Map<string, Set<string>>) {
  const remaining = new Set(tableNames)
  const sorted: string[] = []

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((tableName) => {
        const deps = dependencies.get(tableName)
        if (!deps) return true
        return [...deps].every((dep) => !remaining.has(dep))
      })
      .sort()

    if (ready.length === 0) {
      throw new Error(`Unable to resolve table import order: ${[...remaining].sort().join(', ')}`)
    }

    for (const tableName of ready) {
      remaining.delete(tableName)
      sorted.push(tableName)
    }
  }

  return sorted
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export function createAdminRoutes(db: Db, client: DbClient) {
  const app = new Hono<{ Variables: AppVariables }>()

  // All admin routes require authentication
  app.use('*', requireAuth)

  // ───────────────────────────────────────────────────────────────────────────
  // Users
  // ───────────────────────────────────────────────────────────────────────────

  // GET /users — list all users with their roles
  app.get('/users', requirePermission('users:view'), async (c) => {
    const usersData = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt)

    // Get roles for all users
    const userRolesData = await db
      .select({
        userId: userRoles.userId,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))

    const userRolesMap = new Map<string, Array<{ id: string; name: string }>>()
    for (const ur of userRolesData) {
      const list = userRolesMap.get(ur.userId) ?? []
      list.push({ id: ur.roleId, name: ur.roleName })
      userRolesMap.set(ur.userId, list)
    }

    const result = usersData.map((u) => ({
      ...u,
      roles: userRolesMap.get(u.id) ?? [],
    }))

    return c.json({ users: result })
  })

  // PUT /users/:id/roles — assign roles to user
  app.put('/users/:id/roles', requirePermission('users:edit'), async (c) => {
    const userId = c.req.param('id')
    if (!uuidSchema.safeParse(userId).success) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = assignRolesSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { roleIds } = parsed.data
    const currentUser = c.get('user')!
    const canManageRoles = currentUser.permissions.includes('roles:manage')

    // Only roles:manage may change their own roles (prevents self-escalation by admins).
    if (currentUser.id === userId && !canManageRoles) {
      return c.json({ error: 'Cannot change your own roles' }, 403)
    }

    // Check that user exists
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Validate that all roleIds exist
    if (roleIds.length > 0) {
      const existingRoles = await db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(inArray(roles.id, roleIds))
      if (existingRoles.length !== roleIds.length) {
        return c.json({ error: 'One or more roles not found' }, 400)
      }

      // Without roles:manage, may only assign roles whose permissions ⊆ actor permissions.
      if (!canManageRoles) {
        const targetPerms = await db
          .selectDistinct({ name: permissions.name, roleId: rolePermissions.roleId })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(inArray(rolePermissions.roleId, roleIds))

        const actorPerms = new Set(currentUser.permissions)
        for (const perm of targetPerms) {
          if (!actorPerms.has(perm.name)) {
            return c.json(
              { error: 'Cannot assign a role with permissions you do not have' },
              403,
            )
          }
        }
      }
    }

    // Replace user roles
    await db.delete(userRoles).where(eq(userRoles.userId, userId))
    if (roleIds.length > 0) {
      await db.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })))
    }

    return c.json({ ok: true })
  })

  // DELETE /users/:id — delete user
  app.delete('/users/:id', requirePermission('users:delete'), async (c) => {
    const userId = c.req.param('id')
    if (!uuidSchema.safeParse(userId).success) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const currentUser = c.get('user')
    if (currentUser?.id === userId) {
      return c.json({ error: 'Cannot delete yourself' }, 400)
    }

    // Check user exists before deleting
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!existing) {
      return c.json({ error: 'User not found' }, 404)
    }

    await db.delete(users).where(eq(users.id, userId))
    return c.json({ ok: true })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Roles
  // ───────────────────────────────────────────────────────────────────────────

  // GET /roles — list all roles with their permissions
  app.get('/roles', requirePermission('roles:view'), async (c) => {
    const rolesData = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        isSystem: roles.isSystem,
      })
      .from(roles)
      .orderBy(roles.name)

    // Get permissions for all roles
    const rpData = await db
      .select({
        roleId: rolePermissions.roleId,
        permissionId: permissions.id,
        permissionName: permissions.name,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))

    const rolePermsMap = new Map<string, Array<{ id: string; name: string }>>()
    for (const rp of rpData) {
      const list = rolePermsMap.get(rp.roleId) ?? []
      list.push({ id: rp.permissionId, name: rp.permissionName })
      rolePermsMap.set(rp.roleId, list)
    }

    const result = rolesData.map((r) => ({
      ...r,
      permissions: rolePermsMap.get(r.id) ?? [],
    }))

    return c.json({ roles: result })
  })

  // POST /roles — create new role
  app.post('/roles', requirePermission('roles:manage'), async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = createRoleSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { name, description, permissionIds } = parsed.data

    // Check name uniqueness
    const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1)
    if (existing) {
      return c.json({ error: 'Role name already exists' }, 409)
    }

    // Validate permissionIds
    if (permissionIds && permissionIds.length > 0) {
      const existingPerms = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(inArray(permissions.id, permissionIds))
      if (existingPerms.length !== permissionIds.length) {
        return c.json({ error: 'One or more permissions not found' }, 400)
      }
    }

    const [role] = await db
      .insert(roles)
      .values({ name, description: description ?? null, isSystem: false })
      .returning({ id: roles.id, name: roles.name })

    if (!role) {
      return c.json({ error: 'Failed to create role' }, 500)
    }

    // Assign permissions
    if (permissionIds && permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      )
    }

    return c.json({ role }, 201)
  })

  // PUT /roles/:id — update role
  app.put('/roles/:id', requirePermission('roles:manage'), async (c) => {
    const roleId = c.req.param('id')
    if (!uuidSchema.safeParse(roleId).success) {
      return c.json({ error: 'Invalid role ID' }, 400)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = updateRoleSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
    }

    const { name, description, permissionIds } = parsed.data

    // Check role exists
    const [role] = await db
      .select({ id: roles.id, isSystem: roles.isSystem, name: roles.name })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)
    if (!role) {
      return c.json({ error: 'Role not found' }, 404)
    }

    // System roles: name and permissions are immutable (description only).
    if (role.isSystem) {
      if (name !== undefined && name !== role.name) {
        return c.json({ error: 'Cannot rename system role' }, 400)
      }
      if (permissionIds !== undefined) {
        return c.json({ error: 'Cannot change permissions of system role' }, 400)
      }
    }

    // Check name uniqueness if changing
    if (name) {
      const [existing] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.name, name), ne(roles.id, roleId)))
        .limit(1)
      if (existing) {
        return c.json({ error: 'Role name already exists' }, 409)
      }
    }

    // Validate permissionIds
    if (permissionIds && permissionIds.length > 0) {
      const existingPerms = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(inArray(permissions.id, permissionIds))
      if (existingPerms.length !== permissionIds.length) {
        return c.json({ error: 'One or more permissions not found' }, 400)
      }
    }

    // Update role fields
    const updates: { name?: string; description?: string | null } = {}
    if (name !== undefined && !role.isSystem) updates.name = name
    if (description !== undefined) updates.description = description ?? null

    if (Object.keys(updates).length > 0) {
      await db.update(roles).set(updates).where(eq(roles.id, roleId))
    }

    // Update permissions if provided (non-system only)
    if (permissionIds !== undefined && !role.isSystem) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
      if (permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId, permissionId })),
        )
      }
    }

    return c.json({ ok: true })
  })

  // DELETE /roles/:id — delete role (only non-system)
  app.delete('/roles/:id', requirePermission('roles:manage'), async (c) => {
    const roleId = c.req.param('id')
    if (!uuidSchema.safeParse(roleId).success) {
      return c.json({ error: 'Invalid role ID' }, 400)
    }

    const [role] = await db
      .select({ id: roles.id, isSystem: roles.isSystem })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)

    if (!role) {
      return c.json({ error: 'Role not found' }, 404)
    }

    if (role.isSystem) {
      return c.json({ error: 'Cannot delete system role' }, 400)
    }

    await db.delete(roles).where(eq(roles.id, roleId))
    return c.json({ ok: true })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Permissions
  // ───────────────────────────────────────────────────────────────────────────

  // GET /permissions — list all permissions
  app.get('/permissions', requirePermission('roles:view'), async (c) => {
    const permsData = await db
      .select({
        id: permissions.id,
        name: permissions.name,
        description: permissions.description,
      })
      .from(permissions)
      .orderBy(permissions.name)

    return c.json({ permissions: permsData })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Database Backup
  // ───────────────────────────────────────────────────────────────────────────

  // GET /backup — export entire database as JSON
  app.get('/backup', requirePermission('roles:manage'), async (c) => {
    const tableNames = await getPublicTableNames(client)
    const dataEntries = await Promise.all(
      tableNames.map(async (tableName) => {
        const tableSql = quoteIdentifier(tableName)
        const rows = await client.unsafe<{ rows: Array<Record<string, unknown>> }[]>(
          `select coalesce(json_agg(t), '[]'::json) as rows from (select * from ${tableSql}) t`,
        )
        return [tableName, rows[0]?.rows ?? []] as const
      }),
    )

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: Object.fromEntries(dataEntries) as TableRows,
    }

    return c.json(backup)
  })

  // POST /backup — replace database contents from JSON backup (transactional)
  app.post('/backup', requirePermission('roles:manage'), async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = backupImportSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid backup format' }, 400)
    }

    const { data } = parsed.data

    try {
      const existingTables = new Set(await getPublicTableNames(client))
      const backupTableNames = Object.keys(data).filter((tableName) => existingTables.has(tableName))
      const dependencies = await getForeignKeyDependencies(client)
      const orderedTables = sortTablesForImport(backupTableNames, dependencies)

      await client.begin(async (sql) => {
        const existingTableList = [...existingTables].sort()
        if (existingTableList.length > 0) {
          const truncateSql = existingTableList.map(quoteIdentifier).join(', ')
          await sql.unsafe(`truncate table ${truncateSql} restart identity cascade`)
        }

        for (const tableName of orderedTables) {
          const rows = data[tableName] ?? []
          if (rows.length === 0) continue

          const tableSql = quoteIdentifier(tableName)
          await sql.unsafe(
            `insert into ${tableSql} select * from jsonb_populate_recordset(null::${tableSql}, $1::jsonb)`,
            [JSON.stringify(rows)],
          )
        }
      })

      const imported = Object.fromEntries(
        orderedTables.map((tableName) => [tableName, data[tableName]?.length ?? 0]),
      )

      return c.json({ ok: true, imported })
    } catch (err) {
      console.error('Backup import error:', err)
      return c.json({ error: 'Import failed' }, 500)
    }
  })

  return app
}
