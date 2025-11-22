import { defineConfig } from "drizzle-kit";
import 'dotenv/config'


if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// const nonPoolingUrl = process.env.DATABASE_URL.replace(':6543', ':5432')

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
