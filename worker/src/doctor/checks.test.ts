import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Keypair } from "@solana/web3.js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { migrate, type Db } from "../store/index.js";
import { connectPglite } from "../store/testing.js";
import { normalizeGrpcEndpoint, type GrpcClient } from "../watch/client.js";
import {
  checkBeam,
  checkDatabase,
  checkFeePayer,
  checkGrpc,
  checkRpc,
  checkTelegram,
  compareClusters,
  grpcVersion,
  judgeFeePayerBalance,
} from "./checks.js";

const DEVNET = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const MAINNET = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const method = (JSON.parse(body || "{}") as { method?: string }).method;
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      switch (req.url) {
        case "/ok":
          return json(200, { jsonrpc: "2.0", id: 1, result: method === "getGenesisHash" ? DEVNET : 424242 });
        case "/mainnet":
          return json(200, { jsonrpc: "2.0", id: 1, result: method === "getGenesisHash" ? MAINNET : 1 });
        case "/denied":
          return json(401, { error: "unauthorized" });
        case "/forbidden":
          return json(403, { error: "forbidden" });
        case "/limited":
          return json(429, {});
        case "/rpcerr":
          return json(200, { jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } });
        case "/html":
          res.writeHead(200, { "content-type": "text/html" });
          return res.end("<html>hi</html>");
        case "/missing":
          return json(404, {});
        case "/boom":
          return json(500, {});
        default:
          return json(404, {});
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("checkRpc", () => {
  it("passes and reports the cluster, slot and timing", async () => {
    const r = await checkRpc("Solami RPC", `${base}/ok`);
    expect(r.result).toMatchObject({ name: "Solami RPC", status: "pass" });
    expect(r.result.detail).toMatch(/devnet, slot 424242, \d+ ms/);
    expect(r.cluster).toBe("devnet");
  });

  it("recognises mainnet", async () => {
    expect((await checkRpc("x", `${base}/mainnet`)).cluster).toBe("mainnet-beta");
  });

  it("fails when the key is rejected", async () => {
    expect((await checkRpc("x", `${base}/denied`)).result).toMatchObject({ status: "fail", detail: expect.stringContaining("key was rejected (HTTP 401)") });
    expect((await checkRpc("x", `${base}/forbidden`)).result.detail).toContain("HTTP 403");
  });

  it("warns when rate limited and fails on server errors", async () => {
    expect((await checkRpc("x", `${base}/limited`)).result.status).toBe("warn");
    expect((await checkRpc("x", `${base}/boom`)).result).toMatchObject({ status: "fail", detail: "HTTP 500" });
  });

  it("fails on an RPC error and on a reply that is not Solana RPC", async () => {
    expect((await checkRpc("x", `${base}/rpcerr`)).result.detail).toContain("Method not found");
    expect((await checkRpc("x", `${base}/html`)).result.detail).toContain("not like a Solana RPC");
  });

  it("fails clearly when nothing is listening", async () => {
    // A port that was free a moment ago. (Port 1 is blocked by fetch itself, so it would not test this.)
    const probe = createServer();
    await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((r) => probe.close(() => r()));
    const r = await checkRpc("x", `http://127.0.0.1:${port}/`);
    expect(r.result.status).toBe("fail");
    expect(r.result.detail).toMatch(/refused|connect/i);
  });
});

describe("checkBeam", () => {
  it("passes for any JSON-RPC answer, even an error, because the point is reachability and the key", async () => {
    expect((await checkBeam(`${base}/ok`)).status).toBe("pass");
    const r = await checkBeam(`${base}/rpcerr`);
    expect(r.status).toBe("pass");
    expect(r.detail).toContain("no transaction was sent");
  });

  it("fails when the key is rejected and warns on a wrong path", async () => {
    expect((await checkBeam(`${base}/forbidden`)).detail).toContain("key was rejected");
    expect((await checkBeam(`${base}/missing`)).status).toBe("warn");
    expect((await checkBeam(`${base}/html`)).status).toBe("warn");
  });
});

describe("checkGrpc", () => {
  const fake = (over: Partial<GrpcClient> = {}): GrpcClient & { closed: boolean } => {
    const c = {
      closed: false,
      async getVersion() {
        return { version: "3.0.0" };
      },
      async ping() {
        return 1;
      },
      async getSlot() {
        return "777";
      },
      async subscribe() {
        throw new Error("not used");
      },
      _client: {
        close() {
          c.closed = true;
        },
      },
      ...over,
    };
    return c as GrpcClient & { closed: boolean };
  };

  it("passes with version, slot and timing, and closes the connection", async () => {
    const c = fake();
    const r = await checkGrpc("host:443", "token", () => c);
    expect(r.status).toBe("pass");
    expect(r.detail).toMatch(/version 3\.0\.0, slot 777, \d+ ms/);
    expect(c.closed).toBe(true);
  });

  it("maps gRPC status codes to something a person can act on", async () => {
    const err = (code: number) => fake({ getVersion: async () => Promise.reject(Object.assign(new Error("x"), { code })) });
    expect((await checkGrpc("h", "t", () => err(16))).detail).toContain("token was rejected");
    expect((await checkGrpc("h", "t", () => err(7))).detail).toContain("token was rejected");
    expect((await checkGrpc("h", "t", () => err(14))).detail).toContain("cannot reach");
    expect((await checkGrpc("h", "t", () => err(12))).detail).toContain("not a Yellowstone");
  });

  it("still closes the connection on failure", async () => {
    const c = fake({ getVersion: async () => Promise.reject(Object.assign(new Error("x"), { code: 14 })) });
    await checkGrpc("h", "t", () => c);
    expect(c.closed).toBe(true);
  });
});

describe("grpcVersion", () => {
  it("reads the version from an object, a JSON string or a plain string", () => {
    expect(grpcVersion({ version: "3.1.0" })).toBe("3.1.0");
    expect(grpcVersion('{"version":{"package":"yellowstone-grpc-geyser","version":"15.2.1"}}')).toBe("15.2.1");
    expect(grpcVersion({ version: { package: "x", version: "9.9.9" } })).toBe("9.9.9");
    expect(grpcVersion('{"version":"2.0.1"}')).toBe("2.0.1");
    expect(grpcVersion("1.2.3")).toBe("1.2.3");
    expect(grpcVersion(undefined)).toBe("unknown");
    expect(grpcVersion({})).toBe("unknown");
  });
});

describe("normalizeGrpcEndpoint", () => {
  it("adds https to a bare host and keeps an explicit scheme", () => {
    expect(normalizeGrpcEndpoint("grpc.solami.dev:443")).toBe("https://grpc.solami.dev:443");
    expect(normalizeGrpcEndpoint("https://grpc.solami.fast/")).toBe("https://grpc.solami.fast");
    expect(normalizeGrpcEndpoint("http://localhost:10000")).toBe("http://localhost:10000");
  });
});

describe("checkDatabase", () => {
  const dbs: Db[] = [];
  afterEach(async () => {
    while (dbs.length) await dbs.pop()?.close();
  });
  const open = async () => {
    const db = await connectPglite();
    dbs.push(db);
    return db;
  };

  it("warns, not fails, when connected but the schema does not exist yet", async () => {
    const r = await checkDatabase(await open());
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("No schema yet");
  });

  it("passes on a migrated database and reports the schema version", async () => {
    const db = await open();
    await migrate(db);
    const r = await checkDatabase(db);
    expect(r.status).toBe("pass");
    expect(r.detail).toMatch(/schema 1$/);
  });

  it("fails with the reason when the database errors", async () => {
    const broken: Db = {
      query: async () => Promise.reject(Object.assign(new Error("boom"), { code: "28P01" })),
      exec: async () => {},
      transaction: async () => {
        throw new Error("no");
      },
      close: async () => {},
    };
    const r = await checkDatabase(broken);
    expect(r).toMatchObject({ status: "fail", detail: "authentication failed: wrong user or password" });
  });
});

describe("fee payer", () => {
  it("judges the balance against the low mark and the 0.05 SOL cap", () => {
    expect(judgeFeePayerBalance(0).status).toBe("fail");
    expect(judgeFeePayerBalance(1_000_000).status).toBe("warn");
    expect(judgeFeePayerBalance(5_000_000).status).toBe("pass");
    expect(judgeFeePayerBalance(50_000_000).status).toBe("pass");
    expect(judgeFeePayerBalance(50_000_001).status).toBe("warn");
  });

  it("shows the public key and balance, never the secret", async () => {
    const kp = Keypair.generate();
    const r = await checkFeePayer("any.json", { getBalance: async () => 20_000_000 }, () => kp);
    expect(r.status).toBe("pass");
    expect(r.detail).toContain(kp.publicKey.toBase58());
    expect(r.detail).not.toContain(Buffer.from(kp.secretKey).toString("base64"));
  });

  it("fails with guidance when the key file is missing", async () => {
    const r = await checkFeePayer("missing.json", { getBalance: async () => 0 }, () => {
      throw new Error("Cannot read the keypair file missing.json");
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("Create a keypair file");
  });

  it("warns, not fails, when only the balance cannot be read", async () => {
    const r = await checkFeePayer("k.json", { getBalance: async () => Promise.reject(new Error("rpc down")) }, () => Keypair.generate());
    expect(r.status).toBe("warn");
  });
});

describe("checkTelegram", () => {
  const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("is skipped when not configured", async () => {
    expect((await checkTelegram(undefined)).status).toBe("skip");
  });

  it("passes when the bot works and can reach the chat, and shows only the bot name", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return url.includes("/getMe")
        ? new Response(JSON.stringify({ ok: true, result: { username: "rem_alert_bot" } }))
        : new Response(JSON.stringify({ ok: true, result: { type: "private" } }));
    }) as unknown as typeof fetch;
    const r = await checkTelegram({ botToken: "123:SECRET", chatId: "42" }, fetchImpl);
    expect(r).toMatchObject({ status: "pass", detail: "bot @rem_alert_bot can reach the chat" });
    expect(r.detail).not.toContain("SECRET");
    expect(calls.every((u) => u.includes("api.telegram.org"))).toBe(true);
  });

  it("fails on a rejected token and on an unreachable chat", async () => {
    expect((await checkTelegram({ botToken: "x", chatId: "1" }, reply(401, { ok: false }) as unknown as typeof fetch)).detail).toContain("rejected the bot token");
    let n = 0;
    const second = (async () => (n++ === 0 ? new Response(JSON.stringify({ ok: true, result: { username: "b" } })) : new Response(JSON.stringify({ ok: false })))) as unknown as typeof fetch;
    expect((await checkTelegram({ botToken: "x", chatId: "99" }, second)).detail).toContain("cannot reach chat 99");
  });
});

describe("compareClusters", () => {
  it("warns when Solami and the fallback are on different clusters", () => {
    const r = compareClusters("mainnet-beta", "devnet");
    expect(r?.status).toBe("warn");
    expect(r?.detail).toContain("FALLBACK_RPC_URL");
  });

  it("says nothing when they match or when a cluster is unknown", () => {
    expect(compareClusters("devnet", "devnet")).toBeNull();
    expect(compareClusters("mainnet-beta", null)).toBeNull();
    expect(compareClusters("unknown", "devnet")).toBeNull();
  });
});
