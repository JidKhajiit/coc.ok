import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://cardtrades:cardtrades@localhost:5432/cardtrades',
  },
})
