import Link from "next/link";
import ActVisual, { type ActKind } from "./ActVisual";
import RuleIcon, { type RuleKind } from "./RuleIcons";
import StreamVisual from "./StreamVisual";
import ThreatVisual, { type ThreatKind } from "./ThreatVisual";
import { Words } from "./Words";

const REPO = "https://github.com/Im-A-Nuel/rem-solami";

const h2 = "display text-[clamp(1.9rem,min(4.3vw,7.6vh),3.9rem)]";
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
  // Large outlined numeral so the chapter reads from across the room, with the name on a rule.
  return (
    <p className="mb-5 flex items-end gap-5" data-fade>
      <span
        aria-hidden="true"
        className="display mono text-[clamp(2.4rem,min(5vw,8vh),4.4rem)] font-extralight leading-[0.8] tracking-tight text-transparent [-webkit-text-stroke:1px_var(--accent)]"
      >
        {n}
      </span>
      <span className="flex max-w-[16rem] flex-1 items-center gap-4 pb-1">
        <span aria-hidden="true" className="h-px flex-1 bg-line-strong" />
        <span className="label !text-[0.82rem] !text-text">
          <span className="sr-only">Chapter {n}: </span>
          {name}
        </span>
      </span>
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
            <h1 className="display mt-5 text-[clamp(2.3rem,min(5.9vw,10.5vh),5.4rem)]">
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
      <div data-content className={`relative z-10 flex min-h-[100svh] flex-col justify-center ${pad}`}>
        <div className="py-16">
          <div className="max-w-[46rem]">
            <ChapterTag n="01" name="Watch" />
            <h2 className={h2}>
              <Words text="Every transaction, the *moment* it lands." />
            </h2>
            <p className={`${body} mt-5 max-w-xl`} data-fade>
              Rem subscribes to Solami Yellowstone gRPC with filters on the agent wallet and the owner&apos;s token
              accounts. After a disconnect it resumes from the last processed slot and drops duplicates by signature.
            </p>
          </div>
          <div className="mt-8 max-w-6xl">
            <StreamVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

const rules: {
  kind: RuleKind;
  title: string;
  tagline: string;
  text: string;
  key: string;
  unit: string;
}[] = [
  {
    kind: "destinations",
    title: "Destinations",
    tagline: "Who gets paid",
    text: "A delegated transfer to any address outside the list breaks the rule.",
    key: "allow_destinations",
    unit: "pubkeys",
  },
  {
    kind: "spend",
    title: "Spend rate",
    tagline: "How much leaves",
    text: "Outflow above the limit in a rolling 60 second window.",
    key: "max_out_per_minute",
    unit: "base units",
  },
  {
    kind: "burst",
    title: "Burst",
    tagline: "How often",
    text: "More agent transactions than allowed in a rolling 10 second window.",
    key: "max_tx_per_10s",
    unit: "count",
  },
  {
    kind: "programs",
    title: "Programs",
    tagline: "What it calls",
    text: "Any transaction that invokes a program outside the list.",
    key: "allow_programs",
    unit: "program ids",
  },
];

export function Decide() {
  return (
    <section id="decide" data-scene data-chapter="02" data-name="Decide" className="scene">
      <Scrim side="center" />
      <div data-content className={`relative z-10 flex min-h-[100svh] flex-col justify-center ${pad}`}>
        <div className="py-20">
          <div className="grid gap-x-14 gap-y-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-end">
            <div>
              <ChapterTag n="02" name="Decide" />
              <h2 className={h2}>
                <Words text="Four rules. No network call." />
              </h2>
            </div>
            <p className={`${body} max-w-md`} data-fade>
              Policy is a pure function over the event and the agent&apos;s rolling state, evaluated in memory on the
              receive path. Nothing is fetched between seeing a transaction and deciding about it.
            </p>
          </div>

          <ul className="mt-9 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 md:grid-cols-4">
            {rules.map((r) => (
              <li
                key={r.key}
                data-row
                className="rule-card relative flex min-h-[15rem] flex-col justify-between rounded-[0.9rem] p-4 md:h-[min(20rem,38vh)] md:min-h-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-text/80">
                    <RuleIcon kind={r.kind} />
                  </span>
                  <span className="max-w-[5.5rem] text-right text-[0.6rem] uppercase leading-[1.5] tracking-[0.2em] text-muted">
                    {r.tagline}
                  </span>
                </div>

                <h3 className="display text-center text-[clamp(1.05rem,1.75vw,1.55rem)] uppercase tracking-[0.06em]">
                  {r.title}
                </h3>

                <div>
                  <p className="text-[0.78rem] leading-[1.55] text-muted">{r.text}</p>
                  <p className="mt-3 flex flex-wrap justify-end gap-1.5">
                    <span className="mono rounded-full border border-accent/40 px-2.5 py-1 text-[0.6rem] text-accent">
                      {r.key}
                    </span>
                    <span className="mono rounded-full border border-line-strong px-2.5 py-1 text-[0.6rem] text-muted">
                      {r.unit}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mono mt-5 text-[0.74rem] leading-6 text-muted" data-row>
            target: under 5 ms per event
            <span aria-hidden="true" className="mx-3 text-line-strong">
              |
            </span>
            measured: not yet recorded
          </p>
        </div>
      </div>
    </section>
  );
}

const panic: {
  n: string;
  kind: ActKind;
  program: string;
  title: string;
  tagline: string;
  text: string;
}[] = [
  {
    n: "01",
    kind: "nonce",
    program: "System",
    title: "AdvanceNonceAccount",
    tagline: "Always first",
    text: "Advances the durable nonce. Once it lands, the same transaction cannot be sent again.",
  },
  {
    n: "02",
    kind: "limit",
    program: "ComputeBudget",
    title: "SetComputeUnitLimit",
    tagline: "Caps the compute",
    text: "Sets the compute limit the transaction runs under.",
  },
  {
    n: "03",
    kind: "price",
    program: "ComputeBudget",
    title: "SetComputeUnitPrice",
    tagline: "Pays for priority",
    text: "A high fixed priority fee, chosen at signing time, because an incident justifies overpaying.",
  },
  {
    n: "04",
    kind: "revoke",
    program: "SPL Token",
    title: "Revoke",
    tagline: "Cuts the delegate",
    text: "Clears the agent's delegate on each watched token account.",
  },
];

export function Act() {
  return (
    <section id="act" data-scene data-chapter="03" data-name="Act" className="scene">
      <Scrim side="center" />
      <div data-content className={`relative z-10 flex min-h-[100svh] flex-col justify-center ${pad}`}>
        <div className="py-16">
          <div className="grid gap-x-14 gap-y-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end">
            <div>
              <ChapterTag n="03" name="Act" />
              <h2 className={h2}>
                <Words text="One transaction, signed once, in *advance*." />
              </h2>
            </div>
            <p className={`${body} max-w-md md:justify-self-end`} data-fade>
              The owner signs offline with a durable nonce. At incident time Rem adds only its fee-payer signature and
              sends through Solami Beam and a fallback RPC in parallel, then records which one lands first.
            </p>
          </div>

          <ol
            aria-label="Instructions in the panic transaction"
            className="mt-8 grid grid-cols-1 items-center gap-4 min-[520px]:grid-cols-2 md:grid-cols-4"
          >
            {panic.map((p, i) => (
              <li
                key={p.title}
                data-row
                className={`rule-card relative flex min-h-[16rem] flex-col justify-between overflow-hidden rounded-[0.9rem] p-4 ${
                  i % 2 === 1 ? "md:h-[min(22rem,41vh)]" : "md:h-[min(18.5rem,35vh)]"
                } md:min-h-0`}
              >
                <div>
                  <p className="mono flex items-baseline justify-between text-[0.66rem] text-muted">
                    <span className={i === 0 ? "text-accent" : ""}>{p.n}</span>
                    <span>{p.program}</span>
                  </p>
                  <h3 className="mono mt-2 break-words text-[clamp(0.85rem,1.15vw,1.02rem)] leading-snug text-text">
                    {p.title}
                  </h3>
                </div>

                <div className="px-1 opacity-90">
                  <ActVisual kind={p.kind} />
                </div>

                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.2em] text-accent">{p.tagline}</p>
                  <p className="mt-1.5 text-[0.78rem] leading-[1.5] text-muted">{p.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 text-[0.82rem] text-muted" data-row>
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

const threats: { kind: ThreatKind; title: string; outcome: string }[] = [
  {
    kind: "leak",
    title: "The panic transaction leaks",
    outcome: "It holds only advance nonce, revoke and compute budget. The agent stops. Nothing moves.",
  },
  {
    kind: "breach",
    title: "The Rem server is breached",
    outcome:
      "An attacker can send the revoke and spend the fee payer's small SOL balance. No key can move your funds.",
  },
  {
    kind: "cancel",
    title: "You change your mind",
    outcome: "Advance the nonce yourself and every transaction signed with it is dead.",
  },
  {
    kind: "cap",
    title: "The first bad transaction lands before detection",
    outcome: "That one is already on-chain. The loss is capped by the allowance, so keep the allowance small.",
  },
];

export function Threat() {
  return (
    <section id="threat" data-scene data-chapter="05" data-name="Threat model" className="scene">
      <Scrim side="center" />
      <div data-content className={`relative z-10 flex min-h-[100svh] items-center ${pad}`}>
        <div className="w-full py-20">
          <ChapterTag n="05" name="Threat model" />
          <h2 className={h2}>
            <Words text="Worst case: your agent *stops*." />
          </h2>
          <ul className="mt-6 max-w-5xl">
            {threats.map((t) => (
              <li
                key={t.kind}
                data-row
                className="grid items-center gap-x-8 gap-y-3 border-t border-line py-2.5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.25fr)]"
              >
                <div className="w-44 border border-line bg-surface/60 p-1.5 md:w-[min(12rem,19vh)]">
                  <ThreatVisual kind={t.kind} />
                </div>
                <p className="display text-[clamp(1.05rem,1.6vw,1.3rem)] leading-snug">{t.title}</p>
                <p className="text-[0.88rem] leading-6 text-muted">{t.outcome}</p>
              </li>
            ))}
          </ul>
          <a
            href={`${REPO}/blob/main/docs/ARCHITECTURE.md#threat-model`}
            className="btn mt-6"
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
          <h2 className="display text-[clamp(2.2rem,min(6.3vw,10.5vh),5.8rem)]">
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
