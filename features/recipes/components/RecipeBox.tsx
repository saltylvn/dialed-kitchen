"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useWakeLock } from "@/components/useWakeLock";
import { rankRecipes, RECENT_WEEKS } from "@/lib/plan";
import { setInStock } from "@/features/stock/actions";
import { addRecipeToList, setFavorite } from "../actions";
import type { RecipeView } from "../queries";
import { SOURCE_TYPES } from "../schema";

// The recipe box: favorites and regulars (planned often lately) first, most planned first,
// then the rest. Tapping a recipe opens it in place with
// everything needed to cook from the phone: ingredients, steps you can tick off as you go,
// a keep-the-screen-on switch, and "Add to grocery list". One recipe is open at a time.
export function RecipeBox({
  recipes,
  initialOpenId,
}: {
  recipes: RecipeView[];
  initialOpenId: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [optimistic, applyFavorite] = useOptimistic(
    recipes,
    (state, change: { id: string; favorite: boolean }) =>
      state.map((r) => (r.id === change.id ? { ...r, favorite: change.favorite } : r)),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleFavorite(id: string, favorite: boolean) {
    setError(null);
    startTransition(async () => {
      applyFavorite({ id, favorite });
      try {
        await setFavorite(id, favorite);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  const { top: favorites, rest: others } = rankRecipes(optimistic);
  const card = (recipe: RecipeView) => (
    <RecipeCard
      key={recipe.id}
      recipe={recipe}
      open={openId === recipe.id}
      onToggle={() => setOpenId((id) => (id === recipe.id ? null : recipe.id))}
      onFavorite={() => toggleFavorite(recipe.id, !recipe.favorite)}
    />
  );

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="font-medium">
          ⚠️ {error}
        </p>
      )}
      <section aria-labelledby="favorites-heading">
        <h2
          id="favorites-heading"
          className="text-muted mb-2 text-[12px] tracking-[0.2em] uppercase"
        >
          ★ Favorites & regulars
        </h2>
        {favorites.length > 0 ? (
          <ul className="space-y-3">{favorites.map(card)}</ul>
        ) : (
          <p className="text-muted text-[15px]">
            Tap ☆ on a recipe you two love to keep it up here. Recipes you plan often join them on
            their own.
          </p>
        )}
      </section>
      {others.length > 0 && (
        <section aria-labelledby="all-heading">
          <h2 id="all-heading" className="text-muted mb-2 text-[12px] tracking-[0.2em] uppercase">
            {favorites.length > 0 ? "More recipes" : "Recipes"}
          </h2>
          <ul className="space-y-3">{others.map(card)}</ul>
        </section>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  open,
  onToggle,
  onFavorite,
}: {
  recipe: RecipeView;
  open: boolean;
  onToggle: () => void;
  onFavorite: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const panelId = `recipe-${recipe.id}`;
  const source =
    recipe.source_type === "own"
      ? null
      : [SOURCE_TYPES[recipe.source_type], recipe.source_name].filter(Boolean).join(": ");

  // Bring an opened recipe to the top of the screen, so it reads from its title down.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  return (
    <li ref={ref} className="border-border bg-surface scroll-mt-4 rounded-2xl border">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium break-words">{recipe.title}</span>
            <span className="text-muted block text-[14px]">
              Serves {recipe.servings}
              {recipe.ingredients.length > 0 && ` · ${recipe.ingredients.length} ingredients`}
              {recipe.timesPlanned > 0 &&
                ` · planned ${recipe.timesPlanned}× in ${RECENT_WEEKS} weeks`}
            </span>
          </span>
          <span
            aria-hidden
            className={`text-muted text-xl transition-transform ${open ? "rotate-90" : ""}`}
          >
            ›
          </span>
        </button>
        <button
          type="button"
          aria-pressed={recipe.favorite}
          aria-label={
            recipe.favorite
              ? `Remove ${recipe.title} from favorites`
              : `Add ${recipe.title} to favorites`
          }
          onClick={onFavorite}
          className={`flex size-12 shrink-0 items-center justify-center text-2xl ${
            recipe.favorite ? "text-accent" : "text-muted"
          }`}
        >
          <span aria-hidden>{recipe.favorite ? "★" : "☆"}</span>
        </button>
      </div>

      {open && (
        <div id={panelId} className="border-border border-t px-4 pt-3 pb-4">
          <RecipeDetail recipe={recipe} source={source} />
        </div>
      )}
    </li>
  );
}

function RecipeDetail({ recipe, source }: { recipe: RecipeView; source: string | null }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const wake = useWakeLock();
  const [adding, startAdding] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  // In stock, updated on tap; the database also takes it off the grocery list.
  const [ingredients, applyStock] = useOptimistic(
    recipe.ingredients,
    (state, change: { id: string; inStock: boolean }) =>
      state.map((i) => (i.id === change.id ? { ...i, inStock: change.inStock } : i)),
  );
  const [, startStock] = useTransition();
  const needed = ingredients.filter((i) => !i.inStock).length;

  function toggleStock(id: string, name: string, inStock: boolean) {
    setAdded(null);
    startStock(async () => {
      applyStock({ id, inStock });
      try {
        await setInStock(name, inStock);
      } catch (e) {
        setAdded(`⚠️ ${e instanceof Error ? e.message : "Couldn't save that."}`);
      }
    });
  }

  function addToList() {
    setAdded(null);
    startAdding(async () => {
      const result = await addRecipeToList(recipe.id);
      setAdded(
        result.ok
          ? result.data.added === 0
            ? "✓ Everything needed is already on your list."
            : `✓ Added ${result.data.added} to your grocery list.`
          : `⚠️ ${result.error}`,
      );
    });
  }

  return (
    <div className="space-y-5">
      {(source || recipe.source_url) && (
        <p className="text-muted text-[15px]">
          {source}
          {recipe.source_url && (
            <>
              {source && " · "}
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info-text underline"
              >
                Original recipe
              </a>
            </>
          )}
        </p>
      )}

      {wake.supported && (
        <label className="border-border flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3">
          <span>Keep screen on while cooking</span>
          <input
            type="checkbox"
            checked={wake.on}
            onChange={(e) => wake.setOn(e.target.checked)}
            className="accent-accent size-5"
          />
        </label>
      )}

      {ingredients.length > 0 && (
        <section aria-label="Ingredients">
          <h3 className="text-muted text-[12px] tracking-[0.2em] uppercase">Ingredients</h3>
          <p className="text-muted mt-1 text-[15px]">
            {needed === 0
              ? "Everything is In stock."
              : `${needed} needed · ${ingredients.length - needed} In stock`}
          </p>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {ingredients.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-1.5">
                <span className={`min-w-0 flex-1 break-words ${i.inStock ? "text-muted" : ""}`}>
                  {i.amount && <span className="font-medium tabular-nums">{i.amount} </span>}
                  {i.name}
                </span>
                <label className="flex min-h-11 shrink-0 items-center gap-2 text-[14px]">
                  <input
                    type="checkbox"
                    checked={i.inStock}
                    onChange={(e) => toggleStock(i.id, i.name, e.target.checked)}
                    aria-label={`${i.name}: In stock`}
                    className="accent-success size-5"
                  />
                  In stock
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section aria-label="Steps">
          <h3 className="text-muted text-[12px] tracking-[0.2em] uppercase">
            Steps · tap when done
          </h3>
          <ol className="mt-2 space-y-2">
            {recipe.steps.map((step, index) => {
              const isDone = done.has(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    aria-pressed={isDone}
                    onClick={() =>
                      setDone((d) => {
                        const next = new Set(d);
                        if (isDone) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                    className="flex w-full gap-3 rounded-xl py-1.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-semibold ${
                        isDone ? "border-success bg-success text-surface" : "border-[var(--muted)]"
                      }`}
                    >
                      {isDone ? "✓" : index + 1}
                    </span>
                    <span
                      className={`min-w-0 flex-1 break-words ${isDone ? "text-muted line-through" : ""}`}
                    >
                      <span className="sr-only">Step {index + 1}: </span>
                      {step}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={addToList}
          disabled={adding || needed === 0}
          className="bg-accent text-on-accent min-h-12 flex-1 rounded-xl font-medium disabled:opacity-60"
        >
          {adding ? "Adding…" : needed === 0 ? "All In stock" : `Add ${needed} needed to list`}
        </button>
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="border-border flex min-h-12 items-center rounded-xl border px-5 font-medium"
        >
          Edit
        </Link>
      </div>
      {added && (
        <p role="status" className="text-[15px] font-medium">
          {added}
        </p>
      )}
    </div>
  );
}
