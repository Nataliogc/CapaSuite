const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const S = require('../js/segment-analysis.js');
const source = () => [
    ['Seg.', '', '01/01/26', '02/01/26', '01/01/25', '02/01/25', '01-02 Ene.26', '01-02 Ene.26%'],
    ['', 'Hab', 1, 0, 0, 0, 1, 10],
    ['', 'HABITACION DUI', 50, 0, 0, 0, 50, 10],
    ['CORPORATI', 'Hab', 1, 2, 1, 1, 3, 90],
    ['', 'HABITACION DOBLE', 100, 200, 50, 50, 300, 90],
    ['', 'DESAYUNO', 10, 20, 5, 5, 30, 90],
    ['', 'Pro', 150, 220, 55, 55, 370, 90],
    [],
    ['', 'Hab', 2, 2, 1, 1, 4, 100],
    ['', 'HABITACION DUI', 50, 0, 0, 0, 50, 10],
    ['', 'HABITACION DOBLE', 100, 200, 50, 50, 300, 90],
    ['', 'DESAYUNO', 10, 20, 5, 5, 30, 100],
    ['', 'Pro', 150, 220, 55, 55, 370, 100]
];
test('separates years, skips totals/percentages, preserves unassigned rooms and reconciles controls', () => {
    const r = S.parse(source(), 'from 01-01-26 to 31-01-26.xlsx');
    assert.deepEqual(Object.keys(r.years).sort(), ['2025', '2026']);
    assert.equal(r.years[2026].segment['CORPORATIVO LINEAL'].revenue[0], 330);
    assert.equal(r.years[2026].segment['SIN SEGMENTO'].rooms[0], 1);
    assert.equal(Object.keys(r.years[2026].segment).length, 2);
});
test('imports replace only covered months, keep services, and remain idempotent', () => {
    const db = { Hotel: { 2026: { service: { preserved: 42 }, segment: { EXISTING: { name: 'EXISTING', rooms: [999, 3], revenue: [999, 80] } } } } };
    const report = S.parse(source());
    S.merge(db, 'Hotel', report);
    assert.equal(db.Hotel[2026].segment.EXISTING.revenue[1], 80);
    assert.equal(db.Hotel[2026].segment.EXISTING.revenue[0], 0);
    assert.equal(db.Hotel[2026].service.preserved, 42);
    const before = JSON.stringify(db.Hotel[2026].segment);
    S.merge(db, 'Hotel', report);
    assert.equal(JSON.stringify(db.Hotel[2026].segment), before);
});
test('ADR is weighted accommodation revenue, not breakfast or sum of monthly rates', () => {
    const db = {}; S.merge(db, 'Hotel', S.parse(source()));
    const a = S.aggregate(db.Hotel[2026], [0]);
    assert.equal(a.adr, 350 / 4);
    assert.equal(a.revenue, 380);
    assert.equal(a.days, 2);
    assert.ok(S.comparable(db.Hotel[2026], db.Hotel[2025], [0]));
    db.Hotel[2025].segmentCoverage[0] = [1];
    assert.equal(S.comparable(db.Hotel[2026], db.Hotel[2025], [0]), false);
    assert.equal(S.comparable(db.Hotel[2026], db.Hotel[2025], [1]), false);
});
test('legacy data does not invent coverage or verified ADR; zero rooms leaves ADR unavailable', () => {
    assert.equal(S.aggregate({ segment: { A: { name: 'A', rooms: [1], revenue: [50] } } }, [0]).adr, null);
    assert.equal(S.aggregate({ segmentCoverage: { 0: [1] }, segment: {} }, [0]).adr, null);
    assert.deepEqual(S.availableMonths({ segment: { A: { name: 'A', rooms: [0, 0], revenue: [0, -10] } } }), [1]);
});
test('monthly reports use actual leap-year calendar days and retain unfamiliar segments', () => {
    const rows = [['Seg.', '', 'Feb.24'], ['NEW CHANNEL', 'Hab', 2], ['', 'SUITE', 100], ['', 'DESAYUNO', 20]];
    const db = {}; S.merge(db, 'Hotel', S.parse(rows));
    assert.equal(S.aggregate(db.Hotel[2024], [1]).days, 29);
    assert.equal(db.Hotel[2024].segment['NEW CHANNEL'].revenue[1], 120);
});
test('invalid dates, duplicate dates, nonnumeric amounts and failed reconciliation fail before merge', () => {
    const invalid = source(); invalid[0][2] = '31/02/26';
    assert.throws(() => S.parse(invalid), /Fecha no válida/);
    const duplicate = source(); duplicate[0][3] = duplicate[0][2];
    assert.throws(() => S.parse(duplicate), /duplicada/);
    const bad = source(); bad[3][2] = 'error'; assert.throws(() => S.parse(bad), /Importe no válido/);
    const mismatch = source(); mismatch[8][2] = 100;
    assert.throws(() => S.parse(mismatch), /no cuadra/);
    assert.throws(() => S.parse([['No report']]), /No se reconoce/);
    assert.equal(S.number('(1.234,50 €)'), -1234.5);
});
test('reading storage retains source segment names and does not write a purge', () => {
    const input = { Hotel: { 2026: { segment: { AGENCIAS: { name: 'AGENCIAS', rooms: [20] } } } } };
    const saved = JSON.stringify(input);
    const context = { window: {}, console, localStorage: { setItem() {}, removeItem() {}, getItem(key) { return key === 'v3_hotel_manager_db_v2' ? saved : null; } } };
    context.window = context;
    vm.createContext(context); vm.runInContext(fs.readFileSync('js/storage.js', 'utf8'), context);
    assert.equal(context.window.CapaStorage.getItem('hotel_manager_db_v2'), saved);
});
test('central upload uses the same parser and preserves production data', () => {
    const html = fs.readFileSync('CargarDatos.html', 'utf8');
    const start = html.indexOf('        function processDataForDB(');
    const end = html.indexOf('\n        function ', start + 1);
    const context = { SegmentAnalysis: S, db: { Hotel: { 2026: { service: { preserved: 42 }, lastProdDate: 'unchanged' } } } };
    vm.createContext(context);
    vm.runInContext(html.slice(start, end), context);
    context.processDataForDB(source(), 'Seg 01-01-26 al 02-01-26.xlsx', 'Hotel', 'Seg', '');
    assert.equal(context.db.Hotel[2026].service.preserved, 42);
    assert.equal(context.db.Hotel[2026].lastProdDate, 'unchanged');
    assert.equal(context.db.Hotel[2025].segment['CORPORATIVO LINEAL'].rooms[0], 2);
    assert.equal(context.db.Hotel[2025].updates.seg, '01-01-2025 al 02-01-2025');
});
