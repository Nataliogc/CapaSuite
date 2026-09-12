const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const S = require('../js/segment-analysis.js');
test('segment scope keeps coverage, isolates metrics and preserves the hotel denominator', () => {
    const hotel = { segmentCoverage: { 0: [1, 2] }, segment: { GRUPOS: { name: 'GRUPOS', revenue: [100], accommodation: [80], rooms: [2] }, OTROS: { name: 'OTROS', revenue: [900], accommodation: [720], rooms: [9] } } };
    const scoped = S.scope(hotel, 'GRUPOS');
    assert.equal(S.aggregate(scoped, [0]).revenue, 100);
    assert.equal(S.aggregate(scoped, [0]).adr, 40);
    assert.equal(S.aggregate(scoped, [0]).days, 2);
    assert.equal(S.aggregate(hotel, [0]).revenue, 1000);
    assert.equal(S.aggregate(S.scope(hotel, 'MISSING'), [0]).rooms, 0);
    assert.equal(S.scope(hotel, ''), hotel);
});
const source = () => [
    ['Seg.', '', '01/01/26', '02/01/26', '01/01/25', '02/01/25', '01-02 Ene.26', '01-02 Ene.26%'],
    ['OTROS', 'Hab', 1, 0, 0, 0, 1, 10],
    ['', 'HABITACION DUI', 50, 0, 0, 0, 50, 10],
    ['CORPORATI', 'Hab', 1, 2, 1, 1, 3, 90],
    ['', 'HABITACION DOBLE', 100, 200, 50, 50, 300, 90],
    ['', 'DESAYUNO', 10, 20, 5, 5, 30, 90],
    ['', 'Pro', 150, 220, 55, 55, 370, 90],
    [],
    ['TOTAL GENERAL', 'Hab', 2, 2, 1, 1, 4, 100],
    ['', 'HABITACION DUI', 50, 0, 0, 0, 50, 10],
    ['', 'HABITACION DOBLE', 100, 200, 50, 50, 300, 90],
    ['', 'DESAYUNO', 10, 20, 5, 5, 30, 100],
    ['', 'Pro', 150, 220, 55, 55, 370, 100]
];
test('separates years, skips totals/percentages and reconciles controls', () => {
    const r = S.parse(source(), 'from 01-01-26 to 31-01-26.xlsx');
    assert.deepEqual(Object.keys(r.years).sort(), ['2025', '2026']);
    assert.equal(r.years[2026].segment['CORPORATIVO LINEAL'].revenue[0], 330);
    assert.equal(r.years[2026].segment.OTROS.rooms[0], 1);
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
test('monthly reports use actual leap-year calendar days', () => {
    const rows = [['Seg.', '', 'Feb.24'], ['GRUPOS', 'Hab', 2], ['', 'SUITE', 100], ['', 'DESAYUNO', 20]];
    const db = {}; S.merge(db, 'Hotel', S.parse(rows));
    assert.equal(S.aggregate(db.Hotel[2024], [1]).days, 29);
    assert.equal(db.Hotel[2024].segment.GRUPOS.revenue[1], 120);
});
test('missing left-hand segment is blocking and never inherits a previous segment or becomes a total', () => {
    const rows = source(); rows[1][0] = ''; rows[3][0] = ''; rows.splice(3, 0, []);
    assert.throws(() => S.parse(rows), error => error.code === 'SEGMENT_REVIEW' && error.issues.map(b => b.cell).join(',') === 'A2,A5');
    const corrected = S.parse(rows, 'example.xlsx', undefined, { A2: 'OTROS', A5: 'GRUPOS' });
    assert.equal(corrected.years[2026].segment.GRUPOS.rooms[0], 3);
    assert.equal(rows[1][0], '');
    assert.deepEqual(corrected.corrections[0], { cell: 'A2', original: '', segment: 'OTROS' });
});
test('Agencias, Particula and Particulares must be corrected even with zero activity', () => {
    for (const invalid of ['Agencias', 'Particula', 'Particulares', 'SIN SEGMENTO', 'UNKNOWN']) {
        const rows = source(); rows[1][0] = invalid;
        assert.throws(() => S.parse(rows), error => error.code === 'SEGMENT_REVIEW' && error.issues[0].cell === 'A2');
        assert.throws(() => S.parse(rows, '', undefined, { A2: invalid }), /Segmento no válido/);
    }
});
test('correction merges complete blocks across all years and retains totals and audit trail', () => {
    const rows = source(); rows[1][0] = 'Agencias';
    const report = S.parse(rows, 'example.xlsx', undefined, { A2: 'CORPORATIVO LINEAL' });
    assert.equal(report.years[2026].segment['CORPORATIVO LINEAL'].rooms[0], 4);
    assert.equal(report.years[2026].segment['CORPORATIVO LINEAL'].revenue[0], 380);
    assert.equal(report.years[2025].segment['CORPORATIVO LINEAL'].revenue[0], 110);
    const db = {}; S.merge(db, 'Hotel', report);
    assert.equal(db.Hotel[2026].segmentCorrections[0][0].original, 'Agencias');
});
test('Excel leading empty rows retain the true A4 address', () => {
    const context = {}; vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/xlsx.full.min.js', 'utf8'), context);
    const sheet = context.XLSX.utils.aoa_to_sheet([[], [], ['Seg.', '', '01/01/26'], ['', 'Hab', 1], ['', 'SUITE', 50]]);
    sheet['!ref'] = 'A3:C5';
    const rows = context.XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: true, defval: null });
    assert.throws(() => S.parse(rows), error => error.code === 'SEGMENT_REVIEW' && error.issues[0].cell === 'A4');
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
