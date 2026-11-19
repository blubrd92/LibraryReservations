// The explainer's script: scene order, durations, on-screen lines, camera, tips.
// Times inside a scene are seconds from that scene's start. Camera focus points
// (cx, cy) are in recorded-frame pixels (1920x1080 = the 1440x810 page at 4/3).
// <mark> highlights a key term as a whole; keep each <mark> to whole words.

// Recorded-frame coordinates for things the camera visits (from the takes' logged boxes).
const AT = {
  menu: { cx: 890, cy: 86 },
  // Zooms that keep the day headers (and, at the left edge, the time column) in frame.
  todayTop: { cx: 600, cy: 337 },
  todayTopWide: { cx: 662, cy: 372 },
  thuAfternoon: { cx: 1266, cy: 600 },
  wedThuAfternoon: { cx: 1150, cy: 600 },
  wedAfternoon: { cx: 1017, cy: 600 },
  modal: { cx: 960, cy: 545 },
  centre: { cx: 960, cy: 540 },
};
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
    { id: 'title', type: 'title', dur: 5.5,
      eyebrow: 'For library staff',
      title: 'Library Reservations',
      sub: 'One shared schedule for the rooms, equipment and appointments patrons book with us.' },

    { id: 'login', type: 'footage', clip: 'login', clipFrom: 1.0, dur: 10.5, xfade: 0.8, step: 1,
      camera: [cam(0, 1.18, AT.centre), cam(4.6, 1.18, AT.centre), cam(5.8, 1, AT.centre)],
      captions: [
        { from: 0.4, to: 5.4, text: 'Open Library Reservations and enter the <mark>shared access code</mark>.' },
        { from: 5.9, to: 10.3, text: 'The schedule opens on <mark>today</mark>.' },
      ] },

    { id: 'read', type: 'footage', clip: 'read', clipFrom: 0.0, dur: 15.0, xfade: 0.6, step: 2,
      camera: [cam(0, 1, AT.centre), cam(0.5, 1, AT.centre), cam(1.8, 1.45, AT.menu), cam(4.6, 1.45, AT.menu),
               cam(5.8, 1, AT.centre), cam(10.0, 1, AT.centre), cam(11.2, 1.6, AT.todayTop)],
      rings: [
        { from: 1.0, to: 4.8, src: 'resourceSelect' },
        { from: 11.0, to: 14.8, src: 'today' },
      ],
      captions: [
        { from: 0.3, to: 5.0, text: 'Each room or service has its own schedule. Pick one from the <mark>resource menu</mark>.' },
        { from: 5.4, to: 9.9, text: 'Days run across, times run down. <mark>Colored blocks</mark> are bookings; grey is closed.' },
        { from: 10.3, to: 14.8, text: 'Today is underlined, and the <mark>red line</mark> marks the time right now.' },
      ] },

    { id: 'book', type: 'footage', clip: 'book', clipFrom: 1.5, dur: 27.5, xfade: 0.6, step: 3,
      camera: [cam(0, 1, AT.centre), cam(3.0, 1, AT.centre), cam(4.2, 1.3, AT.thuAfternoon), cam(9.4, 1.3, AT.thuAfternoon),
               cam(10.4, 1.45, AT.modal), cam(20.6, 1.45, AT.modal), cam(21.8, 1.3, AT.thuAfternoon)],
      captions: [
        { from: 0.3, to: 4.4, text: 'A patron asks for this room on Thursday, from 3 to 5.' },
        { from: 4.7, to: 9.9, text: '<mark>Drag</mark> down the empty slots to cover their time.' },
        { from: 10.3, to: 18.6, text: 'Type the <mark>patron or event name</mark>. A note is optional.' },
        { from: 19.0, to: 27.3, text: 'Click <mark>Save Booking</mark>. Everyone with the schedule open sees it right away.' },
      ] },

    { id: 'move', type: 'footage', clip: 'move', clipFrom: 1.0, dur: 14.0, xfade: 0.6, step: 4,
      camera: [cam(0, 1.25, AT.wedThuAfternoon), cam(6.2, 1.25, AT.wedThuAfternoon), cam(7.2, 1.4, AT.modal),
               cam(11.2, 1.4, AT.modal), cam(12.3, 1.25, AT.wedAfternoon)],
      captions: [
        { from: 0.3, to: 6.2, text: 'Plans change? <mark>Drag</mark> the booking to its new time.' },
        { from: 6.6, to: 13.8, text: 'Check the details, then click <mark>Move Booking</mark>.' },
      ] },

    { id: 'details', type: 'footage', clip: 'details', clipFrom: 1.5, dur: 11.0, xfade: 0.6, step: 4,
      camera: [cam(0, 1.25, AT.wedAfternoon), cam(1.4, 1.25, AT.wedAfternoon), cam(2.5, 1.45, AT.modal)],
      rings: [{ from: 6.0, to: 10.8, src: 'moveWeek' }],
      captions: [
        { from: 0.3, to: 5.5, text: 'Click a booking to change its details, or to <mark>Delete</mark> it.' },
        { from: 5.9, to: 10.8, text: 'Moving it to a day that isn’t on screen? Use <mark>Move to another…</mark>' },
      ] },

    { id: 'altn', type: 'footage', clip: 'altn', clipFrom: 0.4, dur: 6.5, xfade: 0.8, step: 5,
      camera: [cam(0, 1.45, AT.todayTopWide)],
      tips: [{ from: 0.9, to: 6.3, text: '<kbd>Alt</kbd> + <kbd>N</kbd> jumps to <mark>now</mark> and highlights the next hour.' }] },

    { id: 'pods', type: 'footage', clip: 'pods', clipFrom: 0, dur: 9.5, xfade: 0.8, step: 5,
      tips: [
        { from: 0.6, to: 4.9, text: 'Some resources show one <mark>day</mark> at a time, with a column for each room.' },
        { from: 5.2, to: 9.4, text: 'Some double-check the date when you book a <mark>later day</mark>.' },
      ] },

    { id: 'desk', type: 'desk', clip: 'details', clipAt: 19.5, dur: 10.5, xfade: 1.0, cardFrom: 1.0,
      card: `<div class="k">Try it</div>
             <div class="url">blubrd92.github.io/LibraryReservations</div>
             <div class="t">Sign in with the shared access code. Bookings are real, so everyone sees what you add.</div>` },
  ],
};
