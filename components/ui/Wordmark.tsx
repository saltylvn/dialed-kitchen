// The Dialed Kitchen logo: pure type, no symbol. "DIALED" in medium, widely spaced
// capitals with a smaller, wider-spaced "KITCHEN" (in the mono font) beneath. (docs/decisions/0008, 0050)
//
// Letter-spacing adds space after the last letter too, which pushes centered text left;
// the matching negative right margin cancels it so each word sits truly centered.

const SIZES = {
  lg: { name: "text-[30px] tracking-[0.3em] -mr-[0.3em]", sub: "text-[11px] mt-1.5" },
  sm: { name: "text-[17px] tracking-[0.28em] -mr-[0.28em]", sub: "text-[8px] mt-0.5" },
} as const;

export function Wordmark({ size = "lg" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className="inline-flex flex-col items-center leading-none">
      {/* What screen readers say; the spaced-out letters below are visual only. */}
      <span className="sr-only">Dialed Kitchen</span>
      <span aria-hidden className={`font-medium ${s.name}`}>
        DIALED
      </span>
      <span aria-hidden className={`text-muted -mr-[0.6em] font-mono tracking-[0.6em] ${s.sub}`}>
        KITCHEN
      </span>
    </span>
  );
}
