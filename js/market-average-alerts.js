(function (root) {
    'use strict';
    function detectMarketAverageAnomalies(rows, ignored = []) {
        const excluded = new Set(ignored);
        const dated = new Map();
        for (const row of rows || []) {
            let date = String(row.dateISO || row.date || '');
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) date = date.split('/').reverse().join('-');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
            const parsed = new Date(date + 'T12:00:00Z');
            if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
            const prices = {};
            for (const [name, hotel] of Object.entries(row.hotels || {})) {
                if (/guadiana|cumbria|l[ií]bere/i.test(name) || excluded.has(name)) continue;
                const price = Number(hotel?.price);
                if (!hotel?.sold && Number.isFinite(price) && price > 0) prices[name] = price;
            }
            dated.set(date, {date, weekday: parsed.getUTCDay(), prices, hotels: row.hotels});
        }
        const data = [...dated.values()].sort((a,b) => a.date.localeCompare(b.date));
        const mean = values => values.reduce((a,b)=>a+b,0)/values.length;
        const alerts = [];
        for (const row of data) {
            const names = Object.keys(row.prices);
            if (names.length < 3) continue;
            const peers = data.filter(other => other !== row && other.date.slice(0,7) === row.date.slice(0,7) && other.weekday === row.weekday && names.every(name => other.prices[name] > 0));
            if (peers.length < 3) continue;
            const averages = peers.map(other => mean(names.map(name => other.prices[name]))).sort((a,b)=>a-b);
            const mid = Math.floor(averages.length / 2);
            const baseline = averages.length % 2 ? averages[mid] : (averages[mid-1]+averages[mid])/2;
            const average = mean(Object.values(row.prices));
            const diff = average - baseline, pct = diff / baseline * 100;
            if (Math.abs(diff) < 15 || Math.abs(pct) < 25) continue;
            alerts.push({date:row.date, average, baseline, diff, pct, count:names.length, referenceCount:peers.length, hotels:row.hotels});
        }
        return alerts;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = detectMarketAverageAnomalies;
    else root.detectMarketAverageAnomalies = detectMarketAverageAnomalies;
})(typeof window !== 'undefined' ? window : globalThis);
