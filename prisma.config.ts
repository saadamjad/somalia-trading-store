import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection — PgBouncer/Supabase's transaction
    // pooler doesn't support the session-level DDL locking `prisma migrate` relies on.
    // DIRECT_URL is only set in production (see .env.example); locally DATABASE_URL already
    // points straight at Postgres with no pooler in front of it, so this falls back to it.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
