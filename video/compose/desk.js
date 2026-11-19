// The closing "real-world" scene: a library service desk with the schedule open on
// the staff monitor. Everything here is drawn; only the monitor's screen is real
// footage (the last frame of the filmed session).

function deskHTML(screenSrc) {
  // Deterministic pseudo-random so every frame draws the same shelves.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spineColors = ['#8d5b4c', '#4f5f9e', '#3f6f6a', '#c49a3c', '#7a8a99', '#a8664f', '#4a5d7a', '#d2bf96', '#6d4c63', '#55806b'];

  function shelfRow(x0, x1, yBase, maxH) {
    let x = x0, out = '';
    while (x < x1 - 20) {
      const w = 16 + Math.floor(rnd() * 20), h = maxH - 6 - Math.floor(rnd() * 34);
      if (rnd() < 0.08) { x += 24; continue; }              // a gap on the shelf
      const c = spineColors[Math.floor(rnd() * spineColors.length)];
      out += `<rect x="${x}" y="${yBase - h}" width="${w}" height="${h}" rx="2" fill="${c}"/>`;
      if (rnd() < 0.5) out += `<rect x="${x + 3}" y="${yBase - h + 12}" width="${w - 6}" height="3" fill="rgba(255,255,255,.35)"/>`;
      x += w + 2;
    }
    return out;
  }

  let shelves = '';
  for (let r = 0; r < 5; r++) {
    const y = 150 + r * 150;
    shelves += shelfRow(40, 560, y, 128);
    shelves += `<rect x="24" y="${y}" width="552" height="14" fill="#9c7350"/>`;
  }

  return `
  <svg viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute;inset:0">
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe6d6"/><stop offset="1" stop-color="#ddd0bb"/></linearGradient>
      <linearGradient id="deskTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c398"/><stop offset="1" stop-color="#c9a374"/></linearGradient>
      <linearGradient id="deskFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a87a50"/><stop offset="1" stop-color="#8a6240"/></linearGradient>
      <radialGradient id="light" cx="0.3" cy="0.1" r="0.9"><stop offset="0" stop-color="#fff8e8" stop-opacity=".55"/><stop offset="1" stop-color="#fff8e8" stop-opacity="0"/></radialGradient>
      <radialGradient id="vig" cx="0.55" cy="0.45" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2c1d10" stop-opacity=".22"/></radialGradient>
      <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#wall)"/>
    <rect x="0" y="0" width="600" height="760" fill="#8a6545"/>
    <rect x="12" y="10" width="576" height="750" fill="#6e4f35"/>
    ${shelves}

    <!-- wayfinding sign and study-room door, right wall -->
    <rect x="1728" y="70" width="192" height="700" fill="#cbbda5"/>
    <rect x="1752" y="100" width="168" height="660" rx="4" fill="#7d8b8a"/>
    <rect x="1778" y="150" width="60" height="300" rx="3" fill="#b9d3d6" opacity=".85"/>
    <circle cx="1890" cy="440" r="9" fill="#d9c27a"/>
    <g transform="translate(1756,26)">
      <rect width="148" height="64" rx="7" fill="#2c3e50"/>
      <text x="14" y="27" font-family="Inter Caption" font-weight="600" font-size="17" fill="#fff">Study Tables</text>
      <text x="14" y="50" font-family="Inter Caption" font-weight="600" font-size="17" fill="#fff">this way →</text>
    </g>

    <!-- monitor -->
    <rect x="1192" y="640" width="96" height="70" fill="#2a2f35"/>
    <rect x="1120" y="700" width="240" height="16" rx="6" fill="#23282d"/>
    <rect x="776" y="132" width="928" height="532" rx="16" fill="#1f2429"/>
    <rect x="790" y="146" width="900" height="506" fill="#fff"/>
    <rect x="790" y="146" width="900" height="506" fill="url(#glare)"/>

    <!-- desk -->
    <rect x="240" y="712" width="1680" height="30" fill="url(#deskTop)"/>
    <rect x="240" y="742" width="1680" height="338" fill="url(#deskFront)"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${300 + i * 120}" y="742" width="2" height="338" fill="rgba(0,0,0,.07)"/>`).join('')}
    <rect x="240" y="742" width="1680" height="6" fill="rgba(0,0,0,.12)"/>

    <!-- keyboard -->
    <rect x="1010" y="696" width="420" height="20" rx="5" fill="#3a4047"/>
    <rect x="1018" y="699" width="404" height="6" rx="2" fill="#565d66"/>
    <!-- books on the desk -->
    <rect x="360" y="652" width="210" height="22" rx="3" fill="#4f5f9e"/>
    <rect x="372" y="630" width="190" height="22" rx="3" fill="#c49a3c"/>
    <rect x="352" y="674" width="226" height="38" rx="3" fill="#3f6f6a"/>
    <rect x="356" y="686" width="218" height="4" fill="rgba(255,255,255,.3)"/>
    <!-- mug -->
    <rect x="660" y="640" width="64" height="72" rx="8" fill="#26a69a"/>
    <path d="M724 656 q30 0 30 22 q0 22 -30 22" fill="none" stroke="#26a69a" stroke-width="9"/>
    <!-- plant -->
    <path d="M1740 712 l12 -64 h76 l12 64 z" fill="#b5502f"/>
    <g fill="#4a7a5e">
      <ellipse cx="1790" cy="610" rx="22" ry="54" transform="rotate(-18 1790 610)"/>
      <ellipse cx="1820" cy="600" rx="20" ry="60" transform="rotate(14 1820 600)"/>
      <ellipse cx="1765" cy="625" rx="18" ry="44" transform="rotate(-48 1765 625)"/>
      <ellipse cx="1848" cy="628" rx="17" ry="42" transform="rotate(44 1848 628)"/>
    </g>
    <rect width="1920" height="1080" fill="url(#light)"/>
    <rect width="1920" height="1080" fill="url(#vig)"/>
  </svg>
  <img src="${screenSrc}" style="position:absolute;left:790px;top:146px;width:900px;height:506px">
  <div style="position:absolute;left:790px;top:146px;width:900px;height:506px;background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,0) 45%)"></div>`;
}
