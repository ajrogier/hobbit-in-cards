# The Hobbit in Cards — There and Back Again

A single-file website that tells the story of *The Hobbit* through Magic: The Gathering's
The Hobbit set (HOB) — and tracks which cards of the tale you own.

## What it does

- **Collection view** — all cards of the set and its tokens (fetched live from Scryfall),
  with search, rarity filters, owned/missing filters, quantity and foil counts. Foil copies
  shimmer on the card; on desktop the hover pill marks a foil in one click. A **Main set
  #1–193** chip narrows the quest to the numbered main set — special art treatments
  (#194+) are hidden and stop counting toward progress. The goal syncs with the collection.
- **The Tale view** (the landing page) — a blank page you author yourself. Create sections and subsections
  (auto-numbered, with optional descriptions), reorder, rename, delete. Fill each part
  from a card picker that searches the whole set by name, type, or flavor text — every
  printing is its own card, so showcase and borderless arts are individually pickable.
- **Placements** — a card can be placed at several points of the story (Bilbo is
  everywhere!), each with a free note ("finds the ring"). Manage placements from the
  section (tap to add/remove in the picker) or from the card dialog (the **⋯** button,
  or just tapping the card in the Tale view).
- **A closer look, spoiler-safe** — in the tale's read view, tapping a card opens its
  art as an illustrated plate with its note; the flavor text shows only where you've
  marked it relevant to that point of the story (the ❝ toggle on each placement in edit
  mode) — so a dwarf introduced in chapter one doesn't quote his own ending. Tap the art
  to flip to the full card and back.
- **Passages** — story text between the cards: free narration via the ❝ tile, or one tap
  in a card's dialog quotes its flavor text into the tale, attributed and showing a small
  copy of the card — without counting as a placement, so quoting Ori's line doesn't
  demand a second Ori.
- **Unused cards & the hunt list** — a Collection chip filters to cards not yet woven
  into the tale, and the Buy list gathers every copy still wanted to cover the story's
  placements — in story order, one row per printing (same name in two arts = two rows,
  told apart by thumbnail and artist), each row deep-linking to that **exact printing's
  page on Cardmarket** via its product ID. Exportable as plain text or in Cardmarket's
  wants-import format (plain `Nx Card Name` lines, front face for // cards — their
  MTG importer matches names only, so the import is any-version; the row links are
  how you buy or pin the exact arts).
- **Copies vs. the tale** — you track regular and foil ✦ copies per card (special arts are
  their own card entries, so they need no separate counter). If a card has more placements
  than you own copies, the uncovered placements glow amber ("needs another copy") — your
  hunt list for bringing the story to life.
- **The collection lives in the repo** — every edit is committed to `collection.json`
  via the GitHub API, so it's versioned, backed up, and shared across your devices.
  Visitors see the collection read-only; editing requires the owner sign-in (below).
- **Export** downloads a JSON backup; **Import** restores it — and also accepts a
  **ManaBox CSV export**, so you can scan cards with your phone and import them here.
- **Settings (⚙)** — a small menu holding the per-device preferences: theme (follows the
  device's light/dark setting by default, or pin day/night — day is styled after Tolkien's
  original Hobbit cover), foil shimmer (subtle static wash, or an animated gleam sweep),
  and the owner sign-in with live sync status.

## Owner sign-in (who can edit)

Write access is GitHub's own: only someone who can commit to this repository can change
the collection. On each device you edit from, tap the sync button in the nav and paste a
GitHub **fine-grained personal access token** — create it at
*Settings → Developer settings → Fine-grained tokens* with **Repository access: only this
repo** and **Permissions: Contents → Read and write**. The token is stored in that
browser only. Without a token the site is a read-only view of the collection.

Edits save locally at once and are committed a moment later (debounced). If you're
offline, the sync chip shows "unsaved" and the commit retries automatically when the
connection returns — even across page reloads.

## Deploy on GitHub Pages

Deployment is automatic: the workflow in `.github/workflows/deploy-pages.yml` enables
GitHub Pages and publishes the site on every push to `main` (the repo must be public
for free Pages hosting). After the first run the site is live at
`https://<your-username>.github.io/hobbit-in-cards/`.

You can also trigger it manually from the *Actions* tab (*Deploy to GitHub Pages →
Run workflow*), or set Pages up by hand under *Settings → Pages* if you prefer
deploying from a branch.

No build step, no dependencies — it's one HTML file.

## Package contents

- `index.html` — the entire site
- `README.md` — this file
- `DESIGN.md` — RFC-style design notes: data model, coverage rule, extension points
- `test/` — Playwright test with mock Scryfall data (`npm install playwright && node run.js`)

## Notes

- The source of truth is `collection.json` in this repo — its git history doubles as a
  full undo trail for your collection. localStorage is only a cache/offline buffer.
- To also track the Commander set (HOC), change `SET_CODE` at the top of the script in
  `index.html` — or ask Claude to add a second tab.

Unofficial fan project. Card data and images courtesy of [Scryfall](https://scryfall.com).
Magic: The Gathering © Wizards of the Coast. *The Hobbit* is the work of J.R.R. Tolkien.
