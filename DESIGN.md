# DESIGN.md — The Hobbit in Cards

RFC-style notes on how the site works, so you (or Claude, or anyone) can keep building on it.
Everything lives in one file, `index.html` — inline CSS + vanilla JS, no build step, no framework.

## 1. Concept

Two views over the same data:

- **The Tale** (the landing view) — the point of the project: a user-authored outline of
  sections and subsections, each holding the cards and passages that tell that part of the
  story. It starts blank; the owner writes it.
- **Collection** — the practical ledger: every card in the HOB set, what you own, what's missing.

The core idea binding them: a card is one *object* you can own copies of, but it may have many
**placements** in the story. Bilbo is in almost every chapter; one copy of a Bilbo card can only
sit in one sleeve of the final display. So the site counts copies against placements and tells
you where the story is still "uncovered".

## 2. Data model

The card database comes from Scryfall at runtime. The collection itself is stored in the
repo as `collection.json` (same shape as a JSON export: `{owned, story}`), read via
the GitHub contents API by everyone and written — as commits — only by the signed-in owner.
`localStorage` acts as an instant-write cache and offline buffer:

```
collection.json (repo, source of truth)
  read:  GET  /repos/<repo>/contents/collection.json   (unauthenticated for viewers)
  write: PUT  same endpoint, with sha + owner token — debounced 1.5s after each edit
  conflict: 409/422 -> refetch sha, retry once (last write wins)

token   (key hob_token_v1) — fine-grained PAT, Contents R/W on this repo only.
        Presence of the token = owner mode; without it the UI is read-only
        (body.readonly hides edit controls, guard() blocks the handlers).
        Enforcement is GitHub's: the token is validated against repo.permissions.push,
        and the API rejects writes from anyone else regardless of the UI.

dirty   (key hob_dirty_v1) — set on every local edit, cleared on successful commit;
        survives reloads, so offline edits are pushed on the next visit
        ('online' event, visibilitychange->hidden, and beforeunload also flush).
        On load: remote wins unless dirty (unpushed local edits win, then push).
```

Everything below is unchanged and still in `localStorage`:

```
cards        (cache, key hob_cards_v2, 24h TTL)
  [{ id, set, name, cn, rarity, type_line, flavor, oracle, img, uri }]
  — trimmed from Scryfall /cards/search?q=set:hob&unique=prints (paginated), plus the
    token companion set (set:thob), which fails soft if Scryfall has no such set.
  — unique=prints means each art/printing is its own entry: the picker exposes them all.
  — tokens render as T#n, sort after the main cards, never count as main set, and
    CSV import matches on set code + collector number since numbering restarts.

owned        (key hob_owned_v1)
  { [cardId]: { q, f, s } }        // regular, foil ✦ copy counts
  — a card is "owned" if q+f+s > 0; total copies = q+f+s.
  — s (special art ★) is legacy: printings are separate card entries (unique=prints),
    so the UI no longer offers it; existing s counts still display and count.

settings     (key hob_settings_v1, synced inside collection.json)
  { mainOnly }  — collecting goal: true narrows the Collection view, quest progress
  and rarity counts to collector numbers 1..MAIN_SET_MAX (193); special art
  treatments (#194+) are hidden and uncounted. The tale picker always shows all prints.

story        (key hob_story_v3, synced inside collection.json)
  { sections: [ { id, title, blurb, cards: [entry], subs: [ {id, title, blurb, cards: [entry]} ] } ] }
  — entry is one of two kinds, discriminated by the presence of .text:
      placement { cardId, note, fl? } — a card in the display; consumes copies for coverage.
                                     fl marks the flavor text as RELEVANT AT THIS PLACEMENT:
                                     the read-mode lightbox shows flavor only where fl is set,
                                     so a closer look never runs ahead of the story (a dwarf
                                     shown in ch. I may carry flavor quoting his death).
      passage   { text, cardId? }  — story prose between the cards, full-width, quote-styled;
                                     optional cardId shows attribution + a mini card, but
                                     passages NEVER consume copies or count in progress
                                     (a quoted flavor line must not demand a second copy).
  — the same card may be placed any number of times.
  — ids are opaque (sid()); section numerals (I, II, …) come from array order.
  — starts empty: the tale is entirely user-authored, no prefab chapters, no heuristics.
```

### Coverage rule

`copies = q + f + s`. A card's placements are covered in reading order (sections top to
bottom, section cards before its subsections): the first `copies` placements render bright;
the rest render amber with "needs another copy" (`coverageFlags()`). Section progress bars
count covered placements, not owned cards — so the bars measure *the story*, not the binder.

### Migration

v1/v2 stored prefab-chapter appearances (`hob_appear_v1` / `hob_chapters_v1`). The v3 outline
ignores them: JSON backups of any version import their `owned` counts; only v3 backups carry
a `story`.

## 3. Authoring the tale

All owner-only, all guarded by `guard()`. The Tale has an explicit **read/edit toggle**
(`storyEdit`, transient): read mode is the clean book view — identical to what visitors
see — and edit mode surfaces the authoring chrome (section controls, add tiles, and the
per-placement ‹ › ✕ buttons). Starting a section from the blank page flips into edit mode.

- `addSection(parentSecId?)` / `renameSection` / `moveSection` / `deleteSection` — outline CRUD
  via `prompt()`/`confirm()` (works fine on mobile, no extra UI).
- **Picker** (`openPicker(secId, subId?)`) — modal that live-searches the whole set on
  name + type_line + flavor text; tap a card to place it in the target section, tap again to
  remove. Already-placed cards show a ✓ badge; unowned ones render dimmed but are placeable.
- `moveEntry` — ‹ › under a card reorder it within its section/subsection; order matters,
  because copies cover placements in reading order.
- **Drag & drop** — mouse-drag the card (native image drag is suppressed: draggable=false,
  -webkit-user-drag none, dragstart preventDefault — without all three the browser's own
  image-drag eats the pointer stream). On touch, the ⠿ handle (touch-action: none) drags
  immediately; the card body needs a ~300ms hold, which real fingers often lose to scroll.
- `removeEntry` — the ✕ under a card drops that one placement.
- **Lightbox** (`openZoom`) — in read mode (and for visitors) tapping a card shows it big
  with its placement note; flavor text appears only if that placement's ❝ toggle (edit
  mode, next to ‹ › ✕) marked it relevant. Edit-mode taps keep opening the manager dialog.
- **Passages** — the ❝ Add-text tile inserts free narration (prompt); the card dialog's
  "❝ Quote here" inserts the card's flavor text as a passage linked to the card. Passages
  share the entry list, so they reorder, drag, and delete like cards (`placementsIn()`
  filters them out wherever coverage/progress/picker-✓ logic needs placements only).

## 4. UI map

- `cardHTML(card, appr?)` — renders one card. With an `appr` argument (story view) it adds the
  note pill, covered/uncovered styling, and the placement-remove ✕. Two overlay buttons
  (hover on desktop, always-on and ~44px on touch): `+` adds a regular copy, `⋯` opens the
  card dialog. Tapping the card toggles owned in the Collection (only between 0 and 1 —
  with more copies it opens the dialog instead, so a stray tap can't wipe counts), opens
  the dialog in the Tale, and opens a read-only dialog for visitors.
- `renderTracker()` — filters (search, rarity, owned/missing) over `cards`.
- `renderStory()` — walks `story.sections`, computes coverage, renders outline + edit controls
  (owner) or a clean read-only view (visitors).
- **Story modal** (`openModal`/`renderModal`) — per card: copy counters (regular/foil/special art),
  a want-vs-have summary line, and the placement rows (section › subsection, note, remove) plus
  an "add to section" row.
- `exportData()` / `importJSON()` / `importCSV()` — JSON backup of `{owned, story}`;
  CSV import understands ManaBox exports (matches on set code + collector number; foil column
  adds to `f`).

## 5. Testing

`test/run.js` is a Playwright script that opens the page with `api.scryfall.com` intercepted
(`test/mock.js` served instead) and `api.github.com` mocked in-memory (404 until the first PUT,
then serving the committed doc). It exercises: load, toggles, filters, search, story rendering,
multi-appearance editing, coverage, sync commits (owner mode), persistence across reload, and
read-only viewer mode in a token-less browser context.

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
- **Drag-and-drop** of cards between sections, and of sections themselves, as an
  alternative to the buttons.
- **Per-section hunt list**: flat "buy these next" view sorted by story impact.
