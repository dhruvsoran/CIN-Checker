// CIN and LLPIN decoding. Pure functions, no DOM: used by the page and by the tests.
//
// CIN layout (21 characters), e.g. L17110MH1973PLC019786
//   1      L       listing status: L = listed, U = unlisted
//   2-6    17110   industry (NIC) activity code
//   7-8    MH      state of the registered office (ROC code)
//   9-12   1973    year of incorporation
//   13-15  PLC     company type / ownership
//   16-21  019786  registration number issued by the ROC
//
// LLPIN layout (8 characters), e.g. AAA-1234: three letters, a hyphen, four digits.
// An LLPIN is a plain serial number. It does not encode state, year or type.

export const CIN_SEGMENTS = [
  { key: 'listing',  label: 'Listing',      start: 0,  len: 1, cls: 'letter', name: 'listing status' },
  { key: 'industry', label: 'Industry',     start: 1,  len: 5, cls: 'digit',  name: 'industry code' },
  { key: 'state',    label: 'State',        start: 6,  len: 2, cls: 'letter', name: 'state code' },
  { key: 'year',     label: 'Year',         start: 8,  len: 4, cls: 'digit',  name: 'year' },
  { key: 'type',     label: 'Type',         start: 12, len: 3, cls: 'letter', name: 'company type' },
  { key: 'reg',      label: 'Registration', start: 15, len: 6, cls: 'digit',  name: 'registration number' },
];

export const LLPIN_SEGMENTS = [
  { key: 'series', label: 'Series', start: 0, len: 3, cls: 'letter', name: 'letter series' },
  { key: 'dash',   label: '',       start: 3, len: 1, cls: 'dash',   name: 'hyphen' },
  { key: 'serial', label: 'Serial', start: 4, len: 4, cls: 'digit',  name: 'serial number' },
];

// State codes used in CINs. These follow MCA/ROC usage, which differs from GST and
// vehicle codes in a few places (Chhattisgarh CT, Uttarakhand UR, Telangana TG, Odisha OR).
// PN and TZ are ROC office codes (Pune, Coimbatore) that appear on older CINs.
export const STATES = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  DD: 'Daman and Diu',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OR: 'Odisha',
  PB: 'Punjab',
  PN: 'Maharashtra',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TZ: 'Tamil Nadu',
  UP: 'Uttar Pradesh',
  UR: 'Uttarakhand',
  WB: 'West Bengal',
};

export const STATE_NOTES = {
  PN: 'PN is the code of the ROC office in Pune, used on older Maharashtra CINs.',
  TZ: 'TZ is the code of the ROC office in Coimbatore, used on older Tamil Nadu CINs.',
};

// Codes people often type from GST or vehicle registrations instead of the CIN code.
const STATE_ALIASES = {
  UK: { to: 'UR', why: 'Uttarakhand is UR in a CIN. UK is its GST and vehicle code.' },
  UA: { to: 'UR', why: 'Uttarakhand is UR in a CIN.' },
  CG: { to: 'CT', why: 'Chhattisgarh is CT in a CIN. CG is its GST and vehicle code.' },
  TS: { to: 'TG', why: 'Telangana is TG in a CIN. TS is its old vehicle code.' },
  OD: { to: 'OR', why: 'Odisha is OR in a CIN. OD is its vehicle code.' },
  PU: { to: 'PY', why: 'Puducherry is PY in a CIN.' },
};

export const TYPES = {
  PLC: { label: 'Public limited company',                       group: 'public',     private: false },
  PTC: { label: 'Private limited company',                      group: 'private',    private: true  },
  OPC: { label: 'One person company',                           group: 'opc',        private: true  },
  GOI: { label: 'Government company (Central Government)',      group: 'government', private: false },
  SGC: { label: 'Government company (State Government)',        group: 'government', private: false },
  NPL: { label: 'Not-for-profit company (Section 8)',           group: 'nonprofit',  private: false },
  FLC: { label: 'Public company, subsidiary of a foreign company',  group: 'public',  private: false },
  FTC: { label: 'Private company, subsidiary of a foreign company', group: 'private', private: true  },
  GAP: { label: 'Public company limited by guarantee',          group: 'public',     private: false },
  GAT: { label: 'Private company limited by guarantee',         group: 'private',    private: true  },
  ULL: { label: 'Public unlimited company',                     group: 'public',     private: false },
  ULT: { label: 'Private unlimited company',                    group: 'private',    private: true  },
};

const TYPE_ALIASES = {
  PVT: 'PTC', PRV: 'PTC', LTD: 'PLC', PUB: 'PLC', PBL: 'PLC', GOV: 'GOI', OPL: 'OPC',
};

const FIRST_YEAR = 1850; // Joint Stock Companies Act, 1850: India's first company law.
const OPC_FROM = 2014;   // One person companies allowed from 1 April 2014.

// Characters that are easy to confuse when typing or reading off a scan.
const TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
const TO_LETTER = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };

const isLetter = (c) => c >= 'A' && c <= 'Z';
const isDigit = (c) => c >= '0' && c <= '9';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const describeChar = (c) => {
  if (isLetter(c)) return `the letter ${c}`;
  if (isDigit(c)) return `the digit ${c}`;
  if (c === ' ') return 'a space';
  if (c === '-') return 'a hyphen';
  return `“${c}”`;
};

const joinList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const range = (seg) => (seg.len === 1 ? `character ${seg.start + 1}` : `characters ${seg.start + 1}–${seg.start + seg.len}`);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// Cleaning: everything people paste from PDFs, Excel and WhatsApp.

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const ODD_SPACES = /[   -   　]/g;
const DASHES = /[‐-―−﹘﹣－]/g;
const QUOTES = /^["'`“”‘’«»]+|["'`“”‘’«»]+$/g;
const LABEL = /^(?:LLP\s*IN|LLPIN|LLP\s*ID|CIN|CORPORATE\s+IDENTI(?:TY|FICATION)\s+(?:NUMBER|NO))\.?\s*(?:NO\.?|NUMBER|#)?\s*[:#=\-]?\s*/i;

export function clean(raw) {
  const notes = [];
  let s = String(raw);
  const before = s;
  s = s.replace(ZERO_WIDTH, '');
  if (s !== before) notes.push('Removed hidden characters copied along with the text.');
  s = s.normalize('NFKC').replace(ODD_SPACES, ' ').replace(DASHES, '-').trim();
  s = s.replace(/[.,;:]+$/, '').replace(QUOTES, '').replace(/[.,;:]+$/, '').trim();
  if (LABEL.test(s)) {
    const stripped = s.replace(LABEL, '');
    if (stripped) { s = stripped; notes.push('Ignored the label in front of the number.'); }
  }
  if (/[a-z]/.test(s)) {
    notes.push('Converted to capital letters.');
    s = s.toUpperCase();
  }
  return { text: s, notes };
}

// ---------------------------------------------------------------------------
// Other Indian identifiers people paste by mistake. Checked on the compact form.

const LOOKALIKES = [
  { re: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, kind: 'GSTIN', msg: 'This is a GSTIN (GST number), not a CIN or LLPIN. A GSTIN contains the PAN, which can’t be turned into a CIN.' },
  { re: /^[A-Z]{5}\d{4}[A-Z]$/, kind: 'PAN', msg: 'This is a PAN (income tax number), not a CIN or LLPIN.' },
  { re: /^\d{8}$/, kind: 'DIN', msg: 'This looks like a DIN (Director Identification Number), which belongs to a person, not a company.' },
  { re: /^F\d{4,7}$/, kind: 'FCRN', msg: 'This looks like an FCRN. Foreign companies with an office in India get an FCRN instead of a CIN.' },
  { re: /^[A-Z]{3}\d{7}[A-Z]$/, kind: 'TAN', msg: 'This looks like a TAN (tax deduction account number), not a CIN or LLPIN.' },
];

// ---------------------------------------------------------------------------
// Public entry point for a single identifier.

export function analyze(raw) {
  const { text, notes } = clean(raw);
  const result = analyzeClean(text, notes);
  result.input = String(raw);

  // A line like "Reliance Industries L17110MH1973PLC019786": try each word on its own.
  if (result.status === 'invalid' && /\s/.test(text)) {
    const words = text.split(/\s+/);
    const hits = words.map((w) => analyzeClean(w, [])).filter((r) => r.status !== 'invalid');
    if (hits.length === 1) {
      const hit = hits[0];
      hit.notes.unshift('Picked the number out of the other text on this line.', ...notes);
      hit.input = String(raw);
      return hit;
    }
  }
  return result;
}

function base(id, notes) {
  return {
    input: '',
    id,
    kind: 'unknown',     // cin | llpin | other | unknown
    otherKind: null,     // GSTIN, PAN, ... when kind = other
    status: 'invalid',   // valid | warning | invalid
    errors: [],          // { msg, at: [index, ...] }
    warnings: [],
    notes: [...notes],
    suggestion: null,    // { id, why }
    fields: null,
    segments: null,      // [{ key, label, text, meaning, bad }]
  };
}

function analyzeClean(text, notes) {
  if (!text) {
    const r = base('', notes);
    r.errors.push({ msg: 'Nothing to check on this line.', at: [] });
    return r;
  }

  const hasSpaces = /\s/.test(text);
  const noSpaces = text.replace(/\s+/g, '');

  // LLPIN: three letters + hyphen + four digits, with some forgiveness.
  if (/^[A-Z0-9]{1,5}-[A-Z0-9]{1,7}$/.test(noSpaces) || /^[A-Z]{2,4}\d{2,6}$/.test(noSpaces)) {
    const llpNotes = [...notes];
    if (hasSpaces) llpNotes.push('Removed spaces.');
    // Exclude things that are clearly other identifiers.
    const other = LOOKALIKES.find((l) => l.re.test(noSpaces));
    if (!other) return checkLLPIN(noSpaces, llpNotes);
  }

  const compact = noSpaces.replace(/[-./_]/g, '');
  const cinNotes = [...notes];
  if (compact !== text) cinNotes.push(hasSpaces && compact.length === noSpaces.length ? 'Removed spaces.' : 'Removed spaces and separators.');

  const other = LOOKALIKES.find((l) => l.re.test(compact));
  if (other) {
    const r = base(compact, cinNotes);
    r.kind = 'other';
    r.otherKind = other.kind;
    r.errors.push({ msg: other.msg, at: [] });
    return r;
  }

  if (/^[A-Z0-9]+$/.test(compact) && compact.length >= 15 && compact.length <= 27) {
    return checkCIN(compact, cinNotes);
  }

  const r = base(compact || text, cinNotes);
  const chars = [...(compact || text)];
  const badAt = chars.map((c, i) => (/[A-Z0-9]/.test(c) ? -1 : i)).filter((i) => i >= 0);
  if (badAt.length && compact) {
    const list = badAt.slice(0, 3).map((i) => `character ${i + 1} is “${chars[i]}”`).join(', ');
    r.errors.push({ msg: `Only letters and digits are allowed, but ${list}${badAt.length > 3 ? ` and ${badAt.length - 3} more` : ''}.`, at: badAt });
  } else if (/^(CIN|LLPIN|LLPIN\/?CIN|CIN\/?LLPIN|CINS|LLPINS|ID|NUMBER|COMPANY|NAME|SR(NO)?)$/.test(compact.replace(/[^A-Z]/g, ''))) {
    r.errors.push({ msg: 'This looks like a column heading, not a number.', at: [] });
  } else if (!/\d/.test(compact)) {
    r.errors.push({ msg: 'There are no digits here, so this can’t be a CIN or LLPIN. A CIN looks like L17110MH1973PLC019786 and an LLPIN like AAA-1234.', at: [] });
  } else if (compact.length > 27) {
    r.errors.push({ msg: `Too long: ${compact.length} characters. A CIN has 21 and an LLPIN has 8 (like AAA-1234). Is there more than one number on this line?`, at: [] });
  } else {
    r.errors.push({ msg: `Too short to be a CIN (21 characters) or an LLPIN (like AAA-1234). This has ${plural(compact.length, 'character')}.`, at: [] });
  }
  return r;
}

// ---------------------------------------------------------------------------
// CIN

function checkCIN(s, notes) {
  const r = base(s, notes);
  r.kind = 'cin';

  if (s.length !== 21) return checkCINLength(r, s);

  const at = (seg) => s.slice(seg.start, seg.start + seg.len);
  const segBad = {};
  const markBad = (key) => { segBad[key] = true; };
  let fixable = true;
  let fixed = s.split('');
  const changes = [];

  // 1. Character classes, segment by segment.
  for (const seg of CIN_SEGMENTS) {
    const wrong = [];
    for (let i = seg.start; i < seg.start + seg.len; i++) {
      const c = s[i];
      const ok = seg.cls === 'digit' ? isDigit(c) : isLetter(c);
      if (!ok) {
        wrong.push(i);
        const swap = seg.cls === 'digit' ? TO_DIGIT[c] : (i === 0 && c === '1' ? 'L' : TO_LETTER[c]);
        if (swap) { fixed[i] = swap; changes.push(`${describeChar(c)} at character ${i + 1} with ${swap}`); } else fixable = false;
      }
    }
    if (wrong.length) {
      markBad(seg.key);
      const want = seg.cls === 'digit' ? 'only digits' : 'only letters';
      const what = wrong.map((i) => `character ${i + 1} is ${describeChar(s[i])}`).join(', ');
      const subject = seg.key === 'listing' ? 'The first character' : `The ${seg.name} (${range(seg)})`;
      const verb = seg.key === 'listing' ? 'must be a letter' : `must be ${want}`;
      r.errors.push({ msg: `${subject} ${verb}, but ${what}.`, at: wrong });
    }
  }

  // 2. Meaning of each segment (only where the characters are of the right kind).
  const listing = at(CIN_SEGMENTS[0]);
  const state = at(CIN_SEGMENTS[2]);
  const yearStr = at(CIN_SEGMENTS[3]);
  const type = at(CIN_SEGMENTS[4]);
  const reg = at(CIN_SEGMENTS[5]);
  const industry = at(CIN_SEGMENTS[1]);
  const year = Number(yearStr);
  const thisYear = new Date().getFullYear();

  if (!segBad.listing && listing !== 'L' && listing !== 'U') {
    markBad('listing');
    fixable = false;
    let msg = `The first character must be L (listed) or U (unlisted), not ${listing}.`;
    if (listing === 'F') msg += ' Numbers that start with F are usually foreign company registrations (FCRN), not CINs.';
    r.errors.push({ msg, at: [0] });
  }

  if (!segBad.state && !STATES[state]) {
    markBad('state');
    const alias = STATE_ALIASES[state];
    if (alias) {
      r.errors.push({ msg: `${state} (characters 7–8) isn’t used in CINs. ${alias.why}`, at: [6, 7] });
      fixed[6] = alias.to[0]; fixed[7] = alias.to[1];
      changes.push(`${state} with ${alias.to}`);
    } else {
      fixable = false;
      r.errors.push({ msg: `${state} (characters 7–8) isn’t an Indian state code used in CINs.`, at: [6, 7] });
    }
  }

  if (!segBad.year) {
    if (year > thisYear) {
      markBad('year'); fixable = false;
      r.errors.push({ msg: `The year of incorporation (characters 9–12) is ${yearStr}, which is in the future.`, at: [8, 9, 10, 11] });
    } else if (year < FIRST_YEAR) {
      markBad('year'); fixable = false;
      r.errors.push({ msg: `The year of incorporation (characters 9–12) is ${yearStr}. Companies have only been registered in India since ${FIRST_YEAR}.`, at: [8, 9, 10, 11] });
    }
  }

  if (!segBad.type && !TYPES[type]) {
    markBad('type');
    const alias = TYPE_ALIASES[type];
    if (alias) {
      r.errors.push({ msg: `${type} (characters 13–15) isn’t a company type code. ${TYPES[alias].label}s use ${alias}.`, at: [12, 13, 14] });
      fixed.splice(12, 3, ...alias);
      changes.push(`${type} with ${alias}`);
    } else {
      fixable = false;
      r.errors.push({ msg: `${type} (characters 13–15) isn’t a company type code. Common ones are PTC (private), PLC (public) and OPC (one person).`, at: [12, 13, 14] });
    }
  }

  const typeInfo = TYPES[type];

  // 3. Combinations that can't really exist. Format is fine, so these are warnings.
  if (!r.errors.length) {
    if (listing === 'L' && typeInfo.private) {
      r.warnings.push(`Marked as listed (L), but a ${typeInfo.label.toLowerCase()} can’t list its shares on a stock exchange. The first character or the type is probably wrong.`);
      segBad.listing = 'warn'; segBad.type = 'warn';
    }
    if (type === 'OPC' && year < OPC_FROM) {
      r.warnings.push(`One person companies have only been allowed since April ${OPC_FROM}, so an OPC from ${year} is unusual. Check the year and the type.`);
      segBad.year = 'warn'; segBad.type = 'warn';
    }
    if (/^0+$/.test(reg)) {
      r.warnings.push('The registration number is all zeros, which the ROC never issues.');
      segBad.reg = 'warn';
    }
    if (STATE_NOTES[state]) r.notes.push(STATE_NOTES[state]);
  }

  // 4. A suggestion, when swapping look-alike characters gives a clean CIN.
  const fixedStr = fixed.join('');
  if (r.errors.length && fixable && fixedStr !== s) {
    const check = checkCIN(fixedStr, []);
    if (check.status !== 'invalid') {
      const changed = [];
      for (let i = 0; i < 21; i++) if (fixedStr[i] !== s[i]) changed.push(i);
      r.suggestion = { id: fixedStr, at: changed, why: `Replaces ${joinList(changes)}.` };
    }
  }

  // 5. Fields and anatomy.
  const valid = !r.errors.length;
  r.status = valid ? (r.warnings.length ? 'warning' : 'valid') : 'invalid';

  const meanings = {
    listing: listing === 'L' ? 'Listed' : listing === 'U' ? 'Unlisted' : 'Should be L or U',
    industry: segBad.industry ? 'Should be 5 digits' : `NIC ${industry}`,
    state: STATES[state] || (segBad.state ? 'Unknown code' : ''),
    year: segBad.year === true ? (isNaN(year) ? 'Should be 4 digits' : 'Not possible') : yearStr,
    type: typeInfo ? shortType(type) : 'Unknown code',
    reg: segBad.reg === true ? 'Should be 6 digits' : `No. ${reg}`,
  };
  r.segments = CIN_SEGMENTS.map((seg) => ({
    key: seg.key, label: seg.label, text: at(seg), meaning: meanings[seg.key], bad: segBad[seg.key] || false,
  }));

  if (valid) {
    r.fields = {
      entity: 'Company',
      listed: listing === 'L' ? 'Listed' : 'Unlisted',
      state: STATES[state],
      stateCode: state,
      year,
      type: typeInfo.label,
      typeCode: type,
      industry,
      reg,
    };
  }
  return r;
}

const SHORT_TYPES = {
  PLC: 'Public', PTC: 'Private', OPC: 'One person', GOI: 'Central Govt.', SGC: 'State Govt.', NPL: 'Section 8',
  FLC: 'Foreign sub. (public)', FTC: 'Foreign sub. (private)', GAP: 'Guarantee (public)', GAT: 'Guarantee (private)',
  ULL: 'Unlimited (public)', ULT: 'Unlimited (private)',
};
const shortType = (code) => SHORT_TYPES[code] || code;

// Wrong length. Split into runs of letters and digits and compare against the
// expected shape L-DDDDD-LL-DDDD-LLL-DDDDDD to say which part is short or long.
function checkCINLength(r, s) {
  const n = s.length;
  const diff = n - 21;
  const lead = `A CIN has 21 characters; this has ${n}.`;
  const runs = s.match(/[A-Z]+|\d+/g) || [];
  const shapeOk = runs.length === 6 && runs.every((run, i) => (i % 2 === 0 ? isLetter(run[0]) : isDigit(run[0])));

  if (shapeOk) {
    const parts = [];
    let pos = 0;
    runs.forEach((run, i) => {
      const seg = CIN_SEGMENTS[i];
      if (run.length !== seg.len) {
        const kind = seg.cls === 'digit' ? 'digit' : 'letter';
        const name = seg.key === 'listing' ? 'listing status' : seg.name;
        parts.push({ msg: `The ${name} has ${plural(run.length, kind)}; it needs ${seg.len}.`, at: [...Array(run.length).keys()].map((k) => pos + k) });
      }
      pos += run.length;
    });
    r.errors.push({ msg: lead, at: [] }, ...parts);

    // If only the registration number is short, the likely cause is a dropped leading zero.
    if (parts.length === 1 && runs[5].length < 6) {
      const padded = runs.slice(0, 5).join('') + runs[5].padStart(6, '0');
      if (checkCIN(padded, []).status !== 'invalid') {
        r.suggestion = { id: padded, at: [], why: 'Adds a leading zero to the registration number, in case one was dropped.' };
      }
    }
  } else {
    r.errors.push({ msg: `${lead} ${diff > 0 ? `That’s ${plural(diff, 'character')} too many.` : `That’s ${plural(-diff, 'character')} short.`}`, at: [] });
  }

  // One extra character (a double-typed key): try removing each one.
  if (diff === 1 && !r.suggestion) {
    const found = new Map();
    for (let i = 0; i < n; i++) {
      const t = s.slice(0, i) + s.slice(i + 1);
      if (!found.has(t) && checkCIN(t, []).status === 'valid') found.set(t, i);
    }
    if (found.size === 1) {
      const [[id, i]] = [...found];
      r.suggestion = { id, at: [], why: `Removes the extra ${s[i]} at character ${i + 1}.` };
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// LLPIN

function checkLLPIN(s, notes) {
  const r = base(s, notes);
  r.kind = 'llpin';
  let left, right;

  const hyphens = (s.match(/-/g) || []).length;
  if (hyphens === 0) {
    const m = s.match(/^([A-Z]+)(\d+)$/) || [null, s.slice(0, 3), s.slice(3)];
    left = m[1]; right = m[2];
  } else {
    [left, right] = s.split('-');
  }
  const canon = `${left}-${right}`;
  r.id = canon;

  const fixedL = left.split('');
  const changes = [];
  const fixedR = right.split('');
  let fixable = true;
  let leftBad = false, rightBad = false;

  if (left.length !== 3) {
    leftBad = true; fixable = false;
    r.errors.push({ msg: `An LLPIN starts with 3 letters; this has ${plural(left.length, 'character')} before ${hyphens ? 'the hyphen' : 'the digits'}.`, at: [...Array(left.length).keys()] });
  } else {
    const wrong = [];
    left.split('').forEach((c, i) => {
      if (!isLetter(c)) { wrong.push(i); if (TO_LETTER[c]) { fixedL[i] = TO_LETTER[c]; changes.push(`${describeChar(c)} at character ${i + 1} with ${TO_LETTER[c]}`); } else fixable = false; }
    });
    if (wrong.length) {
      leftBad = true;
      r.errors.push({ msg: `The first 3 characters must be letters, but ${wrong.map((i) => `character ${i + 1} is ${describeChar(left[i])}`).join(', ')}.`, at: wrong });
    }
  }

  const off = left.length + 1;
  if (right.length !== 4) {
    rightBad = true; fixable = false;
    r.errors.push({ msg: `An LLPIN ends with 4 digits; this has ${plural(right.length, 'character')} after ${hyphens ? 'the hyphen' : 'the letters'}.`, at: [...Array(right.length).keys()].map((k) => off + k) });
  } else {
    const wrong = [];
    right.split('').forEach((c, i) => {
      if (!isDigit(c)) { wrong.push(off + i); if (TO_DIGIT[c]) { fixedR[i] = TO_DIGIT[c]; changes.push(`${describeChar(c)} at character ${off + i + 1} with ${TO_DIGIT[c]}`); } else fixable = false; }
    });
    if (wrong.length) {
      rightBad = true;
      r.errors.push({ msg: `The last 4 characters must be digits, but ${wrong.map((i) => `character ${i + 1} is ${describeChar(canon[i])}`).join(', ')}.`, at: wrong });
    }
  }

  if (!r.errors.length) {
    if (hyphens === 0) r.notes.push('Written without the hyphen. The official form is ' + canon + '.');
    if (right === '0000') { r.warnings.push('The serial number is 0000, which is never issued.'); rightBad = 'warn'; }
  } else if (fixable) {
    const fixed = `${fixedL.join('')}-${fixedR.join('')}`;
    if (fixed !== canon) {
      const at = [];
      for (let i = 0; i < fixed.length; i++) if (fixed[i] !== canon[i]) at.push(i);
      r.suggestion = { id: fixed, at, why: `Replaces ${joinList(changes)}.` };
    }
  }

  r.status = r.errors.length ? 'invalid' : r.warnings.length ? 'warning' : 'valid';
  r.segments = [
    { key: 'series', label: 'Series', text: left, meaning: leftBad === true ? 'Should be 3 letters' : 'Letters', bad: leftBad },
    { key: 'dash', label: '', text: '-', meaning: '', bad: false },
    { key: 'serial', label: 'Serial', text: right, meaning: rightBad === true ? 'Should be 4 digits' : 'Number', bad: rightBad },
  ];
  if (!r.errors.length) {
    r.fields = {
      entity: 'LLP',
      listed: null,
      state: null,
      stateCode: null,
      year: null,
      type: 'Limited liability partnership',
      typeCode: 'LLP',
      industry: null,
      reg: null,
    };
  }
  return r;
}

// ---------------------------------------------------------------------------
// A whole pasted list.

export const MAX_ITEMS = 10000;

export function splitInput(text) {
  const lines = String(text).split(/\r\n|\r|\n/);
  const items = [];
  let blank = 0;
  const visible = (p) => p.replace(ZERO_WIDTH, '').replace(/[\s"'`“”‘’]/g, '').length > 0;

  lines.forEach((line, i) => {
    if (!visible(line)) { blank++; return; }
    const pieces = line.split(/[,;\t|]+/).map((p) => p.trim()).filter(visible);
    if (pieces.length > 1) {
      const withDigits = pieces.filter((p) => /\d/.test(p));
      if (withDigits.length) {
        const dropped = withDigits.length < pieces.length;
        withDigits.forEach((p) => items.push({ line: i + 1, raw: p, dropped, split: withDigits.length > 1 }));
        return;
      }
    }
    items.push({ line: i + 1, raw: pieces.length === 1 ? pieces[0] : line.trim(), dropped: false, split: false });
  });
  return { items, blank, lines: lines.length };
}

export function analyzeAll(text) {
  const { items, blank, lines } = splitInput(text);
  const truncated = items.length > MAX_ITEMS ? items.length : 0;
  const list = truncated ? items.slice(0, MAX_ITEMS) : items;
  const seen = new Map();
  const results = list.map((item, idx) => {
    const r = analyze(item.raw);
    r.line = item.line;
    r.index = idx;
    if (item.dropped) r.notes.unshift('Ignored the other text on this line.');
    if (item.split) r.notes.unshift('This line had more than one number; each is checked separately.');
    const key = r.id;
    if (key && r.kind !== 'unknown') {
      if (seen.has(key)) r.duplicateOf = seen.get(key);
      else seen.set(key, item.line);
    }
    return r;
  });

  const stats = { total: results.length, valid: 0, warning: 0, invalid: 0, duplicates: 0, companies: 0, llps: 0, blank, lines, truncated };
  for (const r of results) {
    stats[r.status]++;
    if (r.duplicateOf) stats.duplicates++;
    if (r.fields?.entity === 'Company') stats.companies++;
    if (r.fields?.entity === 'LLP') stats.llps++;
  }
  return { results, stats };
}
