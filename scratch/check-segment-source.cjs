const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const analysis = require('../js/segment-analysis.js');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/xlsx.full.min.js', 'utf8'), sandbox);
const path = process.argv[2];
const book = sandbox.XLSX.read(fs.readFileSync(path), { type: 'buffer' });
const rows = sandbox.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
const report = analysis.parse(rows, path);
const db = {};
analysis.merge(db, 'Guadiana', report);
const expected = { 2026: { rooms: 1100, total: 88815.59 }, 2025: { rooms: 787, total: 59471.08 }, 2024: { rooms: 690, total: 51833.06 } };
for (const [year, values] of Object.entries(expected)) {
    const total = analysis.aggregate(db.Guadiana[year], [0]);
    assert.equal(total.rooms, values.rooms);
    assert.equal(total.days, 31);
    const pro = Object.values(db.Guadiana[year].segment).reduce((n, s) => n + s.totalRevenue[0], 0);
    assert.ok(Math.abs(pro - values.total) < .01);
    console.log(year, JSON.stringify({ ...total, totalRevenue: pro }));
}
const before = JSON.stringify(db.Guadiana['2026'].segment);
analysis.merge(db, 'Guadiana', report);
assert.equal(JSON.stringify(db.Guadiana['2026'].segment), before);
assert.ok(analysis.comparable(db.Guadiana['2026'], db.Guadiana['2025'], [0]));
fs.writeFileSync('scratch/segment-test-data.json', JSON.stringify(db));
console.log('Source reconciliation and repeat import passed.');
