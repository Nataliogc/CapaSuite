const test = require('node:test');
const assert = require('node:assert/strict');
const { apply, day } = require('../js/daily-pickup.js');
const SegmentAnalysis = require('../js/segment-analysis.js');

test('daily reference survives repeated uploads and serialization, then resets in Madrid', () => {
    let target = { otb: { rooms: [100] }, daily_otb: { '2026-10-08': { rooms: 100 } } };
    const fields = ['otb', 'daily_otb', 'segment_otb'];
    apply(target, fields, new Date('2026-10-06T08:00:00Z'), '06-10-2026');
    target.otb.rooms[0] = 110;
    apply(target, fields, new Date('2026-10-06T12:00:00Z'));
    target = JSON.parse(JSON.stringify(target));
    target.otb.rooms[0] = 115;
    apply(target, fields, new Date('2026-10-06T20:00:00Z'));
    assert.equal(target.otb.rooms[0] - target.otb_prev.rooms[0], 15);
    assert.equal(target.otb_prev.daily_otb['2026-10-08'].rooms, 100);
    target.otb.rooms[0] = 120;
    apply(target, fields, new Date('2026-10-06T22:00:00Z'), '07-10-2026');
    assert.equal(target.otb_prev.rooms[0], 120);
    assert.equal(day(new Date('2026-10-06T22:00:00Z')), '2026-10-07');
});

test('forecast segments retain first upload and keep hotels isolated', () => {
    const db = {};
    const report = rooms => ({ source: 'forecast.xlsx', startYear: '2026', segmentData: { GRUPOS: { name: 'GRUPOS', days: { '2026-10-08': { rooms } } } } });
    SegmentAnalysis.mergeForecast(db, 'Guadiana', report(100));
    SegmentAnalysis.mergeForecast(db, 'Cumbria', report(50));
    SegmentAnalysis.mergeForecast(db, 'Guadiana', report(110));
    SegmentAnalysis.mergeForecast(db, 'Guadiana', report(115));
    assert.equal(db.Guadiana.segment_prev.GRUPOS.days['2026-10-08'].rooms, 100);
    assert.equal(db.Cumbria.segment.GRUPOS.days['2026-10-08'].rooms, 50);
});
