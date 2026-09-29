const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../Analisis360.html'), 'utf8');
const code = html.slice(html.indexOf('            // PICK-UP MONITOR'), html.indexOf('            // BUDGET OCCUPANCY'));
function render(yearData, midx = -1, element = { innerHTML: '' }) {
    vm.runInNewContext(code, { yearData, midx, currentYear: '2026', document: { getElementById: () => element } });
    return element.innerHTML;
}
function data(current, previous) { return { daily_otb: current, otb_prev: { daily_otb: previous } }; }
test('both hotels show actual changes, including explicit zero and legacy numeric entries', () => {
    for (const hotel of ['Guadiana', 'Cumbria']) {
        const db = { [hotel]: data({ '2026-10-01': { rooms: 0 }, '2026-10-02': 8 }, { '2026-10-01': 5, '2026-10-02': { rooms: 6 } }) };
        const before = JSON.stringify(db);
        assert.match(render(db[hotel]), /Variación entre cargas: -3 RN/);
        assert.equal(JSON.stringify(db), before);
    }
});
test('missing dates on either side do not invent bookings or hide removals', () => {
    assert.match(render(data({}, { '2026-10-01': 5 })), /No hay datos comparables/);
    assert.match(render(data({ '2026-10-01': 5 }, {})), /No hay datos comparables/);
});
test('switching hotel or period clears the previous result when no comparison is available', () => {
    const element = { innerHTML: '' };
    render(data({ '2026-10-01': 10 }, { '2026-10-01': 5 }), -1, element);
    assert.match(element.innerHTML, /\+5 RN/);
    render({}, -1, element);
    assert.match(element.innerHTML, /No hay datos comparables/);
    assert.match(render(data({ '2026-10-01': 10 }, { '2026-10-01': 5 }), 8), /No hay datos comparables/);
});
test('month and year scope exclude unrelated valid dates', () => {
    assert.match(render(data({ '2026-10-01': 10, '2026-11-01': 99, '2027-10-01': 50 }, { '2026-10-01': 5 }), 9), /\+5 RN/);
});
test('invalid amounts, dates and empty maps remain unavailable; verified zero stays zero', () => {
    for (const value of [null, {}, '5', NaN, Infinity, -1]) {
        assert.match(render(data({ '2026-10-01': value }, { '2026-10-01': 5 })), /No hay datos comparables/);
    }
    assert.match(render(data({ '2026-02-30': 5 }, { '2026-02-30': 5 })), /No hay datos comparables/);
    assert.match(render(data({}, {})), /No hay datos comparables/);
    assert.match(render(data({ '2026-10-01': 0 }, { '2026-10-01': 0 })), /: 0 RN/);
});
