import { createMiddleware } from 'hono/factory'
import type { AppVariables } from './session.js'

export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

/**
 * Middleware that requires the user to have at least one of the specified permissions.
 * Must be used after requireAuth.
 */
export function requirePermission(...requiredPerms: string[]) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const hasPermission = requiredPerms.some((perm) => user.permissions.includes(perm))
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}
