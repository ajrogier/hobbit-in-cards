# DESIGN.md — The Hobbit in Cards

RFC-style notes on how the site works, so you (or Claude, or anyone) can keep building on it.
Everything lives in one file, `index.html` — inline CSS + vanilla JS, no build step, no framework.

## 1. Concept

Two views over the same data:

- **Collection** — the practical ledger: every card in the HOB set, what you own, what's missing.
- **The Tale** — the point of the project: the 19 chapters of *The Hobbit* (plus a "Wider Tale"
  bucket), each showing the cards that tell that part of the story.

The core idea binding them: a card is one *object* you can own copies of, but it may have many
**appearances** in the story. Bilbo is in almost every chapter; one copy of a Bilbo card can only
sit in one sleeve of the final display. So the site counts copies against appearances and tells
you where the story is still "uncovered".

## 2. Data model

All state is in `localStorage`; the card database comes from Scryfall at runtime.

```
cards        (cache, key hob_cards_v1, 24h TTL)
  [{ id, name, cn, rarity, type_line, flavor, oracle, img, uri }]
  — trimmed from Scryfall /cards/search?q=set:hob&unique=prints, paginated.

owned        (key hob_owned_v1)
  { [cardId]: { q, f, s } }        // regular, foil ✦, special-art ★ copy counts
  — a card is "owned" if q+f+s > 0; total copies = q+f+s.

appearances  (key hob_appear_v1)
  { [cardId]: [ { ch, tag, note } ] }
  — ch:   chapter key ('ch1'…'ch19' | 'wider')
  — tag:  WHY the card sits at this story point:
          'character' | 'event' | 'flavor' (flavor text quotes the book)
          | 'art' (the art shows the moment) | 'auto' (machine-placed)
  — note: free text, e.g. "finds the ring"
  — ABSENT key  = card not yet curated → one auto appearance from the heuristics
  — EMPTY array = deliberately removed from the tale
```

### Coverage rule

`copies = q + f + s`. A card's appearances are covered in list order: the first `copies`
appearances render bright; the rest render amber with "needs another copy". Chapter progress
bars count covered appearances, not owned cards — so the bars measure *the story*, not the binder.

### Migration

v1 of the site stored a single chapter override per card (`hob_chapters_v1`). On boot, if
`hob_appear_v1` is missing, legacy overrides are converted to single `event` appearances.
JSON backups of both versions import cleanly.

## 3. Chapter auto-assignment

`CHAPTERS` is an ordered array; each chapter has a regex tested against
`name + type_line + flavor + oracle`. First match wins; no match → `wider`.
The heuristics are a starting point, not an authority — the moment you edit a card's
appearances in the story modal, they're materialized into `appearances` and the regexes no
longer apply to that card (`ensureAppr`). Tune the regexes freely; they only affect uncurated cards.

## 4. UI map

- `cardHTML(card, appr?)` — renders one card. With an `appr` argument (story view) it adds the
  tag pill, the note, and covered/uncovered styling. Quick actions on hover: `+/−` regular,
  `✦` foil, `★` special art, `story` opens the manager modal.
- `renderTracker()` — filters (search, rarity, owned/missing) over `cards`.
- `renderStory()` — explodes cards into appearance entries, groups by chapter, computes coverage.
- **Story modal** (`openModal`/`renderModal`) — per card: copy counters (regular/foil/special art),
  a want-vs-have summary line, and the appearance rows (chapter, reason tag, note, delete, add).
- `exportData()` / `importJSON()` / `importCSV()` — JSON backup of `{owned, appearances}`;
  CSV import understands ManaBox exports (matches on set code + collector number; foil column
  adds to `f`).

## 5. Testing

`test/run.js` is a Playwright script that opens the page with `api.scryfall.com` intercepted and
`test/mock.js` served instead, then exercises: load, toggles, filters, search, story rendering,
multi-appearance editing, coverage, and localStorage persistence across reload.

```
cd test && npm install playwright && node run.js
```

(In an environment with a pre-installed browser, set `executablePath` in `chromium.launch`.)

## 6. Ideas / open questions for future versions

- **Special-art linkage**: `unique=prints` means showcase/borderless printings are separate card
  entries. The `s` counter currently lives on whichever entry you mark — a future version could
  group printings by oracle id and roll ownership up.
- **HOC Commander set**: change `SET_CODE`, or add a second tab with its own cache key.
- **Read-only share mode**: serialize state into the URL hash so a link shows your tale without
  edit controls.
- **Drag-and-drop** between chapters as an alternative to the modal.
- **Per-chapter hunt list**: flat "buy these next" view sorted by chapter impact.
