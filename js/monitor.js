const WINDOW = 4.2;
let paused = false;
const kicks = new Set();
export function pauseMonitors(on) {
  paused = on;
  if (!on) kicks.forEach((k) => k());
}
const GAP = 16;

function gauss(t, c, w, a) {
  const x = (t - c) / w;
  return a * Math.exp(-x * x);
}

function shape(tb, interval) {
  const s = Math.max(0.5, Math.min(1, interval / 0.9));
  const q = 0.15 + 0.07 * s;
  return gauss(tb, 0.02 + 0.08 * s, 0.026, 0.12)
    + gauss(tb, q, 0.008, -0.1)
    + gauss(tb, q + 0.022, 0.0095, 1)
    + gauss(tb, q + 0.046, 0.011, -0.27)
    + gauss(tb, q + 0.06 + 0.2 * s, 0.012 + 0.045 * s, 0.27);
}

function createTrace(row, still) {
  const cv = row.querySelector('canvas');
  const head = row.querySelector('.trace-head');
  const blip = row.querySelector('.blip');
  const bpm = Number(cv.dataset.bpm) || 60;
  const color = getComputedStyle(row).getPropertyValue('--c').trim() || '#9fd1ff';
  const interval = 60 / bpm;
  const m = { cv, ctx: cv.getContext('2d'), head, blip, color, interval, beats: [], t: 0, w: 1, h: 1, last: null, flash: 0, fired: -1 };

  const ensure = (t) => {
    if (!m.beats.length) m.beats.push(t - WINDOW - 1);
    while (m.beats[m.beats.length - 1] < t + 0.2) {
      const jitter = 1 + (Math.random() - 0.5) * 0.08;
      m.beats.push(m.beats[m.beats.length - 1] + interval * jitter);
    }
    while (m.beats.length > 2 && m.beats[1] < t - 2) m.beats.shift();
  };
  const wave = (t) => {
    let y = 0.012 * Math.sin(t * 1.9) + 0.006 * Math.sin(t * 7.3);
    for (const b of m.beats) {
      const tb = t - b;
      if (tb >= 0 && tb < 1.1) y += shape(tb, interval);
    }
    return y;
  };
  const xOf = (t) => (((t * m.w) / WINDOW) % m.w + m.w) % m.w;
  const yOf = (v) => m.h * 0.64 - v * m.h * 0.52;

  const clear = (x, len) => {
    const end = x + len;
    m.ctx.clearRect(x + 1, 0, Math.min(end, m.w) - x, m.h);
    if (end > m.w) m.ctx.clearRect(0, 0, end - m.w, m.h);
  };

  function segment(ta, tb) {
    ensure(tb);
    const len = ((tb - ta) * m.w) / WINDOW;
    clear(xOf(ta), len + GAP);
    const n = Math.max(1, Math.ceil(len));
    const lines = [];
    let line = m.last ? [m.last] : [];
    for (let i = 0; i <= n; i++) {
      const t = ta + ((tb - ta) * i) / n;
      const p = [xOf(t), yOf(wave(t))];
      if (line.length && p[0] < line[line.length - 1][0] - 1) {
        lines.push(line);
        line = [];
      }
      line.push(p);
    }
    lines.push(line);
    m.last = line[line.length - 1];
    const ctx = m.ctx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = m.color;
    for (const [width, alpha] of [[5, 0.16], [1.5, 1]]) {
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      for (const l of lines) {
        if (l.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(l[0][0], l[0][1]);
        for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (m.head) m.head.style.transform = `translate3d(${m.last[0].toFixed(1)}px,${m.last[1].toFixed(1)}px,0)`;

    const q = 0.15 + 0.07 * Math.max(0.5, Math.min(1, interval / 0.9)) + 0.022;
    for (const b of m.beats) {
      if (b > m.fired && b + q > ta && b + q <= tb) {
        m.fired = b;
        m.flash = 1;
      }
    }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    m.w = r.width;
    m.h = r.height;
    cv.width = Math.round(m.w * dpr);
    cv.height = Math.round(m.h * dpr);
    m.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.ctx.clearRect(0, 0, m.w, m.h);
    m.last = null;
    m.beats = [];
    segment(m.t - WINDOW + (GAP * WINDOW) / m.w, m.t);
  }

  function step(dt) {
    const t1 = m.t + dt;
    segment(m.t, t1);
    m.t = t1;
    m.flash = Math.max(0, m.flash - dt * 5);
    if (m.blip) m.blip.style.opacity = (0.25 + 0.75 * m.flash).toFixed(2);
  }

  if (still && m.head) m.head.hidden = true;
  return { resize, step };
}

export function startMonitors(root) {
  const rows = [...root.querySelectorAll('.ecg')];
  if (!rows.length) return () => {};
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const traces = rows.map((r) => createTrace(r, still));
  let raf = 0;
  let last = 0;
  let visible = true;

  const ro = new ResizeObserver(() => traces.forEach((t) => t.resize()));
  ro.observe(root);
  traces.forEach((t) => t.resize());
  if (still) return () => ro.disconnect();

  const frame = (now) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    traces.forEach((t) => t.step(dt));
    if (visible && !document.hidden && !paused) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf && visible && !document.hidden && !paused) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    kick();
  });
  io.observe(root);
  kicks.add(kick);
  document.addEventListener('visibilitychange', kick);
  kick();

  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
    visible = false;
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', kick);
    kicks.delete(kick);
  };
}
