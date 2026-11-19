// The explainer's script: scene order, durations, on-screen lines, camera, tips.
// Times inside a scene are seconds from that scene's start. Camera focus points
// (cx, cy) are in recorded-frame pixels (1920x1080 = the 1440x810 page at 4/3).
// <mark> highlights a key term as a whole; keep each <mark> to whole words.

// Recorded-frame coordinates for things the camera visits (from the takes' logged boxes).
// Zooms keep the column headers (and, at the left edge, the time column) in frame.
const AT = {
  menu: { cx: 956, cy: 81 },
  header: { cx: 857, cy: 300 },     // left-anchored so the resource name isn't clipped
  nowTopLeft: { cx: 640, cy: 360 },
  table2: { cx: 1013, cy: 530 },
  tables23: { cx: 1300, cy: 547 },
  table2Late: { cx: 1013, cy: 547 },
  benjamin: { cx: 1600, cy: 530 },
  modal: { cx: 960, cy: 545 },
  centre: { cx: 960, cy: 540 },
}
const cam = (t, z, at) => ({ t, z, ...at });

const SCRIPT = {
  fps: 30,
  fadeIn: 0.8,
  fadeOut: 1.6,
  stepsTitle: 'A typical booking',
  steps: ['Sign in', 'Find the time', 'Book it', 'Make changes'],
  // Decorative booking-like blocks on the title card, in the app's own colors.
  titleBlocks: [
    [0, 0, 150, 120, '#5c6bc0'], [170, 40, 150, 170, '#26a69a'],
    [0, 140, 150, 90, '#26a69a'], [170, 230, 150, 110, '#5c6bc0'],
    [0, 250, 150, 190, '#5c6bc0'], [170, 360, 150, 80, '#e5b829'],
  ],
  scenes: [
    { id: 'title', type: 'title', dur: 5.0,
      eyebrow: 'For library staff',
      title: 'Library Reservations',
      sub: 'One shared schedule for the rooms, equipment and appointments patrons book with us.' },

    { id: 'login', type: 'footage', clip: 'login', clipFrom: 1.0, dur: 9.5, xfade: 0.8, step: 1,
      camera: [cam(0, 1.18, AT.centre), cam(4.6, 1.18, AT.centre), cam(5.8, 1, AT.centre)],
      captions: [
        { from: 0.4, to: 5.3, text: 'Open Library Reservations and enter the <mark>shared access code</mark>.' },
        { from: 5.7, to: 9.3, text: 'The schedule opens on <mark>today</mark>.' },
      ] },

    { id: 'read', type: 'footage', clip: 'read', clipFrom: 0.0, dur: 13.5, xfade: 0.6, step: 2,
      camera: [cam(0, 1, AT.centre), cam(0.4, 1, AT.centre), cam(1.6, 1.45, AT.menu), cam(4.0, 1.45, AT.menu),
               cam(5.0, 1, AT.centre), cam(8.6, 1, AT.centre), cam(9.8, 1.5, AT.nowTopLeft)],
      rings: [{ from: 0.9, to: 4.3, src: 'resourceSelect' }],
      captions: [
        { from: 0.3, to: 4.4, text: 'Each room or service has its own schedule. Pick one from the <mark>resource menu</mark>.' },
        { from: 4.7, to: 8.8, text: 'Here each <mark>column</mark> is a table and times run down. Colored blocks are bookings.' },
        { from: 9.1, to: 13.3, text: 'The <mark>red line</mark> marks the time right now; bookings in progress say Now.' },
      ] },

    { id: 'book', type: 'footage', clip: 'book', clipFrom: 1.0, dur: 33.0, xfade: 0.6, step: 3,
      camera: [cam(0, 1, AT.centre), cam(3.8, 1, AT.centre), cam(4.8, 1.12, AT.header), cam(6.9, 1.12, AT.header),
               cam(8.1, 1.3, AT.table2), cam(14.4, 1.3, AT.table2), cam(15.4, 1.45, AT.modal),
               cam(26.8, 1.45, AT.modal), cam(28.0, 1.3, AT.table2)],
      rings: [{ from: 4.4, to: 5.2, src: 'nextDay' }],
      captions: [
        { from: 0.3, to: 3.9, text: 'A patron asks for a study table tomorrow, from 2 to 4.' },
        { from: 4.2, to: 9.0, text: 'Use the <mark>arrows</mark> or the date box to change the day.' },
        { from: 9.3, to: 14.6, text: '<mark>Drag</mark> down the empty slots to cover their time.' },
        { from: 15.0, to: 24.0, text: 'Type the <mark>patron or event name</mark>. A note is optional.' },
        { from: 24.4, to: 32.8, text: 'Click <mark>Save Booking</mark>. Everyone with the schedule open sees it right away.' },
      ] },

    { id: 'hover', type: 'footage', clip: 'hover', clipFrom: 0.5, dur: 12.5, xfade: 0.6, step: 3,
      camera: [cam(0, 1.3, AT.table2), cam(6.4, 1.3, AT.table2), cam(7.4, 1.45, AT.modal)],
      captions: [
        { from: 0.3, to: 12.3, text: 'Hover over a booking for a quick look. <mark>Click</mark> it for the full details and notes.' },
      ] },

    { id: 'move', type: 'footage', clip: 'move', clipFrom: 1.0, dur: 13.5, xfade: 0.6, step: 4, ghost: 'dragSource',
      camera: [cam(0, 1.25, AT.tables23), cam(6.0, 1.25, AT.tables23), cam(7.0, 1.4, AT.modal),
               cam(11.1, 1.4, AT.modal), cam(12.2, 1.25, AT.tables23)],
      captions: [
        { from: 0.3, to: 6.1, text: 'Plans change? <mark>Drag</mark> the booking to a new time or table.' },
        { from: 6.5, to: 13.3, text: 'Check the details, then click <mark>Move Booking</mark>.' },
      ] },

    { id: 'resize', type: 'footage', clip: 'resize', clipFrom: 1.0, dur: 13.5, xfade: 0.6, step: 4,
      camera: [cam(0, 1.3, AT.benjamin), cam(6.4, 1.3, AT.benjamin), cam(7.4, 1.4, AT.modal),
               cam(11.0, 1.4, AT.modal), cam(12.0, 1.3, AT.benjamin)],
      captions: [
        { from: 0.3, to: 6.3, text: 'Patron needs more time? Drag the booking’s <mark>bottom edge</mark>.' },
        { from: 6.6, to: 13.3, text: 'Check the new length, then click <mark>Update Duration</mark>.' },
      ] },

    { id: 'details', type: 'footage', clip: 'details', clipFrom: 1.5, dur: 9.0, xfade: 0.6, step: 4,
      camera: [cam(0, 1.25, AT.tables23), cam(1.3, 1.25, AT.tables23), cam(2.3, 1.45, AT.modal)],
      rings: [{ from: 2.4, to: 8.7, src: 'moveDay' }],
      captions: [
        { from: 0.3, to: 8.8, text: 'For another day, open the booking and use <mark>Move to another day…</mark>' },
      ] },

    { id: 'delete', type: 'footage', clip: 'delete', clipFrom: 1.0, dur: 13.0, xfade: 0.6, step: 4,
      camera: [cam(0, 1.25, AT.table2Late), cam(1.5, 1.25, AT.table2Late), cam(2.5, 1.45, AT.modal),
               cam(9.5, 1.45, AT.modal), cam(10.4, 1.25, AT.table2Late)],
      rings: [{ from: 3.2, to: 6.4, src: 'delete' }],
      captions: [
        { from: 0.3, to: 7.4, text: 'A patron cancels? Open their booking and click <mark>Delete</mark>.' },
        { from: 7.7, to: 12.8, text: 'Your browser asks <mark>“Delete booking?”</mark> Click OK, and it’s gone.' },
      ] },

    { id: 'altn', type: 'footage', clip: 'altn', clipFrom: 0.4, dur: 6.5, xfade: 0.8, step: 5,
      camera: [cam(0, 1.25, AT.nowTopLeft)],
      tips: [{ from: 0.8, to: 6.3, text: '<kbd>Alt</kbd> + <kbd>N</kbd> brings you back to <mark>today</mark> and highlights the next hour.' }] },

    { id: 'week', type: 'footage', clip: 'week', clipFrom: 0, dur: 10.5, xfade: 0.8, step: 5,
      tips: [
        { from: 0.5, to: 5.1, text: 'Some resources show a whole <mark>week</mark> at a time.' },
        { from: 5.4, to: 10.3, text: 'Some double-check the date when you book a <mark>later day</mark>.' },
      ] },

    { id: 'desk', type: 'desk', clip: 'delete', clipAt: 16.5, dur: 10.5, xfade: 1.0, cardFrom: 0.9,
      card: `<div class="k">Try it</div>
             <div class="url">blubrd92.github.io/LibraryReservations</div>
             <div class="t">Sign in with the shared access code. Bookings are real, so everyone sees what you add.</div>` },
  ],
};
