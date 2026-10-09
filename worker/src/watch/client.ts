import type { ClientDuplexStream } from "@grpc/grpc-js";
import * as Yellowstone from "@triton-one/yellowstone-grpc";
import type { SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";

// @triton-one/yellowstone-grpc is pinned to 4.0.2 on purpose. It is the last release that is plain
// JavaScript on @grpc/grpc-js. From 5.0 on the package ships native binaries with no Windows build, which
// breaks installs on a developer laptop and goes against the "no native addons" rule.

/** The part of the client Rem uses. Declared here because the package's own types are CJS-shaped. */
export interface GrpcClient {
  /** A string in the typings, but the client resolves an object like { version }. Handle both. */
  getVersion(): Promise<unknown>;
  ping(count: number): Promise<number>;
  getSlot(): Promise<string>;
  subscribe(): Promise<ClientDuplexStream<SubscribeRequest, SubscribeUpdate>>;
  _client: { close(): void };
}

type Ctor = new (endpoint: string, xToken: string | undefined, options: Record<string, unknown> | undefined) => GrpcClient;

// Depending on the loader, the class is the default export or nested one level deeper.
function resolveCtor(): Ctor {
  const d = (Yellowstone as unknown as { default?: unknown }).default;
  const nested = (d as { default?: unknown } | undefined)?.default;
  const ctor = typeof d === "function" ? d : nested;
  if (typeof ctor !== "function") throw new Error("Could not load the Yellowstone gRPC client class.");
  return ctor as Ctor;
}

/** A bare host:port would be treated as plaintext by the client. Solami needs TLS, so default to https. */
export function normalizeGrpcEndpoint(endpoint: string): string {
  const e = endpoint.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(e) ? e : `https://${e}`;
}

export function connectGrpc(endpoint: string, token: string): GrpcClient {
  const Client = resolveCtor();
  return new Client(normalizeGrpcEndpoint(endpoint), token, {
    "grpc.max_receive_message_length": 64 * 1024 * 1024,
    "grpc.keepalive_time_ms": 20_000,
    "grpc.keepalive_timeout_ms": 10_000,
  });
}

export type { SubscribeRequest, SubscribeUpdate };
