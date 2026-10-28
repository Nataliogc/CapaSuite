/**
 * Test Suite Integral para Pricing Intelligence Module
 */

const assert = require('assert');
const path = require('path');

// Mock localStorage / CapaStorage en entorno Node
const mockStorage = {};
global.CapaStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = val; }
};

const PricingIntelligence = require('../js/pricing-intelligence.js');

console.log('🧪 INICIANDO TEST SUITE INTEGRAL: PricingIntelligence...\n');

// 1. TEST: Matriz base de precios 2027
console.log('Test 1: Matriz de Precios 2027...');
const matrix = PricingIntelligence.getBarMatrix();
assert.strictEqual(matrix[1][1], 62, 'Enero Lunes debe ser 62€');
assert.strictEqual(matrix[1][2], 64, 'Enero Martes debe ser 64€');
assert.strictEqual(matrix[1][3], 64, 'Enero Miércoles debe ser 64€');
assert.strictEqual(matrix[1][4], 62, 'Enero Jueves debe ser 62€');
assert.strictEqual(matrix[1][5], 70, 'Enero Viernes debe ser 70€');
assert.strictEqual(matrix[1][6], 75, 'Enero Sábado debe ser 75€');
assert.strictEqual(matrix[1][7], 58, 'Enero Domingo debe ser 58€');

// Marzo: L 66, M 68, X 68, J 66, V 73, S 78, D 60
assert.strictEqual(matrix[3][1], 66, 'Marzo Lunes debe ser 66€');
assert.strictEqual(matrix[3][6], 78, 'Marzo Sábado debe ser 78€');
assert.strictEqual(matrix[3][7], 60, 'Marzo Domingo debe ser 60€');

// Abril: L 72, M 74, X 74, J 72, V 78, S 85, D 64
assert.strictEqual(matrix[4][6], 85, 'Abril Sábado debe ser 85€');
console.log('✅ Test 1 Superado: Matriz de Precios 2027 conforme al Excel.');

// 2. TEST: Excepciones de tarifas por fecha
console.log('Test 2: Excepciones de tarifas...');
const testDate = '2027-05-15'; // Sábado de mayo
const normalBar = PricingIntelligence.getBaseBarForDate(testDate);
assert.strictEqual(normalBar.bar, 85, 'Sábado de Mayo default debe ser 85€');
assert.strictEqual(normalBar.isException, false);

PricingIntelligence.setDateException(testDate, { barBase: 120, eventName: 'Feria de Mayo', notes: 'Alta demanda' });
const excBar = PricingIntelligence.getBaseBarForDate(testDate);
assert.strictEqual(excBar.bar, 120, 'Fecha con excepción debe retornar 120€');
assert.strictEqual(excBar.isException, true);
assert.strictEqual(excBar.eventName, 'Feria de Mayo');

// Limpiar excepción
PricingIntelligence.setDateException(testDate, null);
assert.strictEqual(PricingIntelligence.getBaseBarForDate(testDate).isException, false);
console.log('✅ Test 2 Superado: Excepciones de fechas especiales y eventos.');

// 3. TEST: Deduplicación de Snapshots
console.log('Test 3: Deduplicación de Snapshots...');
const stayDate = '2027-03-20';
const hotel = 'Guadiana';

// Registrar snapshot día 1
const d1 = new Date('2027-03-01T10:00:00Z');
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 20, revenue: 1400 }, d1);

// Registrar snapshot MISMO DÍA unas horas más tarde (no debe duplicar la entrada, debe actualizar)
const d1_late = new Date('2027-03-01T18:00:00Z');
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 22, revenue: 1540 }, d1_late);

const db = JSON.parse(mockStorage['daily_otb_snapshots_v1']);
const snaps = db[hotel][stayDate];
assert.strictEqual(snaps.length, 1, 'No debe haber dos snapshots para el mismo día de captura');
assert.strictEqual(snaps[0].rooms, 22, 'Debe haber actualizado a 22 habitaciones');
console.log('✅ Test 3 Superado: Deduplicación de capturas de un mismo día.');

// 4. TEST: Cálculo de Pick-up multi-horizonte (24h, 3d, 7d, 14d, 30d) y manejo de "Sin histórico"
console.log('Test 4: Cálculo de Pick-up multi-horizonte...');
const tHoy = new Date('2027-03-03T12:00:00Z');
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 10, revenue: 600 }, new Date('2027-02-01T12:00:00Z'));
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 15, revenue: 1000 }, new Date('2027-02-17T12:00:00Z'));
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 20, revenue: 1400 }, new Date('2027-02-24T12:00:00Z'));
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 24, revenue: 1680 }, new Date('2027-02-28T12:00:00Z'));
PricingIntelligence.recordDailySnapshot(hotel, stayDate, { rooms: 28, revenue: 1960 }, new Date('2027-03-02T12:00:00Z'));

const pRes = PricingIntelligence.calculateDailyPickup(hotel, stayDate, { rooms: 30, revenue: 2100 }, tHoy);
assert.strictEqual(pRes.h24h.available, true);
assert.strictEqual(pRes.h24h.diffRooms, 2, 'Pickup 24h debe ser 30 - 28 = +2');

assert.strictEqual(pRes.d3.available, true);
assert.strictEqual(pRes.d3.diffRooms, 6, 'Pickup 3d debe ser 30 - 24 = +6');

assert.strictEqual(pRes.d7.available, true);
assert.strictEqual(pRes.d7.diffRooms, 10, 'Pickup 7d debe ser 30 - 20 = +10');

assert.strictEqual(pRes.d14.available, true);
assert.strictEqual(pRes.d14.diffRooms, 15, 'Pickup 14d debe ser 30 - 15 = +15');

assert.strictEqual(pRes.d30.available, true);
assert.strictEqual(pRes.d30.diffRooms, 20, 'Pickup 30d debe ser 30 - 10 = +20');

// Fecha sin histórico previo en DB pero con otbChange (pickup de la última carga/informe)
const pOtbChange = PricingIntelligence.calculateDailyPickup(hotel, '2027-11-21', { rooms: 25, otbChange: 7 }, tHoy);
assert.strictEqual(pOtbChange.h24h.available, true);
assert.strictEqual(pOtbChange.h24h.diffRooms, 7, 'Pickup 24h debe ser +7 desde otbChange');
assert.strictEqual(pOtbChange.h24h.label, '+7 RN');

// Fecha sin histórico previo ni otbChange
const pEmpty = PricingIntelligence.calculateDailyPickup(hotel, '2027-11-20', { rooms: 5 }, tHoy);
assert.strictEqual(pEmpty.h24h.available, false);
assert.strictEqual(pEmpty.h24h.label, 'Sin histórico suficiente');
assert.strictEqual(pEmpty.d7.available, false);
assert.strictEqual(pEmpty.d7.label, 'Sin histórico suficiente');
console.log('✅ Test 4 Superado: Pick-up a 24h, 3d, 7d, 14d y 30d verificado.');

// 5. TEST: Agregación mensual y por día de la semana sin doble conteo
console.log('Test 5: Agregación mensual y semanal sin duplicados...');
const sampleDates = [
    { dateISO: '2027-03-05', otbRooms: 40, compAvg: 80, hotels: { Guadiana: { price: 73 } } }, // Viernes
    { dateISO: '2027-03-12', otbRooms: 50, compAvg: 82, hotels: { Guadiana: { price: 75 } } }, // Viernes
    { dateISO: '2027-03-19', otbRooms: 60, compAvg: 85, hotels: { Guadiana: { price: 78 } } }, // Viernes
    { dateISO: '2027-03-26', otbRooms: 45, compAvg: 80, hotels: { Guadiana: { price: 73 } } }, // Viernes
    { dateISO: '2027-03-05', otbRooms: 40, compAvg: 80, hotels: { Guadiana: { price: 73 } } }, // DUPLICADO (debe ser ignorado)
    { dateISO: '2027-03-06', otbRooms: 70, compAvg: 90, hotels: { Guadiana: { price: 80 } } }  // Sábado
];

const dowAgg = PricingIntelligence.aggregateByDayOfWeek(sampleDates, 3, 'Guadiana');
const viernesAgg = dowAgg.find(d => d.name === 'Viernes');
assert.strictEqual(viernesAgg.count, 4, 'Debe haber exactamente 4 viernes (ignorando el duplicado)');
assert.strictEqual(viernesAgg.avgOtbRooms, Math.round((40 + 50 + 60 + 45) / 4), 'Media de habitaciones correcta');

const monthAgg = PricingIntelligence.aggregateMonthSummary(sampleDates, 3, 'Guadiana');
assert.strictEqual(monthAgg.totalDays, 5, 'Total de días únicos debe ser 5 (4 viernes + 1 sábado)');
assert.strictEqual(monthAgg.totalSoldRooms, 40 + 50 + 60 + 45 + 70, 'Suma de habitaciones sin duplicar');
console.log('✅ Test 5 Superado: Agregaciones libres de doble conteo de inventario.');

// 6. TEST: Motor de Recomendación y Regla de Seguridad
console.log('Test 6: Motor de Recomendación y Reglas de Seguridad...');

// Caso A: Ocupación alta (>85%) -> SUBIR
const recA = PricingIntelligence.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-03-20',
    currentPrice: 78,
    marketAvg: 95,
    otbRooms: 95,
    occupancyPct: 88,
    capacity: 108
});
assert.strictEqual(recA.action, 'SUBIR', 'Ocupación >85% debe recomendar SUBIR');
assert.ok(recA.proposedPrice > 78, 'Precio propuesto debe ser mayor');

// Caso B: Antelación corta (<7 días) y baja ocupación -> Regla de seguridad (MANTENER / Promoción segmentada, NO bajar BAR)
const dCorta = new Date();
dCorta.setDate(dCorta.getDate() + 3);
const isoCorta = dCorta.toISOString().split('T')[0];

const recB = PricingIntelligence.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: isoCorta,
    currentPrice: 66,
    marketAvg: 70,
    otbRooms: 20,
    occupancyPct: 18.5,
    capacity: 108
});
assert.strictEqual(recB.action, 'MANTENER', 'A <7 días con baja ocupación NO debe bajar la BAR general');
assert.ok(recB.reasons.some(r => r.includes('No bajar BAR general')), 'Debe explicar la regla de seguridad');

// Caso C: Overbooking / Lleno (100%) -> REVISIÓN MANUAL
const recC = PricingIntelligence.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-03-20',
    currentPrice: 85,
    otbRooms: 108,
    occupancyPct: 100,
    capacity: 108
});
assert.strictEqual(recC.action, 'REVISIÓN MANUAL', 'Al 100% debe recomendar REVISIÓN MANUAL');

// Caso D: Escalado Enero por ocupación (0-60%: 62€, 61-70%: 70€, etc.)
const recJan = PricingIntelligence.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-01-20',
    currentPrice: 62,
    marketAvg: 68,
    otbRooms: 70,
    occupancyPct: 65, // Tramo 61-70% -> 70€
    capacity: 108
});
assert.strictEqual(recJan.occTierRefPrice, 70, 'Escalado de enero al 65% debe indicar 70€');

console.log('✅ Test 6 Superado: Motor de Recomendación con justificación y reglas de seguridad verificadas.');


    // -------------------------------------------------------------
    // Test 7: Gestión Multi-Hotel, Multi-Año y Multi-Mes (CapaSuite Nativo)
    // -------------------------------------------------------------
    console.log('Test 7: Gestión Multi-Hotel, Multi-Año y Multi-Mes...');
    const mGuadiana27 = PricingIntelligence.getBarMatrix('Guadiana', 2027);
    const mCumbria27 = PricingIntelligence.getBarMatrix('Cumbria', 2027);
    assert.strictEqual(mGuadiana27[1][1], 62, 'Guadiana Enero Lunes debe ser 62');
    assert.strictEqual(mCumbria27[1][1], 59, 'Cumbria Enero Lunes debe ser 59 € (62 - 3)');

    // Comprobación obligatoria: Las 84 combinaciones de Cumbria 2027 deben ser exactamente Guadiana 2027 - 3 €
    for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 7; d++) {
            const gVal = mGuadiana27[m][d];
            const cVal = mCumbria27[m][d];
            assert.strictEqual(cVal, gVal - 3, `Cumbria Mes ${m} Día ${d} (${cVal}€) debe ser exactamente Guadiana (${gVal}€) - 3€`);
        }
    }
    console.log('✅ Verificación 84 BARs: Cumbria 2027 es exactamente Guadiana 2027 - 3 € en todas las celdas.');

    // Test copyBarMatrix con ajuste +5%
    PricingIntelligence.copyBarMatrix('Guadiana', 2027, 'Guadiana', 2029, 5);
    const mGuadiana29 = PricingIntelligence.getBarMatrix('Guadiana', 2029);
    assert.strictEqual(mGuadiana29[1][1], Math.round(62 * 1.05), 'Guadiana 2029 debe tener +5%');

    // Test tiers multi-mes
    const tiersJan = PricingIntelligence.getOccTiers('Guadiana', 2027, 1);
    assert(tiersJan.length === 10, 'Debe haber 10 tramos de ocupación');
    tiersJan[0].price = 65;
    PricingIntelligence.saveOccTiers('Guadiana', 2027, 1, tiersJan);
    const reloadedJan = PricingIntelligence.getOccTiers('Guadiana', 2027, 1);
    assert.strictEqual(reloadedJan[0].price, 65, 'El precio del tramo guardado debe persistir');
    console.log('✅ Test 7 Superado: Gestión Multi-Hotel, Multi-Año y Multi-Mes verificada.');

    // -------------------------------------------------------------
    // Test 8: Caso Real de Clasificación Comercial vs Banda Matemática
    // Lunes 7 de junio de 2027: BAR base: 68€, Precio actual: 80€,
    // Ocupación: 26%, Antelación: 224d, Mercado: 72€ (+11%), sin pickup suficiente
    // -------------------------------------------------------------
    console.log('Test 8: Evaluación comercial vs matemática (Ejemplo real Lunes 7 Junio 2027)...');
    const recReal = PricingIntelligence.evaluateDailyRecommendation({
        hotelName: 'Guadiana',
        dateISO: '2027-06-07',
        currentPrice: 80,
        marketAvg: 72,
        otbRooms: 28,
        occupancyPct: 26,
        capacity: 108,
        pickupData: {
            snapshotsCount: 0,
            h24h: { available: false, diffRooms: 0 },
            d7:   { available: false, diffRooms: 0 }
        }
    });

    assert.strictEqual(recReal.baseBar, 68, 'BAR base debe ser 68 €');
    assert.strictEqual(recReal.currentPrice, 80, 'Precio actual debe ser 80 €');
    assert.strictEqual(recReal.action, 'MANTENER', 'Debe ser MANTENER');
    assert.strictEqual(recReal.triggerText, '⚠️ Pend. Demanda', 'Debe mostrar advertencia de demanda pendiente');
    assert.strictEqual(recReal.demandStatus, 'PENDIENTE DE EVALUACIÓN DE DEMANDA', 'Status debe ser PENDIENTE DE EVALUACIÓN DE DEMANDA');
    assert.strictEqual(recReal.isCommerciallyOptimal, false, 'NO debe indicar que 80 € es óptimo');
    assert.strictEqual(recReal.minRange, 68, 'Suelo comercial recomendado debe ser BAR base (68 €)');
    assert(recReal.maxRange <= 76, 'Techo comercial recomendado no debe exceder 76 €');
    assert.strictEqual(recReal.mathToleranceBand.min, 76, 'Banda matemática inferior ±5% es 76 €');
    assert.strictEqual(recReal.mathToleranceBand.max, 84, 'Banda matemática superior ±5% es 84 €');
    assert.ok(recReal.reasons.some(r => r.includes('PENDIENTE DE EVALUACIÓN DE DEMANDA')), 'Debe incluir justificación explícita de demanda pendiente');
    console.log('✅ Test 8 Superado: Clasificación comercial correcta; no se clasifica como «EN RANGO» por banda matemática.');

console.log('\n============================================================');
console.log('🎉 TODOS LOS TESTS DE PRICING INTELLIGENCE HAN FINALIZADO CON ÉXITO.');
console.log('============================================================\n');
