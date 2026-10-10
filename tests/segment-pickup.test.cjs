const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SegmentAnalysis = require('../js/segment-analysis.js');

test('mergeForecast saves previous forecast snapshot in segment_prev', () => {
    const db = {};
    const report1 = {
        source: 'test-1.xlsx',
        startYear: '2026',
        segmentData: {
            'GRUPOS': { name: 'GRUPOS', days: { '2026-10-01': { rooms: 10, revenue: 1000, accommodation: 900 } } }
        }
    };
    SegmentAnalysis.mergeForecast(db, 'Guadiana', report1);
    assert.equal(db.Guadiana.segment['GRUPOS'].days['2026-10-01'].rooms, 10);
    assert.equal(db.Guadiana.segment_prev, undefined);

    // Second upload with changes
    const report2 = {
        source: 'test-2.xlsx',
        startYear: '2026',
        segmentData: {
            'GRUPOS': { name: 'GRUPOS', days: { '2026-10-01': { rooms: 15, revenue: 1500, accommodation: 1350 } } }
        }
    };
    SegmentAnalysis.mergeForecast(db, 'Guadiana', report2);
    assert.equal(db.Guadiana.segment['GRUPOS'].days['2026-10-01'].rooms, 15);
    assert.ok(db.Guadiana.segment_prev);
    assert.equal(db.Guadiana.segment_prev['GRUPOS'].days['2026-10-01'].rooms, 10);
});

test('renderSegmentPickupAnalysis in Analisis360 calculates pickup from forecast snapshots', () => {
    const html = fs.readFileSync(path.join(__dirname, '../Analisis360.html'), 'utf8');
    const startIdx = html.indexOf('function renderSegmentPickupAnalysis(');
    const endIdx = html.indexOf('function switchHotel(');
    const code = html.slice(startIdx, endIdx);

    const tbody = { innerHTML: '' };
    const fakeDocument = {
        getElementById: (id) => {
            if (id === 'segmentPickupBody') return tbody;
            if (id === 'yield-ly-label') return { innerText: '' };
            return null;
        }
    };

    const storage = {
        'segment_forecast_v2': JSON.stringify({
            'Guadiana': {
                segment: {
                    'GRUPOS': { name: 'GRUPOS', days: { '2026-10-01': { rooms: 20, revenue: 2000, accommodation: 1800 } } },
                    'DIRECTO ONLINE': { name: 'DIRECTO ONLINE', days: { '2026-10-01': { rooms: 5, revenue: 500, accommodation: 450 } } }
                },
                segment_prev: {
                    'GRUPOS': { name: 'GRUPOS', days: { '2026-10-01': { rooms: 12, revenue: 1200, accommodation: 1080 } } },
                    'DIRECTO ONLINE': { name: 'DIRECTO ONLINE', days: { '2026-10-01': { rooms: 8, revenue: 800, accommodation: 720 } } }
                }
            }
        })
    };

    const fakeCapaStorage = {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = v; }
    };

    const context = {
        document: fakeDocument,
        CapaStorage: fakeCapaStorage,
        db: {
            'Guadiana': {
                '2026': {
                    segment: {
                        'GRUPOS': { name: 'GRUPOS', rooms: Array(12).fill(0), revenue: Array(12).fill(0), accommodation: Array(12).fill(0) },
                        'DIRECTO ONLINE': { name: 'DIRECTO ONLINE', rooms: Array(12).fill(0), revenue: Array(12).fill(0), accommodation: Array(12).fill(0) }
                    }
                },
                '2025': {
                    segment: {}
                }
            }
        },
        normalizeSegmentDisplayName: (n) => n,
        fmt: (n) => `${Math.round(n)} €`,
        fmtNum: (n) => `${n}`,
        window: { __seg360NetMode: false },
        console: console
    };

    vm.runInNewContext(`${code}\nrenderSegmentPickupAnalysis('Guadiana', '2026', -1);`, context);

    // GRUPOS: 20 - 12 = +8 RN, 1800 - 1080 = +720 €
    assert.match(tbody.innerHTML, /\+8 RN/);
    assert.match(tbody.innerHTML, /\+720 €/);

    // DIRECTO ONLINE: 5 - 8 = -3 RN, 450 - 720 = -270 €
    assert.match(tbody.innerHTML, /-3 RN/);
    assert.match(tbody.innerHTML, /-270 €/);
});
