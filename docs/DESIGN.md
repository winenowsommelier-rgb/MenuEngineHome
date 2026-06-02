# MenuEngine — Product & Experience Design

> From a dinner picker to a **monthly, 3-meals-a-day family meal operating
> system**: plan the month, right-size every pot so there's almost no
> leftover, let each person veto what they don't like a week ahead, and hand
> the cook an exact shopping list.

---

## 1. Who uses it (roles)

| Role | Who | Can do |
|------|-----|--------|
| **Member** | Each family person, via a short **code** (GGM, D, M, N1…N7, L) | See the upcoming week, tap 👎 on meals they don't want, leave a quick reason |
| **Admin** | You | Generate/edit the month, review everyone's votes, finalize each week, release the shopping list |
| **Cook** | Household cook | Read the finalized day: dishes, **exact quantities to cook**, and the week's shopping list |

No passwords. Members identify by tapping their **code**; the admin link is a
separate unguessable URL.

---

## 2. The weekly cycle (published 1 week ahead)

```
  T‑7        T‑6 ─ T‑3            T‑3 ─ T‑2          T‑2              cook day
  │           │                    │                 │                  │
GENERATE → PUBLISH week →  MEMBERS REVIEW  →  ADMIN FINALIZE → PORTION+SHOP → COOK
  │           │                    │                 │                  │
month of   links sent      each member taps     admin sees vote     auto portions
3‑meal     to members      👎 on disliked       heatmap, swaps      + shopping list
drafts                     meals (+reason)      dishes, locks       sent to cook
```

1. **Generate** — MenuEngine drafts a month of breakfast/lunch/dinner from the
   family taste profile + each member's health constraints.
2. **Publish** — the upcoming week opens for review; a link goes to each member.
3. **Members review** (open window ~T‑7 → T‑3) — tap 👎 on any meal, optional
   reason chip ("too spicy", "had it recently", "don't like X").
4. **Admin finalize** (T‑3 → T‑2) — a vote heatmap shows which meals are
   unpopular; admin swaps/keeps and **locks** the week.
5. **Portion** — for every locked meal, compute *how much to cook* from who's
   eating, minimizing leftovers (tiny surplus = the cook's portion).
6. **Shopping list** — aggregate all ingredients for the week, scaled to
   portions, grouped by aisle, sent to the cook.

---

## 3. Three meals a day

| Meal | Character | Health hooks |
|------|-----------|--------------|
| **Breakfast** | Lighter, fast, some soft | Congee/eggs for GGM & Neo; protein (eggs) for trainers; low-sugar for Dad |
| **Lunch** | Rice bowls, noodle soups, salads | Fiber + protein; portion-aware |
| **Dinner** | The main event (current engine) | Beef‑free, fish‑free (shrimp OK), spice on the side, soft options |

---

## 4. Portion engine (minimize leftovers)

Each member carries a **portion factor** (relative to one standard adult
serving), derived from age, size, appetite and goals:

| Member | Factor | Why |
|--------|-------:|-----|
| Neo (4) | 0.4 | toddler |
| Neon (10) | 0.7 | child |
| GGM (86, soft) | 0.6 | senior, small/soft |
| Mom (65) | 0.9 | regular |
| Lookaew (35) | 0.9 | regular |
| Note / N5 (ballet) | 1.0 | lean, active |
| Dad (diabetic) | 1.0 | portion‑controlled, more protein/veg, less rice |
| N2 (training) | 1.4 | high protein |
| N1, N3, N4 (training, 107kg) | 1.5 | high protein, big eaters |

**Per meal:**
```
attendees      = members present and NOT vetoing this meal
raw_servings   = Σ attendee.factor
cook_servings  = round_up_to_0.5(raw_servings)
buffer         = cook_servings − raw_servings   // ≤ 0.5 → "cook's share"
```
For multi‑dish meals (e.g. a feast), `cook_servings` is split across dishes by
weight so nothing is over‑cooked. Result the cook sees: **"Cook ~11.5 servings
(≈ ½ portion spare)."**

*Attendance* matters (school/work lunches), which is the main thing I need to
confirm — see open questions.

---

## 5. Shopping list

- Each recipe stores **ingredients per serving** (item, qty, unit, aisle).
- Week list = Σ over finalized meals of `ingredient.qty × cook_servings`,
  summed per item, converted to sensible units, grouped by aisle
  (produce / meat & seafood / dairy & egg / pantry / frozen / other).
- Output: a clean checklist the cook can tick, printable, shareable by link.

---

## 6. Screens

1. **Code login** — grid of member cards; tap your code to enter.
2. **My week** — day selector; three meal cards per day with dishes, a
   personalized note, the cook quantity, and a **"Not for me"** toggle.
3. **Sent / thanks** — confirmation after submitting vetoes.
4. **Admin · review** — week grid with a **vote heatmap**; tap a meal to swap a
   dish; **Lock week**.
5. **Admin · shopping list** — generated list, grouped by aisle, share to cook.
6. **Cook · day** — today's three meals, exact quantities, recipe steps.

---

## 7. Design system (modern, minimal, scalable)

- **Voice:** calm, premium, uncluttered. Lots of whitespace; one accent.
- **Palette:** warm paper `#FBFAF7`, ink `#181818`, muted `#8A8578`, hairline
  `#EDE8E0`, accent terracotta `#E8623D`. Cuisine dots: Thai `#E35D6A`,
  Chinese `#D99A00`, Japanese `#5B8DEF`, American `#3AA76D`.
- **Type:** system UI stack; tight, confident headings (weight 650), relaxed
  body, small ALL‑CAPS labels for structure.
- **Shape:** 18–22px radius cards, soft single‑layer shadows, pill tabs,
  segmented controls, sticky day nav, a single bottom action bar.
- **Motion:** small, quick (120–180ms) — press scale, fade, slide. Nothing flashy.
- **Mobile‑first**, thumb‑reachable actions, works offline-ish (localStorage),
  internationalizable copy (so it can scale beyond the family later).

---

## 8. Data model additions (Google Sheet tabs)

- **Meals** — `id, menu_id, date, meal_type(breakfast|lunch|dinner), status, position`
- **MealDishes** — `id, meal_id, dish_name, cuisine, role, recipe_id, planned_servings, notes, position`
- **Votes** — `id, meal_id, member_code, vote(dislike), reason, created_at`
- **Ingredients** — `id, recipe_id, item, qty_per_serving, unit, aisle`
- (existing **Menus** becomes a month/period container; **Members** already
  upgraded with codes, health and goals.)

Portion factors live on **Members** (add `portion_factor`); the shopping list
is computed, not stored.

---

## 9. Build order

1. ✅ Design (this doc) + clickable member prototype (`app.html`, sample data).
2. Backend tabs (Meals/MealDishes/Votes/Ingredients) + Code.gs endpoints.
3. Member review flow wired to real data; vote submission.
4. Admin review heatmap + lock.
5. Portion engine + shopping list generation.
6. Cook day view.
