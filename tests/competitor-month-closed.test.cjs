const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../AnalisisCompetencia.html'), 'utf8');

function setupEnvironment() {
    const context = {
        activeHotel: 'Guadiana',
        competitorsList: [
            { name: 'Hotel Santa Cecilia' },
            { name: 'El Parque Real' },
            { name: 'NH Ciudad Real' }
        ],
        ignoredCompetitors: new Set(),
        ignoreCompetitorsBelowMin: false,
        useDayPartMultipliers: false,
        dayPartMultipliers: {},
        getHotelMinPrice: () => 0,
        console: { log: () => {}, warn: () => {}, error: () => {} },
        ensureHotelStructure: (d, h) => {
            if (!d.hotels) d.hotels = {};
            if (!d.hotels[h]) d.hotels[h] = { price: 0, sold: false, status: 'noData' };
        }
    };

    vm.createContext(context);

    // Extract recalcMarketAverages and calculateSmartYield from AnalisisCompetencia.html
    const startRecalc = html.indexOf('        function recalcMarketAverages(');
    const endRecalc = html.indexOf('\n        function openMinPriceModal(');
    assert.ok(startRecalc !== -1 && endRecalc !== -1, 'Could not find recalcMarketAverages in HTML');
    vm.runInContext(html.slice(startRecalc, endRecalc), context);

    const startYield = html.indexOf('        function calculateSmartYield(');
    const endYield = html.indexOf('\n        function setManualPrice(');
    assert.ok(startYield !== -1 && endYield !== -1, 'Could not find calculateSmartYield in HTML');
    vm.runInContext(html.slice(startYield, endYield), context);

    return context;
}

test('competitor closed for the entire month is recognized as unopened sales and excluded from sold out counts and price recommendations', () => {
    const ctx = setupEnvironment();

    // Create 31 days of October:
    // Santa Cecilia is closed on all 31 days (sold: true, status: 'sold')
    // Parque Real is 71€, NH is 67€
    // Guadiana is 75€, occupancy 30 rooms (capacity 108 -> ~28% low occ)
    const data = [];
    for (let day = 1; day <= 31; day++) {
        const iso = `2026-10-${String(day).padStart(2, '0')}`;
        data.push({
            dayIndex: day,
            month: 'Octubre 2026',
            dateISO: iso,
            hotels: {
                Guadiana: { price: 75, sold: false, status: 'available', otbRooms: 30 },
                'Hotel Santa Cecilia': { price: 0, sold: true, status: 'sold' },
                'El Parque Real': { price: 71, sold: false, status: 'available' },
                'NH Ciudad Real': { price: 67, sold: false, status: 'available' }
            }
        });
    }

    ctx.recalcMarketAverages(data);

    // 1. Verify Santa Cecilia is marked as isMonthClosed
    assert.equal(data[0].hotels['Hotel Santa Cecilia'].isMonthClosed, true);
    assert.equal(data[30].hotels['Hotel Santa Cecilia'].isMonthClosed, true);

    // 2. Verify activeSoldComps does NOT count Santa Cecilia as sold out (should be 0, not 1)
    assert.equal(data[0].activeSoldComps, 0);
    assert.equal(data[15].activeSoldComps, 0);

    // 3. Verify market average is calculated only from open competitors (71 + 67) / 2 = 69
    assert.equal(data[0].compAvg, 69);
    assert.equal(data[0].activeCompPrices.length, 2);
    assert.equal(data[0].activeCompPrices[0], 71);
    assert.equal(data[0].activeCompPrices[1], 67);

    // 4. Verify calculateSmartYield does NOT trigger "Comp. Llenos"
    const yieldInfo = ctx.calculateSmartYield(data[0], 'Guadiana');
    assert.ok(yieldInfo, 'Yield info should be generated');
    assert.doesNotMatch(yieldInfo.actionText, /Comp\. Llenos/);
});

test('competitor with open sales and occasional sold out dates counts as real sold out', () => {
    const ctx = setupEnvironment();

    const data = [];
    for (let day = 1; day <= 31; day++) {
        const iso = `2026-10-${String(day).padStart(2, '0')}`;
        const isSoldWeekend = (day === 10 || day === 11);
        data.push({
            dayIndex: day,
            month: 'Octubre 2026',
            dateISO: iso,
            hotels: {
                Guadiana: { price: 75, sold: false, status: 'available', otbRooms: 30 },
                'Hotel Santa Cecilia': {
                    price: isSoldWeekend ? 0 : 80,
                    sold: isSoldWeekend,
                    status: isSoldWeekend ? 'sold' : 'available'
                },
                'El Parque Real': { price: 71, sold: false, status: 'available' },
                'NH Ciudad Real': { price: 67, sold: false, status: 'available' }
            }
        });
    }

    ctx.recalcMarketAverages(data);

    // Because Santa Cecilia is open on 29 days, it is NOT month closed
    assert.equal(data[0].hotels['Hotel Santa Cecilia'].isMonthClosed, false);
    assert.equal(data[9].hotels['Hotel Santa Cecilia'].isMonthClosed, false);

    // On regular days, activeSoldComps is 0
    assert.equal(data[0].activeSoldComps, 0);

    // On days 10 and 11, Santa Cecilia IS legitimately counted as a sold out competitor!
    assert.equal(data[9].activeSoldComps, 1);
    assert.equal(data[10].activeSoldComps, 1);
});

test('competition table layout fits 100% of the screen without horizontal scrolling', () => {
    // 1. table is width 100% and table-layout: fixed
    assert.match(html, /table\s*\{[\s\S]*width:\s*100%;/);
    assert.match(html, /table\s*\{[\s\S]*table-layout:\s*fixed;/);

    // 2. table-wrap does not show horizontal scrollbar on standard displays
    assert.match(html, /\.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden;/);

    // 3. Columns use proportional classes
    assert.match(html, /th-date/);
    assert.match(html, /th-active-hotel/);
    assert.match(html, /th-action/);
    assert.match(html, /th-comp/);

    // 4. Action text and date do not block column compaction
    assert.match(html, /\.action-main-text\s*\{[\s\S]*white-space:\s*normal;/);
});
