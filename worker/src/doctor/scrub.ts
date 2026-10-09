import type { RemConfig } from "../config/index.js";

// Anything `rem doctor` prints passes through scrub, so a secret cannot leak through an error message
// that happens to quote a URL, a header or a connection string.

const MIN_SECRET_LENGTH = 6; // shorter strings would also match ordinary words and mangle the output

function urlSecrets(value: string): string[] {
  try {
    const u = new URL(value);
    const found = [...u.searchParams.values()];
    if (u.password) found.push(u.password, decodeURIComponent(u.password));
    if (u.username && u.password) found.push(`${u.username}:${u.password}`);
    return found;
  } catch {
    return [];
  }
}

export function secretsOf(c: RemConfig): string[] {
  const all = [
    c.solami.grpcToken,
    c.telegram?.botToken,
    ...[c.solami.rpcUrl, c.solami.beamUrl, c.solami.mirageWs, c.fallbackRpcUrl, c.databaseUrl].flatMap((u) =>
      u ? [u, ...urlSecrets(u)] : [],
    ),
  ];
  return [...new Set(all.filter((s): s is string => !!s && s.length >= MIN_SECRET_LENGTH))];
}

export function scrub(text: string, secrets: readonly string[]): string {
  let out = text;
  // Longest first, so a full URL is replaced as a whole before the key inside it.
  for (const s of [...secrets].sort((a, b) => b.length - a.length)) out = out.split(s).join("***");
  return out;
}
