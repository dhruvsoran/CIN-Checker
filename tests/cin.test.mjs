// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, analyzeAll } from '../src/cin.js';

const errText = (r) => r.errors.map((e) => e.msg).join(' | ');

test('decodes the example CIN from the brief', () => {
  const r = analyze('L17110MH1973PLC019786');
  assert.equal(r.status, 'valid');
  assert.deepEqual(
    { ...r.fields },
    { entity: 'Company', listed: 'Listed', state: 'Maharashtra', stateCode: 'MH', year: 1973, type: 'Public limited company', typeCode: 'PLC', industry: '17110', reg: '019786' },
  );
});

test('real CINs of different shapes', () => {
  assert.equal(analyze('L85110KA1981PLC013115').fields.state, 'Karnataka');
  assert.equal(analyze('L74899DL1993GOI054155').fields.type, 'Government company (Central Government)');
  assert.equal(analyze('L65993PN2007PLC130076').fields.state, 'Maharashtra'); // Bajaj Auto, ROC Pune code
  assert.equal(analyze('L29120TZ1960PLC000351').fields.state, 'Tamil Nadu'); // ELGI Equipments, ROC Coimbatore code
  assert.equal(analyze('U72900KA2019OPC123456').fields.type, 'One person company');
  assert.equal(analyze('U74999TG2016PTC123456').fields.state, 'Telangana');
});

test('LLPIN with and without hyphen', () => {
  const r = analyze('AAA-1234');
  assert.equal(r.status, 'valid');
  assert.equal(r.fields.entity, 'LLP');
  const n = analyze('aab1234');
  assert.equal(n.status, 'valid');
  assert.equal(n.id, 'AAB-1234');
  assert.match(n.notes.join(' '), /without the hyphen/);
});

test('LLPIN errors say exactly what is wrong', () => {
  assert.match(errText(analyze('AA-1234')), /3 letters; this has 2 characters/);
  assert.match(errText(analyze('AAA-12345')), /4 digits; this has 5 characters/);
  const o = analyze('AAA-12O4');
  assert.match(errText(o), /character 7 is the letter O/);
  assert.equal(o.suggestion.id, 'AAA-1204');
});

test('letter O in place of zero gets pinpointed and fixed', () => {
  const r = analyze('L17110MH1973PLCO19786');
  assert.equal(r.status, 'invalid');
  assert.match(errText(r), /registration number \(characters 16–21\) must be only digits, but character 16 is the letter O/);
  assert.equal(r.suggestion.id, 'L17110MH1973PLC019786');
});

test('wrong length names the short segment', () => {
  const r = analyze('L17110MH1973PLC19786');
  assert.match(errText(r), /21 characters; this has 20/);
  assert.match(errText(r), /registration number has 5 digits; it needs 6/);
  assert.equal(r.suggestion.id, 'L17110MH1973PLC019786');
});

test('one doubled character is found', () => {
  const r = analyze('L17110MHH1973PLC019786');
  assert.equal(r.status, 'invalid');
  assert.equal(r.suggestion.id, 'L17110MH1973PLC019786');
  // Ambiguous: removing either the 1 or the 0 would work, so no guess is offered.
  const a = analyze('L171100MH1973PLC019786');
  assert.match(errText(a), /industry code has 6 digits; it needs 5/);
  assert.equal(a.suggestion, null);
});

test('bad listing, state, year and type', () => {
  assert.match(errText(analyze('X17110MH1973PLC019786')), /must be L \(listed\) or U \(unlisted\), not X/);
  assert.match(errText(analyze('L17110XX1973PLC019786')), /XX .* isn’t an Indian state code/);
  const uk = analyze('U72200UK2015PTC123456');
  assert.match(errText(uk), /Uttarakhand is UR/);
  assert.equal(uk.suggestion.id, 'U72200UR2015PTC123456');
  assert.match(errText(analyze('U72200DL2999PTC123456')), /in the future/);
  assert.match(errText(analyze('U72200DL1700PTC123456')), /since 1850/);
  const pvt = analyze('U72200DL2015PVT123456');
  assert.match(errText(pvt), /PVT .* isn’t a company type code/);
  assert.equal(pvt.suggestion.id, 'U72200DL2015PTC123456');
});

test('impossible combinations are warnings, not errors', () => {
  const r = analyze('L72900KA2016PTC123456');
  assert.equal(r.status, 'warning');
  assert.match(r.warnings[0], /can’t list its shares/);
  assert.equal(analyze('U72900KA2010OPC123456').status, 'warning');
});

test('other identifiers are recognised', () => {
  assert.equal(analyze('27AAACR5055K1Z7').otherKind, 'GSTIN');
  assert.equal(analyze('AAACR5055K').otherKind, 'PAN');
  assert.equal(analyze('01234567').otherKind, 'DIN');
  assert.equal(analyze('F01234').otherKind, 'FCRN');
});

test('messy pasting: spaces, case, quotes, labels, unicode', () => {
  assert.equal(analyze(' l17110mh1973plc019786 ').status, 'valid');
  assert.equal(analyze('L17110 MH1973 PLC019786').status, 'valid');
  assert.equal(analyze('"L17110MH1973PLC019786",').status, 'valid');
  assert.equal(analyze('CIN: L17110MH1973PLC019786').status, 'valid');
  assert.equal(analyze('L17110MH1973PLC019786​').status, 'valid');
  assert.equal(analyze('ＬＬ17110MH1973PLC019786'.slice(1)).status, 'valid'); // full-width L
  assert.equal(analyze('AAA–1234').status, 'valid'); // en dash
  assert.equal(analyze('Reliance Industries L17110MH1973PLC019786').id, 'L17110MH1973PLC019786');
  assert.equal(analyze('L-17110-MH-1973-PLC-019786').status, 'valid');
});

test('junk gets a clear message', () => {
  assert.match(errText(analyze('hello')), /no digits/);
  assert.match(errText(analyze('AB12')), /3 letters; this has 2 characters before the digits/);
  assert.match(errText(analyze('12')), /Too short/);
  assert.match(errText(analyze('L17110MH1973PLC019786L17110MH1973PLC019786')), /Too long/);
  assert.match(errText(analyze('L17110MH1973PLC0197@6')), /character 20 is “@”/);
});

test('list handling: blanks, duplicates, commas, line numbers', () => {
  const { results, stats } = analyzeAll('L17110MH1973PLC019786\n\n  \nAAA-1234, L85110KA1981PLC013115\nl17110mh1973plc019786\nReliance,L17110MH1973PLC019786');
  assert.equal(stats.blank, 2);
  assert.equal(stats.total, 5);
  assert.equal(results[1].line, 4);
  assert.equal(results[2].line, 4);
  assert.equal(results[3].duplicateOf, 1);
  assert.equal(results[4].duplicateOf, 1);
  assert.equal(stats.duplicates, 2);
});

test('500 lines is fast', () => {
  const lines = Array.from({ length: 500 }, (_, i) => `U72900KA20${String(10 + (i % 15))}PTC${String(i).padStart(6, '0')}`);
  const t = performance.now();
  const { stats } = analyzeAll(lines.join('\n'));
  assert.equal(stats.total, 500);
  assert.ok(performance.now() - t < 200);
});
