import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from './db/index.js'
import { loadEnv } from './env.js'
import { createSessionMiddleware, cleanupExpiredSessions } from './middleware/session.js'
import type { AppVariables } from './middleware/session.js'
import { createAuthRoutes } from './routes/auth.js'
import { createCollectionsRoutes, createShareRoutes } from './routes/collections.js'
import { createStateRoutes } from './routes/state.js'
import { createAdminRoutes } from './routes/admin.js'
import { createCozyFarmRoutes } from './routes/cozyFarm.js'

const env = loadEnv()
const { db, client } = createDb(env.DATABASE_URL)

const app = new Hono<{ Variables: AppVariables }>()

app.use('*', secureHeaders())
app.use('*', createSessionMiddleware(db, env))

app.get('/api/health', (c) => c.json({ ok: true }))

const api = new Hono<{ Variables: AppVariables }>()
api.route('/auth', createAuthRoutes(db, env))
api.route('/state', createStateRoutes(db))
api.route('/card-trades/collections', createCollectionsRoutes(db))
api.route('/card-trades/share', createShareRoutes(db))
api.route('/admin', createAdminRoutes(db))
api.route('/cozy-farm', createCozyFarmRoutes(db))
app.route('/api', api)

const distPath = resolve(fileURLToPath(new URL('../../../dist', import.meta.url)))
if (existsSync(distPath)) {
  app.use('/*', serveStatic({ root: distPath }))
  app.get('*', serveStatic({ path: resolve(distPath, 'index.html') }))
}

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`)
  },
)

// Periodic session cleanup
setInterval(() => {
  cleanupExpiredSessions(db).catch((err) => console.error('Session cleanup failed:', err))
}, 60 * 60 * 1000)

const shutdown = async () => {
  await client.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
