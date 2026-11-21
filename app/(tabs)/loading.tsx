// Shown instantly while a tab loads, so every tap gets immediate feedback.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading" className="pt-screen mx-auto w-full max-w-md px-4">
      <div className="flex min-h-12 items-center">
        <div className="bg-border h-8 w-32 animate-pulse rounded-lg" />
      </div>
      <div className="bg-surface-2 mt-4 h-28 animate-pulse rounded-xl" />
      <div className="bg-surface-2 mt-4 h-20 animate-pulse rounded-xl" />
    </main>
  );
}
