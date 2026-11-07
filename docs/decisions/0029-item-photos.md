# 0029. A photo per item, stored as a small square in the database

**Status:** Accepted · 2026-11-07

## Context

Decision 0028 lets the household choose an emoji when the name doesn't give one. The owner also wants a picture: some things are clearer as a photo of the actual product, and iPhone keyboard stickers can't go into a web text box. A photo is private household data, so it needs the same protection as every other row. It also shows on every row of the List and Prices views, often over cellular.

## Decision

- **The phone crops and shrinks the photo**: the middle square, 320 × 320 px, JPEG, about 20 KB (`ItemPhotoForm`). That's sharp at icon size on a 3× screen and quick to upload.
- **Stored in the database, in its own table** (`item_photos`: item, household, bytes, `updated_at`), not in Supabase Storage:
  - The same household RLS as everything else, already tested.
  - It disappears with its item (`on delete cascade`), when the household is deleted and when the demo resets. Files in storage would need separate cleanup and could be left behind.
  - Its own table keeps `items` lean: lists read only "which items have a photo, and when it changed".
- **Checked three times:**
  - The phone sends only a small JPEG.
  - The server checks the bytes (starts with `FF D8 FF`, at most 100 KB) and never trusts the file name or the type the browser claims (`checkItemPhoto` in `lib/photos.ts`).
  - The database has the same JPEG and size check, and column grants that only allow setting the item and the photo.
- **Served by the app itself** (`/grocery/items/[id]/photo`), read with the signed-in person's session, so RLS decides who can see it. Because it's same-origin, the strict CSP (decision 0006) needs no new image source.
  - The address carries `?v=<when it changed>`, so the browser can keep it cached for good (`Cache-Control: private, immutable`, never in a shared cache) and still loads a replaced photo.
  - `nosniff` makes the browser treat it only as an image.
- **Shown in place of the emoji** wherever the item's emoji shows (Prices, the item page, the List). Order: photo, then chosen emoji, then the emoji from the name. The **＋** spot on Prices appears only when an item has none of the three.

## Alternatives considered

- **Supabase Storage (private bucket + signed URLs):** the usual home for files, and better for large or many images. It needs its own access policies, cleanup when items or households go away, and the Supabase domain in the CSP's `img-src`. For one ~20 KB thumbnail per item, the database is simpler and safer.
- **Sending the photo inside the page as a `data:` URL:** no extra requests, but every visit would download every photo again, which is slow on cellular for a long price book.
- **Keeping the full-size photo:** nothing uses it, and it would cost upload time and storage.

## Consequences

- An item can look like the actual product on the shelf.
- Each photo is one small, cached request the first time it's seen.
- If photos are ever used for larger images, moving them to Storage would get its own decision.
