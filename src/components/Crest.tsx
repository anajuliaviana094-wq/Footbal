import type { CrestSpec } from "@/seed/generate";

const SHAPES: Record<CrestSpec["shape"], string> = {
  shield: "M50 4 L92 16 L92 52 C92 76 72 92 50 98 C28 92 8 76 8 52 L8 16 Z",
  circle: "M50 4 A46 46 0 1 1 49.9 4 Z",
  diamond: "M50 3 L96 50 L50 97 L4 50 Z",
  hex: "M50 3 L91 26 L91 74 L50 97 L9 74 L9 26 Z",
  badge: "M14 6 L86 6 L92 30 L86 86 L50 98 L14 86 L8 30 Z",
};

/** Escudo procedural em SVG: forma + padrão + cores + iniciais. */
export function Crest({ crest, size = 40, className = "" }: { crest: CrestSpec; size?: number; className?: string }) {
  const id = `c${crest.initials}${crest.primary.slice(1)}${crest.shape}${crest.pattern}`.replace(/[^a-zA-Z0-9]/g, "");
  const p = crest.primary;
  const s = crest.secondary;
  const light = isLight(p);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <defs>
        <clipPath id={id}>
          <path d={SHAPES[crest.shape]} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="100" fill={p} />
        {crest.pattern === "stripes" && [18, 42, 66].map((x) => <rect key={x} x={x} width="12" height="100" fill={s} />)}
        {crest.pattern === "hoops" && [22, 48, 74].map((y) => <rect key={y} y={y} width="100" height="11" fill={s} />)}
        {crest.pattern === "half" && <rect x="50" width="50" height="100" fill={s} />}
        {crest.pattern === "band" && <path d="M-10 70 L70 -10 L95 -10 L-10 95 Z" fill={s} />}
        {crest.pattern === "chevron" && <path d="M0 30 L50 62 L100 30 L100 48 L50 80 L0 48 Z" fill={s} />}
        {crest.pattern === "cross" && (
          <>
            <rect x="40" width="20" height="100" fill={s} />
            <rect y="40" width="100" height="20" fill={s} />
          </>
        )}
        <circle cx="50" cy="52" r="23" fill={p} stroke={s} strokeWidth="4" />
      </g>
      <path d={SHAPES[crest.shape]} fill="none" stroke={light ? "#0b1220" : "#ffffff"} strokeOpacity="0.55" strokeWidth="4" />
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        fill={light ? "#0b1220" : "#ffffff"}
      >
        {crest.initials}
      </text>
      {crest.star && <path d="M50 8 l3 7 7 .5 -5.5 4.5 2 7 -6.5 -4 -6.5 4 2 -7 -5.5 -4.5 7 -.5z" fill="#ffd23f" />}
    </svg>
  );
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
