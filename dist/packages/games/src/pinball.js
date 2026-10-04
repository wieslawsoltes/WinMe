import { h, button } from '../../ui/src/dom.js';
import { clamp } from '../../core/src/index.js';

export function createPinball(sys) {
  const win = sys.createWindow({
    title: '3D Pinball for Windows - Space Cadet',
    icon: 'pinball',
    width: 590,
    height: 650,
    minWidth: 420,
    minHeight: 450,
  });
  const canvas = h('canvas', {
      width: 720,
      height: 1120,
      'aria-label': 'Space Cadet pinball table',
      tabIndex: 0,
    }),
    ctx = canvas.getContext('2d');
  const panel = h('aside', { class: 'pinball-info' }),
    scoreNode = h('div', { class: 'pinball-score' }, '00000000'),
    message = h(
      'div',
      {
        class: 'game-turn',
        style: { background: '#100f21', color: '#f3af41', borderColor: '#514368' },
      },
      'Press Space to launch',
    ),
    ballNode = h('p');
  const W = 360,
    H = 560,
    ball = { x: 327, y: 500, vx: 0, vy: 0, r: 6 },
    bumper = [
      { x: 142, y: 122, r: 21, flash: 0 },
      { x: 205, y: 123, r: 21, flash: 0 },
      { x: 174, y: 178, r: 21, flash: 0 },
      { x: 98, y: 240, r: 14, flash: 0 },
      { x: 252, y: 255, r: 14, flash: 0 },
    ];
  let score = 0,
    balls = 3,
    ready = true,
    left = false,
    right = false,
    charge = 0,
    charging = false,
    paused = false,
    over = false,
    raf = 0,
    last = 0,
    accumulator = 0,
    hits = 0,
    tilt = 0;
  const targets = Array.from({ length: 6 }, (_, i) => ({ x: 67 + i * 39, y: 65, lit: false }));
  const lineWalls = [
    [18, 82, 35, 382],
    [35, 382, 95, 452],
    [265, 452, 310, 360],
    [310, 360, 307, 80],
    [308, 82, 309, 490],
    [343, 80, 343, 534],
    [61, 400, 111, 448],
    [294, 386, 249, 449],
    [18, 82, 35, 43],
    [35, 43, 93, 23],
    [93, 23, 274, 23],
    [274, 23, 331, 45],
    [331, 45, 343, 80],
    [65, 311, 86, 363],
    [271, 330, 249, 377],
  ];
  const resetBall = () => Object.assign(ball, { x: 327, y: 505, vx: 0, vy: 0 });
  const updateScore = () => {
    scoreNode.textContent = String(score).padStart(8, '0');
    ballNode.textContent = `Ball ${4 - balls} of 3\nRank: ${hits >= 30 ? 'Captain' : hits >= 15 ? 'Lieutenant' : 'Cadet'}`;
  };
  const reset = () => {
    score = 0;
    balls = 3;
    hits = 0;
    over = false;
    ready = true;
    paused = false;
    charge = 0;
    charging = false;
    tilt = 0;
    targets.forEach((t) => (t.lit = false));
    resetBall();
    message.textContent = 'Press and release Space to launch';
    updateScore();
  };
  const launch = () => {
    if (ready && !over) {
      ball.vy = -700 - charge * 350;
      ball.vx = -6;
      ready = false;
      message.textContent = 'Hit the bumpers to advance your rank.';
      sys.sound.tone(110, 0.18, 'sawtooth', 0.03);
    }
    charging = false;
    charge = 0;
  };
  const flippers = () => [
    {
      x1: 105,
      y1: 472,
      x2: 105 + 69 * Math.cos(left ? -0.32 : 0.42),
      y2: 472 + 69 * Math.sin(left ? -0.32 : 0.42),
      active: left,
      side: 1,
    },
    {
      x1: 254,
      y1: 472,
      x2: 254 - 69 * Math.cos(right ? -0.32 : 0.42),
      y2: 472 + 69 * Math.sin(right ? -0.32 : 0.42),
      active: right,
      side: -1,
    },
  ];
  const segment = (x1, y1, x2, y2, restitution = 0.82, thickness = 4, boost = 0) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      len2 = dx * dx + dy * dy,
      t = clamp(((ball.x - x1) * dx + (ball.y - y1) * dy) / len2, 0, 1),
      qx = x1 + t * dx,
      qy = y1 + t * dy,
      ex = ball.x - qx,
      ey = ball.y - qy,
      d = Math.hypot(ex, ey);
    if (d < ball.r + thickness && d > 0.001) {
      const nx = ex / d,
        ny = ey / d;
      ball.x = qx + nx * (ball.r + thickness + 0.1);
      ball.y = qy + ny * (ball.r + thickness + 0.1);
      const speed = ball.vx * nx + ball.vy * ny;
      if (speed < 0) {
        ball.vx -= (1 + restitution) * speed * nx;
        ball.vy -= (1 + restitution) * speed * ny;
      }
      if (boost) {
        ball.vy -= boost * (0.5 + t);
        ball.vx += nx * boost * 0.25;
      }
    }
  };
  const physics = (dt) => {
    if (paused || over) return;
    if (charging) charge = Math.min(1.3, charge + dt);
    if (ready) return;
    ball.vy += 465 * dt;
    ball.vx *= 0.9995;
    ball.vy *= 0.9995;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 1200) {
      ball.vx *= 1200 / speed;
      ball.vy *= 1200 / speed;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    for (const wall of lineWalls) segment(...wall);
    if (ball.y < 31) {
      ball.y = 31;
      ball.vy = Math.abs(ball.vy) * 0.9;
    }
    if (ball.x < 23) {
      ball.x = 23;
      ball.vx = Math.abs(ball.vx) * 0.9;
    }
    if (ball.x > 337) {
      ball.x = 337;
      ball.vx = -Math.abs(ball.vx) * 0.9;
    }
    if (ball.y < 90 && ball.x > 307 && ball.vy < 0) {
      ball.vx -= 950 * dt;
    }
    for (const b of bumper) {
      b.flash = Math.max(0, b.flash - dt);
      const dx = ball.x - b.x,
        dy = ball.y - b.y,
        d = Math.hypot(dx, dy);
      if (d < ball.r + b.r) {
        const nx = dx / (d || 1),
          ny = dy / (d || 1);
        ball.x = b.x + nx * (ball.r + b.r + 1);
        ball.y = b.y + ny * (ball.r + b.r + 1);
        const current = ball.vx * nx + ball.vy * ny;
        if (current < 0) {
          ball.vx -= 2 * current * nx;
          ball.vy -= 2 * current * ny;
        }
        ball.vx += nx * 160;
        ball.vy += ny * 160;
        if (b.flash === 0) {
          score += 1000;
          hits++;
          b.flash = 0.15;
          sys.sound.tone(440 + (hits % 5) * 90, 0.05, 'sine', 0.035);
          updateScore();
        }
      }
    }
    for (const f of flippers()) segment(f.x1, f.y1, f.x2, f.y2, 0.75, 6, f.active ? 55 : 0);
    for (const target of targets)
      if (!target.lit && Math.abs(ball.x - target.x) < 13 && Math.abs(ball.y - target.y) < 13) {
        target.lit = true;
        score += 5000;
        updateScore();
        if (targets.every((t) => t.lit)) {
          score += 50000;
          message.textContent = 'MISSION COMPLETE — 50,000';
          targets.forEach((t) => (t.lit = false));
          updateScore();
        }
      }
    if (ball.y > 550) {
      balls--;
      if (balls <= 0) {
        over = true;
        message.textContent = 'GAME OVER — press F2 to play again';
        const high = sys.settings.get('pinballHighScore') ?? 0;
        if (score > high) sys.settings.set('pinballHighScore', score);
      } else {
        ready = true;
        resetBall();
        message.textContent = 'Ball lost. Press Space to launch.';
      }
      updateScore();
    }
  };
  const draw = () => {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = '#111326';
    ctx.fillRect(0, 0, W, H);
    const background = ctx.createLinearGradient(0, 0, 0, H);
    background.addColorStop(0, '#152b50');
    background.addColorStop(0.5, '#0c1932');
    background.addColorStop(1, '#242239');
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.moveTo(30, 535);
    ctx.lineTo(15, 82);
    ctx.quadraticCurveTo(10, 13, 120, 14);
    ctx.lineTo(266, 14);
    ctx.quadraticCurveTo(347, 20, 349, 85);
    ctx.lineTo(349, 535);
    ctx.fill();
    ctx.strokeStyle = '#407293';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 45; i++) {
      const x = 22 + (Math.sin(i * 79) * 0.5 + 0.5) * 280,
        y = 42 + (Math.cos(i * 67) * 0.5 + 0.5) * 350;
      ctx.fillStyle = i % 3 ? '#668094' : '#a6b9c7';
      ctx.fillRect(x, y, i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    }
    ctx.save();
    ctx.translate(176, 310);
    ctx.rotate(-0.14);
    ctx.textAlign = 'center';
    ctx.font = 'italic bold 24px Arial';
    ctx.fillStyle = '#557faa';
    ctx.fillText('SPACE', 0, 0);
    ctx.font = 'italic bold 35px Arial';
    ctx.fillStyle = '#6899c6';
    ctx.fillText('CADET', 0, 34);
    ctx.font = '9px Arial';
    ctx.fillStyle = '#777c9c';
    ctx.fillText('PINBALL • MISSION CONTROL', 0, 51);
    ctx.restore();
    const rails = (color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2] of lineWalls) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };
    rails('#182f3d', 10);
    rails('#7195a5', 5);
    rails('#c7d6d9', 1);
    for (const [x, y, angle] of [
      [69, 362, 0.4],
      [278, 367, -0.4],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = '#be4933';
      ctx.strokeStyle = '#e9ad3e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 52);
      ctx.lineTo(37, 74);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const b of bumper) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#4d5680';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      const fill = ctx.createRadialGradient(b.x - 5, b.y - 7, 1, b.x, b.y, b.r);
      fill.addColorStop(0, b.flash ? '#fff' : '#ffcc72');
      fill.addColorStop(0.5, b.flash ? '#ffff7f' : '#d77136');
      fill.addColorStop(1, '#6a2c19');
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = '#f2bd63';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = b.flash ? '#fffbc1' : '#143351';
      ctx.fill();
    }
    for (const t of targets) {
      ctx.fillStyle = t.lit ? '#ffee3c' : '#555467';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 10);
      ctx.lineTo(t.x + 7, t.y + 7);
      ctx.lineTo(t.x - 7, t.y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9490a8';
      ctx.stroke();
    }
    for (const f of flippers()) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#742f24';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.strokeStyle = f.active ? '#ffce53' : '#e8b981';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = '#fff7bf';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#a28072';
    ctx.fillRect(320, 520 + charge * 10, 15, 15);
    for (let y = 538; y < 550; y += 3) {
      ctx.strokeStyle = '#b7c1c7';
      ctx.strokeRect(322, y, 11, 1);
    }
    ctx.fillStyle = '#222';
    ctx.fillRect(144, 530, 76, 30);
    const shade = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, ball.r);
    shade.addColorStop(0, '#fff');
    shade.addColorStop(0.3, '#e1e8ef');
    shade.addColorStop(0.75, '#8193a0');
    shade.addColorStop(1, '#3e4650');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    if (paused) {
      ctx.fillStyle = '#0009';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 25px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  };
  const tick = (time) => {
    if (win.closed) return;
    const dt = Math.min(0.05, (time - (last || time)) / 1000);
    last = time;
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      physics(1 / 120);
      accumulator -= 1 / 120;
    }
    if (win.state !== 'minimized' && !document.hidden) draw();
    raf = requestAnimationFrame(tick);
  };
  const key = (e, down) => {
    if (e.key === 'z' || e.key === 'Z' || e.key === 'ArrowLeft') {
      left = down;
      e.preventDefault();
    }
    if (e.key === '/' || e.key === 'ArrowRight') {
      right = down;
      e.preventDefault();
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (down) {
        charging = true;
      } else launch();
    }
    if (down && e.key === 'F2') {
      e.preventDefault();
      reset();
    }
    if (down && e.key === 'F3') {
      paused = !paused;
    }
    if (down && e.key.toLowerCase() === 'x' && !ready) {
      tilt++;
      ball.vx += (Math.random() - 0.5) * 130;
      ball.vy -= 90;
      score = Math.max(0, score - 250);
      updateScore();
      message.textContent = tilt % 4 === 0 ? 'TILT WARNING' : 'Nudge';
    }
  };
  win.element.addEventListener('keydown', (e) => key(e, true), { signal: win.signal });
  win.element.addEventListener('keyup', (e) => key(e, false), { signal: win.signal });
  window.addEventListener(
    'blur',
    () => {
      left = right = charging = false;
      paused = true;
    },
    { signal: win.signal },
  );
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    if (ready) {
      charging = true;
    } else if (e.clientX - r.left < r.width / 2) left = true;
    else right = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => {
    if (ready) launch();
    left = right = false;
  });
  canvas.addEventListener('pointercancel', () => (left = right = charging = false));
  panel.append(
    h('h2', {}, 'SPACE', h('br'), 'CADET'),
    h('span', {}, 'SCORE'),
    scoreNode,
    ballNode,
    message,
    h(
      'div',
      {},
      h('b', {}, 'Controls'),
      h(
        'p',
        {},
        'Z / Left: left flipper\n/ / Right: right flipper\nSpace: plunger\nX: nudge\nF3: pause',
      ),
    ),
    button('Launch Ball', launch),
    button('New Game', reset),
  );
  win.menu([
    {
      label: 'Game',
      items: [
        { label: 'New Game', shortcut: 'F2', action: reset },
        { label: 'Launch Ball', shortcut: 'Space', action: launch },
        { label: 'Pause / Resume', shortcut: 'F3', action: () => (paused = !paused) },
        {
          label: 'High Scores...',
          action: () =>
            sys.dialogs.message(
              'High score: ' + (sys.settings.get('pinballHighScore') ?? 0).toLocaleString(),
              { title: 'High Scores', icon: 'pinball' },
            ),
        },
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Options',
      items: [
        {
          label: 'Sound',
          checked: sys.settings.get('sound'),
          action: () => sys.settings.set('sound', !sys.settings.get('sound')),
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'How to Play',
          action: () =>
            sys.dialogs.message(
              'Launch the ball with Space. Use Z and /, or the arrow keys, to control the flippers. Hit the six mission lights for a bonus. Bumper hits increase your score and rank. You have three balls.\n\nThis is a browser pinball reimplementation with its own table physics and mission rules.',
              { title: 'Space Cadet', icon: 'pinball' },
            ),
        },
      ],
    },
  ]);
  win.content.append(h('div', { class: 'pinball-area' }, canvas, panel));
  win.onDispose(() => cancelAnimationFrame(raf));
  reset();
  raf = requestAnimationFrame(tick);
  return win;
}
