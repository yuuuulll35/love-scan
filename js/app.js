import { ELEMENTS, RISKS, SAMPLE } from './data.js?v=202611160030';
import { PROMPTS, parseScan } from './ooc.js?v=202611160030';
import { createSpecimen } from './specimen.js?v=202611160030';
import { startMonitors, pauseMonitors } from './monitor.js?v=202611160030';
import { encodeGif } from './gif.js?v=202611160030';

const $ = (id) => document.getElementById(id);
const KEY = 'love-scan:last';
const store = {
  get() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && typeof v.text === 'string' ? v : null;
    } catch { return null; }
  },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (n) => (Math.round(n * 10) / 10).toFixed(1);
const dot = (s) => esc(s).replace(/\./g, '<i class="pt"></i>');
const app = $('app');

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 1800);
}

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(label);
}

let current = null;
let marks = [];
let mode = 'all';
let pinned = -1;

const BASE = { main: [0.62, 0.82, 1], heat: [1, 0.36, 0.54] };
const AMBER = [1, 0.72, 0.42];
const toHex = (c) => '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let sat = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [h, sat, l];
}

function rgb([h, sat, l]) {
  sat = Math.min(sat, 0.92);
  l = Math.max(0.66, Math.min(0.84, l));
  const k = (m) => (m + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  return [0, 8, 4].map((m) => l - a * Math.max(-1, Math.min(k(m) - 3, 9 - k(m), 1)));
}

function palette(surface, deep) {
  const S = surface ? hsl(surface.hex) : null;
  let D = deep ? hsl(deep.hex) : null;
  if (!D) {
    const pinkish = S && S[1] > 0.25 && (S[0] >= 300 || S[0] <= 20);
    D = pinkish ? hsl(toHex(AMBER)) : hsl(toHex(BASE.heat));
  }
  if (S && S[1] > 0.2 && D[1] > 0.2) {
    const gap = Math.abs(((S[0] - D[0] + 540) % 360) - 180);
    if (gap < 28) D = [(D[0] + (D[0] >= S[0] ? 40 : -40) + 360) % 360, D[1], D[2]];
  }
  return { main: S ? rgb(S) : BASE.main, heat: rgb(D) };
}

function applyColor(r) {
  const p = r ? palette(r.color, r.deepColor) : BASE;
  const root = document.documentElement.style;
  if (r) {
    root.setProperty('--xray', toHex(p.main));
    root.setProperty('--heat', toHex(p.heat));
  } else {
    root.removeProperty('--xray');
    root.removeProperty('--heat');
  }
  specimen?.setColors(p.main, p.heat);
}

const hud = { id: $('hudId'), yaw: $('hudYaw'), pitch: $('hudPitch'), slice: $('hudSlice'), points: $('hudPoints'), bpm: $('hudBpm'), pulse: $('pulse'), zoom: $('zoomValue') };
const leaders = $('leaders');

function onFrame(f) {
  hud.pulse.style.transform = `scale(${1 + f.beat * 0.9})`;
  if (f.frame % 5 === 0) {
    hud.yaw.textContent = f.yaw.toFixed(1).padStart(5, '0');
    hud.pitch.textContent = (f.pitch >= 0 ? '+' : '-') + Math.abs(f.pitch).toFixed(1).padStart(4, '0');
    hud.slice.textContent = String(f.slice).padStart(2, '0');
    hud.points.textContent = f.count.toLocaleString('en-US');
    hud.zoom.textContent = `${Math.round(f.zoom * 100)}%`;
    hud.bpm.textContent = current?.bpm ? Math.round(f.bpm) : '--';
  }
  if (!marks.length) return;
  const cx = f.w / 2;
  const cy = f.h / 2;
  const full = f.w >= 520;
  let d = '';
  f.pts.forEach((p, i) => {
    const m = marks[i];
    const on = p.shown && (mode === 'all' || mode === p.layer || (p.layer === 'body' && mode === 'deep')) && (p.layer !== 'surface' || p.depth > -0.35);
    m.el.classList.toggle('on', on);
    m.el.classList.toggle('mini', p.layer === 'body' && mode === 'all');
    if (!on) return;
    let dx = p.x - cx;
    let dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    if (p.layer === 'deep' && len < 30) { dx = Math.cos(1 + p.index * 2.1); dy = Math.sin(1 + p.index * 2.1); } else { dx /= len; dy /= len; }
    const reach = full ? (p.layer === 'deep' ? 54 : 46) : 26;
    if (!m.w || f.frame % 90 === 0) m.w = m.el.firstChild.offsetWidth;
    const lx = Math.max(22, Math.min(f.w - 22, p.x + dx * reach));
    const ly = Math.max(40, Math.min(f.h - 56, p.y + dy * reach));
    let flip = dx < 0;
    if (!flip && lx + m.w > f.w - 6) flip = true;
    else if (flip && lx - m.w < 6) flip = false;
    m.el.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0)`;
    m.el.classList.toggle('flip', flip);
    d += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${lx.toFixed(1)} ${ly.toFixed(1)}`;
    m.dot.setAttribute('cx', p.x.toFixed(1));
    m.dot.setAttribute('cy', p.y.toFixed(1));
    m.dot.style.opacity = 1;
  });
  f.pts.forEach((p, i) => { if (!marks[i].el.classList.contains('on')) marks[i].dot.style.opacity = 0; });
  leaders.firstChild.setAttribute('d', d);
}

const specimen = createSpecimen($('gl'), onFrame);
if (specimen?.mode === 'canvas') {
  const chip = $('gpuChip');
  const note = $('gpuNote');
  const why = specimen.reason === 'shader' ? 'shader' : 'off';
  for (const el of note.querySelectorAll('[data-why]')) el.hidden = el.dataset.why !== why;
  const open = (on) => {
    note.hidden = !on;
    chip.setAttribute('aria-expanded', String(on));
  };
  chip.hidden = false;
  chip.addEventListener('click', () => open(note.hidden));
  $('gpuClose').addEventListener('click', () => open(false));
}
if (!specimen) {
  $('nogl').hidden = false;
  $('zoom').hidden = true;
  $('hint').hidden = true;
}

function setMode(m) {
  mode = m;
  app.dataset.mode = m;
  specimen?.setMode(m);
  for (const b of $('modes').children) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
}

function highlight(group) {
  specimen?.highlight(group);
  marks.forEach((m) => m.el.classList.toggle('hot', m.group === group));
  document.querySelectorAll('#report [data-group]').forEach((el) => el.classList.toggle('hot', +el.dataset.group === group));
}

function buildMarks(r) {
  const box = $('marks');
  box.innerHTML = '';
  leaders.innerHTML = '<path />';
  marks = [];
  const add = (c, i, layer) => {
    const group = { surface: 0, deep: 100, body: 200 }[layer] + i;
    const el = document.createElement('div');
    el.className = `mark ${layer}`;
    el.dataset.group = group;
    const code = { surface: 'S', deep: 'D', body: 'F' }[layer];
    el.innerHTML = `<span class="tag"><b>${code}${i + 1}</b><em>${esc(c.name)}</em>${c.ratio != null ? `<i>${pct(c.ratio)}%</i>` : ''}</span>`;
    box.append(el);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', 3);
    dot.setAttribute('class', layer);
    leaders.append(dot);
    marks.push({ el, dot, group });
  };
  r.surface.forEach((c, i) => add(c, i, 'surface'));
  r.deep.forEach((c, i) => add(c, i, 'deep'));
  r.bodies.slice(0, 4).forEach((c, i) => add(c, i, 'body'));
}

function comps(list, layer) {
  const total = list.reduce((a, c) => a + c.ratio, 0) || 1;
  return list.map((c, i) => `
    <li class="comp ${layer}" data-group="${layer === 'deep' ? 100 + i : i}" tabindex="0">
      <div class="comp-head">
        <span class="code">${layer === 'deep' ? 'D' : 'S'}${i + 1}</span>
        <h3>${esc(c.name)}${c.en ? `<small>${esc(c.en)}</small>` : ''}</h3>
        <p class="num">${dot(pct(c.ratio))}<span>%</span></p>
      </div>
      <div class="meter" style="--v:${(c.ratio / total * 100).toFixed(2)}%"><i></i></div>
      ${c.desc ? `<p class="desc">${esc(c.desc)}</p>` : ''}
    </li>`).join('');
}

function ecg(bpm, label, tone) {
  return `
    <div class="ecg ${tone}">
      <p class="ecg-label"><span>${label}<i class="blip" aria-hidden="true"></i></span><b>${bpm}</b><em>BPM</em></p>
      <div class="scope"><canvas data-bpm="${bpm}" aria-hidden="true"></canvas><i class="trace-head" aria-hidden="true"></i></div>
    </div>`;
}

const DENSITY = [0.6, 1.4, 2.2, 3.0, 3.8];

function lookup(c) {
  const sym = (c.en || '').trim();
  return ELEMENTS.find((e) => e.sym.toLowerCase() === sym.toLowerCase())
    || ELEMENTS.find((e) => e.names.includes(c.name.replace(/\s/g, '')))
    || ELEMENTS.find((e) => e.names.some((n) => c.name.includes(n) && n.length > 1));
}

function elements(r) {
  if (!r.elements.length) return '';
  const list = r.elements.map((c) => ({ ...c, el: lookup(c) }));
  const total = list.reduce((a, c) => a + (c.ratio || 0), 0) || 1;
  const bar = list.map((c, i) => `<i style="--w:${((c.ratio || 0) / total * 100).toFixed(2)}%;--o:${(1 - i * 0.18).toFixed(2)}"><b>${esc(c.el?.sym || c.en || c.name.slice(0, 2))}</b></i>`).join('');
  return `
    <section class="sec">
      <h2 class="sec-title"><span>원소 조성</span><em>COMPOSITION</em></h2>
      <p class="sec-lede">이 감정을 끝까지 쪼개면 남는 것들입니다. 어떤 물질로 빚어진 마음인지, 그 원소가 이 사람의 어디를 닮았는지 적었습니다.</p>
      <div class="compo" aria-hidden="true">${bar}</div>
      <ol class="elements">${list.map((c) => {
        const e = c.el;
        return `
        <li class="element">
          <div class="cell">
            <span class="z">${e ? e.z : '?'}</span>
            <span class="w">${e ? esc(e.weight) : ''}</span>
            <b class="sym">${esc(e?.sym || c.en || '?')}</b>
            <span class="ko">${esc(e ? e.names[0] : c.name)}</span>
          </div>
          <div class="el-body">
            <div class="el-head">
              <h3>${esc(c.name)}<small>${esc(e ? e.group : '')}</small></h3>
              ${c.ratio != null ? `<p class="num">${dot(pct(c.ratio))}<span>%</span></p>` : ''}
            </div>
            ${c.desc ? `<p class="desc">${esc(c.desc)}</p>` : ''}
          </div>
        </li>`;
      }).join('')}
      </ol>
    </section>`;
}

function material(r) {
  const P = r.props;
  const F = r.form;
  const meter = (v) => `<div class="meter" style="--v:${Math.max(0, Math.min(100, v)).toFixed(1)}%"><i></i></div>`;
  const steps = (n, of) => `<div class="steps-g">${Array.from({ length: of }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</div>`;
  const wave = (hz) => {
    const cycles = Math.max(2, Math.min(16, 2 + Math.log2(Math.max(1, hz) / 40) * 2.4));
    let d = 'M0 12';
    for (let x = 1; x <= 300; x += 2) d += `L${x} ${(12 - 9 * Math.sin((x / 300) * cycles * 6.2832)).toFixed(1)}`;
    return `<svg class="wave" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" /></svg>`;
  };
  const weave = F.hard <= 3.5 ? '나선으로 감긴 막' : F.hard >= 7.5 ? '격자로 짜인 각진 막' : '고리로 쌓인 막';
  const field = { 인력: '극에서 극으로 휘어 드는 자기력선', 척력: '바깥으로 뻗는 방사선', 구속: '표본을 에워싼 궤도 고리' }[F.field] || '';
  const rows = [
    P.cryst && ['결정화율', 'CRYSTALLIZATION', `${dot(String(P.cryst.num ?? '?'))}<span>%</span>`, meter(F.cryst * 100), P.cryst.note, F.cryst > 0.66 ? '하트에 가까운 윤곽' : F.cryst < 0.33 ? '아직 굳지 않은 구형' : '구와 하트 사이의 윤곽'],
    P.hard && ['경도', 'HARDNESS', `${dot(String(P.hard.num ?? '?'))}<span>/10</span>`, steps(Math.round(F.hard), 10), P.hard.note, weave],
    P.trans && ['투과율', 'TRANSMITTANCE', `${dot(String(P.trans.num ?? '?'))}<span>%</span>`, meter(F.trans * 100), P.trans.note, F.trans < 0.4 ? '속이 잘 비치지 않는 짙은 막' : '속이 비치는 옅은 막'],
    P.hz && ['공명', 'RESONANCE', `${dot(String(P.hz.num ?? '?'))}<span>Hz</span>`, wave(F.hz), P.hz.note, '막 표면의 정상파 무늬'],
    P.tesla && ['자기장', 'MAGNETIC FIELD', `${dot(String(P.tesla.num ?? '?'))}<span>T${P.tesla.type ? ` · ${esc(P.tesla.type)}` : ''}</span>`, meter(F.tesla * 10), P.tesla.note, field],
    P.half && ['반감기', 'HALF-LIFE', `<em>${esc(P.half.head)}</em>`, meter(F.half * 100), P.half.note, F.half < 0.45 ? '바깥으로 흩어지는 입자' : '흩어지지 않고 제자리를 지키는 입자'],
    P.layers && ['나이테', 'GROWTH RINGS', `${dot(String(F.layers))}<span>겹</span>`, steps(F.layers, 6), P.layers.note, '안쪽으로 겹친 막의 수'],
  ].filter(Boolean);
  if (!rows.length) return '';
  return `
    <section class="sec">
      <h2 class="sec-title"><span>물성 분석</span><em>MATERIAL</em></h2>
      <ol class="comps props">${rows.map(([name, en, value, gauge, note, effect]) => `
        <li class="comp prop">
          <div class="comp-head prop-head">
            <h3>${name}<small>${en}</small></h3>
            <p class="num">${value}</p>
          </div>
          ${gauge}
          ${note ? `<p class="desc">${esc(note)}</p>` : ''}
          ${effect ? `<p class="effect">표본 · ${effect}</p>` : ''}
        </li>`).join('')}
      </ol>
    </section>`;
}

function findings(r) {
  const [head, ...rest] = r.mass.split(/\s*[·•|]\s*/);
  const m = head.match(/^\s*([~≈약]?\s*[\d.,]+(?:\s*[×x]\s*10\s*\^?\s*-?\d+)?)\s*(.*)$/);
  const num = m ? m[1].replace(/\s+/g, '') : '';
  const unit = m ? m[2] : head;
  const caption = rest.join(' · ');
  const lv = r.level;
  const risk = lv >= 0 ? RISKS[lv] : null;
  if (!r.mass && !risk) return '';

  const mass = r.mass ? `
    <div class="rd-mass">
      <p class="sub">애정 질량</p>
      <p class="mass">${num ? `<b>${dot(num)}</b>` : ''}${unit ? `<span>${esc(unit)}</span>` : ''}</p>
      ${caption ? `<p class="cap">${esc(caption)}</p>` : ''}
    </div>` : '';

  const wedge = risk ? `
    <div class="rd-risk">
      <div class="rd-risk-head">
        <p class="sub">위험 등급</p>
        <p class="risk-name">${esc(risk.key)}</p>
      </div>
      <div class="wedge" role="img" aria-label="위험 등급 ${esc(risk.key)}, 5단계 중 ${lv + 1}단계">
        ${RISKS.map((x, i) => `
          <div class="w-step${i <= lv ? ' on' : ''}${i === lv ? ' cur' : ''}" style="--i:${i}">
            <span class="w-od">OD ${DENSITY[i].toFixed(1)}</span>
            <i class="w-bar"></i>
            <span class="w-name">${esc(x.key)}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  return `
    <div class="reading" data-level="${lv}">
      <div class="rd-top">
        <span>FILM BADGE · ${esc(r.id)}</span>
        ${risk ? `<span class="rd-code">${risk.code} · LV ${lv + 1}/5</span>` : ''}
      </div>
      ${mass}${wedge}
    </div>`;
}

function render(r, animate) {
  current = r;
  const npc = r.npc || 'NPC';
  const pc = r.pc || 'PC';
  const d = new Date(r.at || Date.now());
  const stamp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const topS = [...r.surface].sort((a, b) => b.ratio - a.ratio)[0];
  const topD = [...r.deep].sort((a, b) => b.ratio - a.ratio)[0];

  const vitals = [];
  if (r.bpm) vitals.push(`<div class="vital"><dt>최고 심박</dt><dd><b>${r.bpm.peak}</b><span>BPM</span></dd></div>`);
  if (r.gaze) vitals.push(`<div class="vital"><dt>시선 체류</dt><dd><b>×${dot((r.gaze.pc / r.gaze.base).toFixed(1))}</b><span>일반 대비</span></dd></div>`);
  vitals.push(`<div class="vital"><dt>표층 주성분</dt><dd><b>${dot(pct(topS.ratio))}</b><span>% ${esc(topS.name)}</span></dd></div>`);
  vitals.push(`<div class="vital heat"><dt>심층 주성분</dt><dd><b>${dot(pct(topD.ratio))}</b><span>% ${esc(topD.name)}</span></dd></div>`);

  const body = r.bpm || r.gaze || r.symptoms.length;
  const gaze = r.gaze ? `
    <div class="gaze">
      <p class="sub">시선 체류 시간</p>
      <div class="gaze-row heat"><span>${esc(pc)}</span><div class="meter" style="--v:100%"><i></i></div><b>${r.gaze.pc}초</b></div>
      <div class="gaze-row"><span>일반 상대</span><div class="meter" style="--v:${Math.min(100, r.gaze.base / r.gaze.pc * 100).toFixed(1)}%"><i></i></div><b>${r.gaze.base}초</b></div>
    </div>` : '';
  const notes = (list, code, group) => list.map((s, i) => `
    <li class="note"${group != null && i < 4 ? ` data-group="${group + i}" tabindex="0"` : ''}>
      <h3>${code ? `<span class="code">${code}${i + 1}</span>` : ''}${esc(s.name)}${s.en ? `<small>${esc(s.en)}</small>` : ''}</h3>
      ${s.value ? `<p class="value">${esc(s.value)}</p>` : ''}
      ${s.desc ? `<p class="desc">${esc(s.desc)}</p>` : ''}
    </li>`).join('');
  const paras = (t) => t.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('');

  const tabs = [
    ['overview', '개요', 'all', `
      <header class="head">
        <p class="kicker">감정 방사선 판독지 · ${stamp}</p>
        <h1 class="pair"><span>${esc(npc)}</span><i aria-hidden="true">→</i><span>${esc(pc)}</span></h1>
        <div class="hues">${[[r.color, 'surface', '표층'], [r.deepColor, 'deep', '심층']].filter(([c]) => c).map(([c, cls, label]) => `<p class="hue ${cls}"><i aria-hidden="true"></i><em>${label}</em><b>${esc(c.name || (c.auto ? '표본 고유색' : '감정의 색'))}</b><code>${esc(c.hex.toUpperCase())}</code>${c.note ? `<span>${esc(c.note)}</span>` : ''}</p>`).join('')}</div>
        <dl class="vitals">${vitals.join('')}</dl>
      </header>
      ${r.summary ? `<section class="sec"><h2 class="sec-title"><span>종합 판독</span><em>SUMMARY</em></h2><div class="prose">${paras(r.summary)}</div></section>` : ''}`],
    ['surface', '표층', 'surface', `
      <section class="sec">
        <h2 class="sec-title"><span>표층 감정</span><em>SURFACE · X-RAY</em></h2>
        <p class="sec-lede">누구의 눈에도 띄는 자리로 새어 나온 마음입니다. 무심한 척하는 얼굴, 괜한 장난, 아무렇지 않게 건네는 챙김처럼 겉으로 드러난 애정이 이 감정의 바깥을 감싸고 있습니다.</p>
        <ol class="comps">${comps(r.surface, 'surface')}</ol>
      </section>`],
    ['deep', '심층', 'deep', `
      <section class="sec">
        <h2 class="sec-title heat"><span>심층 감정</span><em>DEEP · THERMAL</em></h2>
        <p class="sec-lede">본인조차 들여다본 적 없는 가장 깊은 곳의 마음입니다. 겉의 태도 아래에서 맥박처럼 뛰는 집착과 두려움, 이름 붙이지 못한 믿음이 여기에 가라앉아 있습니다.</p>
        <ol class="comps">${comps(r.deep, 'deep')}</ol>
      </section>`],
    (body || r.extras.length) && ['vital', '증상', 'all', `
      ${body ? `<section class="sec">
        <h2 class="sec-title"><span>물리적 증상</span><em>VITAL SIGNS</em></h2>
        ${r.bpm ? `<div class="ecgs">${ecg(r.bpm.rest, '평상시', 'cold')}${ecg(r.bpm.contact, '접촉 시', 'warm')}${ecg(r.bpm.peak, '최고', 'hot')}</div>` : ''}
        ${gaze}
        ${r.symptoms.length ? `<ul class="notes">${notes(r.symptoms)}</ul>` : ''}
      </section>` : ''}
      ${r.extras.length ? `<section class="sec"><h2 class="sec-title"><span>특이 패턴</span><em>ANOMALY</em></h2><ul class="notes">${notes(r.extras)}</ul></section>` : ''}`],
    r.elements.length && ['elements', '원소', 'all', elements(r)],
    Object.keys(r.props).length && ['material', '물성', 'all', material(r)],
    (r.cracks.length || r.bodies.length) && ['scars', '균열·삼킨 것', 'deep', `
      ${r.cracks.length ? `<section class="sec"><h2 class="sec-title heat"><span>균열</span><em>FRACTURE</em></h2><p class="sec-lede">한 번 금이 간 자리는 다시 붙어도 흔적이 남습니다. 이 감정이 갈라졌던 순간들입니다.</p><ul class="notes">${notes(r.cracks, 'C')}</ul></section>` : ''}
      ${r.bodies.length ? `<section class="sec"><h2 class="sec-title"><span>삼킨 것</span><em>FOREIGN BODY</em></h2><p class="sec-lede">끝내 입 밖에 내지 못한 말, 건네지 못하고 쥐고 있는 물건입니다. 삼킨 채로 이 감정 안쪽에 박혀 있습니다.</p><ul class="notes">${notes(r.bodies, 'F', 200)}</ul></section>` : ''}`],
    (r.mass || r.level >= 0 || r.verdict) && ['findings', '소견', 'all', `
      <section class="sec final">
        <h2 class="sec-title heat"><span>최종 소견</span><em>FINDINGS</em></h2>
        ${findings(r)}
        ${r.verdict ? `<div class="prose">${paras(r.verdict)}</div>` : ''}
      </section>`],
  ].filter(Boolean);

  $('tabs').innerHTML = tabs.map(([id, label], i) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join('');
  $('report').innerHTML = tabs.map(([id, , layer, html], i) => `<div class="tab-panel" role="tabpanel" id="panel-${id}" data-tab="${id}" data-layer="${layer}" aria-labelledby="tab-${id}" tabindex="0"${i ? ' hidden' : ''}>${html}</div>`).join('');
  tabLayer = Object.fromEntries(tabs.map(([id, , layer]) => [id, layer]));

  $('barId').textContent = r.id;
  hud.id.textContent = `${r.id} · ${npc}`;
  $('modes').hidden = false;
  $('shot').hidden = !specimen;
  $('hint').textContent = r.bpm ? '끌어서 돌려 보세요 · 손을 대면 심박이 오릅니다' : '끌어서 돌려 보세요';
  applyColor(r);
  buildMarks(r);
  pinned = -1;
  setMode('all');
  specimen?.load(r, animate);

  $('home').hidden = true;
  $('result').hidden = false;
  app.dataset.view = 'result';
  window.scrollTo(0, 0);
  stopMonitors();
  const vital = $('panel-vital');
  stopMonitors = vital ? startMonitors(vital) : () => {};
}

let stopMonitors = () => {};
let tabLayer = {};
let tab = 'overview';

function showTab(id, opts = {}) {
  if (!tabLayer[id]) return;
  tab = id;
  for (const b of $('tabs').children) {
    const on = b.dataset.tab === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  for (const p of $('report').children) p.hidden = p.dataset.tab !== id;
  if (!opts.keepMode) setMode(tabLayer[id]);
  if (pinned >= 0 && !$('report').querySelector(`[data-tab="${id}"] [data-group="${pinned}"]`)) {
    pinned = -1;
    highlight(-1);
  }
  const bar = $('tabs').getBoundingClientRect();
  const top = parseFloat(getComputedStyle($('tabs')).top) || 0;
  if (bar.top < top - 1 || opts.scroll) window.scrollBy({ top: bar.top - top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function focusGroup(group) {
  const layer = group >= 200 ? 'scars' : group >= 100 ? 'deep' : 'surface';
  showTab(layer);
  pinned = group;
  highlight(group);
  const el = $('report').querySelector(`[data-group="${group}"]`);
  if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function goHome() {
  current = null;
  $('shot').hidden = true;
  $('shotMenu').hidden = true;
  marks = [];
  $('marks').innerHTML = '';
  leaders.innerHTML = '';
  stopMonitors();
  $('result').hidden = true;
  $('home').hidden = false;
  $('modes').hidden = true;
  $('hint').textContent = '끌어서 돌려 보세요';
  hud.id.textContent = '표본 대기 중';
  hud.bpm.textContent = '--';
  app.dataset.view = 'home';
  setMode('all');
  specimen?.load(null, false);
  applyColor(null);
  $('resume').hidden = !store.get();
  resetTasks();
  window.scrollTo(0, 0);
}

function resetTasks() {
  for (const t of tasks) {
    t.text = '';
    t.ta.value = '';
    t.ta.hidden = true;
    t.err.hidden = true;
    t.pre.hidden = true;
    const peek = t.el.querySelector('.peek');
    peek.setAttribute('aria-expanded', 'false');
    peek.textContent = 'OOC 내용 보기';
    setState(t, 'empty');
  }
}

function run(text, at, animate = true) {
  const out = parseScan(text);
  if (out.error) return toast(out.error);
  out.result.at = at || Date.now();
  render(out.result, animate);
}

const tasks = [1, 2, 3].map((n) => {
  const el = document.querySelector(`.step[data-task="${n}"]`);
  const q = (sel) => el.querySelector(sel);
  return { n, el, ta: q('textarea'), got: q('.got'), gotText: q('.got-text'), err: q('.error'), pre: q('.prompt'), text: '', build: PROMPTS[n - 1] };
});
const [T1] = tasks;
const MARK = '①②③';
const filled = (t) => t.el.dataset.state === 'filled';

function refresh() {
  tasks.forEach((t, i) => t.el.classList.toggle('locked', i > 0 && !filled(tasks[i - 1]) && !filled(t)));
  $('scan').disabled = !filled(T1);
  const missing = tasks.slice(1).filter((t) => !filled(t)).map((t) => MARK[t.n - 1]);
  const whole = filled(T1) && parseScan(T1.text).result?.extra;
  $('scanNote').hidden = !(filled(T1) && missing.length && !whole);
  $('scanNote').textContent = `${missing.join('·')} 없이도 스캔할 수 있지만, 그 답에 들어갈 항목이 빠지고 표본 형태 일부는 임의로 정해집니다.`;
}

function setState(t, state) {
  t.el.dataset.state = state;
  t.got.hidden = state !== 'filled';
  refresh();
}

function inspect(t, text) {
  if (!text) return { msg: '내용이 비어 있어요. AI가 보낸 답을 복사한 뒤 다시 눌러 주세요.' };
  if (/^\s*\[OOC\s*\d\/2/.test(text) && text.includes('[출력]')) return { msg: '아직 OOC가 복사된 상태예요. 채팅에서 AI가 보낸 답을 복사한 뒤 다시 눌러 주세요.' };
  const out = parseScan(text, t.n > 1 ? t.n : 0);
  if (out.error) return { msg: out.error };
  const r = out.result;
  return {
    summary: [
      () => `${r.npc || 'NPC'} → ${r.pc || 'PC'} · 표층 ${r.surface.length} · 심층 ${r.deep.length} 성분${[r.color && !r.color.auto && ' · 표층 색', r.deepColor && ' · 심층 색'].filter(Boolean).join('')}`,
      () => [r.bpm && '심박', r.gaze && '시선', r.symptoms.length && `증상 ${r.symptoms.length}`, Object.keys(r.props).length && `물성 ${Object.keys(r.props).length}항목`].filter(Boolean).join(' · '),
      () => [r.elements.length && `원소 ${r.elements.length}`, r.cracks.length && `균열 ${r.cracks.length}`, r.bodies.length && `삼킨 것 ${r.bodies.length}`, r.verdict && '소견'].filter(Boolean).join(' · '),
    ][t.n - 1](),
  };
}

function accept(t, raw) {
  const text = String(raw || '').trim();
  const c = inspect(t, text);
  if (c.msg) {
    t.err.textContent = c.msg;
    t.err.hidden = false;
    return false;
  }
  t.text = text;
  t.ta.value = text;
  t.ta.hidden = true;
  t.err.hidden = true;
  t.pre.hidden = true;
  t.gotText.textContent = `✓ ${c.summary}`;
  setState(t, 'filled');
  const next = tasks[t.n];
  if (next && !filled(next)) next.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

function manual(t, note) {
  t.ta.hidden = false;
  t.ta.focus();
  if (note) toast(note);
}

for (const t of tasks) {
  const q = (sel) => t.el.querySelector(sel);
  t.pre.textContent = t.build();
  q('.copy').addEventListener('click', async () => {
    await copy(t.build(), `OOC ${MARK[t.n - 1]} 복사 완료. 채팅에 보내 주세요`);
    t.err.hidden = true;
    if (!filled(t)) setState(t, 'copied');
  });
  q('.peek').addEventListener('click', (e) => {
    const open = t.pre.hidden;
    t.pre.hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
    e.currentTarget.textContent = open ? 'OOC 내용 닫기' : 'OOC 내용 보기';
  });
  q('.paste').addEventListener('click', async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return manual(t, '아래 칸에 직접 붙여넣어 주세요');
    }
    if (!accept(t, text)) t.ta.hidden = true;
  });
  q('.manual').addEventListener('click', () => manual(t));
  t.ta.addEventListener('paste', () => setTimeout(() => accept(t, t.ta.value)));
  t.ta.addEventListener('change', () => { if (t.ta.value.trim()) accept(t, t.ta.value); });
  t.got.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    if (act === 'clear') {
      t.text = '';
      t.ta.value = '';
    }
    t.err.hidden = true;
    setState(t, act === 'redo' ? 'copied' : 'empty');
    if (act === 'redo') manual(t);
  });
}
refresh();
$('scan').addEventListener('click', () => {
  if (!filled(T1)) return;
  const text = tasks.filter(filled).map((t) => t.text).join('\n');
  const at = Date.now();
  store.set({ text, at });
  run(text, at);
});
$('sample').addEventListener('click', () => run(SAMPLE));
$('resume').addEventListener('click', () => {
  const v = store.get();
  if (v) run(v.text, v.at);
});
$('back').addEventListener('click', goHome);
$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role="tab"]');
  if (b) showTab(b.dataset.tab);
});
$('tabs').addEventListener('keydown', (e) => {
  const list = [...$('tabs').children];
  const i = list.findIndex((b) => b.dataset.tab === tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
  if (next == null) return;
  e.preventDefault();
  const b = list[(next + list.length) % list.length];
  showTab(b.dataset.tab);
  b.focus();
});
$('marks').addEventListener('click', (e) => {
  const m = e.target.closest('.mark.on');
  if (m) focusGroup(+m.dataset.group);
});
$('zoom').addEventListener('click', (e) => {
  const z = e.target.closest('button')?.dataset.z;
  if (z) specimen?.zoomBy({ in: 1.25, out: 0.8, reset: 0 }[z]);
});
$('modes').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const m = b.dataset.mode;
  if (m === 'all') {
    setMode('all');
    if (tabLayer[tab] !== 'all') showTab('overview', { keepMode: true });
  } else {
    showTab(m);
  }
});

const report = $('report');
const over = (e) => {
  const el = e.target.closest?.('[data-group]');
  if (el && pinned < 0) highlight(+el.dataset.group);
};
const out = (e) => {
  if (e.target.closest?.('[data-group]') && pinned < 0) highlight(-1);
};
report.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') over(e); });
report.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse') out(e); });
report.addEventListener('focusin', over);
report.addEventListener('focusout', out);
report.addEventListener('click', (e) => {
  const el = e.target.closest('[data-group]');
  if (!el) return;
  const g = +el.dataset.group;
  pinned = pinned === g ? -1 : g;
  highlight(pinned);
});

specimen?.load(null, false);
$('resume').hidden = !store.get();

const MODE_LABEL = { all: 'FULL · 전체', surface: 'SURFACE · 표층', deep: 'DEEP · 심층' };
function cardBase(r, W, names = true) {
  const H = Math.round(W * 1270 / 1080), u = W / 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.scale(u, u);
  const L = 1080, LH = 1270;
  const css = getComputedStyle(document.documentElement);
  const xray = css.getPropertyValue('--xray').trim() || '#9fd1ff';
  const heat = css.getPropertyValue('--heat').trim() || '#ff5c8a';
  const mono = "'Martian Mono', ui-monospace, monospace";
  const body = "'IBM Plex Sans KR', sans-serif";
  const doto = "'Doto', 'Martian Mono', monospace";

  g.fillStyle = '#05080c'; g.fillRect(0, 0, L, LH);
  const glow = g.createRadialGradient(L / 2, 640, 30, L / 2, 640, 560);
  glow.addColorStop(0, xray + '30'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, L, LH);
  g.fillStyle = xray + '2a';
  for (let x = 30; x < L; x += 44) for (let y = 30; y < LH; y += 44) g.fillRect(x, y, 2, 2);

  g.strokeStyle = 'rgba(170,205,245,0.45)'; g.lineWidth = 2;
  const fx = 70, fy = 150, fw = L - 140, fh = 980, k = 34;
  [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].forEach(([x, y, dx, dy]) => {
    g.beginPath(); g.moveTo(x + dx * k, y); g.lineTo(x, y); g.lineTo(x, y + dy * k); g.stroke();
  });
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#8496aa'; g.font = `300 17px ${mono}`;
  g.fillText('LOVE-SCAN / EMOTIONAL RADIOGRAPHY', 70, 72);
  g.textAlign = 'right';
  g.fillText(MODE_LABEL[mode] || MODE_LABEL.all, L - 70, 72);
  g.textAlign = 'left';
  if (names) {
    g.fillStyle = '#e2ecf6'; g.font = `600 34px ${body}`;
    g.fillText(`${r.npc || 'NPC'}  →  ${r.pc || 'PC'}`, 70, 124);
  } else {
    g.fillStyle = '#e2ecf6'; g.font = `800 40px ${doto}`;
    g.fillText('LOVE SCAN', 70, 126);
  }
  g.textAlign = 'right'; g.fillStyle = xray; g.font = `500 22px ${mono}`;
  g.fillText(r.id || '', L - 70, 122);
  g.textAlign = 'left';
  const y0 = 1190;
  g.strokeStyle = 'rgba(170,205,245,0.16)'; g.beginPath(); g.moveTo(70, y0 - 30); g.lineTo(L - 70, y0 - 30); g.stroke();
  let x = 70;
  [[r.color, xray, '표층'], [r.deepColor, heat, '심층']].forEach(([col, fallback, label]) => {
    if (!col) return;
    g.fillStyle = col.hex || fallback; g.beginPath(); g.arc(x + 11, y0 + 4, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8496aa'; g.font = `400 18px ${body}`; g.fillText(label, x + 32, y0 + 11);
    g.fillStyle = '#e2ecf6'; g.font = `500 22px ${body}`;
    const name = col.name || col.hex.toUpperCase();
    g.fillText(name, x + 76, y0 + 11);
    x += 76 + g.measureText(name).width + 48;
  });
  if (r.bpm) {
    g.textAlign = 'right';
    g.fillStyle = heat; g.font = `800 56px ${doto}`;
    g.fillText(String(r.bpm.rest), L - 140, y0 + 24);
    g.fillStyle = '#8496aa'; g.font = `300 17px ${mono}`;
    g.fillText('BPM', L - 70, y0 + 22);
    g.textAlign = 'left';
  }
  return { c, H, u };
}

function frameOf(base, shot, W, H, u) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  const bx = (1080 - 980) / 2 * u, by = 150 * u, bs = 980 * u;
  const small = document.createElement('canvas');
  small.width = small.height = Math.max(8, Math.round(bs / 6));
  const sg = small.getContext('2d');
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(shot, 0, 0, small.width, small.height);
  g.globalCompositeOperation = 'lighter';
  g.imageSmoothingQuality = 'high';
  g.globalAlpha = 0.85;
  g.drawImage(small, bx, by, bs, bs);
  g.globalAlpha = 1;
  g.drawImage(shot, bx, by, bs, bs);
  g.globalAlpha = 0.35;
  g.drawImage(shot, bx, by, bs, bs);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return g.getImageData(0, 0, W, H).data;
}

const GIF_W = 520, GIF_FRAMES = 72, GIF_MS = 125;
let gifBusy = false;
async function saveGif(r, names, onProgress) {
  const { c: base, H, u } = cardBase(r, GIF_W, names);
  const T = GIF_FRAMES * GIF_MS / 1000;
  const bpm = r.bpm?.rest || 60;
  const beats = Math.max(1, Math.round(T * bpm / 60));
  const shotSize = Math.round(980 * u * 2);
  const frames = [];
  for (let i = 0; i < GIF_FRAMES; i++) {
    const t = i / GIF_FRAMES;
    const ph = (t * beats) % 1;
    const beat = 0.55 * (Math.exp(-Math.pow(ph / 0.16, 2)) + Math.exp(-Math.pow((ph - 1) / 0.16, 2)) + 0.5 * Math.exp(-Math.pow((ph - 0.32) / 0.14, 2)));
    const scan = 1.6 * Math.cos(t * Math.PI * 2);
    const shot = specimen.snapshot(shotSize, 1.025, { yaw: t * Math.PI * 2, pitch: 0, beat, scan, scanK: 0.5 });
    frames.push(frameOf(base, shot, GIF_W, H, u));
    onProgress(0.65 * (i + 1) / GIF_FRAMES);
    if (i % 3 === 2) await new Promise((res) => setTimeout(res));
  }
  return encodeGif(frames, GIF_W, H, GIF_MS, (p) => onProgress(0.65 + 0.35 * p));
}
const shotMenu = $('shotMenu');
const closeShotMenu = () => { shotMenu.hidden = true; $('shot').setAttribute('aria-expanded', 'false'); };
$('shot').addEventListener('click', (e) => {
  e.stopPropagation();
  if (gifBusy) return;
  const open = shotMenu.hidden;
  shotMenu.hidden = !open;
  $('shot').setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => { if (!shotMenu.hidden && !shotMenu.contains(e.target)) closeShotMenu(); });
shotMenu.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-names]');
  if (!b) return;
  closeShotMenu();
  const names = b.dataset.names === '1';
  if (!current || !specimen?.snapshot || gifBusy) return;
  gifBusy = true;
  const ov = $('gifLoading');
  const bar = $('gifBar');
  const pct = $('gifPct');
  const msg = $('gifMsg');
  const setP = (p) => { const v = Math.round(p * 100); bar.style.width = v + '%'; pct.textContent = v + '%'; };
  msg.textContent = names ? '회전 GIF를 만드는 중' : '회전 GIF를 만드는 중 · LOVE SCAN';
  ov.dataset.state = 'busy';
  setP(0);
  ov.hidden = false;
  specimen.pause(true);
  pauseMonitors(true);
  await new Promise((res) => requestAnimationFrame(() => setTimeout(res)));
  try {
    try { await document.fonts.ready; } catch {}
    const blob = await saveGif(current, names, setP);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `love-scan-${current.id || 'specimen'}-${mode}.gif`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setP(1);
    ov.dataset.state = 'done';
    msg.textContent = '저장했어요';
    await new Promise((res) => setTimeout(res, 900));
  } catch {
    ov.dataset.state = 'error';
    msg.textContent = 'GIF를 만들지 못했어요';
    await new Promise((res) => setTimeout(res, 1600));
  } finally {
    ov.hidden = true;
    specimen.pause(false);
    pauseMonitors(false);
    gifBusy = false;
  }
});
