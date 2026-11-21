function palette(frames) {
  const cnt = new Float64Array(32768);
  for (const f of frames) {
    for (let i = 0; i < f.length; i += 4) cnt[((f[i] >> 3) << 10) | ((f[i + 1] >> 3) << 5) | (f[i + 2] >> 3)]++;
  }
  const pts = [];
  for (let k = 0; k < 32768; k++) {
    if (!cnt[k]) continue;
    const r = ((k >> 10) << 3) | 4, g = (((k >> 5) & 31) << 3) | 4, b = ((k & 31) << 3) | 4;
    const lum = (r * 3 + g * 4 + b * 2) / 2295;
    pts.push({ c: [r, g, b], w: Math.sqrt(cnt[k]) * (0.4 + 2.5 * lum) });
  }
  let boxes = [pts];
  while (boxes.length < 256) {
    let bi = -1, best = 0, axis = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let a = 0; a < 3; a++) {
        let lo = 255, hi = 0, wsum = 0;
        for (const p of bx) { lo = Math.min(lo, p.c[a]); hi = Math.max(hi, p.c[a]); wsum += p.w; }
        const score = (hi - lo) * Math.sqrt(wsum);
        if (score > best) { best = score; bi = i; axis = a; }
      }
    });
    if (bi < 0) break;
    const bx = boxes[bi].sort((p, q) => p.c[axis] - q.c[axis]);
    const half = bx.reduce((t, p) => t + p.w, 0) / 2;
    let acc = 0, cut = 1;
    for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].w; if (acc >= half) { cut = i + 1; break; } }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  const pal = boxes.map((bx) => {
    let w = 0, r = 0, g = 0, b = 0;
    for (const p of bx) { w += p.w; r += p.c[0] * p.w; g += p.c[1] * p.w; b += p.c[2] * p.w; }
    return [r / w, g / w, b / w].map(Math.round);
  });
  while (pal.length < 256) pal.push([0, 0, 0]);
  return pal;
}

function indexer(pal) {
  const cache = new Int16Array(32768).fill(-1);
  return (r, g, b) => {
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = cache[k];
    if (v >= 0) return v;
    const cr = (r & 0xf8) | 4, cg = (g & 0xf8) | 4, cb = (b & 0xf8) | 4;
    let best = 0, bd = Infinity;
    for (let i = 0; i < 256; i++) {
      const p = pal[i];
      const d = (p[0] - cr) ** 2 * 3 + (p[1] - cg) ** 2 * 4 + (p[2] - cb) ** 2 * 2;
      if (d < bd) { bd = d; best = i; }
    }
    cache[k] = best;
    return best;
  };
}

function lzw(indices, out) {
  const MIN = 8, CLEAR = 256, EOI = 257;
  out.push(MIN);
  let block = [], acc = 0, nbits = 0, size = MIN + 1;
  const emit = (code) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      block.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
      if (block.length === 255) { out.push(255, ...block); block = []; }
    }
  };
  let dict = new Map();
  let next = EOI + 1;
  emit(CLEAR);
  let cur = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = cur * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << size) && size < 12) size++;
    } else {
      emit(CLEAR);
      dict = new Map();
      next = EOI + 1;
      size = MIN + 1;
    }
    cur = k;
  }
  emit(cur);
  emit(EOI);
  if (nbits > 0) block.push(acc & 255);
  if (block.length) out.push(block.length, ...block);
  out.push(0);
}

export async function encodeGif(frames, w, h, delayMs, onProgress) {
  const pal = palette(frames);
  const idx = indexer(pal);
  const out = [];
  const str = (s) => { for (const c of s) out.push(c.charCodeAt(0)); };
  const u16 = (n) => out.push(n & 255, (n >> 8) & 255);
  str('GIF89a'); u16(w); u16(h); out.push(0xf7, 0, 0);
  for (const p of pal) out.push(p[0], p[1], p[2]);
  out.push(0x21, 0xff, 11); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0);
  const cs = Math.round(delayMs / 10);
  const ind = new Uint8Array(w * h);
  let done = 0;
  for (const f of frames) {
    for (let i = 0, j = 0; i < f.length; i += 4, j++) ind[j] = idx(f[i], f[i + 1], f[i + 2]);
    out.push(0x21, 0xf9, 4, 0, cs & 255, cs >> 8, 0, 0);
    out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0);
    lzw(ind, out);
    onProgress?.(++done / frames.length);
    await new Promise((r) => setTimeout(r));
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
