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
      <p className="mt-1 text-muted">Plan it, price it, cook it.</p>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <ul className="mt-2 space-y-2">
          {COMING.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-success">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-semibold text-success-text">🎉 New best price! (sample)</p>
      </section>

      <button
        type="button"
        className="mt-6 min-h-12 w-full rounded-xl bg-accent font-heading font-semibold text-on-accent"
      >
        Sample button
      </button>
    </main>
  );
}
