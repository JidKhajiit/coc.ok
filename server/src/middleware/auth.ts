import { createMiddleware } from 'hono/factory'
import type { AppVariables } from './session.js'

export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})
