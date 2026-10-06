(function (root) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const day = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(date);
    function apply(target, fields, date = new Date(), label = '') {
        const key = fields.join('|');
        target.pickupBaselines ||= {};
        let baseline = target.pickupBaselines[key];
        if (!baseline || baseline.day !== day(date)) {
            baseline = { day: day(date), label, values: {} };
            for (const field of fields) if (target[field] !== undefined) baseline.values[field] = clone(target[field]);
            target.pickupBaselines[key] = baseline;
        }
        for (const field of fields) {
            if (baseline.values[field] !== undefined) target[field + '_prev'] = clone(baseline.values[field]);
            else delete target[field + '_prev'];
        }
        if (fields.includes('otb')) {
            target.otb_prev ||= {};
            target.otb_prev.daily_otb = clone(baseline.values.daily_otb || {});
            target.otb_prev.snapshotDate = baseline.label;
        }
        if (fields.includes('service')) target.prod_prev = { service: clone(baseline.values.service || {}), snapshotDate: baseline.label };
        return baseline;
    }
    const api = { apply, day };
    if (typeof module === 'object') module.exports = api;
    root.DailyPickup = api;
})(typeof window === 'object' ? window : globalThis);
