const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/revenue-review.js');
const row = (iso, roomsDelta, accommodationDelta) => ({ iso, roomsDelta, accommodationDelta, previousRooms: 8, rooms: 8 + roomsDelta });
const comparison = { available: true, rows: [row('2026-10-03', 0, -100), row('2026-09-30', -5, -500), row('2026-10-01', -2, null), row('2026-10-02', 1, 100), row('2026-10-04', 0, null)] };
test('review prioritizes future observed declines by proximity including income-only declines', () => {
    assert.deepEqual(R.attention(comparison, 'forecast', '2026-10-01').map(r => r.iso), ['2026-10-01', '2026-10-03']);
});
test('past corrections and unavailable comparisons do not generate demand alerts', () => {
    assert.deepEqual(R.attention(comparison, 'actual', '2026-10-01'), []);
    assert.deepEqual(R.attention({ available: false }, 'forecast', '2026-10-01'), []);
});
test('CSV retains capture provenance and distinguishes unknown accommodation from explicit zero', () => {
    const csv = R.csv({ available: true, rows: [row('2026-10-01', -2, null), row('2026-10-02', 0, 0)] }, { capturedAt: '2026-09-30T10:00:00Z' }, { hotel: 'Cumbria', mode: 'forecast', capturedAt: '2026-10-01T10:00:00Z' });
    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /2026-09-30T10:00:00Z/);
    assert.match(csv, /"2026-10-01";"8";"6";"-2";""/);
    assert.match(csv, /"2026-10-02";"8";"8";"0";"0"/);
});
test('CSV changes filter preserves income-only changes and uses Excel decimal formatting', () => {
    const csv = R.csv({ available: true, rows: [row('2026-10-01', 0, -12.5), row('2026-10-02', 0, null)] }, { capturedAt: 'before' }, { hotel: 'Guadiana', mode: 'forecast', capturedAt: 'after' }, true);
    assert.match(csv, /"-12,5"/);
    assert.equal(csv.includes('2026-10-02'), false);
    assert.throws(() => R.csv({ available: false }), /No hay/);
});
