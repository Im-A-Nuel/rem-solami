import { resolve } from "node:path";

/**
 * Resolves a path typed on the command line from where the user ran the command, not from the package
 * directory. pnpm runs scripts inside `worker/` but records the real working directory in INIT_CWD, so
 * `pnpm --dir worker rem setup --out ./panic/x.json` writes to ./panic/x.json of the repo root.
 */
export function fromUserDir(path: string, env: Record<string, string | undefined> = process.env): string {
  return resolve(env.INIT_CWD ?? process.cwd(), path);
}
