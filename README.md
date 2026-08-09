# The Hobbit in Cards — There and Back Again

A single-file website that tells the story of *The Hobbit* through Magic: The Gathering's
The Hobbit set (HOB) — and tracks which cards of the tale you own.

## What it does

- **Collection view** — all cards of the set (fetched live from Scryfall, always current),
  with search, rarity filters, owned/missing filters, quantity and foil counts.
- **The Tale view** — the full story in 19 chapters, each showing its cards. Owned cards
  glow gold; missing ones wait in grey. Cards are auto-sorted into chapters by name, type,
  and flavor text as a starting point — hover any card and press **story** to curate it yourself.
- **Appearances** — a card can appear at several points of the story (Bilbo is everywhere!).
  Each appearance is tagged with *why* it belongs there: character/being, event/scene,
  flavor text quoting the book, or the art showing the moment — plus a free note.
- **Copies vs. the tale** — you track regular, foil ✦, and special-art ★ copies per card.
  If a card has more appearances than you own copies, the uncovered appearances glow amber
  ("needs another copy") — your hunt list for bringing the story to life.
- Your collection and story curation are saved in your browser (localStorage).
- **Export** downloads a JSON backup; **Import** restores it — and also accepts a
  **ManaBox CSV export**, so you can scan cards with your phone and import them here.

## Deploy on GitHub Pages

1. Create a new repository on GitHub (e.g. `hobbit-in-cards`). Public is required for
   free Pages hosting.
2. Upload `index.html` (and this README) — on the repo page: *Add file → Upload files*.
3. Go to *Settings → Pages*, set **Source** to *Deploy from a branch*, branch `main`,
   folder `/ (root)`, and save.
4. After a minute your site is live at `https://<your-username>.github.io/hobbit-in-cards/`.

No build step, no dependencies — it's one HTML file.

## Package contents

- `index.html` — the entire site
- `README.md` — this file
- `DESIGN.md` — RFC-style design notes: data model, coverage rule, extension points
- `test/` — Playwright test with mock Scryfall data (`npm install playwright && node run.js`)

## Notes

- Collection data lives in the browser you use it in. If you switch browsers or machines,
  use Export/Import to carry it over.
- To also track the Commander set (HOC), change `SET_CODE` at the top of the script in
  `index.html` — or ask Claude to add a second tab.

Unofficial fan project. Card data and images courtesy of [Scryfall](https://scryfall.com).
Magic: The Gathering © Wizards of the Coast. *The Hobbit* is the work of J.R.R. Tolkien.
