const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../AnalisisIA.html'), 'utf8');
const code = html.slice(html.indexOf("            const compDataRaw ="), html.indexOf("            if (container.innerHTML === '')"));
function run(currentHotel, rows) {
    const insights = [];
    vm.runInNewContext(code, {
        currentHotel, otbRN: Array(12).fill(300),
        CapaStorage: { getItem: () => JSON.stringify({ data: rows }) },
        fmtEuro: n => `${n} €`, addInsight: (...args) => insights.push(args)
    });
    return insights;
}
test('market insight uses saved ISO dates and keeps the hotels separate', () => {
    const rows = [{ dateISO: '2026-10-05', compAvg: 100, hotels: { Guadiana: {price: 70}, Cumbria: {price: 95} } }];
    const result = run('Guadiana', rows);
    assert.equal(result.length, 1);
    assert.match(result[0][2], /2026-10-05/);
    assert.match(result[0][2], /300 €/);
    assert.match(result[0][2], /No representa una pérdida comprobada/);
    assert.equal(run('Cumbria', rows).length, 0);
    rows[0].hotels.Cumbria.price = 60;
    assert.match(run('Cumbria', rows)[0][2], /400 €/);
});
test('legacy dates remain supported and imported text cannot inject markup', () => {
    for (const field of ['date', 'checkIn']) {
        const row = { [field]: '<img src=x>', compAvg: 100, hotels: { Guadiana: {price: 70} } };
        const text = run('Guadiana', [row])[0][2];
        assert.match(text, /&lt;img src=x&gt;/);
        assert.doesNotMatch(text, /<img/);
    }
});
test('sold dates do not generate a low-price insight', () => {
    assert.equal(run('Guadiana', [{dateISO:'2026-10-05',compAvg:100,hotels:{Guadiana:{price:70,sold:true}}}]).length, 0);
});
