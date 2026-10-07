import pg from "pg";

/** The smallest surface the store needs. Production uses `pg` (Neon), tests use PGlite (see testing.ts). */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  /** Runs several statements with no parameters, for migrations. */
  exec(sql: string): Promise<void>;
  /** All queries inside `fn` share one connection and commit or roll back together. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function fromClient(client: pg.PoolClient | pg.Pool, owner: { pool?: pg.Pool }): Db {
  const self: Db = {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const r = await client.query(sql, params as unknown[]);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async exec(sql) {
      await client.query(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if (!owner.pool) throw new Error("Nested transactions are not supported.");
      const conn = await owner.pool.connect();
      const inner = fromClient(conn, {}); // no pool: nesting is refused
      try {
        await conn.query("BEGIN");
        const result = await fn(inner);
        await conn.query("COMMIT");
        return result;
      } catch (cause) {
        await conn.query("ROLLBACK").catch(() => {});
        throw cause;
      } finally {
        conn.release();
      }
    },
    async close() {
      if (owner.pool) await owner.pool.end();
    },
  };
  return self;
}

/**
 * Connects to Postgres, normally a Neon pooled connection string. Neon suspends idle compute on its free
 * plan, which drops connections. An idle client error must be handled or Node would crash on it, so it is
 * logged (the message never contains the password) and the pool opens a fresh connection on the next query.
 */
export function connectPg(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });
  pool.on("error", (e) => console.error(`database pool: ${e.message}`));
  return fromClient(pool, { pool });
}
