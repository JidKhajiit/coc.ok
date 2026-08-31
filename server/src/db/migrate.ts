import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnv } from '../env.js'

const env = loadEnv()
const client = postgres(env.DATABASE_URL, { max: 1 })
const db = drizzle(client)

const migrationsFolder = resolve(process.cwd(), 'server/drizzle')
await migrate(db, { migrationsFolder })
await client.end()

console.log('Migrations applied')
