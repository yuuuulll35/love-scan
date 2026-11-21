const VS = `
attribute vec3 aLocal;
attribute vec3 aCenter;
attribute vec4 aMeta;
uniform mat3 uRot;
uniform vec2 uScale;
uniform float uTime, uBeat, uScan, uReveal, uDeep, uHi, uPx, uScanK;
uniform vec3 uMain, uHeat;
varying vec4 vCol;
void main() {
  float kind = aMeta.x, grp = aMeta.y, seed = aMeta.z;
  vec3 c = aCenter;
  vec3 l = aLocal;
  if (kind < 0.5) {
    l *= 1.0 + (0.012 + 0.09 * seed) * uBeat;
  } else if (kind < 1.5) {
    l *= 1.0 + 0.02 * uBeat;
  } else if (kind < 2.5) {
    float a = uTime * (0.15 + 0.25 * fract(grp * 0.37));
    float cs = cos(a), sn = sin(a);
    c = vec3(c.x * cs - c.z * sn, c.y, c.x * sn + c.z * cs);
    l *= 1.0 + 0.16 * uBeat;
  } else if (kind < 3.5) {
    l.y += 0.05 * sin(uTime * 0.3 + seed * 40.0);
  }
  vec3 p = c + l;
  if (kind > 3.5 && kind < 4.5) p.y = uScan;
  vec3 q = uRot * p;
  float z = 3.6 - q.z;
  gl_Position = vec4(q.x * uScale.x / z, q.y * uScale.y / z, 0.0, 1.0);

  bool solid = kind < 2.5 || (kind > 4.5 && kind < 5.5);
  float sd = (p.y - uScan) / 0.07;
  float s = solid ? exp(-sd * sd) * uScanK : 0.0;
  float vis = (kind > 2.5 && kind < 4.5) ? 1.0 : mix(step(p.y, uScan), 1.0, uReveal);
  vec3 xr = uMain;
  vec3 heat = uHeat;
  vec3 amber = vec3(1.0, 0.72, 0.42);
  vec3 col = xr;
  float a = 0.66;
  if (kind < 0.5) {
    a *= 1.0 - 0.82 * max(uDeep, 0.0);
  } else if (kind < 1.5) {
    col = mix(heat, xr, seed);
    a = 0.55;
  } else if (kind < 2.5) {
    col = mix(heat, amber, seed * seed);
    a = 0.62 * (1.0 + 0.8 * min(uDeep, 0.0)) * (1.0 + 0.5 * uBeat);
  } else if (kind < 3.5) {
    col = xr * 0.8;
    a = 0.22;
  } else if (kind < 4.5) {
    a = 0.1 * (1.0 + 3.0 * (1.0 - uReveal));
  } else if (kind < 5.5) {
    col = vec3(1.0, 0.96, 0.88);
    a = 0.95 * (1.0 + 0.5 * min(uDeep, 0.0));
  } else {
    float flow = 0.5 + 0.5 * sin(seed * 14.0 - uTime * 1.8 * grp);
    col = mix(xr, vec3(1.0), 0.15);
    a = 0.85 * (0.3 + 0.7 * flow * flow * flow) * (1.0 - abs(uDeep));
  }
  a *= min(1.0, aMeta.w);
  col = mix(col, vec3(1.0), s * (kind > 1.5 ? 0.2 : 0.6));
  a *= 1.0 + (kind > 1.5 ? 0.5 : 2.2) * s;
  if (uHi > -0.5 && solid) a *= abs(grp - uHi) < 0.5 ? 2.0 : 0.3;
  a *= vis * clamp(1.3 - 0.35 * (z - 2.6), 0.35, 1.3);
  gl_PointSize = max(1.0, aMeta.w * uPx / z * (1.0 + s * 0.6));
  vCol = vec4(col, a);
}`;

const FS = `
precision mediump float;
varying vec4 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.12, d) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * m, m * 0.6);
}`;

const CAM = 3.6;
const SPAN = 1.6;
const SWEEP = 2.8;
const IDLE = { cryst: 1, hard: 5, trans: 0.45, hz: 0, tesla: 0, field: '', half: 0.5, layers: 2 };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function heartF(x, y, z) {
  const a = x * x + 2.25 * z * z + y * y - 1;
  return a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y;
}

function heartR(x, y, z) {
  let lo = 0;
  let hi = 0.04;
  while (hi < 2 && heartF(x * hi, y * hi - 0.12, z * hi) < 0) {
    lo = hi;
    hi += 0.04;
  }
  for (let i = 0; i < 12; i++) {
    const m = (lo + hi) / 2;
    if (heartF(x * m, y * m - 0.12, z * m) < 0) lo = m;
    else hi = m;
  }
  return lo;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

function bodyShape(name, rand) {
  const pts = [];
  const line = (a, b, n) => {
    for (let i = 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, a[2] + (b[2] - a[2]) * i / n]);
  };
  const circle = (cx, cy, r, n) => {
    for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos(i / n * 6.2832), cy + r * Math.sin(i / n * 6.2832), 0]);
  };
  let type = ['shard', 'ring', 'card', 'key'][Math.floor(rand() * 4)];
  if (/반지|고리|링|ring/i.test(name)) type = 'ring';
  else if (/열쇠|키|key/i.test(name)) type = 'key';
  else if (/편지|말|고백|메모|사진|이름|문장|약속|쪽지/.test(name)) type = 'card';
  if (type === 'ring') {
    circle(0, 0, 1, 70);
    circle(0, 0, 0.82, 56);
  } else if (type === 'key') {
    circle(-0.75, 0, 0.42, 40);
    line([-0.33, 0, 0], [1.2, 0, 0], 40);
    line([0.75, 0, 0], [0.75, -0.38, 0], 10);
    line([1.05, 0, 0], [1.05, -0.3, 0], 8);
  } else if (type === 'card') {
    const w = 1.1;
    const h = 0.72;
    line([-w, -h, 0], [w, -h, 0], 36);
    line([w, -h, 0], [w, h, 0], 24);
    line([w, h, 0], [-w, h, 0], 36);
    line([-w, h, 0], [-w, -h, 0], 24);
    line([-w, h, 0], [0, 0, 0], 22);
    line([0, 0, 0], [w, h, 0], 22);
  } else {
    const v = [[1, 0, 0], [-1, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1], [0, 0, -1]];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (i >> 1 !== j >> 1) line(v[i], v[j], 16);
  }
  return pts;
}

function build(spec, budget) {
  const F = spec ? spec.form : IDLE;
  budget = Math.round(budget * (spec ? 0.55 + 0.8 * (spec.density ?? 0.5) : 1));
  const rand = rng(spec ? spec.seed : 7);
  const out = [];
  const anchors = [];
  const put = (lx, ly, lz, cx, cy, cz, kind, grp, seed, size) => out.push(lx, ly, lz, cx, cy, cz, kind, grp, seed, size);
  const sphere = () => {
    const y = rand() * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    const a = rand() * Math.PI * 2;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  const angle = (x, y, z, d) => Math.acos(Math.max(-1, Math.min(1, x * d[0] + y * d[1] + z * d[2])));

  const surface = spec ? spec.surface : [];
  const deep = spec ? spec.deep : [];
  const cryst = F.cryst;
  const maxS = Math.max(1, ...surface.map((s) => s.ratio));
  const spin = rand() * Math.PI * 2;
  const lobeK = 1 - 0.85 * cryst;
  const lobes = surface.map((s, i) => {
    const n = surface.length;
    const y = n === 1 ? 0.25 : 0.72 - 1.3 * (i + 0.5) / n;
    const r = Math.sqrt(1 - y * y);
    const a = spin + i * 2.39996;
    const w = s.ratio / maxS;
    return { d: [r * Math.cos(a), y, r * Math.sin(a)], amp: (0.24 + 1.05 * w) * lobeK, sig: 0.4 + 0.2 * w };
  });

  const lvl = spec ? Math.max(0, spec.level ?? -1) : 0;
  const topDeep = deep.length ? Math.max(...deep.map((d) => d.ratio)) / 100 : 0;
  const push = sphere();
  const anti = push.map((v) => -v);
  const pushAmp = (0.15 + 0.85 * topDeep * topDeep) * (1 - 0.5 * cryst);
  const pushW = (x, y, z) => {
    const a = angle(x, y, z, push);
    return Math.exp(-(a * a) / 0.72);
  };

  const axis = sphere();
  const axU = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const axV = cross(axis, axU);
  const hz = Math.round(F.hz);
  const modeL = 2 + (hz % 6);
  const modeM = Math.floor(hz / 6) % (modeL + 1);
  const waveAmp = hz ? 0.03 + 0.055 * ((hz % 97) / 97) : 0;
  const wavePh = rand() * 6.28;
  const terrace = F.hard >= 7 ? ((F.hard - 6) / 4) * 0.85 : 0;

  const spikes = [];
  for (let i = 0; i < (lvl ? 6 + lvl * 9 : 0); i++) {
    spikes.push({ d: sphere(), len: (0.04 + 0.075 * lvl) * (0.55 + 0.9 * rand()) });
  }
  const spikeSig = 0.085 - 0.009 * lvl;

  const raw = (x, y, z, bare) => {
    let r = cryst > 0.02 ? (1 - cryst) * 0.58 + cryst * heartR(x, y, z) * 0.9 : 0.58;
    let best = -1;
    let top = 0.12 * lobeK;
    for (let i = 0; i < lobes.length; i++) {
      const L = lobes[i];
      const ang = angle(x, y, z, L.d);
      const g = L.amp * Math.exp(-(ang * ang) / (2 * L.sig * L.sig));
      r += g;
      if (g > top) { top = g; best = i; }
    }
    if (waveAmp) {
      const th = angle(x, y, z, axis);
      const ph = Math.atan2(x * axV[0] + y * axV[1] + z * axV[2], x * axU[0] + y * axU[1] + z * axU[2]);
      r += waveAmp * (1 + 0.5 * lvl / 4) * Math.sin(modeL * th + wavePh) * Math.cos(modeM * ph);
    }
    if (spec && deep.length) {
      const opp = angle(x, y, z, anti);
      r += pushAmp * 0.55 * pushW(x, y, z) - pushAmp * 0.18 * Math.exp(-(opp * opp) / 0.5);
    }
    if (terrace) r += (Math.round(r / 0.075) * 0.075 - r) * terrace;
    if (!bare) {
      for (const S of spikes) {
        const a = angle(x, y, z, S.d);
        if (a < spikeSig * 6) r += S.len * Math.exp(-a / spikeSig);
      }
    }
    return [r, best];
  };
  let peak = 0;
  for (let i = 0; i < 500; i++) {
    const d = sphere();
    peak = Math.max(peak, raw(d[0], d[1], d[2], true)[0]);
  }
  const fit = (spec ? 1.3 : 1.5) / peak;

  const cracks = (spec ? spec.cracks : []).slice(0, 5).map(() => {
    const n = sphere();
    const c = unit(cross(n, sphere()));
    return { n, c, ext: 0.55 + rand() * 0.7, ph: rand() * 6 };
  });
  const crackAt = (x, y, z) => {
    let state = 0;
    for (const C of cracks) {
      const along = angle(x, y, z, C.c);
      if (along > C.ext) continue;
      const taper = 1 - along / C.ext;
      const dist = Math.abs(x * C.n[0] + y * C.n[1] + z * C.n[2] + 0.04 * Math.sin(along * 11 + C.ph) + 0.02 * Math.sin(along * 29 + C.ph));
      if (dist < 0.02 * (0.4 + taper)) return 2;
      if (dist < 0.05 * (0.4 + taper)) state = 1;
    }
    return state;
  };

  const emit = (x, y, z, scale, size, bare) => {
    const ck = cracks.length ? crackAt(x, y, z) : 0;
    if (ck === 2) return;
    const [r, g] = raw(x, y, z, bare);
    const R = r * fit * scale * (ck ? 0.985 : 1);
    if (ck) put(x * R, y * R, z * R, 0, 0, 0, 1, -1, 0.1, 1.3);
    else put(x * R, y * R, z * R, 0, 0, 0, 0, g, spec ? pushW(x, y, z) * topDeep : 0.75, size);
  };
  const ringsOf = (count, rings, scale, size, bare) => {
    for (let j = 1; j < rings; j++) {
      const th = (j / rings) * Math.PI;
      const sy = Math.cos(th);
      const sr = Math.sin(th);
      const n = Math.round((count / rings) * sr * 1.5);
      const off = rand() * 6.28;
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * Math.PI * 2;
        emit(sr * Math.cos(a), sy, sr * Math.sin(a), scale, size, bare);
      }
    }
  };
  const spiralOf = (count, scale, size, bare) => {
    const arms = 3;
    const turns = 13;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const th = Math.acos(1 - 2 * u);
      const a = turns * 2 * th + (i % arms) * (6.2832 / arms) + spin;
      const sr = Math.sin(th);
      emit(sr * Math.cos(a), Math.cos(th), sr * Math.sin(a), scale, size, bare);
    }
  };
  const meridiansOf = (count, lines, scale, size, bare) => {
    const per = Math.floor(count / lines);
    for (let m = 0; m < lines; m++) {
      const a = spin + (m / lines) * 6.2832;
      for (let k = 1; k < per; k++) {
        const th = (k / per) * Math.PI;
        const sr = Math.sin(th);
        emit(sr * Math.cos(a), Math.cos(th), sr * Math.sin(a), scale, size, bare);
      }
    }
  };
  const weave = !spec ? 'rings' : F.hard <= 3.5 ? 'spiral' : F.hard >= 7.5 ? 'lattice' : 'rings';
  const shellOf = (count, scale, size, bare) => {
    if (weave === 'spiral') spiralOf(count, scale, size, bare);
    else if (weave === 'lattice') {
      ringsOf(count * 0.55, 26, scale, size, bare);
      meridiansOf(count * 0.45, 30, scale, size, bare);
    } else ringsOf(count, 44, scale, size, bare);
  };

  const opaque = 1 - F.trans;
  const shellN = Math.floor(budget * 0.62);
  const nLayers = Math.max(1, Math.min(6, Math.round(F.layers)));
  const fillShare = spec ? 0.04 + 0.3 * opaque : 0.14;
  const outerShare = nLayers === 1 ? 0.84 - fillShare : 0.5;
  shellOf(shellN * outerShare, 1, spec ? 0.72 + 0.45 * opaque : 1, false);
  for (let i = 1; i < nLayers; i++) {
    const scale = 1 - (i * 0.55) / Math.max(1, nLayers - 1) * (nLayers === 2 ? 0.7 : 1);
    shellOf((shellN * (0.86 - outerShare - fillShare)) / (nLayers - 1), scale, 0.75 - 0.2 * (i / nLayers), true);
  }
  const fill = Math.floor(shellN * fillShare);
  for (let i = 0; i < fill; i++) {
    const d = sphere();
    emit(d[0], d[1], d[2], 0.97 + rand() * 0.05, 0.75, false);
  }

  for (const S of spikes) {
    const [base, g] = raw(S.d[0], S.d[1], S.d[2], true);
    const tip = Math.min(1.62, (base + S.len) * fit);
    const from = base * fit * 0.92;
    const n = Math.round(10 + 60 * Math.max(0, tip - from));
    for (let k = 0; k <= n; k++) {
      const R = from + (tip - from) * Math.pow(k / n, 0.8);
      put(S.d[0] * R, S.d[1] * R, S.d[2] * R, 0, 0, 0, 0, g, 0, k === n ? 1.7 : 0.9);
    }
  }

  lobes.forEach((L, i) => {
    const R = raw(L.d[0], L.d[1], L.d[2], true)[0] * fit;
    const tip = [L.d[0] * R, L.d[1] * R, L.d[2] * R];
    anchors.push({ group: i, layer: 'surface', index: i, p: tip, orbit: 0 });
    const bend = sphere();
    const steps = Math.floor(budget * 0.012);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const u = 4 * t * (1 - t) * 0.16;
      const j = 0.012;
      put(tip[0] * t + bend[0] * u + (rand() - 0.5) * j, tip[1] * t + bend[1] * u + (rand() - 0.5) * j, tip[2] * t + bend[2] * u + (rand() - 0.5) * j, 0, 0, 0, 1, i, t, 0.85);
    }
  });

  if (deep.length) {
    const maxD = Math.max(...deep.map((d) => d.ratio));
    const main = deep.findIndex((d) => d.ratio === maxD);
    const coreN = Math.floor(budget * 0.24);
    const total = deep.reduce((a, d) => a + d.ratio, 0) || 1;
    let sat = 0;
    deep.forEach((d, j) => {
      const grp = 100 + j;
      const w = Math.cbrt(d.ratio / maxD);
      const R = j === main ? 0.13 + 0.2 * topDeep : Math.max(0.07, 0.19 * w);
      let c = push.map((v) => v * 0.2 * topDeep * (1 - 0.5 * cryst));
      if (j !== main) {
        const a = spin + sat * 2.2 + 1;
        const orbit = 0.38 + 0.07 * sat;
        c = [orbit * Math.cos(a), (sat % 2 ? -1 : 1) * (0.1 + 0.06 * sat), orbit * Math.sin(a)];
        sat++;
      }
      anchors.push({ group: grp, layer: 'deep', index: j, p: c, orbit: j === main ? 0 : 0.15 + 0.25 * ((grp * 0.37) % 1) });
      const n = Math.max(160, Math.floor(coreN * (0.25 / deep.length + 0.75 * d.ratio / total)));
      for (let k = 0; k < n; k++) {
        const v = sphere();
        const rr = k % 4 === 0 ? R : R * Math.pow(rand(), 0.7);
        put(v[0] * rr, v[1] * rr, v[2] * rr, c[0], c[1], c[2], 2, grp, rand(), k % 4 === 0 ? 1 : 1.3);
      }
    });
  }

  (spec ? spec.bodies : []).slice(0, 4).forEach((b, i) => {
    const d = sphere();
    const dist = 0.5 + rand() * 0.14;
    const c = [d[0] * dist, d[1] * dist * 0.8, d[2] * dist];
    const u = sphere();
    const v = unit(cross(u, sphere()));
    const w = cross(u, v);
    const k = 0.1;
    for (const p of bodyShape(b.name, rand)) {
      put((u[0] * p[0] + v[0] * p[1] + w[0] * p[2]) * k, (u[1] * p[0] + v[1] * p[1] + w[1] * p[2]) * k, (u[2] * p[0] + v[2] * p[1] + w[2] * p[2]) * k, c[0], c[1], c[2], 5, 200 + i, 0, 1.25);
    }
    anchors.push({ group: 200 + i, layer: 'body', index: i, p: c, orbit: 0 });
  });

  const power = spec ? Math.min(1, F.tesla / 10) : 0;
  if (power > 0.02) {
    const lines = Math.round(4 + 11 * power);
    const pole = unit([axis[0] * 0.5, 1, axis[2] * 0.5]);
    const pu = unit(cross(pole, [1, 0, 0.3]));
    const pv = cross(pole, pu);
    if (F.field === '척력') {
      for (let i = 0; i < lines * 2; i++) {
        const d = sphere();
        for (let k = 0; k < 46; k++) {
          const t = k / 46;
          const R = 1.38 + t * (0.3 + 0.3 * power);
          put(d[0] * R, d[1] * R, d[2] * R, 0, 0, 0, 6, 1, t * 0.9, 1.1);
        }
      }
    } else if (F.field === '구속') {
      for (let i = 0; i < Math.round(2 + 4 * power); i++) {
        const n = sphere();
        const a = unit(cross(n, sphere()));
        const b = cross(n, a);
        const R = 1.5 + 0.09 * (i % 3);
        for (let k = 0; k < 420; k++) {
          const t = (k / 420) * 6.2832;
          const cs = Math.cos(t) * R;
          const sn = Math.sin(t) * R;
          put(a[0] * cs + b[0] * sn, a[1] * cs + b[1] * sn, a[2] * cs + b[2] * sn, 0, 0, 0, 6, i % 2 ? 1 : -1, t * 1.35, 1.1);
        }
      }
    } else {
      for (let i = 0; i < lines; i++) {
        const az = (i / lines) * 6.2832;
        const e = [pu[0] * Math.cos(az) + pv[0] * Math.sin(az), pu[1] * Math.cos(az) + pv[1] * Math.sin(az), pu[2] * Math.cos(az) + pv[2] * Math.sin(az)];
        const L = 1.55 + 0.3 * power + 0.12 * (i % 2);
        for (let k = 1; k < 150; k++) {
          const th = (k / 150) * Math.PI;
          const R = L * Math.sin(th) * Math.sin(th);
          if (R < 1.02) continue;
          const cs = Math.cos(th) * R;
          const sn = Math.sin(th) * R;
          put(pole[0] * cs + e[0] * sn, pole[1] * cs + e[1] * sn, pole[2] * cs + e[2] * sn, 0, 0, 0, 6, -1, th * 0.9, 1.1);
        }
      }
    }
  }

  const shed = spec && F.half < 0.45 ? (0.45 - F.half) / 0.45 : 0;
  const dust = Math.floor(budget * (0.03 + 0.07 * shed));
  for (let i = 0; i < dust; i++) {
    const d = sphere();
    const R = shed && i % 3 ? 1.25 + rand() * 0.55 : 1.55 + rand() * 1.1;
    put(d[0] * R, d[1] * R, d[2] * R, 0, 0, 0, 3, -1, rand(), 0.9);
  }
  return { data: new Float32Array(out), count: out.length / 10, anchors };
}

function glRenderer(canvas, fail) {
  const opts = { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' };
  let gl = null;
  for (const type of ['webgl', 'experimental-webgl', 'webgl2']) {
    try {
      gl = canvas.getContext(type, opts);
    } catch {
      gl = null;
    }
    if (gl) break;
  }
  if (!gl) {
    fail.reason = 'off';
    return null;
  }
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('LOVE SCAN shader:', gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    fail.reason = 'shader';
    console.warn('LOVE SCAN program:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  [['aLocal', 3, 0], ['aCenter', 3, 12], ['aMeta', 4, 24]].forEach(([name, size, off]) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off);
  });
  const U = {};
  for (const n of ['uRot', 'uScale', 'uTime', 'uBeat', 'uScan', 'uReveal', 'uDeep', 'uHi', 'uPx', 'uMain', 'uHeat', 'uScanK']) U[n] = gl.getUniformLocation(prog, n);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);
  let count = 0;
  return {
    budget: 1,
    load(data) {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      count = data.length / 10;
    },
    size(w, h) { gl.viewport(0, 0, w, h); },
    draw(u) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix3fv(U.uRot, false, u.rot);
      gl.uniform2f(U.uScale, u.sx, u.sy);
      gl.uniform1f(U.uTime, u.time);
      gl.uniform1f(U.uBeat, u.beat);
      gl.uniform1f(U.uScan, u.scan);
      gl.uniform1f(U.uReveal, u.reveal);
      gl.uniform1f(U.uDeep, u.deep);
      gl.uniform1f(U.uHi, u.hi);
      gl.uniform1f(U.uPx, u.px);
      gl.uniform1f(U.uScanK, u.scanK ?? 1);
      gl.uniform3fv(U.uMain, u.main);
      gl.uniform3fv(U.uHeat, u.heat);
      gl.drawArrays(gl.POINTS, 0, count);
    },
  };
}

function canvasRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let data = new Float32Array(0);
  let W = 1;
  let H = 1;
  const css = (c, k = 1) => `rgb(${Math.round(Math.min(1, c[0] * k) * 255)},${Math.round(Math.min(1, c[1] * k) * 255)},${Math.round(Math.min(1, c[2] * k) * 255)})`;
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return {
    budget: 0.45,
    load(d) { data = d; },
    size(w, h) { W = w; H = h; },
    draw(u) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const R = u.rot;
      const deepPos = Math.max(u.deep, 0);
      const deepNeg = Math.min(u.deep, 0);
      const amber = [1, 0.72, 0.42];
      const cream = [1, 0.96, 0.88];
      const fills = [css(u.main), css(mixc(u.heat, u.main, 0.5)), css(mixc(u.heat, amber, 0.3)), css(u.main, 0.8), css(u.main), css(cream), css(mixc(u.main, [1, 1, 1], 0.15))];
      let fill = '';
      for (let i = 0; i < data.length; i += 10) {
        const kind = data[i + 6];
        const grp = data[i + 7];
        const seed = data[i + 8];
        const w = data[i + 9];
        let lx = data[i];
        let ly = data[i + 1];
        let lz = data[i + 2];
        let cx = data[i + 3];
        const cy = data[i + 4];
        let cz = data[i + 5];
        let k = 0;
        let a;
        if (kind < 0.5) {
          const m = 1 + (0.012 + 0.09 * seed) * u.beat;
          lx *= m; ly *= m; lz *= m;
          a = 0.66 * (1 - 0.82 * deepPos);
        } else if (kind < 1.5) {
          k = 1;
          const m = 1 + 0.02 * u.beat;
          lx *= m; ly *= m; lz *= m;
          a = 0.55;
        } else if (kind < 2.5) {
          k = 2;
          const an = u.time * (0.15 + 0.25 * ((grp * 0.37) % 1));
          const c = Math.cos(an);
          const sn = Math.sin(an);
          [cx, cz] = [cx * c - cz * sn, cx * sn + cz * c];
          const m = 1 + 0.16 * u.beat;
          lx *= m; ly *= m; lz *= m;
          a = 0.62 * (1 + 0.8 * deepNeg) * (1 + 0.5 * u.beat);
        } else if (kind < 3.5) {
          k = 3;
          ly += 0.05 * Math.sin(u.time * 0.3 + seed * 40);
          a = 0.22;
        } else if (kind < 4.5) {
          continue;
        } else if (kind < 5.5) {
          k = 5;
          a = 0.95 * (1 + 0.5 * deepNeg);
        } else {
          k = 6;
          const flow = 0.5 + 0.5 * Math.sin(seed * 14 - u.time * 1.8 * grp);
          a = 0.85 * (0.3 + 0.7 * flow * flow * flow) * (1 - Math.abs(u.deep));
        }
        const px = cx + lx;
        const py = cy + ly;
        const pz = cz + lz;
        const solid = kind < 2.5 || (kind > 4.5 && kind < 5.5);
        if (solid && u.reveal < 1 && py > u.scan) continue;
        const qx = R[0] * px + R[3] * py + R[6] * pz;
        const qy = R[1] * px + R[4] * py + R[7] * pz;
        const qz = R[2] * px + R[5] * py + R[8] * pz;
        const z = 3.6 - qz;
        const sd = (py - u.scan) / 0.07;
        const s = solid ? Math.exp(-sd * sd) * (u.scanK ?? 1) : 0;
        a *= Math.min(1, w);
        a *= 1 + (kind > 1.5 ? 0.5 : 2.2) * s;
        if (u.hi > -0.5 && solid) a *= Math.abs(grp - u.hi) < 0.5 ? 2 : 0.3;
        a *= Math.max(0.35, Math.min(1.3, 1.3 - 0.35 * (z - 2.6)));
        if (a < 0.02) continue;
        const size = Math.max(1, (w * u.px / z) * (1 + s * 0.6)) * 0.85;
        const x = (qx * u.sx / z * 0.5 + 0.5) * W;
        const y = (1 - (qy * u.sy / z * 0.5 + 0.5)) * H;
        const f = s > 0.3 ? '#ffffff' : fills[k];
        if (f !== fill) {
          ctx.fillStyle = f;
          fill = f;
        }
        ctx.globalAlpha = Math.min(1, a * 0.75);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

function rotOf(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
}

export function createSpecimen(canvas, onFrame) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fail = {};
  const gpu = glRenderer(canvas, fail);
  let renderer = gpu;
  if (!renderer) {
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    canvas = fresh;
    renderer = canvasRenderer(canvas);
  }
  if (!renderer) return null;

  const small = matchMedia('(max-width: 899px)').matches;
  const budget = Math.round((small ? 15000 : 30000) * renderer.budget);
  const st = {
    yaw: 0.6, pitch: 0, vy: 0, vp: 0, drag: false, hover: false, spike: 0,
    time: 0, last: 0, sweep: -1, reveal: 1, deep: 0, deepTo: 0, hi: -1,
    bpm: 60, pulse: { rest: 60, contact: 60, peak: 60 }, phase: 0,
    w: 1, h: 1, count: 0, anchors: [], visible: true, raf: 0, frame: 0,
    zoom: 0.65, zoomTo: 0.65, main: [0.62, 0.82, 1], heat: [1, 0.36, 0.54],
  };
  const ZBASE = 0.65;
  const ZMIN = 0.4;
  const ZMAX = 2.6;
  const setZoom = (z) => {
    st.zoomTo = Math.max(ZMIN, Math.min(ZMAX, z));
    kick();
  };

  function load(spec, animate) {
    const g = build(spec, budget);
    st.idle = !spec;
    if (!spec) st.yaw = 0;
    renderer.load(g.data);
    st.count = g.count;
    st.anchors = g.anchors;
    st.pulse = spec?.bpm || { rest: 60, contact: 60, peak: 60 };
    st.bpm = st.pulse.rest;
    st.hi = -1;
    st.deep = st.deepTo = 0;
    if (animate && !still) {
      st.sweep = 0;
      st.reveal = 0;
    } else {
      st.sweep = -1;
      st.reveal = 1;
    }
    kick();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
    st.w = Math.max(1, r.width);
    st.h = Math.max(1, r.height);
    canvas.width = Math.round(st.w * dpr);
    canvas.height = Math.round(st.h * dpr);
    renderer.size(canvas.width, canvas.height);
    st.px = Math.min(canvas.width, canvas.height) * 0.0072;
    kick();
  }

  function draw(now) {
    st.raf = 0;
    const dt = Math.min(0.05, (now - (st.last || now)) / 1000);
    st.last = now;
    if (!still) st.time += dt;

    if (!st.drag) {
      if (st.idle) {
        const off = Math.atan2(Math.sin(0.55 * Math.sin(st.time * 0.5) - st.yaw), Math.cos(0.55 * Math.sin(st.time * 0.5) - st.yaw));
        st.yaw += st.vy + (still ? 0 : off * Math.min(1, dt * 1.2));
      } else {
        st.yaw += st.vy + (still ? 0 : dt * 0.16);
      }
      st.pitch += st.vp;
      st.vy *= 0.94;
      st.vp *= 0.94;
      st.pitch += (0 - st.pitch) * dt * 0.4;
    }
    st.pitch = Math.max(-1.1, Math.min(1.1, st.pitch));

    let scan;
    if (st.sweep >= 0) {
      st.sweep += dt / SWEEP;
      const e = Math.min(1, st.sweep);
      scan = -SPAN + 2 * SPAN * (e * e * (3 - 2 * e));
      if (st.sweep >= 1) { st.sweep = -1; st.reveal = 0.001; st.t0 = st.time; }
    } else {
      scan = SPAN * Math.cos((st.time - (st.t0 || 0)) * 0.45);
    }
    if (st.reveal > 0 && st.reveal < 1) st.reveal = Math.min(1, st.reveal + dt * 1.6);

    st.spike = Math.max(0, st.spike - dt);
    const target = st.spike > 0 ? st.pulse.peak : st.drag || st.hover ? st.pulse.contact : st.pulse.rest;
    st.bpm += (target - st.bpm) * Math.min(1, dt * 1.8);
    st.phase = (st.phase + dt * st.bpm / 60) % 1;
    const ph = st.phase;
    const beat = still ? 0 : Math.exp(-Math.pow(ph / 0.07, 2)) + Math.exp(-Math.pow((ph - 1) / 0.07, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.28) / 0.08, 2));
    st.deep += (st.deepTo - st.deep) * Math.min(1, dt * 4);
    st.zoom += (st.zoomTo - st.zoom) * Math.min(1, dt * 10);

    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const rot = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
    const f = 2 * st.zoom;
    const sx = f * (st.h < st.w ? st.h / st.w : 1);
    const syc = f * (st.w < st.h ? st.w / st.h : 1);

    renderer.draw({ rot, sx, sy: syc, time: st.time, beat, scan, reveal: st.reveal, deep: st.deep, hi: st.hi, px: st.px * Math.pow(st.zoom, 0.6), main: st.main, heat: st.heat });

    const pts = st.anchors.map((a) => {
      let [x, y, z] = a.p;
      if (a.orbit) {
        const ang = st.time * a.orbit;
        const c = Math.cos(ang), s = Math.sin(ang);
        [x, z] = [x * c - z * s, x * s + z * c];
      }
      const qx = rot[0] * x + rot[3] * y + rot[6] * z;
      const qy = rot[1] * x + rot[4] * y + rot[7] * z;
      const qz = rot[2] * x + rot[5] * y + rot[8] * z;
      const zz = CAM - qz;
      return {
        group: a.group, layer: a.layer, index: a.index, depth: qz,
        x: (qx * sx / zz * 0.5 + 0.5) * st.w,
        y: (1 - (qy * syc / zz * 0.5 + 0.5)) * st.h,
        shown: st.reveal >= 1 || y < scan,
      };
    });
    st.frame++;
    onFrame?.({
      pts, w: st.w, h: st.h, frame: st.frame, bpm: st.bpm, beat, scanning: st.sweep >= 0,
      yaw: ((st.yaw * 180 / Math.PI) % 360 + 360) % 360, pitch: st.pitch * 180 / Math.PI,
      slice: Math.round((scan + SPAN) / (2 * SPAN) * 63) + 1, count: st.count, zoom: st.zoom,
    });

    const moving = st.drag || Math.abs(st.vy) + Math.abs(st.vp) > 0.0004 || Math.abs(st.deepTo - st.deep) > 0.002 || Math.abs(st.zoomTo - st.zoom) > 0.002;
    if (st.visible && (!still || moving)) kick();
  }

  function kick() {
    if (!st.raf && st.visible && !st.paused) st.raf = requestAnimationFrame(draw);
  }

  const touches = new Map();
  let px = 0, py = 0, pinch = 0, pinchZoom = 1;
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture?.(e.pointerId);
    if (touches.size === 2) {
      pinch = spread();
      pinchZoom = st.zoomTo;
      st.drag = false;
      return;
    }
    st.drag = true;
    st.spike = 1.4;
    px = e.clientX;
    py = e.clientY;
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) {
      setZoom(pinchZoom * (spread() / pinch));
      return;
    }
    if (!st.drag) return;
    const dx = (e.clientX - px) * 0.008;
    const dy = (e.clientY - py) * 0.008;
    px = e.clientX;
    py = e.clientY;
    st.yaw += dx;
    st.pitch += dy;
    st.vy = dx;
    st.vp = dy;
    kick();
  });
  const up = (e) => {
    touches.delete(e.pointerId);
    if (touches.size === 1) {
      const [t] = touches.values();
      px = t.x;
      py = t.y;
      st.drag = true;
    } else {
      st.drag = false;
    }
    kick();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setZoom(st.zoomTo * Math.exp(-d * 0.0015));
  }, { passive: false });
  canvas.addEventListener('dblclick', () => setZoom(ZBASE));
  canvas.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') st.hover = true; });
  canvas.addEventListener('pointerleave', () => { st.hover = false; });

  new ResizeObserver(resize).observe(canvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      st.visible = e.isIntersecting && !document.hidden;
      st.last = 0;
      kick();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    st.visible = !document.hidden;
    st.last = 0;
    kick();
  });
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

  function snapshot(size = 1400, zoom = 0.82, o = {}) {
    const pw = canvas.width, ph = canvas.height, ppx = st.px;
    canvas.width = size;
    canvas.height = size;
    renderer.size(size, size);
    const f = 2 * zoom;
    renderer.draw({
      rot: rotOf(o.yaw || 0, o.pitch || 0), sx: f, sy: f, time: o.time ?? st.time, beat: o.beat || 0, scan: o.scan ?? 99, reveal: 1,
      deep: st.deepTo, hi: -1, px: size * 0.0072 * Math.pow(zoom, 0.6), main: st.main, heat: st.heat, scanK: o.scanK ?? 1,
    });
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    out.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = pw;
    canvas.height = ph;
    renderer.size(pw, ph);
    st.px = ppx;
    st.last = 0;
    kick();
    return out;
  }

  resize();
  return {
    canvas,
    snapshot,
    pause(on) {
      st.paused = on;
      if (on) { cancelAnimationFrame(st.raf); st.raf = 0; } else { st.last = 0; kick(); }
    },
    mode: gpu ? 'webgl' : 'canvas',
    reason: fail.reason || '',
    load,
    setMode(m) { st.deepTo = m === 'deep' ? 1 : m === 'surface' ? -1 : 0; kick(); },
    highlight(g) { st.hi = g; kick(); },
    zoomBy(k) { setZoom(k ? st.zoomTo * k : ZBASE); },
    setColors(main, heat) { st.main = main; st.heat = heat; kick(); },
  };
}
