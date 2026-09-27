import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index.js";
import { runMigrations } from "./migrate.js";

export type CortexDb = ReturnType<typeof drizzle<typeof schema>>;

let dbSingleton: CortexDb | undefined;
let pgliteSingleton: PGlite | undefined;

/**
 * Creates (or returns) the process-wide PGlite-backed Drizzle client.
 * `dataDir` undefined => in-memory (fresh every process start, used by
 * seed-demo + tests); a path makes it persist across server restarts.
 */
export async function getDb(dataDir?: string): Promise<CortexDb> {
  if (dbSingleton) return dbSingleton;
  pgliteSingleton = dataDir ? new PGlite(dataDir) : new PGlite();
  dbSingleton = drizzle(pgliteSingleton, { schema });
  await runMigrations(dbSingleton);
  return dbSingleton;
}

export async function closeDb(): Promise<void> {
  await pgliteSingleton?.close();
  dbSingleton = undefined;
  pgliteSingleton = undefined;
}

export { schema };
