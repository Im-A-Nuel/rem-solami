// The Solami RPC host from their docs. solami.dev points at the same servers.
const SOLAMI_RPC_BASE = "https://rpc.solami.fast/sol";

/**
 * Lets one key do the work. If SOLAMI_API_KEY is set, the gRPC token and the RPC and landing URLs that are
 * left empty are built from it. A variable that is set always wins, so a separate SWQoS key still works
 * (SOLAMI_SWQOS_KEY, or a full SOLAMI_BEAM_URL). Returns a copy and the names that were derived.
 */
export function withSolamiDefaults(env: Record<string, string | undefined>): {
  env: Record<string, string | undefined>;
  derived: string[];
} {
  const out = { ...env };
  const derived: string[] = [];
  const key = env.SOLAMI_API_KEY?.trim();
  if (!key) return { env: out, derived };
  const url = (k: string) => `${SOLAMI_RPC_BASE}?api_key=${encodeURIComponent(k)}`;
  const empty = (name: string) => !env[name] || env[name]?.trim() === "";
  if (empty("SOLAMI_GRPC_TOKEN")) {
    out.SOLAMI_GRPC_TOKEN = key;
    derived.push("SOLAMI_GRPC_TOKEN");
  }
  if (empty("SOLAMI_RPC_URL")) {
    out.SOLAMI_RPC_URL = url(key);
    derived.push("SOLAMI_RPC_URL");
  }
  if (empty("SOLAMI_BEAM_URL")) {
    out.SOLAMI_BEAM_URL = url(env.SOLAMI_SWQOS_KEY?.trim() || key);
    derived.push("SOLAMI_BEAM_URL");
  }
  return { env: out, derived };
}

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
