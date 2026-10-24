import { formatShortDate } from "@/lib/dates";
import { formatUnitPrice } from "@/lib/pricing";
import {
  chartPoints,
  pricesByStore,
  trendSummary,
  type Observation,
  type Trend,
} from "@/lib/priceTrends";
import type { Unit } from "@/lib/units";
import { Tag } from "./BestPriceLine";

// Two cards for an item's price page (docs/decisions/0020): where it's cheapest now, and
// how its price has moved. Server components: plain HTML and SVG, no JavaScript sent.

const card = "border-border bg-surface rounded-2xl border p-4";
const heading = "text-muted text-[12px] tracking-[0.2em] uppercase";

export function StorePrices({
  history,
  stores,
  compareUnit,
  year,
}: {
  history: Observation[];
  stores: { id: string; name: string }[];
  compareUnit: Unit;
  year: number;
}) {
  const rows = pricesByStore(history, stores);
  if (!rows.some((r) => r.latest)) return null;

  return (
    <section aria-labelledby="stores-heading" className={card}>
      <h2 id="stores-heading" className={heading}>
        By store · latest price
      </h2>
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <li key={r.storeId} className="flex min-h-12 items-center gap-3 py-2">
            <span className={`min-w-0 flex-1 ${r.latest ? "" : "text-muted"}`}>
              {r.storeName}
              {r.cheapest && <Tag>✓ Cheapest</Tag>}
              {r.latest?.on_sale && <Tag>Sale</Tag>}
            </span>
            {r.latest ? (
              <span className="text-right">
                <span className={`block tabular-nums ${r.cheapest ? "font-medium" : ""}`}>
                  {formatUnitPrice(r.latest.unit_price_base, compareUnit)}
                </span>
                <span className="text-muted block text-[14px]">
                  {formatShortDate(r.latest.observed_on, year)}
                </span>
              </span>
            ) : (
              <span className="text-muted text-[15px]">No price yet</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const WIDTH = 320;
const HEIGHT = 120;

export function PriceTrend({
  history,
  compareUnit,
  year,
}: {
  history: Observation[];
  compareUnit: Unit;
  year: number;
}) {
  const trend = trendSummary(history);
  if (!trend) return null;
  const points = chartPoints(history, WIDTH, HEIGHT, 10);
  const prices = history.map((p) => p.unit_price_base);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const sentence = describe(trend, year);

  return (
    <section aria-labelledby="trend-heading" className={card}>
      <h2 id="trend-heading" className={heading}>
        Price trend
      </h2>
      {/* Never color alone: an arrow and words say which way it went. */}
      <p className="mt-2 text-[17px] font-medium">{sentence}</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Price over time, from ${formatUnitPrice(low, compareUnit)} to ${formatUnitPrice(high, compareUnit)}. ${sentence}`}
        className="mt-3 h-auto w-full"
      >
        <line
          x1="0"
          y1={HEIGHT - 1}
          x2={WIDTH}
          y2={HEIGHT - 1}
          className="stroke-border"
          strokeWidth="1"
        />
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          className="stroke-accent fill-none"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            className={p.observation.on_sale ? "fill-surface stroke-accent" : "fill-accent"}
            strokeWidth="2"
          />
        ))}
      </svg>
      <p className="text-muted mt-1 flex justify-between text-[14px] tabular-nums">
        <span>Low {formatUnitPrice(low, compareUnit)}</span>
        <span>High {formatUnitPrice(high, compareUnit)}</span>
      </p>
      {history.some((p) => p.on_sale) && (
        <p className="text-muted text-[14px]">Hollow dots are sale prices.</p>
      )}
    </section>
  );
}

function describe(trend: Trend, year: number): string {
  const since = formatShortDate(trend.since, year);
  if (trend.kind === "same") return `→ About the same since ${since}`;
  return trend.kind === "up"
    ? `↑ Up ${trend.percent}% since ${since}`
    : `↓ Down ${trend.percent}% since ${since}`;
}
