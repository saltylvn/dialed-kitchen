import { foodEmoji } from "@/lib/foodEmoji";

// The emoji in front of a food's name (lib/foodEmoji). Decorative: hidden from screen
// readers, which just read the name. Nothing is shown for foods it doesn't recognize.
export function FoodEmoji({ name }: { name: string }) {
  const emoji = foodEmoji(name);
  if (!emoji) return null;
  return (
    <span aria-hidden className="mr-1.5 inline-block w-[1.3em] text-center not-italic">
      {emoji}
    </span>
  );
}
