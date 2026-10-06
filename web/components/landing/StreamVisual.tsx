// The Watch scene as a picture: transactions arriving on a slot timeline, a dropped connection that is
// replayed from the last processed slot, and a duplicate that is dropped by signature.
// Mechanism diagram only, no measured values. Each <g data-row> is revealed in turn by the scroll engine.
const A = "var(--accent)";
const L = "var(--muted)";
const T = "var(--text)";
const D = "var(--danger)";

const BASE = 100;

function Tx({ x, h, kind = "ok" }: { x: number; h: number; kind?: "ok" | "replay" | "dup" }) {
  const dashed = kind !== "ok";
  const color = kind === "dup" ? L : A;
  return (
    <g>
      <path d={`M${x} ${BASE}V${BASE - h}`} stroke={color} strokeDasharray={dashed ? "2 3" : undefined} opacity={kind === "ok" ? 0.9 : 0.8} />
      <circle
        cx={x}
        cy={BASE - h}
        r="4.5"
        fill={kind === "ok" ? A : "var(--bg)"}
        stroke={color}
        strokeDasharray={dashed ? "2 2" : undefined}
      />
    </g>
  );
}

const text = { fontFamily: "var(--font-mono)", fontSize: 11 } as const;

export default function StreamVisual() {
  const ticks = Array.from({ length: 51 }, (_, i) => i * 20);
  return (
    <svg viewBox="0 0 1000 176" className="block h-auto w-full" fill="none" aria-hidden="true">
      <defs>
        <pattern id="gap-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0v7" stroke={L} strokeWidth="1" opacity="0.35" />
        </pattern>
      </defs>

      <g data-row>
        <path d={`M0 ${BASE}H985`} stroke={T} opacity="0.55" />
        <path d="M978 95l8 5-8 5" stroke={T} opacity="0.55" />
        {ticks.map((x, i) => (
          <path key={x} d={`M${x} ${BASE}v${i % 5 === 0 ? 9 : 5}`} stroke={L} opacity={i % 5 === 0 ? 0.7 : 0.4} />
        ))}
        <text x="8" y="22" fill={A} style={text}>
          gRPC stream
        </text>
        <text x="94" y="22" fill={L} style={text}>
          agent wallet + owner token accounts
        </text>
      </g>

      <g data-row>
        {[
          [60, 30],
          [118, 52],
          [176, 36],
          [236, 58],
          [296, 40],
          [356, 48],
        ].map(([x, h]) => (
          <Tx key={x} x={x} h={h} />
        ))}
      </g>

      <g data-row>
        <rect x="396" y="44" width="170" height="70" rx="2" fill="url(#gap-hatch)" stroke={L} strokeDasharray="3 3" opacity="0.9" />
        <text x="481" y="36" textAnchor="middle" fill={L} style={text}>
          connection drops
        </text>
      </g>

      <g data-row>
        <Tx x={430} h={32} kind="replay" />
        <Tx x={481} h={50} kind="replay" />
        <Tx x={532} h={38} kind="replay" />
        <path d="M396 126Q481 168 566 126" stroke={A} />
        <path d="M559 124l8 2-4 8" stroke={A} />
        <text x="481" y="172" textAnchor="middle" fill={A} style={text}>
          resume from last processed slot
        </text>
      </g>

      <g data-row>
        <Tx x={620} h={46} />
        <Tx x={630} h={46} kind="dup" />
        <path d="M625 36l10 10M635 36l-10 10" stroke={D} strokeWidth="1.4" transform="translate(-5 -4)" />
        <text x="640" y="26" textAnchor="middle" fill={L} style={text}>
          same signature, dropped
        </text>
      </g>

      <g data-row>
        {[
          [700, 34],
          [768, 56],
          [836, 40],
          [904, 50],
        ].map(([x, h]) => (
          <Tx key={x} x={x} h={h} />
        ))}
        <text x="985" y="128" textAnchor="end" fill={L} style={text}>
          to policy
        </text>
      </g>
    </svg>
  );
}
