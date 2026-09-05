import { createMiddleware } from 'hono/factory'
import { getConnInfo } from '@hono/node-server/conninfo'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitOptions = {
  trustProxy?: boolean
}

function clientIp(c: Parameters<Parameters<typeof createMiddleware>[0]>[0], trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
    const realIp = c.req.header('x-real-ip')?.trim()
    if (realIp) return realIp
  }

  try {
    const info = getConnInfo(c)
    if (info.remote.address) return info.remote.address
  } catch {
    // not running under node-server adapter
  }

  return 'unknown'
}

export function createRateLimit(maxRequests: number, windowMs: number, options: RateLimitOptions = {}) {
  const trustProxy = Boolean(options.trustProxy)

  return createMiddleware(async (c, next) => {
    const ip = clientIp(c, trustProxy)
    const key = `${c.req.path}:${ip}`
    const now = Date.now()
    let bucket = buckets.get(key)

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    if (bucket.count > maxRequests) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    await next()
  })
}
