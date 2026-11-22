# 0058. Grooming and Cleaning sections for non-food things

**Status:** Accepted · 2026-11-21 · Extends the store sections of 0027 and the food emojis of 0023

## Context

Razors, toothpaste, soap, lotion, dish soap and paper towels go on the same grocery list as food, but they all fell into "Other", far from each other in the store and in the list.

## Decision

- Two new sections after Snacks & drinks: **Grooming** 🪒 (razors, shaving cream, toothpaste, toothbrushes, floss, mouthwash, soap, body wash, lotion, shampoo, conditioner, deodorant, sunscreen, lip balm) and **Cleaning** 🧽 (dish soap, dishwasher pods, cleaners, wipes, sponges, bleach, laundry detergent, fabric softener, dryer sheets, paper towels, toilet paper, tissues, napkins, trash bags, brooms, mops).
- They're worked out from the name, like every section, so nothing is stored. Adding "Razors" files it under Grooming with 🪒 at once, on the list, In stock and in the price book.
- Two-word phrases settle the tricky ones: "shaving cream" is grooming, not dairy, and "dish soap" is cleaning, while "hand soap" is grooming.

## Alternatives considered

- **Pick a section by hand when adding an item.** More control, but it adds a step to every add, and the name already says what it is. An item whose name isn't recognized still lands in Other.
- **One "Household" section.** Simpler, but toiletries and cleaning supplies sit in different aisles.

## Consequences

- The word lists in `lib/foodEmoji.ts` now include non-food words. They're tested, and the "last word wins" rule still holds ("sponge cake" is cake).
- Things like foil and plastic wrap stay in Other until they get their own words.
