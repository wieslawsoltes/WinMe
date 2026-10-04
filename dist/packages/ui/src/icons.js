// Original, deliberately pixel-aligned interface icons. No emoji or platform icon fonts.
const box = (x, y, w, h, fill, stroke) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ''}/>`;
const path = (d, fill, stroke) =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ''}/>`;
const line = (x1, y1, x2, y2, stroke) =>
  `<path d="M${x1} ${y1}H${x2}" fill="none" stroke="${stroke}"/>`;
const paper =
  box(7, 2, 19, 27, '#000') +
  box(8, 3, 16, 25, '#fff') +
  path('M20 3v6h5', '#c0c0c0', '#808080') +
  box(10, 12, 12, 1, '#808080') +
  box(10, 15, 12, 1, '#808080') +
  box(10, 18, 10, 1, '#808080') +
  box(10, 21, 11, 1, '#808080');
const folder =
  path('M2 9V5h10l3 3h14v21H2z', '#000') +
  path('M3 6h9l3 3h13v18H3z', '#ffdc64') +
  path('M1 12h28l-3 17H2z', '#ffe99c', '#806a26') +
  path('M2 13h26v2H3v12H2z', '#ffffd5');
const computer =
  box(5, 2, 23, 20, '#000') +
  box(6, 3, 21, 18, '#d4d0c8') +
  box(8, 5, 17, 13, '#000') +
  path('M9 6h15v11H9z', '#0a66c7') +
  path('M10 7h12l-12 8z', '#55d5ff') +
  box(14, 22, 7, 3, '#c0c0c0') +
  path('M4 25h24l3 5H1z', '#d4d0c8', '#000') +
  box(4, 26, 24, 1, '#fff') +
  box(23, 28, 4, 1, '#000');
const flag =
  path('M9 4l9 2 9-2v19l-9 3-9-2z', '#000') +
  path('M10 6l7 1v7l-7-1z', '#f33') +
  path('M19 7l6-2v7l-6 2z', '#2ba849') +
  path('M10 15l7 1v7l-7-2z', '#297dde') +
  path('M19 16l6-2v7l-6 3z', '#ffdf23') +
  box(3, 6, 3, 3, '#000') +
  box(4, 11, 3, 3, '#000') +
  box(2, 16, 3, 3, '#000') +
  box(5, 21, 3, 3, '#000') +
  box(0, 9, 2, 2, '#000');
const images = {
  computer,
  windows: flag,
  folder,
  documents:
    paper +
    path('M1 17h10l3 3h15l-3 10H2z', '#ffe68a', '#867130') +
    path('M2 18h9v2H3v9H2z', '#fff9c7'),
  disk:
    path('M3 13l7-8h17l3 8v14H3z', '#000') +
    path('M4 14h25v12H4z', '#d4d0c8') +
    path('M4 12l7-6h15l2 6z', '#aaa') +
    box(6, 17, 20, 3, '#666') +
    box(6, 21, 2, 2, '#05a431') +
    box(22, 21, 4, 2, '#808080'),
  floppy:
    box(4, 3, 24, 26, '#222') +
    box(5, 4, 22, 24, '#393c94') +
    box(9, 4, 13, 10, '#ddd') +
    box(17, 5, 4, 8, '#444') +
    box(9, 18, 15, 10, '#fff') +
    box(11, 20, 10, 1, '#999') +
    box(11, 23, 10, 1, '#999'),
  cd: '<circle cx="16" cy="16" r="13" fill="#e5e5e5" stroke="#777"/><path d="M16 3v9l10-5M29 16h-9l6 10M16 29v-9L6 26M3 16h9L6 6" fill="#8accca"/><circle cx="16" cy="16" r="4" fill="#fff" stroke="#888"/>',
  file: paper,
  notepad:
    box(5, 3, 23, 25, '#000') +
    box(6, 4, 20, 23, '#fff') +
    path('M7 7h17M7 11h17M7 15h17M7 19h17M7 23h17', 'none', '#5789a6') +
    path('M9 2v5M14 2v5M19 2v5M24 2v5', 'none', '#444') +
    path('M4 4v23h22v2H3V4z', '#999'),
  wordpad: paper + path('M3 10l2 13h3l3-8 2 8h3l5-13h-4l-3 9-2-9h-3l-3 9-1-9z', '#194c9f'),
  paint:
    '<ellipse cx="15" cy="18" rx="13" ry="11" fill="#e1c38a" stroke="#684b28"/><circle cx="7" cy="17" r="2" fill="red"/><circle cx="11" cy="11" r="2" fill="#12ab22"/><circle cx="20" cy="12" r="2" fill="blue"/><circle cx="22" cy="21" r="2" fill="#fff300"/><ellipse cx="11" cy="23" rx="3" ry="2" fill="#3a6ea5"/>' +
    path('M13 20L27 2l3 1-14 20z', '#825320', '#000') +
    path('M11 26l2-7 4 3z', '#d9dadc', '#333'),
  calculator:
    box(5, 2, 22, 28, '#000') +
    box(6, 3, 20, 26, '#c0c0c0') +
    box(8, 5, 16, 6, '#fff') +
    box(10, 7, 12, 2, '#2b2b2b') +
    [0, 1, 2]
      .map((y) =>
        [0, 1, 2, 3]
          .map((x) => box(8 + x * 4, 14 + y * 5, 3, 3, y === 0 && x === 3 ? '#a33' : '#444'))
          .join(''),
      )
      .join(''),
  ie: '<ellipse cx="17" cy="16" rx="10" ry="12" fill="#034dcc" stroke="#002976"/><ellipse cx="17" cy="14" rx="5" ry="6" fill="#3a6ea5"/><path d="M6 16h23v5H11l2 5h12l-2 3H12L6 23z" fill="#007aff"/><ellipse cx="16" cy="16" rx="17" ry="6" fill="none" stroke="#82c4fa" stroke-width="2" transform="rotate(-39 16 16)"/><path d="M11 5l11-2" stroke="#b2e2ff"/>',
  recycle:
    path('M7 8h20l-3 21H10z', '#e7e7e7', '#737373') +
    '<ellipse cx="17" cy="8" rx="10" ry="4" fill="#ccc" stroke="#666"/><ellipse cx="17" cy="7" rx="7" ry="2" fill="#eee"/>' +
    path('M14 13l4-3 2 6h-4l2-3M22 16l3 4-6 2v-4l3 2M18 25l-6 1 1-6 4 2-3 2', 'none', '#3756d7'),
  network:
    '<circle cx="10" cy="11" r="9" fill="#008b8b" stroke="#005656"/><path d="M4 5l5 1 3 5-4 1-1 7M13 4l3 6-3 6" fill="#56d321"/>' +
    box(17, 7, 14, 12, '#000') +
    box(18, 8, 12, 10, '#ccc') +
    box(20, 10, 8, 6, '#0084dd') +
    box(17, 21, 14, 3, '#ccc') +
    box(3, 20, 13, 10, '#111') +
    box(4, 21, 11, 7, '#bbb') +
    box(6, 22, 7, 5, '#0788d3'),
  mail:
    '<path d="M4 12L16 3l12 9v17H4z" fill="#eee" stroke="#777"/><path d="M5 14l11 8 11-8M5 28l8-9M27 28l-8-9" fill="none" stroke="#999"/>' +
    path('M2 5h9v8H2z', '#2159c0', '#000') +
    path('M6 3h11v3H9v9H6z', '#ffdf60'),
  media:
    box(4, 4, 24, 23, '#858585') +
    box(5, 5, 22, 21, '#080d29') +
    box(7, 7, 18, 16, '#375996') +
    path('M11 6l17 10-17 10z', '#ffdb42', '#fff2a5') +
    path('M14 10l10 6-10 6z', '#1574c3') +
    box(2, 25, 11, 6, '#ddd') +
    path('M4 29v-3h6m-3-2l3 2-3 2', 'none', '#111'),
  movie:
    box(2, 5, 28, 23, '#111') +
    box(6, 8, 20, 17, '#92d0ed') +
    path('M4 7l24 19M28 7L4 26', 'none', '#444') +
    path('M12 9l12 8-12 6z', '#3b66a8') +
    box(3, 2, 26, 5, '#111') +
    [0, 1, 2, 3, 4].map((i) => path(`M${4 + i * 5} 2h3l-2 5h-3z`, '#fff')).join(''),
  sound:
    path('M3 12h7l9-8v24l-9-8H3z', '#d4d0c8', '#574827') +
    path('M11 11l6-5v20l-6-6z', '#ffdf47') +
    path('M23 10q7 6 0 12M21 13q4 3 0 6', 'none', '#000'),
  control:
    box(2, 6, 28, 21, '#000') +
    box(3, 7, 26, 19, '#ddd') +
    box(4, 8, 24, 3, '#0a246a') +
    box(7, 15, 5, 7, '#03ac86') +
    box(15, 14, 9, 3, '#1869c5') +
    box(15, 19, 9, 3, '#af3030'),
  display: computer,
  cmd:
    box(2, 5, 28, 22, '#000') +
    box(3, 6, 26, 3, '#0a246a') +
    path('M6 14l4 3-4 3M13 21h7', 'none', '#fff'),
  help:
    paper +
    '<circle cx="21" cy="22" r="9" fill="#fcdf26" stroke="#555"/><path d="M18 19c0-5 7-5 7-1 0 3-5 3-5 6M20 26h1" fill="none" stroke="#111" stroke-width="2"/>',
  search:
    folder +
    '<circle cx="17" cy="16" r="8" fill="#bef0ff" fill-opacity=".8" stroke="#333" stroke-width="2"/><path d="M22 22l7 7" stroke="#111" stroke-width="5"/>',
  run:
    box(2, 7, 24, 18, '#ddd') +
    box(3, 8, 22, 3, '#0a246a') +
    path('M9 14h12v4h-6v4H9z', '#777') +
    path('M21 18h10M26 13l5 5-5 5', 'none', '#000'),
  shutdown:
    computer +
    '<circle cx="23" cy="22" r="8" fill="#c11" stroke="#fff"/><path d="M23 16v6M19 18a5 5 0 1 0 8 0" fill="none" stroke="#fff" stroke-width="2"/>',
  logoff:
    '<circle cx="12" cy="9" r="6" fill="#ffe0a2" stroke="#555"/><path d="M2 27v-5c0-9 20-9 20 0v5z" fill="#24848b" stroke="#333"/>' +
    path('M19 16h12M26 12l5 4-5 4', 'none', '#000'),
  clock:
    '<circle cx="16" cy="16" r="13" fill="#fff" stroke="#777" stroke-width="3"/><path d="M16 5v11l7 3M6 16h2M24 16h2M16 24v2" fill="none" stroke="#000" stroke-width="2"/>',
  game:
    box(3, 4, 18, 26, '#000') +
    box(4, 5, 16, 24, '#fff') +
    path('M6 7h3v2H6zM8 11l4 6-4 6-4-6z', '#e00000') +
    path('M13 5l15 3-4 23-15-3z', '#172e7f', '#fff') +
    path('M16 9l8 1-2 16-8-1z', 'none', '#93abe7'),
  mines:
    box(4, 4, 24, 25, '#ddd') +
    path('M8 5v23M14 5v23M20 5v23M26 5v23M5 10h22M5 16h22M5 22h22', 'none', '#777') +
    '<circle cx="18" cy="17" r="7" fill="#000"/>' +
    path('M18 7v20M8 17h20M11 10l14 14M25 10L11 24', 'none', '#000') +
    box(15, 13, 3, 3, '#fff'),
  pinball:
    '<circle cx="16" cy="12" r="9" fill="#aeb6c2" stroke="#222"/><circle cx="13" cy="8" r="4" fill="#fff"/><path d="M2 25l11 4 3-4-11-5zM30 25l-11 4-3-4 11-5z" fill="#dc3030" stroke="#651111"/>',
  registry: [0, 1, 2]
    .map((y) =>
      [0, 1, 2]
        .map((x) => box(4 + x * 8, 4 + y * 8, 6, 6, (x + y) % 2 ? '#008387' : '#45cdd3', '#004447'))
        .join(''),
    )
    .join(''),
  briefcase:
    path('M11 4h10v4h8v21H3V8h8z', '#73602a', '#111') +
    box(12, 5, 8, 3, '#3a6ea5') +
    box(4, 9, 24, 18, '#a69558') +
    box(5, 10, 22, 1, '#e4dca0') +
    box(4, 16, 24, 2, '#665523') +
    box(14, 15, 4, 5, '#ddd', '#222'),
  printer:
    box(7, 2, 18, 16, '#000') +
    box(8, 3, 16, 14, '#fff') +
    path('M3 13h26v12H3z', '#b4b4b4', '#000') +
    box(5, 15, 22, 5, '#ddd') +
    box(7, 20, 18, 9, '#111') +
    box(9, 20, 14, 10, '#eee') +
    box(23, 16, 2, 2, '#2d3'),
  keyboard:
    path('M4 10h23l4 14H1z', '#ddd', '#111') +
    [0, 1, 2]
      .map((y) => [0, 1, 2, 3, 4, 5].map((x) => box(5 + x * 3, y * 3 + 12, 2, 2, '#555')).join(''))
      .join('') +
    box(10, 22, 13, 1, '#555'),
  mouse:
    '<path d="M8 24V13C8 2 25 2 25 13v11c0 8-17 8-17 0z" fill="#ddd" stroke="#333"/><path d="M17 5v11M9 16h15M17 5V1" fill="none" stroke="#444"/>',
  globe:
    '<circle cx="16" cy="16" r="13" fill="#126bc4" stroke="#00215c"/><path d="M4 12l5-5 6 2v6l-6 4-3-3M17 4l7 6-3 8-6 2-1 8 6-2 4-8" fill="#55bb47"/><ellipse cx="16" cy="16" rx="6" ry="13" fill="none" stroke="#88c5e9"/><path d="M4 12h24M4 20h24" stroke="#88c5e9"/>',
  accessibility:
    '<circle cx="17" cy="5" r="3" fill="#fff" stroke="#0a246a"/><path d="M17 10v11h10l3 8M17 15h8M12 15a8 8 0 1 0 10 12" fill="none" stroke="#194798" stroke-width="3"/>',
  task:
    box(2, 5, 28, 24, '#ddd', '#000') +
    box(3, 6, 26, 4, '#0a246a') +
    box(5, 13, 10, 13, '#fff') +
    box(17, 13, 10, 13, '#000') +
    path('M18 24l2-6 2 2 2-5 2 7', 'none', '#0f0'),
  arrow: path('M3 14h16V6l11 10-11 10v-8H3z', '#1c9838', '#07521b'),
  up: path('M14 29V12H6L17 1l11 11h-8v17z', '#b29831', '#796827'),
  stop:
    path('M9 2h14l8 8v13l-8 8H9l-8-8V10z', '#c31f24', '#777') +
    path('M9 9l14 14M23 9L9 23', 'none', '#fff'),
};
export function iconSVG(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">${images[name] ?? images.file}</svg>`;
}
export function icon(name, size = 32, title = '') {
  const image = document.createElement('img');
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSVG(name));
  image.width = image.height = size;
  image.alt = title;
  image.draggable = false;
  image.className = 'pixel-icon';
  return image;
}
export function fileIcon(node) {
  if (node.kind === 'directory')
    return node.path?.length === 3 ? (node.path[0] === 'D' ? 'cd' : 'disk') : 'folder';
  const ext = node.name?.split('.').pop()?.toLowerCase();
  return (
    {
      txt: 'notepad',
      log: 'notepad',
      ini: 'notepad',
      js: 'notepad',
      json: 'notepad',
      html: 'ie',
      htm: 'ie',
      url: 'ie',
      rtf: 'wordpad',
      doc: 'wordpad',
      png: 'paint',
      jpg: 'paint',
      jpeg: 'paint',
      bmp: 'paint',
      gif: 'paint',
      svg: 'paint',
      webp: 'paint',
      mp3: 'media',
      wav: 'sound',
      ogg: 'media',
      webm: 'movie',
      mp4: 'movie',
      wmv: 'movie',
      exe: 'windows',
      com: 'cmd',
      bat: 'cmd',
      lnk: 'windows',
    }[ext] ?? 'file'
  );
}
