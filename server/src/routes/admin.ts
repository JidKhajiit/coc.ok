import { Hono } from 'hono'
import { z } from 'zod'
import { eq, ne, and, inArray } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  userStates,
} from '../db/schema.js'
import type { AppState } from '../../../shared/types.js'
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

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export function createAdminRoutes(db: Db) {
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

    // Check that user exists
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Validate that all roleIds exist
    if (roleIds.length > 0) {
      const existingRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.id, roleIds))
      if (existingRoles.length !== roleIds.length) {
        return c.json({ error: 'One or more roles not found' }, 400)
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
      .select({ id: roles.id, isSystem: roles.isSystem })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)
    if (!role) {
      return c.json({ error: 'Role not found' }, 404)
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
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description ?? null

    if (Object.keys(updates).length > 0) {
      await db.update(roles).set(updates).where(eq(roles.id, roleId))
    }

    // Update permissions if provided
    if (permissionIds !== undefined) {
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
    const [
      usersData,
      userStatesData,
      rolesData,
      permissionsData,
      userRolesData,
      rolePermissionsData,
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(userStates),
      db.select().from(roles),
      db.select().from(permissions),
      db.select().from(userRoles),
      db.select().from(rolePermissions),
    ])

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        users: usersData,
        userStates: userStatesData,
        roles: rolesData,
        permissions: permissionsData,
        userRoles: userRolesData,
        rolePermissions: rolePermissionsData,
      },
    }

    return c.json(backup)
  })

  // POST /backup — import database from JSON backup
  app.post('/backup', requirePermission('roles:manage'), async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object' || !body.data) {
      return c.json({ error: 'Invalid backup format' }, 400)
    }

    const { data } = body as {
      data: {
        users?: Array<{
          id: string
          username: string
          email: string | null
          emailVerified: boolean
          passwordHash: string
          createdAt: string
        }>
        userStates?: Array<{
          userId: string
          data: unknown
          updatedAt: string
          shareEnabled: boolean
          shareSlug: string | null
        }>
        roles?: Array<{
          id: string
          name: string
          description: string | null
          isSystem: boolean
        }>
        permissions?: Array<{
          id: string
          name: string
          description: string | null
        }>
        userRoles?: Array<{ userId: string; roleId: string }>
        rolePermissions?: Array<{ roleId: string; permissionId: string }>
      }
    }

    try {
      // Import in correct order due to foreign keys
      // 1. Permissions (no deps)
      if (data.permissions?.length) {
        for (const perm of data.permissions) {
          await db
            .insert(permissions)
            .values(perm)
            .onConflictDoUpdate({
              target: permissions.id,
              set: { name: perm.name, description: perm.description },
            })
        }
      }

      // 2. Roles (no deps)
      if (data.roles?.length) {
        for (const role of data.roles) {
          await db
            .insert(roles)
            .values(role)
            .onConflictDoUpdate({
              target: roles.id,
              set: { name: role.name, description: role.description, isSystem: role.isSystem },
            })
        }
      }

      // 3. Role-Permission mappings
      if (data.rolePermissions?.length) {
        for (const rp of data.rolePermissions) {
          await db
            .insert(rolePermissions)
            .values(rp)
            .onConflictDoNothing()
        }
      }

      // 4. Users
      if (data.users?.length) {
        for (const user of data.users) {
          await db
            .insert(users)
            .values({
              ...user,
              createdAt: new Date(user.createdAt),
            })
            .onConflictDoUpdate({
              target: users.id,
              set: {
                username: user.username,
                email: user.email,
                emailVerified: user.emailVerified,
                passwordHash: user.passwordHash,
              },
            })
        }
      }

      // 5. User-Role mappings
      if (data.userRoles?.length) {
        for (const ur of data.userRoles) {
          await db
            .insert(userRoles)
            .values(ur)
            .onConflictDoNothing()
        }
      }

      // 6. User states
      if (data.userStates?.length) {
        for (const state of data.userStates) {
          await db
            .insert(userStates)
            .values({
              userId: state.userId,
              data: state.data as AppState,
              updatedAt: new Date(state.updatedAt),
              shareEnabled: state.shareEnabled,
              shareSlug: state.shareSlug,
            })
            .onConflictDoUpdate({
              target: userStates.userId,
              set: {
                data: state.data as AppState,
                updatedAt: new Date(state.updatedAt),
                shareEnabled: state.shareEnabled,
                shareSlug: state.shareSlug,
              },
            })
        }
      }

      return c.json({ ok: true, imported: {
        users: data.users?.length ?? 0,
        userStates: data.userStates?.length ?? 0,
        roles: data.roles?.length ?? 0,
        permissions: data.permissions?.length ?? 0,
        userRoles: data.userRoles?.length ?? 0,
        rolePermissions: data.rolePermissions?.length ?? 0,
      }})
    } catch (err) {
      console.error('Backup import error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Import failed' }, 500)
    }
  })

  return app
}
