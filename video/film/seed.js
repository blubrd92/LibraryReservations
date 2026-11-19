// Seeds the LOCAL Firebase emulators with invented sample data for filming.
// Never points at production: the emulator hosts are hard-coded below, and the
// project id starts with "demo-", which the Firebase tools treat as offline-only.
//
// Every name here is invented. The week filmed is Sun Nov 29 - Sat Dec 5, 2026,
// and the app's clock is set to Tuesday Dec 1, 2026 at 10:40am (see harness.js).

const PROJECT = 'demo-library-reservations';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099';
// Two different codes so the filmed login lands on the staff (viewer) role,
// the one this video's audience uses. Both are film-only inventions.
const PASSWORD = 'film-only-staff-code';
const ADMIN_PASSWORD = 'film-only-admin-code';
const WEEK = '2026-11-29';

// Hours: [Sun_start, Sun_end, Mon_start, Mon_end, ...]; Sunday closed.
const HOURS = [0, 0, 10, 18, 10, 20, 10, 18, 10, 18, 10, 17, 10, 17];

const base = {
  hours: HOURS, maxDuration: 2, closuresByYear: { '2026': [{ date: '2026-12-24', endDate: '2026-12-26', reason: 'Winter Holiday' }] },
  subRooms: [], colorPalette: 'default', useQuarterHour: false, hasStaffField: false, staffNames: [],
  defaultShowNotes: false, allowRecurring: true, confirmFutureBooking: false,
  advanceLimitEnabled: false, advanceLimitDays: 30, advanceLimitAdminBypass: true, adminOnly: false,
  cosmeticCloseMinutes: 0, anonymityBufferMonths: 1, enableSidebar: false, sidebarText: '',
};

const resources = [
  { ...base, id: 'res-study', name: 'Group Study Room', viewMode: 'week' },
  { ...base, id: 'res-pods', name: 'Quiet Study Pods', viewMode: 'day', colorPalette: 'ocean',
    subRooms: [
      { id: 'pod-1', name: 'Pod 1', active: true, displayOrder: 0 },
      { id: 'pod-2', name: 'Pod 2', active: true, displayOrder: 1 },
      { id: 'pod-3', name: 'Pod 3', active: true, displayOrder: 2 },
      { id: 'pod-4', name: 'Pod 4', active: true, displayOrder: 3 },
    ] },
  { ...base, id: 'res-tech', name: 'Tech Help Appointments', viewMode: 'week', colorPalette: 'slate',
    useQuarterHour: true, maxDuration: 1, hasStaffField: true,
    staffNames: ['Dana R.', 'Marcus L.', 'Priya S.', 'Tomás G.'] },
  { ...base, id: 'res-studio', name: 'Recording Studio', viewMode: 'week', colorPalette: 'warm', adminOnly: true },
];

// [resId, dayIndex, start, duration, name, notes, showNotes, subIndex?, staff?]
const bookings = [
  ['res-study', 1, 10, 2, 'Amara Okafor', '', false],
  ['res-study', 1, 13, 1.5, 'Nursing Exam Study Group', '', false],
  ['res-study', 1, 16, 2, 'Diego Fuentes', '', false],
  ['res-study', 2, 10, 1, 'Mei Chen', '', false],
  ['res-study', 2, 12, 2, 'ESL Conversation Circle', 'Volunteer brings flashcards', true],
  ['res-study', 2, 15.5, 1.5, 'Ravi Menon', '', false],
  ['res-study', 2, 18, 2, 'Teen Board Game Night', '', false],
  ['res-study', 3, 11, 2, 'Grace Kim', '', false],
  ['res-study', 3, 14, 1, 'Tomasz Nowak', '', false],
  ['res-study', 4, 10.5, 1.5, 'Small Business Office Hours', '', false],
  ['res-study', 4, 13, 2, 'Lucía Herrera', '', false],
  ['res-study', 5, 10, 2, 'Citizenship Test Prep', '', false],
  ['res-study', 5, 14, 2, 'Jonah Whitfield', '', false],
  ['res-study', 6, 11, 2, 'Family History Club', '', false],
  ['res-study', 6, 14, 1, 'Keiko Tanaka', '', false],
  // Quiet Study Pods (day view): Tuesday, one column per pod.
  ['res-pods', 2, 10, 2, 'Noor Al-Sayed', '', false, 0],
  ['res-pods', 2, 14, 2, 'Isabel Duarte', '', false, 0],
  ['res-pods', 2, 10.5, 1.5, 'Chris Park', '', false, 1],
  ['res-pods', 2, 15, 2, 'Aiyana Tsosie', '', false, 1],
  ['res-pods', 2, 11, 2, 'Elena Petrova', '', false, 2],
  ['res-pods', 2, 13, 1, 'Kofi Mensah', '', false, 3],
  ['res-pods', 2, 16, 2, 'Marisol Vega', '', false, 3],
];

function fsValue(v) {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsValue(x)])) } };
}

async function put(path, data) {
  // "Bearer owner" is the emulator's admin bypass, for seeding only.
  const r = await fetch(`${FS}/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fsValue(data).mapValue.fields }),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}

async function main() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  for (const [email, password] of [['staff@library.internal', ADMIN_PASSWORD], ['viewer@library.internal', PASSWORD]]) {
    const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    if (!r.ok) throw new Error(`signUp ${email}: ${await r.text()}`);
  }
  await put('system/resources', { list: resources });
  // Janitor already ran this month, so it doesn't rewrite anything mid-take.
  await put('system/janitor', { lastRunMonth: '2026-12' /* app format: YYYY-M */ });
  for (const [resId, day, start, duration, name, notes, showNotes, sub, staff] of bookings) {
    let id = `${resId}_${WEEK}_${day}_${start}`;
    if (sub !== undefined && sub !== null) id += `_${sub}`;
    const doc = { name, duration, notes, showNotes, hasStaff: !!staff, staffName: staff || '' };
    await put(`appointments/${id}`, doc);
  }
  console.log(`Seeded ${resources.length} resources and ${bookings.length} bookings.`);
}

module.exports = { PASSWORD, ADMIN_PASSWORD, WEEK, main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
