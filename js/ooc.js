import { RISKS } from './data.js?v=202611160030';

const HEAD = (n, title) => `[OOC ${n}/3 · LOVE SCAN ${title}] 잠시 역할극 중단. NPC/PC 기존설정, 관계성, 성격, 성향, 서사 종합참고. 두 사람 모두 성인이다.`;
const OUT = '[출력] 역할극 서술 없이 코드블록 하나에 아래 형식 그대로 한 항목 한 줄씩 쓴다. 표로 만들지 않는다. PC의 대사와 감정은 지어내지 않는다.';
const NEXT = '앞서 출력한 LOVE SCAN 결과에 이어서 쓰고, 앞선 결과와 모순되지 않게 한다.';

export function buildPrompt1() {
  return `${HEAD(1, '감정 스캔')}
가상의 '감정 스캐너'로 NPC가 PC를 향해 품고 있는 애정의 성분을 스캔한 결과 보고서를 출력한다. 겉으로 드러나는 감정뿐 아니라 무의식 밑바닥에 가라앉은 집착, 헌신, 불안, 맹목적인 믿음 같은 성분의 비율까지 분석한다.

[스캔 규칙]
- 표층: 일상에서 겉으로 드러나는 호감과 애정의 형태. 성분 3~5개, 비율 합 100%.
- 심층: 무의식적 집착, 맹목성, 숨겨진 두려움. 성분 2~4개, 비율 합 100%.
- 성분 이름은 NPC의 성향이 드러나게 직접 짓고 영문명을 괄호로 붙인다. 비율은 소수 첫째 자리까지.
- 설명은 서사 속 실제 장면과 행동을 근거로 2~3문장, 감정을 배제한 판독 문체로 쓴다.
- 색상: 스캐너 필름에 찍힌 표층 감정의 색과 심층 감정의 색을 각각 고른다. NPC의 성향과 서사에 어울리는 색을 반드시 #RRGGBB 형식의 16진수 코드로 쓰고, 색 이름과 그 색인 이유를 붙인다. 두 색은 서로 구별되게 고른다.

${OUT}
대상: NPC 이름 / PC 이름
표층 색: #RRGGBB · 색 이름 · 겉으로 드러난 감정이 그 색인 이유 한 줄
심층 색: #RRGGBB · 색 이름 · 깊은 곳의 감정이 그 색인 이유 한 줄
요약: 감정 구조 전체를 3~4문장으로
표층 1 [성분: 한글 이름 (English Name)] [비율: 00.0%] (설명: ~)
(표층 2~ 같은 형식)
심층 1 [성분: 한글 이름 (English Name)] [비율: 00.0%] (설명: ~)
(심층 2~ 같은 형식)`;
}

export function buildPrompt2() {
  return `${HEAD(2, '신체·물성 스캔')}
${NEXT} NPC의 몸에 나타나는 애정의 증상을 측정하고, NPC가 PC에게 품은 감정을 하나의 물질로 보고 그 물성을 잰다.

[스캔 규칙]
- 증상: 애정의 물리적 증상 2~4개. 특이: NPC의 성향이 반영된 추가 스캔 결과 1~3개.
- 물성 값마다 서사 속 근거를 한 줄 붙인다. 감정을 배제한 판독 문체로 쓴다.

${OUT}
심박: 평상시 00 / 접촉 시 00 / 최고 000
시선: PC 0.0초 / 일반 0.0초
증상 1 [항목: 이름] [수치: 측정값] (설명: ~)
(증상 2~ 같은 형식)
특이 1 [항목: 이름] (설명: ~)
결정화율: 0~100% · 이 감정이 '사랑'이라는 형태로 굳어진 정도와 근거
경도: 1~10 · 외부의 충격과 반대에 흔들리지 않는 정도와 근거
투과율: 0~100% · 속마음이 PC에게 비쳐 보이는 정도와 근거
공명: 000 Hz · 이 감정을 울리는 PC의 말, 소리, 행동 한 가지
자기장: 0.0~10.0 T · 인력 / 척력 / 구속 중 하나 · PC를 끌어당기는지, 밀어내는지, 가두는지
반감기: 기간 · PC와 떨어졌을 때 이 감정이 절반으로 줄기까지 걸리는 시간과 근거
나이테: 1~6겹 · 겹마다 쌓인 시간이나 사건`;
}

export function buildPrompt3() {
  return `${HEAD(3, '조성·최종 판독')}
${NEXT} 이 감정을 이루는 원소, 감정에 남은 상처와 삼킨 것을 판독하고 최종 소견을 낸다.

[스캔 규칙]
- 원소: 이 감정을 이루는 원소 3~5개를 실제 원소(금속, 비금속, 비활성 기체, 방사성 원소 모두 가능)에서 고르고 비율 합 100%. 설명에는 NPC의 어떤 면이 그 원소의 어떤 성질과 닮았는지 쓴다.
- 균열: 이 감정에 금이 간 사건 0~3개. 없으면 쓰지 않는다.
- 이물: NPC가 PC에게 끝내 하지 못하고 삼킨 말이나 건네지 못한 물건 1~3개.

${OUT}
원소 1 [원소: 한글 이름 (원소 기호)] [비율: 00%] (설명: ~)
(원소 2~ 같은 형식)
균열 1 [항목: 금이 간 사건] (설명: ~)
이물 1 [항목: 삼킨 말이나 물건] (설명: 삼킨 이유)
질량: 애정을 물질로 환산한 수치와 단위 · 한 줄 비유
위험 등급: 안정 / 주의 / 경고 / 위험 / 최고 위험 중 하나
소견: 최종 소견 4~6문장`;
}

export const PROMPTS = [buildPrompt1, buildPrompt2, buildPrompt3];

const LABEL_RE = /[\[(（]\s*(성분|원소|항목|이름|위치|원인|비율|수치|측정값|설명|근거)\s*[:：]/g;
const KEY_RE = /^[\[【]?\s*(대상|이름|요약|종합|심박수?|시선|(?:표층|심층|감정의)?\s*색(?:상|깔)?(?:\s*코드)?|(?:표층|심층)?\s*컬러|결정화율?|경도|투과율|공명(?:\s*주파수)?|자기장(?:\s*세기)?|반감기|나이테|애정\s*질량|질량|위험\s*등급|등급|최종\s*소견|소견)\s*[\]】]?\s*[:：]\s*(.*)$/;
const CLOSE = { '[': ']', '(': ')', '（': '）' };

const unquote = (s) => String(s || '').replace(/['‘’"“”「」『』]/g, '').trim();

function fields(rest) {
  const hits = [...rest.matchAll(LABEL_RE)];
  const out = {};
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : rest.length;
    let body = rest.slice(h.index + h[0].length, end).trim();
    const closer = CLOSE[h[0][0]];
    if (body.endsWith(closer) || body.endsWith(')') && closer === '）') body = body.slice(0, -1).trim();
    out[h[1]] = body;
  });
  return out;
}

function splitName(raw) {
  const s = unquote(raw).replace(/[:：]\s*$/, '').trim();
  const m = s.match(/^(.*?)\s*[(（]([A-Za-z][^)）]*)[)）]\s*$/);
  return m ? { name: m[1].trim(), en: m[2].trim() } : { name: s, en: '' };
}

const ratio = (s) => {
  const m = String(s ?? '').match(/\d+(?:\.\d+)?/);
  return m ? Math.max(0, Math.min(100, Number(m[0]))) : null;
};

function section(line) {
  if (/표층/.test(line)) return 'surface';
  if (/심층/.test(line)) return 'deep';
  if (/증상|물리|신체/.test(line)) return 'symptoms';
  if (/특이|추가\s*스캔/.test(line)) return 'extras';
  if (/소견|결론/.test(line)) return 'verdict';
  if (/요약|종합/.test(line)) return 'summary';
  return '';
}

function bpmFrom(text) {
  const v = [...String(text).matchAll(/(\d{2,3})(?:\s*[-~–]\s*(\d{2,3}))?\s*BPM/gi)]
    .map((m) => (m[2] ? Math.round((+m[1] + +m[2]) / 2) : +m[1]));
  if (!v.length) return null;
  const rest = v[0];
  const peak = Math.max(...v);
  const contact = v[1] && v[1] !== peak ? v[1] : Math.round((rest + peak) / 2);
  return { rest, contact, peak };
}

const UNITS = [
  [/^(M\s*[☉⊙]|태양\s*질량|solar)/i, 2e30],
  [/^(M\s*⊕|지구\s*질량|earth)/i, 6e24],
  [/^(달\s*질량)/, 7.3e22],
  [/^(메가\s*톤|Mt\b)/i, 1e9],
  [/^(킬로\s*톤|kt\b)/i, 1e6],
  [/^(밀리\s*그램|mg\b)/i, 1e-6],
  [/^(킬로\s*그램|kg\b)/i, 1],
  [/^(톤|t\b|ton)/i, 1e3],
  [/^(그램|g\b)/i, 1e-3],
  [/^(파운드|lb)/i, 0.4536],
];

export function massDensity(text) {
  const s = String(text || '');
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:[×x*]\s*10\s*\^?\s*(-?\d+))?/);
  if (!m) return 0.5;
  const v = parseFloat(m[1].replace(',', '.')) * (m[2] ? 10 ** Number(m[2]) : 1);
  const unit = s.slice(m.index + m[0].length).trim();
  const hit = UNITS.find(([re]) => re.test(unit));
  const kg = Math.max(1e-9, hit ? v * hit[1] : v);
  return Math.max(0, Math.min(1, (Math.log10(kg) + 3) / 34));
}

const PROPS = { 결정화: 'cryst', 결정화율: 'cryst', 경도: 'hard', 투과율: 'trans', 공명: 'hz', 공명주파수: 'hz', 자기장: 'tesla', 자기장세기: 'tesla', 반감기: 'half', 나이테: 'layers' };
const SPANS = [
  [/초/, 1], [/분/, 60], [/시간/, 3600], [/일|하루|날/, 86400], [/주/, 604800], [/개월|달/, 2.63e6],
  [/세기/, 3.156e9], [/천\s*년/, 3.156e10], [/년|해/, 3.156e7],
];

function prop(v) {
  const parts = v.split(/\s*[·•|]\s*/).filter(Boolean);
  const head = parts[0] || '';
  const n = head.match(/\d+(?:[.,]\d+)?/);
  const type = (v.match(/인력|척력|구속/) || [''])[0];
  return { raw: v, head, num: n ? parseFloat(n[0].replace(',', '.')) : null, type, note: parts.slice(1).filter((t) => t !== type).join(' · ') };
}

export function halfLife(text) {
  const s = String(text || '');
  if (/영원|무한|영구|측정\s*불가|없음|불멸|∞/.test(s)) return 1;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*([가-힣]+)/);
  if (!m) return 0.6;
  const unit = SPANS.find(([re]) => re.test(m[2]));
  const sec = parseFloat(m[1].replace(',', '.')) * (unit ? unit[1] : 86400);
  return Math.max(0, Math.min(1, Math.log10(Math.max(1, sec)) / 10));
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMED = [
  [/분홍|핑크|장미|벚꽃/, '#ff8fb8'], [/빨강|빨간|붉|레드|진홍|와인|피/, '#ff5a5f'], [/주황|오렌지|노을|호박/, '#ffa45c'],
  [/노랑|노란|금빛|황금|레몬|햇빛/, '#ffd75e'], [/초록|녹색|연두|민트|숲|이끼/, '#7fe0a4'], [/하늘|청록|시안|물빛/, '#7fd3f0'],
  [/파랑|파란|남색|군청|바다|코발트/, '#7aa5ff'], [/보라|라벤더|라일락|자주|바이올렛/, '#b79bff'], [/검정|검은|흑|먹/, '#9aa3b2'],
  [/흰|하양|하얀|백|은빛|은색|회색|잿빛/, '#dfe6ee'],
];

export function parseColor(v) {
  const parts = String(v || '').split(/\s*[·•|]\s*/).filter(Boolean);
  const m = String(v).match(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i);
  let hex = m ? m[1] : '';
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const rest = parts.map((p) => p.replace(/#[0-9a-f]{3,6}/i, '').trim()).filter(Boolean);
  const name = rest[0] || '';
  if (!hex) {
    const hit = NAMED.find(([re]) => re.test(name || v));
    if (!hit) return null;
    hex = hit[1].slice(1);
  }
  return { hex: `#${hex.toLowerCase()}`, name, note: rest.slice(1).join(' · ') };
}

export function riskLevel(text) {
  const t = String(text || '').replace(/\s/g, '');
  if (!t) return -1;
  if (/최고|극|critical/i.test(t)) return 4;
  if (/위험|danger/i.test(t)) return 3;
  if (/경고|warning/i.test(t)) return 2;
  if (/주의|caution/i.test(t)) return 1;
  if (/안정|stable/i.test(t)) return 0;
  return -1;
}

export function parseScan(text, partial) {
  const res = { npc: '', pc: '', summary: '', surface: [], deep: [], symptoms: [], extras: [], color: null, deepColor: null, elements: [], cracks: [], bodies: [], props: {}, bpm: null, gaze: null, mass: '', risk: '', verdict: '' };
  const src = String(text || '');
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^```/.test(l) && !/^[-=_*]{3,}$/.test(l));
  const SEC = { 표층: 'surface', 심층: 'deep', 증상: 'symptoms', 특이: 'extras', 원소: 'elements', 균열: 'cracks', 이물: 'bodies' };

  let sec = '';
  let cur = null;
  let open = '';

  for (const raw of lines) {
    const marked = /^#{1,6}\s/.test(raw) || /^\*\*.*\*\*$/.test(raw);
    const line = raw.replace(/\*\*|__|`/g, '').replace(/^#{1,6}\s*/, '').replace(/^[-•*>]\s+/, '');

    const item = line.match(/^(표층|심층|증상|특이|원소|균열|이물)\s*0*(\d{1,2})(?!\d)\s*(.*)$/);
    if (item && LABEL_RE.test(item[3])) {
      LABEL_RE.lastIndex = 0;
      const f = fields(item[3]);
      cur = { ...splitName(f.성분 || f.원소 || f.항목 || f.이름 || f.위치 || f.원인), ratio: ratio(f.비율), value: unquote(f.수치 || f.측정값), desc: (f.설명 || f.근거 || '').trim() };
      res[SEC[item[1]]].push(cur);
      open = '';
      continue;
    }
    LABEL_RE.lastIndex = 0;

    const key = line.match(KEY_RE);
    if (key) {
      const k = key[1].replace(/\s/g, '');
      const v = key[2].trim();
      cur = null;
      open = '';
      if (k === '대상' || k === '이름') {
        const p = v.split(/\s*[|｜\/,→]\s*/);
        res.npc = unquote(p[0]);
        res.pc = unquote(p[1]);
      } else if (k === '요약' || k === '종합') {
        res.summary = v;
        open = 'summary';
      } else if (k.startsWith('심박')) {
        const n = (v.match(/\d{2,3}/g) || []).map(Number);
        if (n.length >= 3) res.bpm = { rest: n[0], contact: n[1], peak: n[2] };
        else if (n.length === 2) res.bpm = { rest: n[0], contact: Math.round((n[0] + n[1]) / 2), peak: n[1] };
      } else if (k === '시선') {
        const n = (v.match(/\d+(?:\.\d+)?/g) || []).map(Number);
        if (n.length >= 2 && n[1] > 0) res.gaze = { pc: n[0], base: n[1] };
      } else if (/색|컬러/.test(k)) {
        if (k.startsWith('심층')) res.deepColor = parseColor(v);
        else res.color = parseColor(v);
      } else if (PROPS[k]) {
        res.props[PROPS[k]] = prop(v);
      } else if (k.includes('질량')) {
        res.mass = v;
      } else if (k.includes('등급')) {
        res.risk = unquote(v);
      } else {
        res.verdict = v;
        open = 'verdict';
      }
      continue;
    }

    const numbered = /^\d+\.\s*\S/.test(line) && line.length < 70;
    if ((marked || numbered) && section(line)) {
      sec = section(line);
      cur = null;
      open = sec === 'summary' || sec === 'verdict' ? sec : '';
      continue;
    }

    const alpha = sec && !open && line.match(/^([A-Za-z])[.)]\s+(.+)$/);
    if (alpha) {
      const pct = alpha[2].match(/[:：]?\s*(\d+(?:\.\d+)?)\s*%\s*$/);
      cur = { ...splitName(pct ? alpha[2].slice(0, pct.index) : alpha[2]), ratio: pct ? ratio(pct[1]) : null, value: '', desc: '' };
      res[sec].push(cur);
      continue;
    }

    if (cur) {
      const t = line.replace(/^설명\s*[:：]\s*/, '');
      cur.desc += (cur.desc ? ' ' : '') + t;
    } else if (open) {
      res[open] += (res[open] ? '\n' : '') + line;
    }
  }

  for (const k of ['surface', 'deep']) res[k] = res[k].filter((c) => c.name && c.ratio != null);
  res.elements = res.elements.filter((c) => c.name);
  for (const k of ['symptoms', 'extras', 'cracks', 'bodies']) res[k] = res[k].filter((c) => c.name);

  res.extra = Object.keys(res.props).length + res.elements.length + res.cracks.length + res.bodies.length + (res.mass ? 1 : 0) + (res.risk ? 1 : 0) + (res.verdict ? 1 : 0);
  if (partial === 2) {
    const n = Object.keys(res.props).length + res.symptoms.length + res.extras.length + (res.bpm ? 1 : 0) + (res.gaze ? 1 : 0);
    return n ? { result: res } : { error: '증상과 물성 항목을 찾지 못했어요. OOC ②의 답을 통째로 복사해 주세요.' };
  }
  if (partial === 3) {
    const n = res.elements.length + res.cracks.length + res.bodies.length + (res.mass ? 1 : 0) + (res.risk ? 1 : 0) + (res.verdict ? 1 : 0);
    return n ? { result: res } : { error: '원소와 소견 항목을 찾지 못했어요. OOC ③의 답을 통째로 복사해 주세요.' };
  }
  if (!res.surface.length && !res.deep.length) return { error: '표층과 심층 성분을 찾지 못했어요. AI의 답을 통째로 복사해 주세요.' };
  if (!res.surface.length) return { error: '표층 성분과 비율을 찾지 못했어요. 답이 중간에 끊겼다면 AI에게 다시 받아 주세요.' };
  if (!res.deep.length) return { error: '심층 성분과 비율을 찾지 못했어요. 답이 중간에 끊겼다면 AI에게 다시 받아 주세요.' };

  const body = [...res.symptoms, ...res.extras];
  if (!res.bpm) {
    const heart = body.find((s) => /심박|맥박|BPM/i.test(s.name + s.value + s.desc));
    res.bpm = heart ? bpmFrom(`${heart.value} ${heart.desc}`) : null;
  }
  if (!res.gaze) {
    const eye = body.find((s) => /시선|응시|눈맞춤/.test(s.name + s.desc));
    const n = eye ? [...`${eye.value} ${eye.desc}`.matchAll(/(\d+(?:\.\d+)?)\s*초/g)].map((m) => +m[1]) : [];
    if (n.length >= 2 && n[1] > 0) res.gaze = { pc: n[0], base: n[1] };
  }
  if (!res.npc) {
    const seen = new Map();
    for (const m of src.matchAll(/['‘]([^'‘’\n]{1,12})['’]/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
    const top = [...seen].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s);
    const ordered = [...seen.keys()].filter((s) => top.includes(s));
    res.npc = ordered[0] || '';
    res.pc = ordered[1] || '';
  }
  if (!res.risk) {
    const m = src.match(/['‘]([^'‘’\n]{1,10})['’]\s*등급/);
    res.risk = m ? m[1] : '';
  }
  res.level = riskLevel(res.risk);
  res.density = massDensity(res.mass);
  if (res.level >= 0 && !RISKS.some((r) => r.key === res.risk)) res.risk = RISKS[res.level].key;

  let h = 2166136261;
  for (const c of [res.npc, res.pc, ...res.surface.map((s) => s.name + s.ratio), ...res.deep.map((s) => s.name + s.ratio)].join('|')) {
    h = Math.imul(h ^ c.codePointAt(0), 16777619);
  }
  res.seed = h >>> 0;
  const rnd = mulberry(res.seed ^ 0x9e3779b9);
  const P = res.props;
  const num = (k, fallback) => (P[k] && P[k].num != null ? P[k].num : fallback);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const guess = [25 + rnd() * 55, 2 + rnd() * 7, 20 + rnd() * 60, 80 + rnd() * 700, rnd() * 6, ['인력', '척력', '구속'][Math.floor(rnd() * 3)], 0.3 + rnd() * 0.6, 2 + rnd() * 3];
  res.form = {
    cryst: clamp(num('cryst', guess[0]) / 100, 0, 1),
    hard: clamp(num('hard', guess[1]), 1, 10),
    trans: clamp(num('trans', guess[2]) / 100, 0, 1),
    hz: Math.max(1, num('hz', guess[3])),
    tesla: clamp(num('tesla', guess[4]), 0, 10),
    field: (P.tesla && P.tesla.type) || guess[5],
    half: P.half ? halfLife(P.half.raw) : guess[6],
    layers: clamp(Math.round(num('layers', guess[7])), 1, 6),
  };
  if (!res.color) {
    const h = res.seed % 360;
    const l = 0.74;
    const c = 0.62 * (1 - Math.abs(2 * l - 1));
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const hex = '#' + [r, g, b].map((v) => Math.round((v + l - c / 2) * 255).toString(16).padStart(2, '0')).join('');
    res.color = { hex, name: '', note: '', auto: true };
  }
  res.id = `LS-${res.seed.toString(36).toUpperCase().padStart(7, '0').slice(-6)}`;
  return { result: res };
}
