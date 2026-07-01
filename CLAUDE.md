# CLAUDE.md - Library Reservations

## Project Overview

A web-based library resource reservation/scheduling system. Staff use it to manage bookings for library rooms, equipment, and other resources. Built as a single-page application with vanilla JavaScript and Firebase (Firestore + Auth) as the backend.

**There is no build step or bundler.** The app runs directly as static files served to the browser. npm is used only for the dev-side test runner (Jest).

## Keeping this file accurate

This document drifts as the code moves. To keep it trustworthy, it deliberately avoids hard line numbers in prose and treats counts/sizes as regenerable snapshots. When you edit the code, follow these rules:

- **Reference section markers and function names, not line numbers.** The `// --- SECTION ---` markers in `app.js` and function names are stable anchors that survive edits; line numbers are not. The Section Map below lists approximate line numbers as a convenience only — search for the marker text to jump, and don't treat the numbers as exact.
- **Regenerate volatile numbers instead of trusting them.** Counts and file sizes in this file are point-in-time snapshots. Re-derive them with:
  - File sizes: `wc -l app.js utils.js utils.test.js index.html styles.css`
  - Test count: `npm test` (see the "Tests:" summary line)
  - Utility function list/count: the `module.exports` block at the bottom of `utils.js`
  - app.js section markers: `grep -n "// --- " app.js`
- **Update this file in the same change that adds a feature.** If you add a resource setting, booking field, section, or utility, update the matching part of this doc (Section Map, Firestore Data Model, and/or Common Tasks) alongside the code.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks)
- **Backend:** Google Firebase (Firestore NoSQL database + Firebase Authentication)
- **External CDN dependencies loaded in index.html:**
  - Firebase SDK v8.10.1 (app, auth, firestore)
  - marked.js (Markdown rendering for the info sidebar)

## File Structure

Approximate sizes (run `wc -l` for current values — see "Keeping this file accurate"):

```
app.js         (largest, ~6,300 lines) - Application logic (DOM, Firebase, UI interactions)
utils.js       (~540 lines)            - Pure utility functions (testable, no DOM/Firebase deps)
utils.test.js  (~870 lines)            - Jest tests for utils.js
index.html     (~720 lines)            - HTML markup, ~15 modal/overlay dialogs, UI structure
styles.css     (~1,270 lines)          - All styling (layout, grid, modals, components)
firestore.rules                        - Server-side access control (the real security boundary)
package.json                           - Dev dependencies (Jest only)
README.md                              - User-facing project summary
```

**`utils.js`** is a dual-mode file: it defines globals when loaded as a `<script>` tag in the browser, and exports via `module.exports` when required by Node/Jest. This is the place for all pure, testable logic. When adding new utility functions, put them here rather than in app.js.

> **Note on color palettes:** The 5 color palettes (`default`, `warm`, `slate`, `ocean`, `accessible`) are **not** in `styles.css`. They are defined as the `COLOR_PALETTES` object near the top of `app.js` — each palette is an array of accent/chart colors selected per resource via `colorPalette`.

## Architecture

### How It Works

1. User logs in with a shared password. The app authenticates via Firebase Auth using one of two hardcoded internal emails to determine the role (admin vs. staff/viewer).
2. The app loads the resource list from a single Firestore document (`system/resources`).
3. A real-time listener subscribes to the `appointments` collection, filtered by the current resource and date range.
4. The grid is rendered as DOM elements. Bookings are positioned as absolutely-positioned overlays on top of time-slot cells.
5. Users interact via drag-to-create, drag-to-move, resize handles, and modal forms.

### Authentication & Roles

- **Admin role:** email `staff@library.internal` (the `STAFF_EMAIL` constant) - can edit all resources, access admin panel
- **Staff/Viewer role:** email `viewer@library.internal` (the `VIEWER_EMAIL` constant) - can edit non-admin-only resources, no admin panel access
- Login uses a Firebase account password (set on the accounts in the Firebase console), not a value in the source. `doLogin()` tries the admin email first, then falls back to the viewer email.
- The admin panel and delete-confirmation prompts are gated by the `ADMIN_PASS` constant in app.js — a **separate** client-side password from the login. This is a speed bump only: it ships in app.js and is readable in the browser.
- **Real access control is enforced server-side by Firestore Security Rules** (`firestore.rules`), which require authentication for all access and block destructive writes to `system/resources` (an empty/missing list is rejected). Never rely on client-side checks alone for security.

### Firestore Data Model

The app uses two collections plus a handful of singleton documents under `system/`.

**`system/resources` (single document)** — the resource catalog. The whole list is stored in one document and every save fully overwrites it (guarded against destructive empty writes both client-side and in the rules).

```
{
  list: [
    {
      id: string,                    // e.g. "res-default"
      name: string,                  // display name
      viewMode: "week" | "day",      // grid layout mode
      hours: number[14],             // operating hours: [Sun_start, Sun_end, Mon_start, Mon_end, ...]
      maxDuration: number,           // max booking hours (e.g. 2)
      closuresByYear: {              // keyed by year string
        "2025": [{ date: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", reason: string }]
      },
      subRooms: [                    // only used when viewMode = "day"; stored shape:
        { id: string, name: string, active: boolean, displayOrder: number }
      ],
      colorPalette: string,          // key into COLOR_PALETTES: "default" | "warm" | "slate" | "ocean" | "accessible"
      useQuarterHour: boolean,       // 15-min vs 30-min slots
      hasStaffField: boolean,        // enable staff assistance tracking
      staffNames: string[],          // configured staff/volunteer names for this resource
      defaultShowNotes: boolean,
      allowRecurring: boolean,
      advanceLimitEnabled: boolean,
      advanceLimitDays: number,
      advanceLimitAdminBypass: boolean,
      adminOnly: boolean,            // restrict to admin role
      cosmeticCloseMinutes: number,  // display closing time N minutes early (0 = disabled; capped at 15)
      anonymityBufferMonths: number, // 0-3; how long patron names are kept before the janitor scrubs them
      enableSidebar: boolean,
      sidebarText: string,           // Markdown content for info sidebar
      lastScrubbedWeekKey: string    // janitor bookmark (written by runLazyJanitor, not user-facing)
    }
  ]
}
```

Notes:
- `subRooms` `_arrayIndex` is **not** stored — it is added at read time by `getActiveSubRooms()`.
- Legacy formats are migrated on load: a comma-separated `subRooms` string (`migrateSubRooms`) and a flat `closureDates` array (`migrateClosureDates`).

**`appointments` collection** — one document per booking.

Document ID format: `{resId}_{weekKey}_{dayIndex}_{startTime}` or `{resId}_{weekKey}_{dayIndex}_{startTime}_{subRoomIndex}`

- `weekKey`: `YYYY-MM-DD`, zero-padded, the Sunday that starts the week (produced by `getWeekKey`)
- `dayIndex`: 0-6 (Sunday=0 through Saturday=6)
- `startTime`: float (e.g. 10.5 = 10:30 AM)
- `subRoomIndex`: integer, only present for day-view resources with sub-rooms

```
{
  name: string,           // patron/event name
  duration: number,       // hours (e.g. 1.5)
  notes: string,
  showNotes: boolean,     // display notes on the grid
  hasStaff: boolean,
  staffName: string,      // only meaningful if hasStaff
  seriesId: string        // only for recurring bookings, links the series
}
```

- **There is no `createdAt` field** — bookings are not timestamped. All position/time information is encoded in the document ID.
- The janitor rewrites old bookings in place: it sets `name` to `"Anonymized Patron"`, clears `notes`, and adds `isScrubbed: true`.

**Other `system/` documents:**
- `system/resourceBackups` — resource-config version history (`{ versions: [...] }`), newest first, capped at `RESOURCE_BACKUP_LIMIT` (20). Appended on every successful settings save; restorable from the admin "Version History" panel.
- `system/janitor` — anonymization checkpoint (`{ lastRunMonth }`), so the janitor runs at most once per month per session load.
- Stats cache documents — year and monthly booking caches created on demand by the stats code.

**Important:** The booking document ID encodes its position (resource, week, day, time, sub-room). Moving a booking means deleting the old document and creating a new one with a different ID.

## app.js Section Map

The file is organized into labeled sections. **Search for the marker text to navigate** — the line numbers below are approximate and drift as code changes (regenerate with `grep -n "// --- " app.js`).

| ~Line | Section Marker | What It Contains |
|------|---------------|-----------------|
| ~1 | `// --- FIREBASE CONFIG ---` | Firebase initialization, auth constants (`STAFF_EMAIL`, `VIEWER_EMAIL`, `ADMIN_PASS`), `COLOR_PALETTES` |
| ~49 | `// --- STATE ---` | Global state (resources, `allBookings`, drag/selection/resize state objects, `statsBookingsCache` + `STATS_CACHE_TTL`) |
| ~170 | `// --- AUTH ACTIONS ---` | `doLogin()`, `doLogout()`, `canEditResource()`, `setupRealtimeListeners()` |
| ~229 | `// --- RESOURCE VERSION HISTORY ---` | `backupResourceList()`, backup modal, in-app restore from `system/resourceBackups` |
| ~354 | `// --- CORE LOGIC ---` | `loadBookingsForCurrentView()`, `handleResourceUpdate()`, navigation, `loadVersion` stale-callback guard |
| ~560 | `function renderGrid()` | Main grid rendering. Builds time slots, positions booking overlays, attaches event listeners |
| ~1006 | `// --- CURRENT TIME INDICATOR ---` | Red time-indicator line for day view (`setupTimeIndicator`, `placeTimeIndicator`) |
| ~1072 | `// --- DRAG-AND-DROP HANDLERS ---` | Moving existing bookings via drag. Validation, conflict checking, drop confirmation |
| ~1737 | `// --- DRAG-TO-CREATE HANDLERS ---` | Creating new bookings by clicking and dragging on empty slots |
| ~2129 | `// --- RESIZE HANDLERS ---` | Changing booking duration by dragging the bottom edge |
| ~2445 | `// --- RESCHEDULE MODE ---` | Multi-step rescheduling: enter mode, navigate to target day/week, click to place |
| ~2705 | `// --- MODAL & SAVE ---` | Booking modal (`openBookingModal`), `saveBooking()`, `saveRecurringBooking()`, recurring pattern logic |
| ~3227 | `// --- ADMIN PANEL ---` | Admin settings UI (`loadSettingsForEditor`), resource management, sub-room editing, staffing config |
| ~3642 | `// --- CLOSURE DATE MANAGEMENT ---` | Add/remove closure dates, year-based storage, apply closures across resources |
| ~4059 | `// --- STAFF NAME LIST MANAGEMENT ---` | Configure staff/volunteer names per resource, apply across resources |
| ~4169 | `// --- STAFF NAME DRAG-TO-REORDER ---` | Drag-to-reorder for the staff/volunteer name cards (mirrors sub-room cards) |
| ~4383 | `// --- NEW RESOURCE WITH IMPORT OPTION ---` | Creating resources with option to clone settings from existing ones |
| ~4573 | `async function deleteResource()` | Delete resource with password protection |
| ~4620 | `async function saveAllSettings()` | Main settings save; also calls `runLazyJanitor()` on the saved resource |
| ~4677 | `checkAndRunJanitor()` / `runLazyJanitor()` | Monthly janitor gate + the batched anonymization worker |
| ~4822 | `// --- BOOKING POPOVER & HIGHLIGHTS ---` | Hover popover (`showBookingPopover`), highlighting, `deleteBooking()` with series-aware logic |
| ~4978 | `// --- UTILITY FUNCTIONS ---` | `closeModal()`, `createDiv()`, `showLoading()`, modal toggles, advance-limit checking |
| ~5109 | `// --- STATS FUNCTIONS ---` | Statistics modal, heatmap, dashboard charts, CSV export (to end of file) |

## Key Patterns & Conventions

### DOM Manipulation
- All UI is built with direct DOM manipulation (`document.createElement`, `innerHTML`).
- Modals are shown/hidden by toggling `style.display` between `'flex'` and `'none'`.
- The grid is fully re-rendered on every data change via `renderGrid()`.

### Data Flow
- Firestore real-time listeners (`onSnapshot`) update the in-memory `allBookings` map and trigger `renderGrid()`.
- Resources are stored in-memory in the `resources` array and synced to the single `system/resources` document.
- A `loadVersion` counter (incremented per load request) prevents stale listener callbacks from overwriting newer data.
- `classifyResourceSnapshot()` / `shouldPersistResourceList()` (in utils.js) guard against a transiently empty/missing `system/resources` document silently wiping real configuration.

### Slot ID Convention
Slot IDs encode position: `{resId}_{weekKey}_{dayIndex}_{time}[_{subRoomIndex}]`. This is used both as Firestore document IDs and as HTML `data-slot-id` attributes. Many functions parse these IDs (`parseSlotId`) to extract day index, time, etc.

### State Objects
Three state objects track interactive operations:
- `dragState` - dragging an existing booking to a new slot
- `selectionState` - drag-to-create a new booking
- `resizeState` - dragging the bottom edge of a booking to change duration

Each follows the pattern: start handler sets state, move handler updates visuals, end handler shows confirmation or saves.

### Reschedule Mode
Distinct from drag-to-move. Allows navigating to a different week before placing a booking. Flow: enter reschedule mode → navigate to target date → click target slot → confirm. Managed by the `rescheduleMode` state object.

### Lazy Janitor (Anonymization)
Two functions work together to scrub old patron names based on each resource's `anonymityBufferMonths` (0–3):
- `checkAndRunJanitor()` runs on app load. It uses a Firestore transaction on `system/janitor` (`lastRunMonth`) so the sweep runs at most once per month, then calls `runLazyJanitor()` for every resource.
- `runLazyJanitor(res)` is the worker. `saveAllSettings()` also calls it directly on the just-saved resource. It processes `appointments` in 500-document batches with cursor-based pagination (`startAfter`), resuming from the per-resource `lastScrubbedWeekKey` bookmark, and anonymizes bookings older than the cutoff (`isBookingAnonymized`).

### Stats Caching
Multi-layer caching for statistics performance:
- **Session cache:** In-memory `statsBookingsCache` map with a 5-minute TTL (`STATS_CACHE_TTL`). Invalidated on booking writes.
- **Firestore cache:** Year and monthly cache documents created on demand under `system/`.
- YTD calculations only include bookings up to today.

### Error Handling
- Firestore operations are wrapped in try/catch with `showToast()` for error display.
- A loading overlay (`showLoading(true/false)`) is shown during saves.
- Navigation is debounced (150ms) to batch quick successive clicks.

### Time Representation
- Times are floats: 10.0 = 10:00 AM, 10.5 = 10:30 AM, 10.25 = 10:15 AM.
- Duration is also in float hours: 1.5 = 1 hour 30 minutes.
- `formatTime(val)` converts a float to a display string (e.g. "10:30am").

## Common Tasks

References below use section markers and function names rather than line numbers (search for them in `app.js`).

### Adding a new field to bookings
1. Add the field to the save logic in `saveBooking()` (MODAL & SAVE section), and to `saveRecurringBooking()` if recurring bookings should carry it.
2. Add the control to the modal form in `index.html` inside `#bookingModal`.
3. Populate it in `openBookingModal()`.
4. If it should display on the grid, update the booking overlay rendering in `renderGrid()`.
5. If it should appear in the popover, update `showBookingPopover()` (BOOKING POPOVER & HIGHLIGHTS section).
6. If it should appear in stats/CSV export, update `renderStatsChart()` and `exportStatsCSV()` (STATS FUNCTIONS section).

### Adding a new resource setting
1. Add the form control to the admin panel in `index.html` inside `#settingsOverlay`.
2. Load the value into the control in `loadSettingsForEditor()` (ADMIN PANEL section).
3. Save the value in `saveAllSettings()`.
4. Add a default (and clone behavior) for it in the NEW RESOURCE WITH IMPORT OPTION section so new/cloned resources get a sensible value.
5. Use the setting where needed (typically in `renderGrid()` or `openBookingModal()`).

### Adding a new pure utility function
1. Add the function to `utils.js` in the appropriate section.
2. Add it to the `module.exports` block at the bottom of `utils.js`.
3. Add it to the `require('./utils')` destructure at the top of `utils.test.js` and write tests, then verify with `npm test`.
4. The function is automatically available as a global in the browser (no import needed in app.js).

### Adding a new modal
1. Add the HTML markup in `index.html` following the existing modal pattern (a `class="modal"` wrapper with a `class="modal-content"` child).
2. Show it with `document.getElementById('myModal').style.display = 'flex'`.
3. Hide it with `closeModal('myModal')`.

## Testing

Run the test suite with:

```
npm test             # run all tests once
npm run test:watch   # re-run on file changes
npm run test:verbose # show individual test names
```

Tests cover the pure utility functions in `utils.js` (one `describe` group per exported function). For the current totals, see the "Tests:" summary line printed by `npm test`. After making changes to any utility function, run `npm test` to verify nothing is broken.

### What's tested

- Time/date formatting (`formatTime`, `formatDateISO`, `formatDateShort`, `getWeekKey`, `getWeekStart`, `getCurrentTimeFloat`, `formatCosmeticTime`)
- HTML escaping (`escapeHtml`)
- Slot ID parsing and construction (`parseSlotId`, `buildSlotId`, `normalizeSubIndex`)
- Closure date logic (`getClosureReason`, `migrateClosureDates`, `getClosuresForYear`, `getAllClosures`)
- Sub-room helpers (`getActiveSubRooms`, `migrateSubRooms`, `getSubRoomName`)
- Recurring date math (`getNthWeekdayOfMonth`, `getLastWeekdayOfMonth`)
- Booking anonymization (`isBookingAnonymized`, `isBookingLocked`)
- Conflict detection (`checkTimeConflict`)
- Staff name normalization (`normalizeStaffName`)
- Resource-list persistence safeguards (`classifyResourceSnapshot`, `shouldPersistResourceList`)

### Adding new tests

When adding a pure function to `utils.js`, add corresponding tests in `utils.test.js`. The pattern:
1. Add the function to `utils.js`.
2. Add it to the `module.exports` block at the bottom of `utils.js`.
3. Add it to the `require('./utils')` destructure at the top of `utils.test.js`.
4. Write test cases in a new `describe()` block.

### What's NOT tested

DOM-dependent code in `app.js` (grid rendering, drag handlers, modal logic, Firebase operations) is not unit tested. These are tested manually in the browser.

## Deployment

Static file hosting. No build step required. Just serve `index.html`, `utils.js`, `app.js`, and `styles.css`. The `node_modules/`, `package.json`, and test files are dev-only.

Firestore Security Rules live in `firestore.rules` and are the real access-control boundary. Deploy them with `firebase deploy --only firestore:rules` (or paste into Firebase Console → Firestore Database → Rules).
