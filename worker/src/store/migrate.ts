import type { Db } from "./db.js";
import { MIGRATIONS, type Migration } from "./migrations.js";

// Arbitrary constant that every Rem process uses, so two processes starting together cannot both migrate.
const LOCK_KEY = 727_274_001;

/** Applies every pending migration, each in its own transaction. Safe to call on every start. */
export async function migrate(db: Db, migrations: readonly Migration[] = MIGRATIONS): Promise<number[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const applied: number[] = [];
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    await db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
      const done = await tx.query("SELECT 1 FROM schema_migrations WHERE version = $1", [m.version]);
      if (done.rows.length > 0) return;
      await tx.exec(m.sql);
      await tx.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [m.version, m.name]);
      applied.push(m.version);
    });
  }
  return applied;
}
