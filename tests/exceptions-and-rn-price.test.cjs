const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadModules() {
    const store = {};
    delete global.window;
    global.CapaStorage = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
    global.localStorage = global.CapaStorage;

    delete require.cache[require.resolve('../js/pricing-intelligence.js')];
    const PI = require('../js/pricing-intelligence.js');
    global.window = { PricingIntelligence: PI, addEventListener: () => {} };

    delete require.cache[require.resolve('../js/competencia-intelligence-ui.js')];
    const UI = require('../js/competencia-intelligence-ui.js');

    return { PI, UI, store };
}

test('excepciones independientes por hotel, fallback legacy y eliminación', () => {
    const { PI, store } = loadModules();
    const dateISO = '2026-11-24';

    // Sin excepción previa, Cumbria usa su BAR base normal (63 € para martes noviembre 2026)
    const defaultCumbria = PI.getBaseBarForDate(dateISO, 'Cumbria');
    const defaultGuadiana = PI.getBaseBarForDate(dateISO, 'Guadiana');
    assert.equal(defaultCumbria.isException, false);
    assert.equal(defaultGuadiana.isException, false);
    assert.equal(defaultCumbria.bar, defaultGuadiana.bar - 3);

    // Excepción exclusiva para Cumbria no contamina a Guadiana
    PI.setDateException(dateISO, { barBase: 60, eventName: 'Baja Ocupación' }, 'Cumbria');
    const cumbriaExc = PI.getBaseBarForDate(dateISO, 'Cumbria');
    const guadianaAfter = PI.getBaseBarForDate(dateISO, 'Guadiana');
    assert.equal(cumbriaExc.isException, true);
    assert.equal(cumbriaExc.bar, 60);
    assert.equal(cumbriaExc.eventName, 'Baja Ocupación');
    assert.equal(guadianaAfter.isException, false);
    assert.equal(guadianaAfter.bar, defaultGuadiana.bar);

    // Fallback legacy cuando existe una clave antigua sin prefijo de hotel
    store.capasuite_pricing_exceptions_v1 = JSON.stringify({
        '2026-12-10': { barBase: 55, eventName: 'Legacy' }
    });
    PI.invalidatePricingCache();
    assert.equal(PI.getDateException('2026-12-10', 'Cumbria')?.barBase, 55);
    assert.equal(PI.getBaseBarForDate('2026-12-10', 'Cumbria').bar, 55);

    // Al guardar o borrar para Cumbria, migra/limpia correctamente
    PI.setDateException('2026-12-10', { barBase: 57, eventName: 'Migrada' }, 'Cumbria');
    assert.equal(PI.getBaseBarForDate('2026-12-10', 'Cumbria').bar, 57);
    assert.equal(PI.getBaseBarForDate('2026-12-10', 'Guadiana').isException, false);

    PI.setDateException('2026-12-10', null, 'Cumbria');
    assert.equal(PI.getDateException('2026-12-10', 'Cumbria'), null);
});

test('excepción de 60 € en Cumbria elimina el aviso belowBase y muestra MANTENER', () => {
    const { PI } = loadModules();
    const dateISO = '2026-11-24';

    const beforeRec = PI.evaluateDailyRecommendation({
        hotelName: 'Cumbria',
        dateISO,
        currentPrice: 60,
        marketAvg: 69,
        otbRooms: 26,
        occupancyPct: 44.1,
        capacity: 59
    });
    assert.equal(beforeRec.belowBase, true);
    assert.equal(beforeRec.action, 'REVISAR');

    PI.setDateException(dateISO, { barBase: 60, eventName: 'Baja Ocupación' }, 'Cumbria');

    const afterRec = PI.evaluateDailyRecommendation({
        hotelName: 'Cumbria',
        dateISO,
        currentPrice: 60,
        marketAvg: 69,
        otbRooms: 26,
        occupancyPct: 44.1,
        capacity: 59
    });
    assert.equal(afterRec.belowBase, false);
    assert.equal(afterRec.action, 'MANTENER');
    assert.equal(afterRec.baseBar, 60);
    assert.equal(afterRec.barObjetivo, 60);
    assert.equal(afterRec.isException, true);
    assert.equal(afterRec.triggerText, '📌 Baja Ocupación');
    assert.equal(afterRec.demandStatus, 'EXCEPCIÓN COMERCIAL');
});

test('calculateSmartYield en AnalisisCompetencia.html invalida caché al añadir, modificar o quitar excepción', () => {
    const { PI } = loadModules();
    const html = fs.readFileSync('AnalisisCompetencia.html', 'utf8');
    const startIdx = html.indexOf('        function calculateSmartYield(d, hotel) {');
    const endIdx = html.indexOf('        function setManualPrice(dayIndex, hotelName, newPrice) {');
    assert.ok(startIdx > -1 && endIdx > startIdx, 'Debe localizar calculateSmartYield en AnalisisCompetencia.html');

    const fnSource = html.slice(startIdx, endIdx);
    const ctx = {
        window: { PricingIntelligence: PI },
        PricingIntelligence: PI,
        ensureHotelStructure: () => {},
        getDynamicDateHtml: () => ({ occ: 26, otb: 26, pickup: 4 }),
        getHotelMinPrice: () => 55
    };
    vm.createContext(ctx);
    vm.runInContext(fnSource, ctx);

    const dayRow = {
        dateISO: '2026-11-24',
        compAvg: 69,
        activeCompPrices: [69],
        activeSoldComps: 0,
        hotels: {
            Cumbria: { price: 60, sold: false, otbRooms: 26, occupancy: 26, otbChange: 4 }
        }
    };

    // 1. Sin excepción -> REVISAR / belowBase = true
    const y1 = ctx.calculateSmartYield(dayRow, 'Cumbria');
    assert.equal(y1.belowBase, true);
    assert.equal(y1.action, 'REVISAR');
    assert.equal(y1.cls, 'gap-critical');

    // 2. Sin borrar dayRow._yieldInfo manualmente: guardar excepción debe romper caché por firma
    PI.setDateException('2026-11-24', { barBase: 60, eventName: 'Baja Ocupación' }, 'Cumbria');
    const y2 = ctx.calculateSmartYield(dayRow, 'Cumbria');
    assert.equal(y2.belowBase, false);
    assert.equal(y2.action, 'MANTENER');
    assert.equal(y2.cls, 'gap-ok');
    assert.equal(y2.isException, true);
    assert.equal(y2.baseBar, 60);
    assert.equal(y2.triggerText, '📌 Baja Ocupación');

    // 3. Modificar excepción a 65 € -> recalcula de nuevo inmediatamente
    PI.setDateException('2026-11-24', { barBase: 65, eventName: 'Evento' }, 'Cumbria');
    const y3 = ctx.calculateSmartYield(dayRow, 'Cumbria');
    assert.equal(y3.belowBase, true);
    assert.equal(y3.action, 'SUBIR');
    assert.equal(y3.targetPrice, 65);

    // 4. Eliminar excepción -> vuelve al estado inicial sin excepción
    PI.setDateException('2026-11-24', null, 'Cumbria');
    const y4 = ctx.calculateSmartYield(dayRow, 'Cumbria');
    assert.equal(y4.belowBase, true);
    assert.equal(y4.action, 'REVISAR');
    assert.equal(y4.isException, false);
});

test('captureBatchSnapshots priceOnly no sobrescribe OTB y calculateDailyPickup ignora snapshots sin OTB', () => {
    const { PI } = loadModules();
    const stayDate = '2026-11-24';

    // Captura OTB real el 2026-11-24 (26 habs vendidas, BAR 65)
    PI.recordDailySnapshot('Cumbria', stayDate, { rooms: 26, revenue: 1690, publishedBar: 65 }, new Date('2026-11-24T10:00:00Z'));

    // Snapshot priceOnly del mismo día con BAR actualizada a 60 €
    PI.captureBatchSnapshots('Cumbria', {
        [stayDate]: { price: 60, compPrice: 69, priceOnly: true }
    }, new Date('2026-11-24T14:00:00Z'));

    // Snapshot priceOnly de otro día (sin OTB previa)
    PI.captureBatchSnapshots('Cumbria', {
        '2026-11-25': { price: 62, compPrice: 70, priceOnly: true }
    }, new Date('2026-11-24T14:00:00Z'));

    // Snapshot OTB previo (hace 7 días) + snapshot priceOnly intermedio (hace 3 días)
    PI.recordDailySnapshot('Cumbria', stayDate, { rooms: 8, revenue: 520, publishedBar: 65 }, new Date('2026-11-17T10:00:00Z'));
    PI.captureBatchSnapshots('Cumbria', {
        [stayDate]: { price: 63, compPrice: 69, priceOnly: true }
    }, new Date('2026-11-21T10:00:00Z'));

    const db = PI.getSnapshotsDB();
    const list = db.Cumbria[stayDate];
    const snap24 = list.find(s => s.captureDate === '2026-11-24');
    const snap21 = list.find(s => s.captureDate === '2026-11-21');
    const snap25 = db.Cumbria['2026-11-25'][0];

    assert.equal(snap24.rooms, 26, 'No debe sobrescribir las 26 habitaciones confirmadas');
    assert.equal(snap24.publishedBar, 60, 'Debe actualizar la BAR publicada a 60 €');
    assert.equal(snap21.rooms, null, 'Snapshot solo-precio debe conservar rooms = null');
    assert.equal(snap21.publishedBar, 63);
    assert.equal(snap25.rooms, null);
    assert.equal(snap25.publishedBar, 62);

    // Pickup 7d debe usar el snapshot de hace 7d (8 habs -> 26 habs = +18 RN) e ignorar el de 3d (r: null)
    const pickup = PI.calculateDailyPickup('Cumbria', stayDate, { rooms: 26, occupancyPct: 44.1 }, new Date('2026-11-24T16:00:00Z'));
    assert.equal(pickup.snapshotsCount, 2);
    assert.equal(pickup.d7.available, true);
    assert.equal(pickup.d7.diffRooms, 18);
    assert.equal(pickup.d3.available, false);
});

test('_buildVariationChipsData muestra precio de venta en cambios de RN, cambios de BAR en +0 RN y omite falsos deltas con r:null', () => {
    const { UI } = loadModules();

    const snaps = [
        { captureDate: '2026-11-05', rooms: 12, revenue: 780, adr: 65, publishedBar: 65, compPrice: 72 },
        { captureDate: '2026-11-06', rooms: 16, revenue: 1040, adr: 65, publishedBar: 65, compPrice: 72 }, // +4 RN a BAR 65€
        { captureDate: '2026-11-08', rooms: 16, revenue: 1040, adr: 65, publishedBar: 63, compPrice: 70 }, // +0 RN con cambio BAR 65→63€
        { captureDate: '2026-11-10', rooms: null, revenue: 0, adr: 0, publishedBar: 61, compPrice: 70 },   // solo precio BAR 63→61€ (sin falso delta RN)
        { captureDate: '2026-11-17', rooms: 20, revenue: 1284, adr: 64.2, publishedBar: 61, compPrice: 69 }, // +4 RN tras snapshot r:null
        { captureDate: '2026-11-19', rooms: 21, revenue: 1344, adr: 64, publishedBar: 60, compPrice: 69 }, // +1 RN con cambio BAR 61→60€
        { captureDate: '2026-11-20', rooms: 12, revenue: 768, adr: 64, publishedBar: 60, compPrice: 69 }   // -9 RN a BAR 60€
    ];

    const chips = UI._buildVariationChipsData(snaps, { currentPrice: 60, compAvg: 69 });
    assert.equal(chips.length, 6);

    assert.equal(chips[0].date, '2026-11-06');
    assert.equal(chips[0].diffRooms, 4);
    assert.ok(chips[0].priceLabel.includes('BAR 65€'));
    assert.ok(chips[0].tooltip.includes('BAR publicada: 65 €'));

    assert.equal(chips[1].date, '2026-11-08');
    assert.equal(chips[1].diffRooms, 0);
    assert.equal(chips[1].hasBarChange, true);
    assert.equal(chips[1].priceLabel, 'BAR 65→63€');

    assert.equal(chips[2].date, '2026-11-10');
    assert.equal(chips[2].isPriceOnly, true);
    assert.equal(chips[2].diffRooms, 0);
    assert.equal(chips[2].hasBarChange, true);
    assert.equal(chips[2].priceLabel, 'BAR 63→61€');

    assert.equal(chips[3].date, '2026-11-17');
    assert.equal(chips[3].diffRooms, 4, 'Debe comparar contra 2026-11-08 (16 habs), no contra r:null');
    assert.ok(chips[3].priceLabel.includes('BAR 61€'));

    assert.equal(chips[4].date, '2026-11-19');
    assert.equal(chips[4].diffRooms, 1);
    assert.ok(chips[4].priceLabel.includes('BAR 61→60€'));

    assert.equal(chips[5].date, '2026-11-20');
    assert.equal(chips[5].diffRooms, -9);
    assert.ok(chips[5].priceLabel.includes('BAR 60€'));
});
