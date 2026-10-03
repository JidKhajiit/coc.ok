import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDb } from './db/index.js'
import { loadEnv } from './env.js'
import { createSessionMiddleware, cleanupExpiredSessions } from './middleware/session.js'
import type { AppVariables } from './middleware/session.js'
import { createAuthRoutes } from './routes/auth.js'
import { createProfilesRoutes } from './routes/profiles.js'
import { createCollectionsRoutes, createShareRoutes } from './routes/collections.js'
import { createStateRoutes } from './routes/state.js'
import { createAdminRoutes } from './routes/admin.js'
import { createCozyFarmRoutes } from './routes/cozyFarm.js'
import { ensureDefaultCardTradeEvent } from './lib/cardTradeEvents.js'
import { createCardTradesRoutes } from './routes/cardTrades.js'
import { createCalendarRoutes } from './routes/calendar.js'

const env = loadEnv()
const { db, client } = createDb(env.DATABASE_URL)
await ensureDefaultCardTradeEvent(db)

const app = new Hono<{ Variables: AppVariables }>()

app.use('*', secureHeaders())
app.use('*', createSessionMiddleware(db, env))

app.get('/api/health', (c) => c.json({ ok: true }))

const api = new Hono<{ Variables: AppVariables }>()
api.route('/auth', createAuthRoutes(db, env))
api.route('/profiles', createProfilesRoutes(db, env))
api.route('/state', createStateRoutes(db))
api.route('/card-trades', createCardTradesRoutes(db))
api.route('/card-trades/collections', createCollectionsRoutes(db))
api.route('/card-trades/share', createShareRoutes(db))
api.route('/admin', createAdminRoutes(db, client))
api.route('/cozy-farm', createCozyFarmRoutes(db))
api.route('/calendar', createCalendarRoutes(db))
app.route('/api', api)

const projectRoot = process.cwd()
app.use('/uploads/*', serveStatic({ root: projectRoot }))

const distPath = resolve(projectRoot, 'dist')
if (env.NODE_ENV === 'production' && existsSync(distPath)) {
  app.use('/*', serveStatic({ root: distPath }))
  app.get('*', serveStatic({ path: resolve(distPath, 'index.html') }))
} else if (env.NODE_ENV !== 'production') {
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api') || c.req.path.startsWith('/uploads')) {
      return c.notFound()
    }
    const frontend = env.APP_URL.replace(/\/$/, '')
    return c.html(
      `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>API</title>
    <style>
      body { margin: 0; font: 16px/1.45 system-ui, sans-serif; padding: 2rem; color: #1a2a22; background: #f7f2e6; }
      a { color: #1f5c3e; }
    </style>
  </head>
  <body>
    <p>Это API в режиме разработки. Интерфейс: <a href="${frontend}">${frontend}</a></p>
  </body>
</html>`,
    )
  })
}

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`)
    if (env.NODE_ENV !== 'production') {
      console.log(`Frontend (Vite): ${env.APP_URL}`)
    }
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
