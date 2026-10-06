// 20px line icons for the four policy rules. Decorative: each card also states the rule in text.
export type RuleKind = "destinations" | "spend" | "burst" | "programs";

export default function RuleIcon({ kind }: { kind: RuleKind }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "destinations" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2.2" />
          <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" />
        </>
      )}
      {kind === "spend" && (
        <>
          <path d="M3 16h14" />
          <path d="M5 13V9M9 13V5M13 13v-6" />
          <path d="M14.5 3.5 17 6l-2.5 2.5" />
        </>
      )}
      {kind === "burst" && (
        <path d="M2 10h3l2-6 3 12 2.5-9L14 10h4" />
      )}
      {kind === "programs" && (
        <>
          <rect x="4" y="4" width="12" height="12" rx="1.5" />
          <path d="M8 8.5 6.5 10 8 11.5M12 8.5l1.5 1.5-1.5 1.5" />
          <path d="M7 1.5v2.5M13 1.5v2.5M7 16v2.5M13 16v2.5" />
        </>
      )}
    </svg>
  );
}
