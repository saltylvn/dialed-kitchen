import Image from "next/image";
import { foodEmoji } from "@/lib/foodEmoji";

// The picture in front of a food's name, in this order: the item's photo (`photo`, its
// address), the emoji the household chose (`custom`), or the one worked out from the name
// (lib/foodEmoji). Decorative: hidden from screen readers, which just read the name.
// Nothing is shown for foods it doesn't recognize.
export function FoodEmoji({
  name,
  custom,
  photo,
}: {
  name: string;
  custom?: string | null;
  photo?: string | null;
}) {
  if (photo) {
    return (
      <Image
        src={photo}
        alt=""
        aria-hidden
        width={96}
        height={96}
        unoptimized // already a small JPEG, and private: served only to its household
        className="mr-1.5 inline-block size-[1.3em] rounded-md object-cover align-[-0.2em]"
      />
    );
  }
  const emoji = custom ?? foodEmoji(name);
  if (!emoji) return null;
  return (
    <span aria-hidden className="mr-1.5 inline-block w-[1.3em] text-center not-italic">
      {emoji}
    </span>
  );
}
