import { PGlite } from "@electric-sql/pglite";
import type { Db } from "./db.js";

/**
 * An in-memory Postgres (PGlite, Postgres compiled to WASM) behind the same Db interface. Tests run the
 * real migrations and the real SQL against it, with no server and no native addon. Test code only.
 */
export async function connectPglite(): Promise<Db> {
  const lite = new PGlite();
  await lite.waitReady;

  const wrap = (q: Pick<PGlite, "query" | "exec">, closeFn: () => Promise<void>, nested: boolean): Db => ({
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const r = await q.query<T>(sql, params as unknown[]);
      // pg reports the row count for SELECT too; PGlite reports affectedRows = 0 there, so take the larger.
      return { rows: r.rows, rowCount: Math.max(r.affectedRows ?? 0, r.rows.length) };
    },
    async exec(sql) {
      await q.exec(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if (nested) throw new Error("Nested transactions are not supported.");
      return lite.transaction(async (tx) => fn(wrap(tx, async () => {}, true)));
    },
    close: closeFn,
  });

  return wrap(lite, () => lite.close(), false);
}
