// Placeholder home page for Milestone 0: shows the name, the colors and fonts in use,
// and what's coming. Replaced by the real tabs in Milestone 1.
const COMING = [
  "Grocery lists with a shopping mode",
  "Best price per item, across every store",
  "Recipes from websites, cookbooks and magazines",
  "Weekly meal planning that builds your list",
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <h1 className="text-3xl font-semibold">Dialed Kitchen</h1>
      <p className="text-muted mt-1">Plan it, price it, cook it.</p>

      <section className="border-border bg-surface mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <ul className="mt-2 space-y-2">
          {COMING.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-success">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-success-text mt-3 font-semibold">🎉 New best price! (sample)</p>
      </section>

      <button
        type="button"
        className="bg-accent font-heading text-on-accent mt-6 min-h-12 w-full rounded-xl font-semibold"
      >
        Sample button
      </button>
    </main>
  );
}
