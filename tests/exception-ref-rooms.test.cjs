const test = require('node:test');
const assert = require('node:assert/strict');

function loadPI() {
    const store = {};
    delete global.window;
    global.CapaStorage = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
    global.localStorage = global.CapaStorage;
    delete require.cache[require.resolve('../js/pricing-intelligence.js')];
    return require('../js/pricing-intelligence.js');
}

const baseParams = (otbRooms) => ({
    hotelName: 'Guadiana', dateISO: '2027-01-24', currentPrice: 75, marketAvg: 54,
    otbRooms, occupancyPct: otbRooms / 108 * 100, capacity: 108, otbChange: 0
});

test('excepción con ocupación de referencia: se mantiene mientras ocupadas >= referencia', () => {
    const PI = loadPI();
    PI.setDateException('2027-01-24', { barBase: 75, eventName: 'Bloq Grupos', refRooms: 83 }, 'Guadiana');
    assert.equal(PI.getDateException('2027-01-24', 'Guadiana').refRooms, 83);

    const same = PI.evaluateDailyRecommendation(baseParams(83));
    assert.equal(same.isException, true);
    assert.ok(!same.exceptionSuspended);

    const more = PI.evaluateDailyRecommendation(baseParams(90));
    assert.equal(more.isException, true);
});

test('excepción con ocupación de referencia: se suspende y avisa si baja de la cifra', () => {
    const PI = loadPI();
    PI.setDateException('2027-01-24', { barBase: 75, eventName: 'Bloq Grupos', refRooms: 83 }, 'Guadiana');
    const rec = PI.evaluateDailyRecommendation(baseParams(78));
    assert.equal(rec.exceptionSuspended, true);
    assert.equal(rec.isException, false);
    assert.notEqual(rec.action, 'MANTENER');
    assert.match(rec.triggerText, /Bloq Grupos: 78\/83/);
    assert.match(rec.reasons[0], /suspendida/);
    // La BAR base vuelve a ser la de la matriz, no la de la excepción
    assert.equal(rec.baseBar, PI.getBaseBarForDate('2027-01-24', 'Guadiana', { ignoreException: true }).bar);
});

test('excepciones sin referencia funcionan como antes', () => {
    const PI = loadPI();
    PI.setDateException('2027-01-24', { barBase: 75, eventName: 'Congreso' }, 'Guadiana');
    const rec = PI.evaluateDailyRecommendation(baseParams(10));
    assert.equal(rec.isException, true);
    assert.ok(!rec.exceptionSuspended);
    assert.equal(PI.getDateException('2027-01-24', 'Guadiana').refRooms, null);
});
