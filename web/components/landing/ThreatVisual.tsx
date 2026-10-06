// Small line diagrams for the threat model rows. Decorative: the row text carries the meaning.
// Red marks the attacker, accent marks what Rem protects, grey is neutral structure.
type Kind = "leak" | "breach" | "cancel" | "cap";

const L = "var(--muted)";
const T = "var(--text)";
const A = "var(--accent)";
const D = "var(--danger)";

function Arrow({ x1, x2, y, color = L, dashed = false }: { x1: number; x2: number; y: number; color?: string; dashed?: boolean }) {
  return (
    <g stroke={color} strokeWidth="1" fill="none">
      <path d={`M${x1} ${y}H${x2}`} strokeDasharray={dashed ? "3 3" : undefined} />
      <path d={`M${x2 - 5} ${y - 4}L${x2} ${y}L${x2 - 5} ${y + 4}`} />
    </g>
  );
}

function Doc({ x, y, strike = false }: { x: number; y: number; strike?: boolean }) {
  return (
    <g fill="none" strokeWidth="1">
      <rect x={x} y={y} width="30" height="46" rx="2" stroke={T} opacity="0.85" />
      <path d={`M${x + 6} ${y + 12}h18M${x + 6} ${y + 34}h18`} stroke={A} />
      <path d={`M${x + 6} ${y + 20}h18M${x + 6} ${y + 27}h12`} stroke={L} />
      {strike && <path d={`M${x - 4} ${y + 50}L${x + 34} ${y - 4}`} stroke={D} strokeWidth="1.5" />}
    </g>
  );
}

export default function ThreatVisual({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 176 80" className="block h-auto w-full" fill="none" aria-hidden="true">
      {kind === "leak" && (
        <>
          <Doc x={8} y={17} />
          <Arrow x1={44} x2={76} y={40} dashed />
          <circle cx="90" cy="40" r="10" stroke={D} opacity="0.45" />
          <circle cx="90" cy="40" r="5" fill={D} />
          <path d="M100 40H128" stroke={L} />
          <circle cx="146" cy="40" r="16" stroke={A} strokeDasharray="2 3" />
          <rect x="140.5" y="32" width="3.5" height="16" fill={A} />
          <rect x="148" y="32" width="3.5" height="16" fill={A} />
        </>
      )}

      {kind === "breach" && (
        <>
          <rect x="8" y="14" width="42" height="52" stroke={T} opacity="0.85" />
          <path d="M16 28h26M16 40h26M16 52h26" stroke={L} />
          <circle cx="43" cy="21" r="2.6" fill={D} />
          <Arrow x1={56} x2={84} y={28} />
          <circle cx="98" cy="28" r="10" stroke={A} />
          <path d="M93 28h10" stroke={A} />
          <path d="M56 54H96" stroke={L} strokeDasharray="3 3" />
          <path d="M98 49l10 10M108 49L98 59" stroke={D} strokeWidth="1.5" />
          <rect x="124" y="36" width="44" height="32" stroke={T} opacity="0.85" />
          <circle cx="146" cy="49" r="4" stroke={L} />
          <path d="M146 53v8" stroke={L} />
        </>
      )}

      {kind === "cancel" && (
        <>
          <rect x="8" y="16" width="46" height="48" stroke={L} />
          <Doc x={16} y={17} strike />
          <Arrow x1={62} x2={96} y={40} />
          <rect x="104" y="16" width="46" height="48" stroke={A} />
          <path d="M116 42l9 9 15-19" stroke={A} strokeWidth="1.6" />
        </>
      )}

      {kind === "cap" && (
        <>
          <rect x="8" y="42" width="160" height="16" rx="2" stroke={L} />
          <rect x="29" y="43" width="138" height="14" fill={A} opacity="0.14" />
          <rect x="9" y="43" width="20" height="14" fill={D} opacity="0.9" />
          <path d="M19 10v26" stroke={D} />
          <path d="M14 31l5 5 5-5" stroke={D} />
          {[56, 82, 108, 134].map((x) => (
            <g key={x} stroke={L}>
              <path d={`M${x} 10v16`} strokeDasharray="3 3" />
              <path d={`M${x - 5} 28h10`} />
            </g>
          ))}
          <path d="M29 36v30" stroke={T} strokeDasharray="2 3" />
          <path d="M9 70h20M9 66v8M29 66v8" stroke={T} />
        </>
      )}
    </svg>
  );
}

export type { Kind as ThreatKind };
