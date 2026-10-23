"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef } from "react";

// An iPhone-style scroll wheel: swipe up and down, and whichever row stops in the middle
// band is the value. It's an ordinary scrollable list that snaps one row at a time (CSS
// scroll-snap), so it works with touch, a mouse wheel and the arrow keys.
// (Ported from the owner's DEVELOP app, where it's proven on a real iPhone.)

// Sizes are CSS classes, never inline style="" attributes: the Content Security Policy
// blocks inline styles in production (docs/decisions/0006), and a wheel with no height
// can't scroll. ROW_HEIGHT must match the h-11 (44px) rows below.
const ROW_HEIGHT = 44; // px per row (also a comfortable tap target)

// Per visible-row count: total height, the padding that lets the first and last rows reach
// the middle, the selected band's offset, and the fades. Written out in full so Tailwind
// finds every class.
const LAYOUT = {
  3: { box: "h-[132px]", pad: "py-[44px]", band: "top-[44px]", fade: "h-[31px]" },
  5: { box: "h-[220px]", pad: "py-[88px]", band: "top-[88px]", fade: "h-[62px]" },
} as const;

type Props = {
  label: string; // read by screen readers; shown above the wheel when showLabel
  options: readonly number[];
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  rows?: 3 | 5; // visible rows (the middle one is selected)
  showLabel?: boolean;
};

// One row. memo(): moving the wheel redraws only the two rows whose "selected" changed.
const WheelRow = memo(function WheelRow({
  index,
  text,
  selected,
  onPick,
}: {
  index: number;
  text: string;
  selected: boolean;
  onPick: (index: number) => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => onPick(index)}
      className={`flex h-11 snap-center snap-always items-center justify-center tabular-nums ${
        selected ? "text-[24px] font-semibold" : "text-muted text-[18px]"
      }`}
    >
      {text}
    </div>
  );
});

export function WheelPicker({
  label,
  options,
  value,
  onChange,
  format = String,
  rows = 3,
  showLabel = true,
}: Props) {
  const layout = LAYOUT[rows];
  const scroller = useRef<HTMLDivElement>(null);
  const touched = useRef(false); // the person has used this wheel (touch, mouse wheel, keys)
  const restingIndex = useRef(0); // where the wheel should sit when it positions itself
  const lastEmitted = useRef<number | null>(null); // the value this wheel last reported

  const selectedIndex = Math.max(0, options.indexOf(value));

  // Show the value: scroll there before the screen is drawn (layout effect) whenever it
  // changes from outside. Skipped for changes the wheel just made, so it never fights you.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || lastEmitted.current === value) return;
    restingIndex.current = selectedIndex;
    el.scrollTop = selectedIndex * ROW_HEIGHT;
  }, [value, selectedIndex]);

  // Until the person touches it, keep it there when its size changes (fonts loading,
  // layout settling): an early scroll can be lost while the page is still being laid out.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!touched.current) el.scrollTop = restingIndex.current * ROW_HEIGHT;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const markTouched = () => {
    touched.current = true;
  };

  // Only the person's own scrolling changes the value, never layout or the wheel moving
  // itself. The value follows the middle row live, so what's highlighted is what's saved.
  function handleScroll() {
    const el = scroller.current;
    if (!el || !touched.current) return;
    const index = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ROW_HEIGHT)));
    const picked = options[index];
    if (picked === undefined) return;
    lastEmitted.current = picked;
    if (picked !== value) onChange(picked);
  }

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.min(options.length - 1, Math.max(0, index));
      scroller.current?.scrollTo({ top: clamped * ROW_HEIGHT, behavior: "smooth" });
    },
    [options.length],
  );

  return (
    <div className="min-w-0 flex-1">
      {showLabel && <p className="text-muted mb-1 text-center text-[13px]">{label}</p>}
      <div className={`relative ${layout.box}`}>
        <div
          ref={scroller}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={handleScroll}
          onPointerDown={markTouched}
          onTouchStart={markTouched}
          onWheel={markTouched}
          onKeyDown={(event) => {
            markTouched();
            if (event.key === "ArrowUp") {
              event.preventDefault();
              goTo(selectedIndex - 1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              goTo(selectedIndex + 1);
            }
          }}
          className={`border-border bg-surface h-full snap-y snap-mandatory [scrollbar-width:none] overflow-y-scroll overscroll-contain rounded-2xl border [&::-webkit-scrollbar]:hidden ${layout.pad}`}
        >
          {options.map((option, index) => (
            <WheelRow
              key={option}
              index={index}
              text={format(option)}
              selected={option === value}
              onPick={goTo}
            />
          ))}
        </div>

        {/* The band marking the selected row, and soft fades top and bottom. */}
        <div
          aria-hidden
          className={`border-accent pointer-events-none absolute inset-x-2 h-11 rounded-xl border-y-2 ${layout.band}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-px top-px rounded-t-2xl bg-gradient-to-b from-[var(--surface)] to-transparent ${layout.fade}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-px bottom-px rounded-b-2xl bg-gradient-to-t from-[var(--surface)] to-transparent ${layout.fade}`}
        />
      </div>
    </div>
  );
}
