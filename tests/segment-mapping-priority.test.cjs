const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../js/segment-analysis.js');

test('explicit import correction wins over remembered source-name mapping', () => {
    const rows = [['Agencias', 'Hab', 2]];
    const mappings = { AGENCIAS: 'OTA/AAVV', A1: 'OTROS' };
    assert.equal(S.reviewRows(rows, { A1: 'GRUPOS' }, mappings)[0].name, 'GRUPOS');
    assert.equal(S.reviewRows(rows, { A1: 'TOTAL GENERAL' }, mappings)[0].name, 'TOTAL GENERAL');
    assert.equal(S.reviewRows(rows, {}, mappings)[0].name, 'OTA/AAVV');
    assert.equal(mappings.AGENCIAS, 'OTA/AAVV');
});

test('current valid segments and historical aliases remain supported', () => {
    for (const [source, expected] of [['Agencias','AGENCIAS'],['Particula','PARTICULARES'],['Bono Online','BONO ONLINE'],['CORPORATI','CORPORATIVO LINEAL']]) {
        const block = S.reviewRows([[source, 'Hab', 1]], {}, {})[0];
        assert.equal(block.name, expected);
        assert.equal(block.reason, '');
    }
});

test('both hotels apply the selected correction through parse without changing saved mappings or source', () => {
    const stored = {
        segment_mappings_Guadiana: JSON.stringify({ AGENCIAS: 'OTA/AAVV' }),
        segment_mappings_Cumbria: JSON.stringify({ AGENCIAS: 'OTROS' })
    };
    const before = JSON.stringify(stored);
    const context = vm.createContext({ CapaStorage: { getItem: key => stored[key] }, console });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/segment-analysis.js'), 'utf8'), context);
    for (const hotel of ['Guadiana', 'Cumbria']) {
        const rows = [['Seg.', '', 'Ene.26'], ['Agencias','Hab',2], ['', 'SUITE',120]];
        const source = JSON.stringify(rows);
        const report = context.SegmentAnalysis.parse(rows, '', undefined, { A2:'GRUPOS' }, hotel);
        assert.equal(report.years['2026'].segment.GRUPOS.rooms[0], 2);
        assert.equal(report.years['2026'].segment.GRUPOS.revenue[0], 120);
        assert.equal(Object.keys(report.years['2026'].segment).length, 1);
        assert.equal(JSON.stringify(rows), source);
    }
    assert.equal(JSON.stringify(stored), before);
});
