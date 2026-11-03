import "server-only"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { createClient, type Client } from "@libsql/client"
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import * as schema from "@/lib/db/schema"

type DB = LibSQLDatabase<typeof schema>

const globalForDb = globalThis as unknown as { qfDb?: DB; qfClient?: Client; qfReady?: Promise<void> }

function resolveUrl() {
  const url = process.env.DATABASE_URL || "file:./data/qaforge.db"
  if (url.startsWith("file:")) {
    mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true })
  }
  return url
}

function init() {
  if (!globalForDb.qfClient) {
    const url = resolveUrl()
    globalForDb.qfClient = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
      // A single local connection keeps per-connection PRAGMAs (foreign keys => cascades) in effect for every query.
      concurrency: url.startsWith("file:") ? 1 : undefined,
    })
    globalForDb.qfDb = drizzle(globalForDb.qfClient, { schema })
  }
  return { client: globalForDb.qfClient, db: globalForDb.qfDb! }
}

/**
 * Returns the database, applying pending migrations exactly once per process.
 * Foreign keys are enforced per connection in SQLite, so they are switched on here.
 */
export async function getDb(): Promise<DB> {
  const { client, db } = init()
  globalForDb.qfReady ??= (async () => {
    if (resolveUrl().startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL")
    // Migrations run with foreign keys OFF so table rebuilds never trigger cascades;
    // enforcement is switched on afterwards for all application queries.
    await client.execute("PRAGMA foreign_keys = OFF")
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") })
    await client.execute("PRAGMA foreign_keys = ON")
  })().catch((err) => {
    globalForDb.qfReady = undefined
    throw err
  })
  await globalForDb.qfReady
  return db
}

export { schema }
