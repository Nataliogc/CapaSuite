const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('AnalisisCalendario.html has month-level interactive selection and insights calculation', () => {
    const html = fs.readFileSync('AnalisisCalendario.html', 'utf8');

    // 1. Verify CSS styles for month interaction
    assert.match(html, /\.month-card\.is-selected/);
    assert.match(html, /\.month-select-pill/);
    assert.match(html, /\.insights-filter-banner/);

    // 2. Verify script logic for month selection and toggle
    assert.match(html, /let selectedMonth\s*=\s*null;/);
    assert.match(html, /function toggleMonthSelection\(m\)/);
    assert.match(html, /card\.onclick\s*=\s*\(\)\s*=>\s*toggleMonthSelection\(m\)/);

    // 3. Verify hotelSelector labels are branded
    assert.match(html, /<option value="Guadiana">Sercotel Guadiana<\/option>/);
    assert.match(html, /<option value="Cumbria">Cumbria Spa&Hotel<\/option>/);

    // 4. Test toggleMonthSelection logic
    const context = {
        selectedMonth: null,
        renderInsightsCalled: false,
        renderCalendarCalled: false,
        renderEventListCalled: false,
        renderInsights: () => { context.renderInsightsCalled = true; },
        renderCalendar: () => { context.renderCalendarCalled = true; },
        renderEventList: () => { context.renderEventListCalled = true; }
    };

    const toggleMatch = html.match(/function toggleMonthSelection\(m\)\s*\{([\s\S]*?)\n        \}/);
    assert.ok(toggleMatch, 'toggleMonthSelection found');
    vm.runInNewContext(`
        var selectedMonth = null;
        function toggleMonthSelection(m) {
            ${toggleMatch[1]}
        }
    `, context);

    // Click October (month 9)
    context.toggleMonthSelection(9);
    assert.equal(context.selectedMonth, 9);
    assert.equal(context.renderInsightsCalled, true);

    // Click October again -> toggles back to null (all year)
    context.renderInsightsCalled = false;
    context.toggleMonthSelection(9);
    assert.equal(context.selectedMonth, null);
    assert.equal(context.renderInsightsCalled, true);
});
