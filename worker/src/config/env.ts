const REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

/**
 * Expands `${NAME}` and `${NAME:-default}` in one string. A variable that is unset or empty is an error
 * unless a default is given, so a missing secret stops startup instead of becoming an empty string.
 * Errors name the variable and where it was used, and never print any value.
 */
export function expandEnv(value: string, env: Record<string, string | undefined>, where: string): string {
  return value.replace(REF, (_match, name: string, fallback: string | undefined) => {
    const v = env[name];
    if (v !== undefined && v !== "") return v;
    if (fallback !== undefined) return fallback;
    throw new Error(`Environment variable ${name} is not set (needed by ${where}).`);
  });
}

/** Expands every string value in a parsed YAML tree. Keys are left alone so env cannot inject structure. */
export function expandTree(node: unknown, env: Record<string, string | undefined>, path = ""): unknown {
  if (typeof node === "string") return expandEnv(node, env, path || "the config");
  if (Array.isArray(node)) return node.map((item, i) => expandTree(item, env, `${path}[${i}]`));
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, expandTree(v, env, path ? `${path}.${k}` : k)]),
    );
  }
  return node;
}
