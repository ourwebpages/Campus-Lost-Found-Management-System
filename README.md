# Campus Lost & Found Management System

**Lovely Professional University** · *Your Campus. Your Community.*

A complete, responsive campus lost-and-found board built for **CSE-326** using **only HTML5, CSS3 and vanilla JavaScript (ES6+)**. Students can browse lost and found listings, search and filter them, publish reports, submit claim requests for found items, and track everything they have filed.

All data lives in the browser's **LocalStorage**. There is no backend, database, API, build step, package manager or third-party library.

---

## 1. Running the project

**Option A — open the file**

Double-click `index.html`, or drag it into Chrome, Edge, Firefox or Safari.

**Option B — local static server (recommended)**

Some browsers restrict `localStorage` on `file://` URLs. Any static server works, for example:

```bash
cd "CSE-326(Project)"
python -m http.server 8000
# then open http://localhost:8000
```

Nothing is installed, compiled or configured. The page loads three local files: `style.css`, `script.js` and the SVGs in `assets/images/`.

---

## 2. Project structure

```text
CSE-326(Project)/
├── index.html              Semantic shell: navigation, four views, dialogs, footer
├── style.css               Design tokens, components, responsive rules
├── script.js               State, storage, filtering, forms, rendering, toasts
├── README.md               This document
├── Images/
│   └── hero_home(576x510).png   Hero photograph
├── assets/
│   └── images/
│       ├── favicon.svg
│       └── item-*.svg      Ten local item illustrations used by the sample listings
├── Group 1.pdf             Original visual reference sheet
├── Campus_Lost_and_Found_PRD.docx
├── Campus_Lost_and_Found_Technical_Specification.docx
├── Web-Projects-List - K2P26LP.xlsx
├── _prd.txt / _spec.txt    Plain-text extracts of the two documents (reference only)
└── assets/css/…            Leftover folder from an earlier iteration; not referenced
```

---

## 3. Implemented modules

| # | Module | What is included |
|---|--------|------------------|
| 1 | Navigation | Sticky header, campus branding, Browse Items / My Reports / How It Works, Report an Item primary action, accessible mobile menu (`aria-expanded`, closes on navigation or `Esc`) |
| 2 | Homepage | Hero with tagline, live Lost / Found / Returned statistics, hero search that spans both tabs, category shortcuts with counts, recently reported items, How It Works, privacy guidance, FAQ, closing call to action, footer |
| 3 | Browse Items | Lost / Found tabs with live counts, keyword search, category filter, campus-location filter, all three combine with AND logic, clear filters, result count, empty state that suggests the other tab when it has matches |
| 4 | Item Details | Dialog with image or illustration, type and status, category, description, campus location and specific spot, date, report ID, and a claim action for claimable found items. Contact details never appear |
| 5 | Report an Item | Lost / Found selector, item name, category, location (label changes to "Location last seen" / "Location found"), specific spot, date (no future dates), description with a live character counter, name, campus email, optional phone, optional JPG/PNG photo with preview and canvas resize, field-level validation, unique report ID, Save as Draft, Publish, success confirmation |
| 6 | Claim Request | Claimant name, campus email, required identifying detail, optional extra proof description, unique claim ID, starts at *Pending verification*, confirmation toast; verification is explicitly labelled simulated |
| 7 | My Reports | Email lookup (stored locally), Lost / Found / Claims tabs with counts, record cards, open listing, delete with confirmation, empty states, persistence |
| 8 | How It Works | Three steps: Look for a match · Share a few details · Arrange a safe return |
| 9 | Privacy & Safety | Keep personal details private · Confirm it belongs to you · Meet somewhere safe |
| 10 | FAQ & Footer | Five accessible accordion answers (button + `aria-expanded` + hidden region), university-branded footer, demo-data reset |

**Interactions:** dynamic rendering, debounced live search, tab switching, dialogs with focus handling and `Esc`, image drag-and-drop, toast notifications, dynamic statistics, empty states, draft restore, reset.

---

## 4. Data and storage keys

| Key | Contents |
|-----|----------|
| `clf.items.v1` | JSON array of item reports (seed + user created) |
| `clf.claims.v1` | JSON array of claim requests |
| `clf.profile.v1` | `{ currentEmail }` used only to prefill My Reports |
| `clf.draft.v1` | The single saved report draft |

**Item record:** `id`, `type` (`lost`/`found`), `itemName`, `category`, `description`, `location`, `specificSpot`, `itemDate` (ISO), `contactName`, `contactEmail`, `contactPhone`, `image` (local sample asset), `imageDataUrl` (uploaded photo), `status`, `createdAt`, `updatedAt`, `isSample`.

**Claim record:** `id`, `itemId`, `claimantName`, `claimantEmail`, `identifyingDetail`, `proofDescription`, `status`, `createdAt`, `updatedAt`.

**Statuses:** lost → `still_looking` · `matched` · `returned`; found → `ready_to_claim` · `claimed` · `returned`; claim → `pending_verification` · `approved` · `rejected`.

**Seeding.** Twelve realistic sample listings are created once, only when no valid item dataset exists. Later page loads keep user data. Deleting a user report never touches the seed records.

**Resetting.** The footer's *Reset demonstration data* button (with a confirmation step) removes the four `clf.*` keys and restores the sample board.

**Robustness.** Every read and write is wrapped in `try/catch`; malformed JSON, wrong-shaped values and unavailable storage fall back to a safe state instead of crashing. Uploaded photos are resized to 1200 px and re-encoded as JPEG; if storage quota is exceeded the report is saved without the photo and the user is told.

---

## 5. Design

| Token | Value |
|-------|-------|
| Primary (forest) | `#174C3C` |
| Secondary (sage) | `#E8F0E9` |
| Background (warm off-white) | `#F8F8F3` |
| Body text | `#252A27` |
| Card surface | `#FFFFFF` |

Headings use a serif display stack, body copy a system sans stack — no web fonts are requested. Layout uses CSS Grid and Flexbox, hairline borders, 8–24 px radii and restrained shadows.

The layout follows the supplied **Group 1.pdf / Figma** reference board: a serif headline over a full-bleed hero photograph, a floating "items safely returned" chip, a sage callout language for reassurance blocks, `·` separated metadata on cards, small uppercase eyebrows, and dark forest primary buttons with an arrow.

**Deliberate deviations from the reference (per the PRD's honesty rules):**

- The reference's "NORTHBRIDGE UNIVERSITY" sample branding is replaced with Lovely Professional University.
- The reference says *"campus email verified"* and *"we'll email you once your claim is verified"*. This build never claims identity verification and never promises email — those would be false in a browser-only demo. Claims are shown as **Pending verification**, labelled as simulated.
- The reference's merged detail + claim page is implemented as a detail dialog with a claim dialog, so both remain usable on a phone.
- Item photography in the reference is replaced with local SVG illustrations plus optional user uploads, avoiding any external asset or network request.

---

## 6. Testing checklist and results

Verified in Chromium against `http://localhost:8765` (the project served by `python -m http.server`), using the browser console and DOM measurements.

| ID | Scenario | Result |
|----|----------|--------|
| T-01 | First launch with empty LocalStorage | **Pass** — 12 sample listings seeded once; statistics show 6 lost / 6 found / 3 returned |
| T-02 | Report survives a refresh | **Pass** — published `L-2026-6740`, storage grew to 13, after reload the report was still on the board and in My Reports |
| T-03 | Lost / Found tab switching | **Pass** — 6 lost cards, 7 found cards at test time; `aria-selected` and counts update |
| T-04 | Category filter | **Pass** — Electronics in Found returned 3 |
| T-05 | Keyword search | **Pass** — "headphones" returned 1; search is case-insensitive and debounced |
| T-06 | Combined filters | **Pass** — Found + Main Library = 1; adding Electronics = 1; keyword + category also matched expectations |
| T-07 | Clear filters | **Pass** — keyword, category and location reset, active tab retained |
| T-08 | Empty report submission | **Pass** — blocked with six field-level errors, focus moved to the first invalid field |
| T-09 | Valid Lost and Found reports | **Pass** — IDs `L-2026-6740` and `F-2026-7098`, statuses Still looking / Ready to claim, cards and statistics update |
| T-10 | Invalid image upload | **Pass** — a `.txt` file and a 5.6 MB PNG were both rejected with specific messages; a valid PNG previewed as a resized JPEG data URL |
| T-11 | Claim without identifying detail | **Pass** — blocked with three field errors |
| T-12 | Valid claim | **Pass** — claim stored, ID `C-…`, status Pending verification, toast shown, no duplicate created |
| T-13 | My Reports with matching email | **Pass** — only that email's records listed, with counts per tab |
| T-14 | My Reports with another email | **Pass** — empty state, no unrelated records |
| T-15 | Malformed LocalStorage JSON | **Pass** — invalid items/claims/profile values were ignored, the board reseeded, no console errors |
| T-16 | 1440 px, 768 px, 375 px | **Pass** — no horizontal overflow at any width; grids collapse 3 → 2 → 1 column |
| T-17 | Keyboard use | **Partial** — `Esc` closes dialogs, focus moves to the first invalid field, the mobile menu exposes `aria-expanded`, and all controls are native buttons/inputs. A full keyboard-only walkthrough was not performed |
| — | Delete report | **Pass** — confirmation dialog, item and its claims removed, list refreshed |
| — | Draft save and restore | **Pass** — draft persisted and repopulated every field after reload; removed on publish |
| — | Footer year | **Pass** — rendered dynamically (2026) |

Console: no errors or failed network requests on load or during the flows above.

**Not verified:** real screen-reader output, Safari/Firefox rendering, print layout, and very large datasets.

---

## 7. Known limitations

1. **One browser profile is the data boundary.** Different students, browsers or devices do not share reports; there is no synchronisation.
2. **No real accounts or identity checks.** The campus email is a local identifier; the app cannot prove someone belongs to the university.
3. **No email, SMS or push notifications.** Confirmations are on-screen only.
4. **Claims are not really reviewed.** There is no staff account or moderation workflow; *Pending verification* is simulated and items are never automatically handed over.
5. **LocalStorage is not secure.** It is unencrypted and readable by anyone using this browser profile or its developer tools. Never store ID numbers, passwords or document photos in it.
6. **Photos are local only.** Uploads are resized into data URLs in LocalStorage; large images can exceed quota, in which case the report saves without the photo.
7. **Seed reports cannot be deleted** (by design, so the demonstration always has content); use *Reset demonstration data* instead.
8. **Dates cannot be in the future** in the standard flow, so the date picker is capped at today.
9. Built and tested against current evergreen browsers only.

---

## 8. Academic notes

- Project No. 02 — *Campus Lost and Found Management System*, Web Projects List (K2P26LP).
- Product requirements: `Campus_Lost_and_Found_PRD.docx`. Implementation decisions: `Campus_Lost_and_Found_Technical_Specification.docx`.
- Visual direction: `Group 1.pdf` and the supplied Figma file.
- Technology constraint honoured: no React/Angular/Vue, no Bootstrap/Tailwind, no jQuery, no TypeScript, no Node/npm packages, no backend, no external APIs, no web fonts.
