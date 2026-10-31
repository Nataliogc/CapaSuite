/**
 * Test script to measure performance of hotel switching
 * and verify regression safety.
 */
const fs = require('fs');

global.window = global;
global.document = {
    getElementById: (id) => {
        if (id === 'hotelSelector') return { value: 'Guadiana' };
        if (id === 'monthSelector') return { value: 'all' };
        if (id === 'tableHeader') return { innerHTML: '' };
        if (id === 'tableBody') return { innerHTML: '', addEventListener: () => {} };
        if (id === 'insights-container') return { innerHTML: '', appendChild: () => {} };
        if (id === 'expert-badge-count') return { style: {}, textContent: '' };
        if (id === 'recordCount') return { innerHTML: '' };
        if (id === 'dowMonthTitleBadge') return { innerText: '' };
        if (id === 'monthDowPillsStrip') return { innerHTML: '' };
        if (id === 'monthSummaryContainer') return { innerHTML: '' };
        if (id === 'comparisonResultsContainer') return { innerHTML: '' };
        if (id === 'chartModal') return { style: { display: 'none' } };
        return { value: '', style: {}, innerHTML: '', appendChild: () => {} };
    },
    querySelectorAll: () => [],
    createElement: () => ({ className: '', innerHTML: '', style: {}, appendChild: () => {} })
};

global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
};
global.CapaStorage = global.localStorage;

require('../js/pricing-intelligence.js');

// Create realistic 365 days of competition and OTB data
const sampleData = [];
const competitors = ['Pago del Vicario', 'Parador Almagro', 'Hotel Santa Cecilia', 'Hotel Parque', 'Hotel Silken', 'Alfonso X'];
const months = ['Enero 2027', 'Febrero 2027', 'Marzo 2027', 'Abril 2027', 'Mayo 2027', 'Junio 2027', 'Julio 2027', 'Agosto 2027', 'Septiembre 2027', 'Octubre 2027', 'Noviembre 2027', 'Diciembre 2027'];

let dayIdx = 0;
for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0');
    const mName = months[m - 1];
    for (let d = 1; d <= 28; d++) {
        const dStr = String(d).padStart(2, '0');
        const iso = `2027-${mStr}-${dStr}`;
        const hotels = {
            Guadiana: { price: 75 + (d % 15), sold: false },
            Cumbria: { price: 72 + (d % 15), sold: false }
        };
        competitors.forEach(c => {
            hotels[c] = { price: 70 + (dayIdx % 25), sold: false };
        });
        sampleData.push({
            dayIndex: dayIdx++,
            dateISO: iso,
            label: `${d} ${mName.slice(0, 3)}`,
            month: mName,
            hotels: hotels,
            compAvg: 80
        });
    }
}

// Add realistic snapshots
const sampleSnapshots = { Guadiana: {}, Cumbria: {} };
sampleData.forEach(d => {
    sampleSnapshots.Guadiana[d.dateISO] = [
        { r: 35, v: 2800, a: 80, b: 85, t: 1793000000, o: 32 },
        { r: 42, v: 3360, a: 80, b: 85, t: 1793400000, o: 38 }
    ];
    sampleSnapshots.Cumbria[d.dateISO] = [
        { r: 22, v: 1650, a: 75, b: 82, t: 1793000000, o: 37 },
        { r: 28, v: 2100, a: 75, b: 82, t: 1793400000, o: 47 }
    ];
});
localStorage.setItem('daily_otb_snapshots_v1', JSON.stringify(sampleSnapshots));

console.log('Performance test setup ready with', sampleData.length, 'dates.');

// Measure pickup computation for all dates
const t0 = performance.now();
sampleData.forEach(d => {
    window.PricingIntelligence.calculateDailyPickup('Guadiana', d.dateISO, { rooms: 42, occupancyPct: 38, otbChange: 7 });
    window.PricingIntelligence.evaluateDailyRecommendation({
        hotelName: 'Guadiana',
        dateISO: d.dateISO,
        currentPrice: 80,
        marketAvg: 80,
        lowestCompPrice: 70,
        highestCompPrice: 95,
        soldCompsCount: 0,
        otbRooms: 42,
        occupancyPct: 38,
        capacity: 108,
        otbChange: 7
    });
});
const t1 = performance.now();
console.log('Guadiana 336 dates calculation time:', (t1 - t0).toFixed(2), 'ms');

// Measure Cumbria calculation time
const t2 = performance.now();
sampleData.forEach(d => {
    window.PricingIntelligence.calculateDailyPickup('Cumbria', d.dateISO, { rooms: 28, occupancyPct: 47, otbChange: 6 });
    window.PricingIntelligence.evaluateDailyRecommendation({
        hotelName: 'Cumbria',
        dateISO: d.dateISO,
        currentPrice: 77,
        marketAvg: 80,
        lowestCompPrice: 70,
        highestCompPrice: 95,
        soldCompsCount: 0,
        otbRooms: 28,
        occupancyPct: 47,
        capacity: 59,
        otbChange: 6
    });
});
const t3 = performance.now();
console.log('Cumbria 336 dates calculation time:', (t3 - t2).toFixed(2), 'ms');

// Measure repeat switch (cache hit)
const t4 = performance.now();
sampleData.forEach(d => {
    window.PricingIntelligence.calculateDailyPickup('Guadiana', d.dateISO, { rooms: 42, occupancyPct: 38, otbChange: 7 });
});
const t5 = performance.now();
console.log('Repeat Guadiana pickup (cache hit):', (t5 - t4).toFixed(2), 'ms');
