import { createMiddleware } from 'hono/factory'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function createRateLimit(maxRequests: number, windowMs: number) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
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
