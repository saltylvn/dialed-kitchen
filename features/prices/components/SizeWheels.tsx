"use client";

import { useState } from "react";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { defaultSizeUnit, MAX_WHOLE, SIZE_FRACTIONS, sizeAmount } from "@/lib/packageSize";
import { choiceLabel, choicesFor, DIMENSIONS, type Dimension } from "@/lib/units";

// The package size as swipe wheels, like the store and price (docs/decisions/0040): a whole
// number (starts at 1), a kitchen fraction (none, ¼, ⅓, ½, ⅔, ¾: so 1½ lb works) and a unit
// (starts at ounces). The unit wheel offers only the units that fit the item ("By weight",
// "By volume" or "By count"), since a price must be in the same kind of measure as its item.
// The form gets "quantity" ("1.5") and "unit" ("oz", or "half_gal" for ½ gal).

const WHOLE = Array.from({ length: MAX_WHOLE + 1 }, (_, i) => i); // 0–500
const FRACTIONS = SIZE_FRACTIONS.map((_, i) => i);

export function SizeWheels({ dimension }: { dimension: Dimension }) {
  const units = choicesFor(dimension);
  const [whole, setWhole] = useState(1);
  const [fraction, setFraction] = useState(0);
  const [unitIndex, setUnitIndex] = useState(
    Math.max(0, units.indexOf(defaultSizeUnit(dimension))),
  );
  const unitIndexes = units.map((_, i) => i);

  return (
    <div>
      <input type="hidden" name="quantity" value={sizeAmount(whole, fraction)} />
      <input type="hidden" name="unit" value={units[unitIndex] ?? ""} />
      <div className="flex gap-2">
        <div className="w-[27%] shrink-0">
          <WheelPicker
            label="Amount"
            options={WHOLE}
            value={whole}
            onChange={setWhole}
            showLabel={false}
            rows={5}
          />
        </div>
        <div className="w-[22%] shrink-0">
          <WheelPicker
            label="Fraction"
            options={FRACTIONS}
            value={fraction}
            onChange={setFraction}
            format={(i) => SIZE_FRACTIONS[i]?.label ?? ""}
            showLabel={false}
            rows={5}
          />
        </div>
        <div className="min-w-0 flex-1">
          <WheelPicker
            label={`Unit, ${DIMENSIONS[dimension].label.toLowerCase()}`}
            options={unitIndexes}
            value={unitIndex}
            onChange={setUnitIndex}
            format={(i) => {
              const unit = units[i];
              return unit ? choiceLabel(unit) : "";
            }}
            showLabel={false}
            rows={5}
            textSize="words"
          />
        </div>
      </div>
      <p className="text-muted mt-1 text-right text-[13px]">{DIMENSIONS[dimension].label}</p>
    </div>
  );
}
