const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('AnalisisIA.html', 'utf8');

test('AnalisisIA generates ins_below_base_ok when 0 dates are below base rate', () => {
    const c = {
        compData: {
            data: [
                { date: '2099-05-10', hotels: { Guadiana: { price: 90, sold: false } } },
                { date: '2099-05-11', hotels: { Guadiana: { price: 85, sold: false } } }
            ]
        },
        currentHotel: 'Guadiana',
        insights: [],
        getDayInfo: () => ({ dayOfWeek: 'Lun', isWeekend: false, dayLabel: 'Laboral' }),
        parseDateRobust: s => new Date(s + 'T12:00:00'),
        PricingIntelligence: {
            getBaseBarForDate: (date, hotel) => ({ bar: 70, isException: false })
        }
    };
    vm.createContext(c);
    vm.runInContext(html.slice(html.indexOf('            const belowBaseDates ='), html.indexOf('            allGeneratedInsights = insights;')), c);

    assert.equal(c.insights.length, 1);
    assert.equal(c.insights[0].id, 'ins_below_base_ok');
    assert.equal(c.insights[0].category, 'pricing');
    assert.equal(c.insights[0].priority, 'positive');
    assert.ok(c.insights[0].title.includes('0 fechas por debajo'));
});

test('openDatesModal formats 7 columns accurately for isBelowBase', () => {
    assert.ok(html.includes("isBelowBase = (insightId === 'ins_below_base' || insightId === 'ins_below_base_ok');"));
    assert.ok(html.includes('Tarifa publicada'));
    assert.ok(html.includes('Tarifa base'));
    assert.ok(html.includes('Por debajo'));
    assert.ok(html.includes('Desviación'));
    assert.ok(html.includes('Base aplicada'));
    assert.ok(html.includes('BAR Base ${currentHotel}'));
});

test('AnalisisCompetencia reads URL filter parameter to filterTable', () => {
    const compHtml = fs.readFileSync('AnalisisCompetencia.html', 'utf8');
    assert.ok(compHtml.includes("urlParams.get('filter')"));
    assert.ok(compHtml.includes("filterTable(filterParam)"));
});
