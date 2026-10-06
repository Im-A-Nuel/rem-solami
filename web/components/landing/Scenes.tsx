import Link from "next/link";
import { Words } from "./Words";

const REPO = "https://github.com/Im-A-Nuel/rem-solami";

const h2 = "display text-[clamp(2.2rem,min(5.4vw,9.2vh),4.9rem)]";
const body = "text-[0.95rem] leading-7 text-muted";
const pad = "px-5 sm:px-10 md:px-[8vw]";

function Scrim({ side }: { side: "left" | "right" | "center" }) {
  const dir =
    side === "left" ? "to right" : side === "right" ? "to left" : "to bottom";
  const stops =
    side === "center"
      ? "rgba(5,8,13,0.55), rgba(5,8,13,0.55)"
      : "rgba(5,8,13,0.78), rgba(5,8,13,0.4) 55%, rgba(5,8,13,0)";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ background: `linear-gradient(${dir}, ${stops})` }}
    />
  );
}

function ChapterTag({ n, name }: { n: string; name: string }) {
  return (
    <p className="label mb-5 flex items-center gap-3" data-fade>
      <span className="mono !tracking-[0.12em] text-accent">{n}</span>
      <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
      {name}
    </p>
  );
}

export function Hero() {
  return (
    <section id="top" data-scene data-hero className="scene">
      <Scrim side="left" />
      <div
        data-content
        className={`relative z-10 flex min-h-[100svh] items-end pb-24 sm:items-center sm:pb-0 ${pad}`}
      >
        <div className="flex gap-8">
          <span aria-hidden="true" data-fade className="hidden w-px self-stretch bg-line-strong sm:block" />
          <div className="max-w-[40rem] sm:py-20">
            <p className="label" data-fade>
              Emergency brake for AI agent wallets
            </p>
            <h1 className="display mt-5 text-[clamp(2.9rem,min(7.6vw,13vh),6.8rem)]">
              <Words text="Stop the agent before its *next* transaction." />
            </h1>
            <p className={`${body} mt-7 max-w-md`} data-fade>
              Rem streams your agent&apos;s wallet activity over Solami and lands a revoke you signed in advance the
              moment a policy breaks. It never holds your keys.
            </p>
            <div className="mt-9 flex flex-wrap gap-3" data-fade>
              <a href="#watch" className="btn">
                See how it stops an agent
              </a>
              <Link href="/console" className="btn btn-quiet">
                Open the console
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Watch() {
  return (
    <section id="watch" data-scene data-chapter="01" data-name="Watch" className="scene">
      <Scrim side="left" />
      <div data-content className={`relative z-10 flex min-h-[100svh] items-center ${pad}`}>
        <div className="max-w-[36rem] py-20">
          <ChapterTag n="01" name="Watch" />
          <h2 className={h2}>
            <Words text="Every transaction, the *moment* it lands." />
          </h2>
          <p className={`${body} mt-6`} data-fade>
            Rem subscribes to Solami Yellowstone gRPC with filters on the agent wallet and the owner&apos;s token
            accounts. After a disconnect it resumes from the last processed slot and drops duplicates by signature.
          </p>
          <dl className="mono mt-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.78rem]">
            {[
              ["source", "Solami Yellowstone gRPC"],
              ["filter", "agent wallet + owner token accounts"],
              ["resume", "from_slot = last processed slot"],
              ["dedupe", "by transaction signature"],
            ].map(([k, v]) => (
              <div key={k} className="contents" data-row>
                <dt className="text-accent">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

const rules = [
  ["allow_destinations", "A delegated transfer to any address outside the list."],
  ["max_out_per_minute", "Outflow above the limit in a rolling 60 second window."],
  ["max_tx_per_10s", "More agent transactions than allowed in a rolling 10 second window."],
  ["allow_programs", "Any transaction that invokes a program outside the list."],
];

export function Decide() {
  return (
    <section id="decide" data-scene data-chapter="02" data-name="Decide" className="scene">
      <div data-content className="relative z-10 grid min-h-[100svh] md:grid-cols-2">
        <div className={`relative flex items-center ${pad} md:pr-10`}>
          <Scrim side="left" />
          <div className="relative max-w-[30rem] py-20">
            <ChapterTag n="02" name="Decide" />
            <h2 className={h2}>
              <Words text="Four rules. No network call." />
            </h2>
            <p className={`${body} mt-6`} data-fade>
              Policy is a pure function over the event and the agent&apos;s rolling state, evaluated in memory on the
              receive path. Nothing is fetched between seeing a transaction and deciding about it.
            </p>
          </div>
        </div>
        <div
          data-wipe
          className="relative flex items-center border-l border-line bg-surface/90 px-5 py-20 sm:px-10 md:px-14"
        >
          <div className="w-full max-w-xl">
            <p className="label mb-6">Rules per agent, from rem.yaml</p>
            <ul>
              {rules.map(([name, text]) => (
                <li key={name} data-row className="border-t border-line py-4">
                  <p className="mono text-[0.88rem] text-accent">{name}</p>
                  <p className="mt-1 text-[0.9rem] text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <p className="mono mt-4 border-t border-line pt-4 text-[0.74rem] leading-6 text-muted" data-row>
              target: under 5 ms per event
              <br />
              measured: not yet recorded
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const panic = [
  ["1", "System", "AdvanceNonceAccount", "nonce account"],
  ["2", "ComputeBudget", "SetComputeUnitLimit", ""],
  ["3", "ComputeBudget", "SetComputeUnitPrice", ""],
  ["4", "SPL Token", "Revoke", "each watched token account"],
];

export function Act() {
  return (
    <section id="act" data-scene data-chapter="03" data-name="Act" className="scene">
      <Scrim side="right" />
      <div data-content className={`relative z-10 flex min-h-[100svh] items-center md:justify-end ${pad}`}>
        <div className="w-full max-w-[34rem] py-20">
          <ChapterTag n="03" name="Act" />
          <h2 className={h2}>
            <Words text="One transaction, signed once, in *advance*." />
          </h2>
          <p className={`${body} mt-6`} data-fade>
            The owner signs offline with a durable nonce. At incident time Rem adds only its fee-payer signature and
            sends through Solami Beam and a fallback RPC in parallel, then records which one lands first.
          </p>
          <ol className="mono mt-8 text-[0.8rem]" aria-label="Instructions in the panic transaction">
            {panic.map(([n, program, ix, account], i) => (
              <li
                key={n}
                data-row
                className={`grid grid-cols-[1.4rem_6.4rem_1fr] items-baseline gap-x-3 border-t border-line py-3 ${i === 0 ? "text-accent" : "text-text"}`}
              >
                <span className="text-muted">{n}</span>
                <span className="text-muted">{program}</span>
                <span>
                  {ix}
                  {account && <span className="block text-[0.7rem] text-muted">{account}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-line pt-4 text-[0.82rem] text-muted" data-row>
            Anything else in this transaction is rejected by <span className="mono text-text">nonce.Validate</span>.
          </p>
        </div>
      </div>
    </section>
  );
}

const proof = [
  ["Demo agent wallet", "Explorer link"],
  ["Leaked transaction (the first and only)", "Explorer link"],
  ["Revoke transaction (the panic tx)", "Explorer link"],
  ["Agent transaction that failed after revoke", "Explorer link"],
  ["Landing latency, Beam", "p50 / p95, n = ?"],
  ["Landing latency, RPC", "p50 / p95, n = ?"],
];

export function Proof() {
  return (
    <section id="proof" data-scene data-chapter="04" data-name="Proof" className="scene">
      <Scrim side="left" />
      <div data-content className={`relative z-10 flex min-h-[100svh] items-center ${pad}`}>
        <div className="w-full max-w-[44rem] py-20">
          <ChapterTag n="04" name="Proof" />
          <h2 className={h2}>
            <Words text="Mainnet proof, *pending*." />
          </h2>
          <p className={`${body} mt-6 max-w-lg`} data-fade>
            The mainnet run happens before the Solami deadline, 13 Oct 2026, 13:59 WIB. These rows fill with explorer
            links and measured latency, reported as p50 and p95 with the sample size, never the best run.
          </p>
          <ul className="mt-8 text-[0.88rem]">
            {proof.map(([k, v]) => (
              <li
                key={k}
                data-row
                className="grid grid-cols-1 gap-1 border-t border-line py-3 sm:grid-cols-[1fr_auto] sm:gap-6"
              >
                <span>{k}</span>
                <span className="mono text-[0.74rem] text-muted">[REAL DATA] {v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const threats = [
  [
    "The panic transaction leaks",
    "It holds only advance nonce, revoke and compute budget. The agent stops. Nothing moves.",
  ],
  [
    "The Rem server is breached",
    "An attacker can send the revoke and spend the fee payer's small SOL balance. No key can move your funds.",
  ],
  ["You change your mind", "Advance the nonce yourself and every transaction signed with it is dead."],
  [
    "The first bad transaction lands before detection",
    "That one is already on-chain. The loss is capped by the allowance, so keep the allowance small.",
  ],
];

export function Threat() {
  return (
    <section id="threat" data-scene data-chapter="05" data-name="Threat model" className="scene">
      <Scrim side="center" />
      <div data-content className={`relative z-10 flex min-h-[100svh] items-center ${pad}`}>
        <div className="w-full py-20">
          <ChapterTag n="05" name="Threat model" />
          <h2 className={`${h2} max-w-3xl`}>
            <Words text="Worst case: your agent *stops*." />
          </h2>
          <ul className="mt-9 max-w-5xl">
            {threats.map(([t, o]) => (
              <li
                key={t}
                data-row
                className="grid gap-2 border-t border-line py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-12"
              >
                <p className="display text-[clamp(1.25rem,2.1vw,1.7rem)] leading-tight">{t}</p>
                <p className="text-[0.88rem] leading-6 text-muted">{o}</p>
              </li>
            ))}
          </ul>
          <a
            href={`${REPO}/blob/main/docs/ARCHITECTURE.md#threat-model`}
            className="btn mt-8"
            target="_blank"
            rel="noreferrer"
            data-fade
          >
            Read the full threat model
          </a>
        </div>
      </div>
    </section>
  );
}

export function Close() {
  return (
    <section id="close" data-scene data-name="Close" className="scene">
      <Scrim side="center" />
      <div data-content className={`relative z-10 flex min-h-[100svh] flex-col justify-center ${pad}`}>
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="display text-[clamp(2.7rem,min(8vw,13vh),7.4rem)]">
            <Words text="Rem only ever stops your *agent*." />
          </h2>
          <p className={`${body} mx-auto mt-7 max-w-md`} data-fade>
            No custody, no keys, one signed transaction. Run the console on sample data, or read how it is built.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3" data-fade>
            <Link href="/console" className="btn">
              Open the console
            </Link>
            <a href={REPO} className="btn btn-quiet" target="_blank" rel="noreferrer">
              Read the source
            </a>
          </div>
        </div>
        <footer className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-6 text-[0.72rem] text-muted sm:px-10">
          <span>Rem. Built for the Solami sidetrack, 13 Oct 2026.</span>
          <span className="flex gap-6">
            <a href={REPO} target="_blank" rel="noreferrer" className="py-2 hover:text-text">
              GitHub
            </a>
            <a href={`${REPO}/tree/main/docs`} target="_blank" rel="noreferrer" className="py-2 hover:text-text">
              Docs
            </a>
          </span>
        </footer>
      </div>
    </section>
  );
}
