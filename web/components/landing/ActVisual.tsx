// Line diagrams for the four instructions in the panic transaction. Decorative: the card text
// states what each instruction does.
export type ActKind = "nonce" | "limit" | "price" | "revoke";

const A = "var(--accent)";
const L = "var(--muted)";
const T = "var(--text)";

// Rounded so server and browser print identical path data (raw trig output differs in the last digits).
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function ActVisual({ kind }: { kind: ActKind }) {
  return (
    <svg viewBox="0 0 200 110" className="block h-auto w-full" fill="none" aria-hidden="true">
      {kind === "nonce" && (
        <>
          <circle cx="100" cy="55" r="36" stroke={L} opacity="0.5" />
          <circle cx="100" cy="55" r="22" stroke={A} opacity="0.55" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
            const major = i === 0;
            const r1 = major ? 30 : 33;
            return (
              <path
                key={i}
                d={`M${r2(100 + Math.cos(a) * r1)} ${r2(55 + Math.sin(a) * r1)}L${r2(100 + Math.cos(a) * 41)} ${r2(55 + Math.sin(a) * 41)}`}
                stroke={major ? A : L}
                strokeWidth={major ? 1.8 : 1}
                opacity={major ? 1 : 0.6}
              />
            );
          })}
          <path d="M100 55V38" stroke={T} />
          <path d="M100 55l11 7" stroke={A} />
          <circle cx="100" cy="55" r="2.4" fill={A} />
        </>
      )}

      {kind === "limit" && (
        <>
          <rect x="20" y="48" width="160" height="14" rx="2" stroke={L} opacity="0.7" />
          <rect x="21" y="49" width="108" height="12" fill={A} opacity="0.3" />
          {Array.from({ length: 17 }, (_, i) => (
            <path key={i} d={`M${20 + i * 10} 42v${i % 4 === 0 ? 4 : 2}`} stroke={L} opacity="0.6" />
          ))}
          <path d="M130 30v50" stroke={A} strokeWidth="1.4" />
          <path d="M124 30h12M124 80h12" stroke={A} />
        </>
      )}

      {kind === "price" && (
        <>
          {[14, 22, 31, 41, 52, 64, 78].map((h, i) => (
            <rect
              key={h}
              x={28 + i * 21}
              y={92 - h}
              width="12"
              height={h}
              stroke={A}
              fill={A}
              fillOpacity={0.08 + i * 0.07}
              opacity={0.45 + i * 0.09}
            />
          ))}
          <path d="M20 94h160" stroke={L} opacity="0.6" />
        </>
      )}

      {kind === "revoke" && (
        <>
          <rect x="22" y="43" width="24" height="24" stroke={T} opacity="0.8" />
          <path d="M28 52h12M28 58h8" stroke={L} />
          <path d="M46 55H92" stroke={A} />
          <path d="M96 47l8 16M104 47l8 16" stroke={A} strokeWidth="1.4" />
          <path d="M116 55H150" stroke={L} strokeDasharray="3 3" />
          <circle cx="164" cy="55" r="13" stroke={L} strokeDasharray="2 3" />
          <circle cx="164" cy="55" r="3" fill={L} />
        </>
      )}
    </svg>
  );
}
