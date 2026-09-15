const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../AnalisisCompetencia.html'), 'utf8');

function setup({ fail = false } = {}) {
    const original = { data: [], lastUpdate: '2026-09-01T10:00:00Z', competitors: [], months: [] };
    const storage = { revenue_data_v2: JSON.stringify(original), revenue_history_lite: 'source history' };
    const alerts = [];
    const context = vm.createContext({
        processedData: [{ dayIndex: 1, dateISO: '2026-09-20', hotels: {
            Guadiana: { price: 65, sold: false, status: 'available' },
            Cumbria: { price: 0, sold: true, status: 'sold' }
        } }],
        competitorsList: [], distinctMonths: [], activeHotel: 'Guadiana',
        CapaStorage: { isAvailable: true, getItem: key => storage[key], setItem: (key, value) => { if (!fail) storage[key] = value; } },
        window: { addEventListener() {} }, alert: message => alerts.push(message),
        console: { error() {} }, refreshActiveView() {}, ensureHotelStructure() {}
    });
    vm.runInContext(html.slice(html.indexOf('        let manualPricesPending'), html.indexOf('        function calculateSmartYield')), context);
    for (const name of ['setManualPrice', 'resetAllManualPrices']) {
        const start = html.indexOf(`        function ${name}(`);
        vm.runInContext(html.slice(start, html.indexOf('\n        function ', start + 1)), context);
    }
    return { context, storage, alerts, run: code => vm.runInContext(code, context) };
}

test('manual edits persist for both hotels without changing source timestamp or history', () => {
    const { run, storage } = setup();
    run("setManualPrice(1, 'Guadiana', 80); setManualPrice(1, 'Cumbria', 60)");
    assert.equal(run('manualPricesPending'), true);
    run('saveManualPrices()');
    const restored = JSON.parse(storage.revenue_data_v2);
    assert.equal(restored.data[0].hotels.Guadiana.price, 80);
    assert.equal(restored.data[0].hotels.Cumbria.sold, false);
    assert.equal(restored.lastUpdate, '2026-09-01T10:00:00Z');
    assert.equal(storage.revenue_history_lite, 'source history');
    assert.equal(run('manualPricesPending'), false);
    run('processedData = JSON.parse(CapaStorage.getItem("revenue_data_v2")).data; resetAllManualPrices(); saveManualPrices()');
    const reset = JSON.parse(storage.revenue_data_v2).data[0].hotels;
    assert.equal(reset.Guadiana.price, 65);
    assert.equal(reset.Cumbria.sold, true);
    assert.equal(reset.Cumbria.status, 'sold');
});

test('failed storage keeps edits pending and reports failure', () => {
    const { run, alerts } = setup({ fail: true });
    run("setManualPrice(1, 'Guadiana', 90); saveManualPrices()");
    assert.equal(run('manualPricesPending'), true);
    assert.match(alerts.at(-1), /No se han podido guardar/);
});

test('non-finite prices are rejected', () => {
    const { run } = setup();
    run("setManualPrice(1, 'Guadiana', Infinity)");
    assert.equal(run('processedData[0].hotels.Guadiana.price'), 65);
    assert.equal(run('manualPricesPending'), false);
});

test('inline page scripts parse', () => {
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        new vm.Script(match[1]);
    }
});
