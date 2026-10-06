const test = require('node:test');
const assert = require('node:assert/strict');
const { apply, day, retainLastUpload } = require('../js/daily-pickup.js');
const SegmentAnalysis = require('../js/segment-analysis.js');

test('first and subsequent uploads measure the full day from the last previous-day file', () => {
    const fields = ['otb', 'daily_otb', 'segment_otb'];
    let target = { otb: { rooms: [90] }, daily_otb: { '2026-10-08': { rooms: 90 } }, lastOtbDate: '05-10-2026' };
    for (const rooms of [100, 110, 115]) {
        const before = structuredClone(target);
        target.otb.rooms[0] = rooms;
        target.daily_otb['2026-10-08'].rooms = rooms;
        retainLastUpload(target, before);
        apply(target, fields, new Date('2026-10-06T12:00:00Z'), before.lastOtbDate, before);
        assert.equal(target.otb.rooms[0] - target.otb_prev.rooms[0], rooms - 90);
        assert.equal(target.otb_prev.snapshotDate, '05-10-2026');
        target = JSON.parse(JSON.stringify(target));
    }
    const before = structuredClone(target);
    target.otb.rooms[0] = 120;
    apply(target, fields, new Date('2026-10-06T22:00:00Z'), '06-10-2026', before);
    assert.equal(target.otb_prev.rooms[0], 115);
    assert.equal(target.otb.rooms[0] - target.otb_prev.rooms[0], 5);
});

test('forecast segments use yesterday on the first upload and retain it all day', () => {
    const report = rooms => ({ source: 'forecast.xlsx', startYear: '2026', segmentData: { GRUPOS: { name: 'GRUPOS', days: { '2026-10-08': { rooms } } } } });
    const db = { Guadiana: { segment: report(90).segmentData, updatedAt: '2026-10-05T18:00:00Z', source: 'yesterday.xlsx' } };
    for (const rooms of [100, 110, 115]) {
        SegmentAnalysis.mergeForecast(db, 'Guadiana', report(rooms));
        assert.equal(db.Guadiana.segment_prev.GRUPOS.days['2026-10-08'].rooms, 90);
        assert.equal(db.Guadiana.prevSource, 'yesterday.xlsx');
    }
});

test('last-file changes remain independent of daily pickup and preserve zero rooms', () => {
    const fields = ['otb', 'daily_otb', 'segment_otb'];
    let target = { otb: { rooms: [100] }, daily_otb: { '2026-10-08': { rooms: 100 }, '2026-10-09': 0 } };
    apply(target, fields, new Date('2026-10-06T08:00:00Z'));
    for (const rooms of [110, 115]) {
        const before = structuredClone(target);
        target.otb.rooms[0] = rooms;
        target.daily_otb['2026-10-08'].rooms = rooms;
        retainLastUpload(target, before);
        apply(target, fields, new Date('2026-10-06T12:00:00Z'));
    }
    target = JSON.parse(JSON.stringify(target));
    assert.equal(target.daily_otb['2026-10-08'].rooms - target.otb_last_upload_prev.daily_otb['2026-10-08'].rooms, 5);
    assert.equal(target.otb.rooms[0] - target.otb_prev.rooms[0], 15);
    assert.equal(target.otb_last_upload_prev.daily_otb['2026-10-09'], 0);
    target.daily_otb['2026-10-08'].rooms = 0;
    assert.equal(target.otb_last_upload_prev.daily_otb['2026-10-08'].rooms, 110);
});

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
