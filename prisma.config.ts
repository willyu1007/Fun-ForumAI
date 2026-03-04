import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/llm_forum_dev`,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? process.env.DATABASE_SHADOW_URL,
  },
})
