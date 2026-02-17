# CLAUDE.md - Library Reservations

## Project Overview

A web-based library resource reservation/scheduling system. Staff use it to manage bookings for library rooms, equipment, and other resources. Built as a single-page application with vanilla JavaScript and Firebase (Firestore + Auth) as the backend.

**There is no build step, no bundler, and no package manager.** The app runs directly as static files served to the browser.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks)
- **Backend:** Google Firebase (Firestore NoSQL database + Firebase Authentication)
- **External CDN dependencies loaded in index.html:**
  - Firebase SDK v8.10.1 (app, auth, firestore)
  - marked.js (Markdown rendering for sidebar)

## File Structure

The entire application is three files:

```
app.js       (~5,200 lines)  - All application logic
index.html   (~640 lines)    - HTML markup, modals, UI structure
styles.css   (~1,120 lines)  - All styling
```

## Architecture

### How It Works

1. User logs in with a shared password. The app authenticates via Firebase Auth using one of two hardcoded internal emails to determine the role (admin vs. staff/viewer).
2. The app loads the resource list from a single Firestore document (`system/resources`).
3. A real-time listener subscribes to the `appointments` collection, filtered by the current resource and date range.
4. The grid is rendered as DOM elements. Bookings are positioned as absolutely-positioned overlays on top of time-slot cells.
5. Users interact via drag-to-create, drag-to-move, resize handles, and modal forms.

### Authentication & Roles

- **Admin role:** email `staff@library.internal` - can edit all resources, access admin panel
- **Staff/Viewer role:** email `viewer@library.internal` - can edit non-admin-only resources, no admin panel access
- Both roles use the same shared password (`ADMIN_PASS` constant in app.js)
- The admin panel has an additional password prompt, but it's the same password

### Firestore Data Model

**`system/resources` (single document):**
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
        "2025": [{ start: "YYYY-MM-DD", end: "YYYY-MM-DD", reason: string }]
      },
      subRooms: [                    // only used when viewMode = "day"
        { name: string, active: boolean, _arrayIndex: number }
      ],
      colorPalette: string,          // "default" | "warm" | "slate" | "ocean" | "accessible"
      useQuarterHour: boolean,       // 15-min vs 30-min slots
      hasStaffField: boolean,        // enable staff assistance tracking
      defaultShowNotes: boolean,
      allowRecurring: boolean,
      advanceLimitEnabled: boolean,
      advanceLimitDays: number,
      advanceLimitAdminBypass: boolean,
      adminOnly: boolean,            // restrict to admin role
      enableSidebar: boolean,
      sidebarText: string            // Markdown content for info sidebar
    }
  ]
}
```

**`appointments` collection (one document per booking):**

Document ID format: `{resId}_{weekKey}_{dayIndex}_{startTime}` or `{resId}_{weekKey}_{dayIndex}_{startTime}_{subRoomIndex}`

- `weekKey`: formatted as `YYYY-M-D` (week start date, Sunday-based)
- `dayIndex`: 0-6 (Sunday=0 through Saturday=6)
- `startTime`: float (e.g. 10.5 = 10:30 AM)
- `subRoomIndex`: integer, only present for day-view resources with sub-rooms

```
{
  name: string,           // patron/event name
  duration: number,        // hours (e.g. 1.5)
  notes: string,
  showNotes: boolean,      // display notes on the grid
  hasStaff: boolean,
  staffName: string,       // only if hasStaff
  seriesId: string,        // only for recurring bookings, links the series
  createdAt: timestamp
}
```

**Important:** The booking document ID encodes its position (resource, week, day, time, sub-room). Moving a booking means deleting the old document and creating a new one with a different ID.

## app.js Section Map

The file is organized into labeled sections. Use these markers to navigate:

| Line | Section Marker | What It Contains |
|------|---------------|-----------------|
| 1 | `// --- FIREBASE CONFIG ---` | Firebase initialization, auth constants |
| 44 | `// STATE` | All global state variables (resources, bookings, drag/selection/resize state objects) |
| 118 | `function init()` | Bootstrap: sets current week, auth state listener, date picker setup |
| 153 | `// --- AUTH ACTIONS ---` | `doLogin()`, `doLogout()`, `canEditResource()`, `setupRealtimeListeners()` |
| 200 | `// --- CORE LOGIC ---` | `loadBookingsForCurrentView()`, `handleResourceUpdate()`, navigation, `renderGrid()` |
| 486 | `function renderGrid()` | Main grid rendering (~390 lines). Builds time slots, positions booking overlays, attaches event listeners |
| 874 | `// --- DRAG-AND-DROP HANDLERS ---` | Moving existing bookings via drag. Includes validation, conflict checking, drop confirmation |
| 1503 | `// --- DRAG-TO-CREATE HANDLERS ---` | Creating new bookings by clicking and dragging on empty slots |
| 1880 | `// --- RESIZE HANDLERS ---` | Changing booking duration by dragging the bottom edge |
| 2182 | `// --- RESCHEDULE MODE ---` | Multi-step rescheduling: enter mode, navigate to target day/week, click to place |
| 2419 | `// --- MODAL & SAVE ---` | Booking modal form population, `saveBooking()`, `saveRecurringBooking()`, recurring pattern logic |
| 3291 | `// --- CLOSURE DATE MANAGEMENT ---` | Add/remove closure dates, year-based storage, apply closures across resources |
| 3623 | `// --- NEW RESOURCE WITH IMPORT OPTION ---` | Creating resources with option to clone settings from existing ones |
| 3846 | `function saveAllSettings()` | Saves admin panel changes to Firestore |
| 3912 | Popover & highlight functions | Booking hover popover, highlighting |
| 3983 | `function deleteBooking()` | Delete with series-aware logic (single vs. entire series) |
| 4045 | Utility functions | `closeModal()`, `createDiv()`, `formatTime()`, `getWeekKey()`, `escapeHtml()`, etc. |
| 4217 | `// --- STATS FUNCTIONS ---` | Statistics modal, heatmap, dashboard charts, CSV export (~960 lines to end of file) |

## Key Patterns & Conventions

### DOM Manipulation
- All UI is built with direct DOM manipulation (`document.createElement`, `innerHTML`).
- Modals are shown/hidden by toggling `style.display` between `'flex'` and `'none'`.
- The grid is fully re-rendered on every data change via `renderGrid()`.

### Data Flow
- Firestore real-time listeners (`onSnapshot`) update the in-memory `allBookings` map and trigger `renderGrid()`.
- Resources are stored in-memory in the `resources` array and synced to a single Firestore document.
- A `bookingVersion` counter prevents stale listener callbacks from overwriting newer data.

### Slot ID Convention
Slot IDs encode position: `{resId}_{weekKey}_{dayIndex}_{time}[_{subRoomIndex}]`. This is used both as Firestore document IDs and as HTML `data-slot-id` attributes. Many functions parse these IDs to extract day index, time, etc.

### State Objects
Three state objects track interactive operations:
- `dragState` - dragging an existing booking to a new slot
- `selectionState` - drag-to-create a new booking
- `resizeState` - dragging the bottom edge of a booking to change duration

Each follows the pattern: start handler sets state, move handler updates visuals, end handler shows confirmation or saves.

### Error Handling
- Firestore operations are wrapped in try/catch with `showToast()` for error display.
- A loading overlay (`showLoading(true/false)`) is shown during saves.

### Time Representation
- Times are floats: 10.0 = 10:00 AM, 10.5 = 10:30 AM, 10.25 = 10:15 AM.
- Duration is also in float hours: 1.5 = 1 hour 30 minutes.
- `formatTime(val)` converts float to display string (e.g. "10:30am").

## Common Tasks

### Adding a new field to bookings
1. Add the field to the save logic in `saveBooking()` (around line 2574)
2. Add it to the modal form in `index.html` inside `#bookingModal`
3. Populate it in `openBookingModal()` (around line 2420)
4. If it should display on the grid, update the booking overlay rendering in `renderGrid()` (around line 700+)
5. If it should appear in the popover, update `showBookingPopover()` (around line 3918)
6. If it should appear in stats/CSV export, update `renderStatsChart()` and `exportStatsCSV()`

### Adding a new resource setting
1. Add the form control to the admin panel in `index.html` inside `#settingsOverlay`
2. Load the value in `loadSettingsForEditor()` (around line 2941)
3. Save the value in `saveAllSettings()` (around line 3846)
4. Use the setting where needed (typically in `renderGrid()` or `openBookingModal()`)

### Adding a new modal
1. Add the HTML markup in `index.html` following the existing modal pattern (class="modal" wrapper with class="modal-content" child)
2. Show it with `document.getElementById('myModal').style.display = 'flex'`
3. Hide it with `closeModal('myModal')`

## Testing

There is no automated test suite. All testing is manual via the browser.

## Deployment

Static file hosting. No build step required. Just serve `index.html`, `app.js`, and `styles.css`.
