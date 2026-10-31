/**
 * Test Suite Automatizado para el Motor Revenue de CapaSuite (Fase 6)
 * Valida los 10 casos obligatorios + pruebas de regresión.
 */
const PI = require('../js/pricing-intelligence.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`✅ [PASS] ${testName}`);
        if (details) console.log(`   ${details}`);
    } else {
        failedTests++;
        console.error(`❌ [FAIL] ${testName}`);
        if (details) console.error(`   ${details}`);
    }
}

console.log('================================================================');
console.log('TEST SUITE: MOTOR DE RECOMENDACIONES REVENUE CAPASUITE');
console.log('Hoteles: Sercotel Guadiana (108 habs) & Cumbria Spa & Hotel (59 habs)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// CASO 1: Ocupación baja y pickup positivo
// No debe activar subida automática; debe mantener la tarifa vigente y señalar vigilancia.
// -----------------------------------------------------------------------------
const r1 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2026-11-03', // Martes base 2026 = 66 €
    currentPrice: 80,
    marketAvg: 83,
    otbRooms: 19, // 18%
    occupancyPct: 18,
    otbChange: 5 // +5 RN
});
assert(
    r1.action === 'MANTENER' && r1.proposedPrice === 80 && r1.triggerText.includes('Vigilar'),
    'Caso 1: Ocupación baja (18%) con pickup positivo (+5 RN)',
    `Acción: ${r1.action}, Propuesto: ${r1.proposedPrice} € (Vigente: 80 €), Trigger: ${r1.triggerText}`
);

// -----------------------------------------------------------------------------
// CASO 2: Ocupación alta y pickup nulo
// Debe mantener la tarifa vigente alta y sugerir evaluación a objetivo, sin bajarla.
// -----------------------------------------------------------------------------
const r2 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-04-24', // Sábado 24 abril 2027, base = 85 €
    currentPrice: 124,
    marketAvg: 81,
    otbRooms: 98, // 91% (10 habs libres)
    occupancyPct: 91,
    otbChange: 0 // Pickup nulo
});
assert(
    r2.action === 'MANTENER' && r2.proposedPrice === 124 && r2.triggerText.includes('MANTENER'),
    'Caso 2: Ocupación alta (91%) y pickup nulo (+0 RN)',
    `Acción: ${r2.action}, Propuesto: ${r2.proposedPrice} € (Base: ${r2.baseBar} €, Objetivo: ${r2.barObjetivo} €), Trigger: ${r2.triggerText}`
);

// -----------------------------------------------------------------------------
// CASO 3: Ocupación alta y demanda creciente
// Debe activar subida al objetivo (+53% sobre BAR base 85 € = 130 €) para proteger plazas.
// -----------------------------------------------------------------------------
const r3 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-04-24',
    currentPrice: 124,
    marketAvg: 81,
    otbRooms: 98, // 91% (10 libres)
    occupancyPct: 91,
    otbChange: 2 // +2 RN sobre 10 libres = 20% absorción
});
assert(
    r3.action === 'SUBIR' && r3.proposedPrice === 130 && r3.triggerText.includes('130'),
    'Caso 3: Ocupación alta (91%) y demanda creciente (+2 RN sobre 10 libres)',
    `Acción: ${r3.action}, Propuesto: ${r3.proposedPrice} € (Objetivo: ${r3.barObjetivo} €), Trigger: ${r3.triggerText}`
);

// -----------------------------------------------------------------------------
// CASO 4: BAR vigente superior a BAR objetivo
// Debe proteger la tarifa vigente y no forzar bajadas automáticas.
// -----------------------------------------------------------------------------
const r4 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-05-18', // Martes base 2027 = 70 €
    currentPrice: 85,      // Vigente 85 € > Objetivo 70 €
    marketAvg: 80,
    otbRooms: 30, // 28% (tramo 0-50% objetivo = 70 €)
    occupancyPct: 28,
    otbChange: 0
});
assert(
    r4.action === 'MANTENER' && r4.proposedPrice === 85 && r4.diffAmount === 0,
    'Caso 4: BAR vigente (85 €) superior a BAR objetivo (70 €)',
    `Acción: ${r4.action}, Propuesto: ${r4.proposedPrice} € (Protegido sin bajada), Diff: ${r4.diffAmount} €`
);

// -----------------------------------------------------------------------------
// CASO 5: BAR vigente inferior a BAR base
// Nueva regla: NO mostrar automáticamente SUBIR. Mostrar REVISAR — TARIFA INFERIOR A BAR BASE.
// -----------------------------------------------------------------------------
const r5 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2026-11-04', // Miércoles base 2026 = 66 €
    currentPrice: 60,      // Vigente 60 € < Base 66 €
    marketAvg: 77,
    otbRooms: 18,
    occupancyPct: 17,
    otbChange: 0
});
assert(
    r5.action === 'REVISAR' && r5.proposedPrice === 60 && r5.triggerText.includes('TARIFA INFERIOR A BAR BASE'),
    'Caso 5: BAR vigente (60 €) inferior a BAR base (66 €) -> REVISAR comercialmente',
    `Acción: ${r5.action}, Propuesto: ${r5.proposedPrice} € (Tarifa protegida sin subida automática), Trigger: ${r5.triggerText}`
);

// -----------------------------------------------------------------------------
// CASO 6: Evento especial con tarifa manual
// Debe respetar prioritariamente la tarifa de evento aprobada, sin escalados ordinarios.
// -----------------------------------------------------------------------------
const r6 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-09-15',
    currentPrice: 90,
    marketAvg: 85,
    otbRooms: 50,
    occupancyPct: 46,
    customEvent: { name: 'Congreso Médico Provincial', barBase: 110 }
});
assert(
    r6.action === 'SUBIR' && r6.proposedPrice === 110 && r6.isException === true && r6.triggerText.includes('Evento'),
    'Caso 6: Evento especial con tarifa fijada (110 €) superior a vigente (90 €)',
    `Acción: ${r6.action}, Propuesto: ${r6.proposedPrice} €, Evento: ${r6.eventName}, Trigger: ${r6.triggerText}`
);

// -----------------------------------------------------------------------------
// CASO 7: Inventario agotado (100% ocupación)
// Debe indicar REVISIÓN MANUAL, cerrar canales y no recomendar ventas.
// -----------------------------------------------------------------------------
const r7 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-06-12',
    currentPrice: 120,
    otbRooms: 108, // 100% de 108
    occupancyPct: 100,
    otbChange: 1
});
assert(
    r7.action === 'REVISAR' && r7.triggerText === '100% LLENO' && r7.demandStatus === 'INVENTARIO AGOTADO' && r7.proposedPrice === 120,
    'Caso 7: Inventario agotado (108/108 habs)',
    `Acción: ${r7.action}, Trigger: ${r7.triggerText}, Diagnóstico: ${r7.demandStatus}`
);

// -----------------------------------------------------------------------------
// CASO 8: Datos de pickup incompletos
// Debe marcar información limitada en confianza y justificación sin inventar datos.
// -----------------------------------------------------------------------------
const r8 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-03-10',
    currentPrice: 70,
    otbRooms: 25,
    occupancyPct: 23,
    pickupData: null // Sin snapshots ni histórico
});
assert(
    r8.hasSufficientPickupHistory === false && r8.confidenceScore === 'Media' && r8.reasons.some(r => r.includes('insuficiente') || r.includes('limitada')),
    'Caso 8: Datos de pickup incompletos (sin inventar histórico)',
    `Histórico suficiente: ${r8.hasSufficientPickupHistory}, Confianza: ${r8.confidenceScore}, Razón: ${r8.reasons[0]}`
);

// -----------------------------------------------------------------------------
// CASO 9: Diferencias entre ejercicios 2026 y 2027
// Comprobar que 2026 y 2027 usan sus propias matrices oficiales (ej. Miércoles Nov).
// -----------------------------------------------------------------------------
const base2026 = PI.getBaseBarForDate('2026-11-04', 'Guadiana'); // Mié Nov 2026
const base2027 = PI.getBaseBarForDate('2027-11-03', 'Guadiana'); // Mié Nov 2027
assert(
    base2026.bar === 66 && base2027.bar === 68,
    'Caso 9: Separación de ejercicios (Guadiana Miércoles Noviembre: 2026=66€ vs 2027=68€)',
    `BAR Base 2026-11-04: ${base2026.bar} €, BAR Base 2027-11-03: ${base2027.bar} €`
);

// -----------------------------------------------------------------------------
// CASO 10: Guadiana y Cumbria con comportamientos independientes
// Diferencial estricto de 3 € y capacidades independientes (108 vs 59).
// -----------------------------------------------------------------------------
const baseGuadiana = PI.getBaseBarForDate('2027-04-24', 'Guadiana'); // Sáb Abr 2027
const baseCumbria = PI.getBaseBarForDate('2027-04-24', 'Cumbria');   // Sáb Abr 2027
const rCumbria = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2027-04-24',
    currentPrice: 110,
    otbRooms: 54, // 54 / 59 = 91.5% (tramo 91-95%, objetivo base 82 + 53% = 125 €)
    occupancyPct: 91.5,
    otbChange: 0
});
assert(
    baseGuadiana.bar === 85 && baseCumbria.bar === 82 && (baseGuadiana.bar - baseCumbria.bar === 3) &&
    rCumbria.action === 'MANTENER' && rCumbria.proposedPrice === 110 && rCumbria.barObjetivo === 125,
    'Caso 10: Guadiana vs Cumbria independencia y diferencial estricto de 3 €',
    `Guadiana Base: ${baseGuadiana.bar} €, Cumbria Base: ${baseCumbria.bar} € (Diff: ${baseGuadiana.bar - baseCumbria.bar} €) | Cumbria Objetivo 91%: ${rCumbria.barObjetivo} €`
);

// -----------------------------------------------------------------------------
// CASO 11: Competitividad en tarifa alta con ocupación baja (Paso 8)
// Debe activar REVISIÓN MANUAL por competitividad sin proponer bajada automática.
// -----------------------------------------------------------------------------
const r11 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-02-10', // Antelación cercana
    currentPrice: 95,      // Vigente 95 € (> 25% sobre mercado)
    marketAvg: 70,         // Mercado 70 €
    otbRooms: 20,          // 18.5% ocupación baja
    occupancyPct: 18.5,
    otbChange: 0           // Pickup nulo
});
// Antelación calculada dependerá de fecha actual, forzamos simulación con daysOut corto
const r11Custom = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2026-11-15', // Lead time muy cercano
    currentPrice: 95,
    marketAvg: 70,
    otbRooms: 20,
    occupancyPct: 18.5,
    otbChange: 0
});
assert(
    r11Custom.action === 'REVISAR' && r11Custom.proposedPrice === 95 && r11Custom.diffAmount === 0 && r11Custom.triggerText.includes('Competitividad'),
    'Caso 11: Alerta comercial de competitividad (Tarifa 95€ vs Mercado 70€ con ocupación 18% y pickup nulo)',
    `Acción: ${r11Custom.action}, Propuesto: ${r11Custom.proposedPrice} € (0 bajada automática), Trigger: ${r11Custom.triggerText}`
);

// -----------------------------------------------------------------------------
// PRUEBAS DE REGRESIÓN: Fechas y tarifas no utilizadas durante el desarrollo
// -----------------------------------------------------------------------------
console.log('\n--- PRUEBAS DE REGRESIÓN ADICIONALES ---');

// Regresión 1: Domingo de Agosto 2027 Guadiana (Base 62 €)
const reg1 = PI.getBaseBarForDate('2027-08-15', 'Guadiana');
assert(reg1.bar === 62, 'Regresión 1: Domingo 15 Agosto 2027 Guadiana (Base 62 €)', `Base: ${reg1.bar} €`);

// Regresión 2: Domingo de Agosto 2027 Cumbria (Base 59 € = 62 - 3)
const reg2 = PI.getBaseBarForDate('2027-08-15', 'Cumbria');
assert(reg2.bar === 59, 'Regresión 2: Domingo 15 Agosto 2027 Cumbria (Base 59 €)', `Base: ${reg2.bar} €`);

// Regresión 3: Viernes de Octubre 2027 Guadiana (Base 78 €)
const reg3 = PI.getBaseBarForDate('2027-10-15', 'Guadiana');
assert(reg3.bar === 78, 'Regresión 3: Viernes 15 Octubre 2027 Guadiana (Base 78 €)', `Base: ${reg3.bar} €`);

// Regresión 4: Escalado 65% ocupación en Lunes de Febrero 2027 Guadiana (Base 62 € -> +13% = 70 €)
const reg4 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-02-15',
    currentPrice: 62,
    otbRooms: 70, // 65%
    occupancyPct: 65,
    otbChange: 3
});
assert(
    reg4.action === 'SUBIR' && reg4.proposedPrice === 70 && reg4.barObjetivo === 70,
    'Regresión 4: Tramo 61–70% (+13% sobre base 62 € = 70 €)',
    `Base: ${reg4.baseBar} €, Objetivo: ${reg4.barObjetivo} €, Propuesto: ${reg4.proposedPrice} €`
);

// Regresión 5: Escalado 75% ocupación en Jueves de Enero 2027 Cumbria (Base 59 € -> +21% = 71 €)
const reg5 = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2027-01-21',
    currentPrice: 59,
    otbRooms: 44, // 44 / 59 = 74.5%
    occupancyPct: 74.5,
    otbChange: 2
});
assert(
    reg5.action === 'SUBIR' && reg5.proposedPrice === 71 && reg5.barObjetivo === 71,
    'Regresión 5: Cumbria Tramo 71–80% (+21% sobre base 59 € = 71 €)',
    `Base: ${reg5.baseBar} €, Objetivo: ${reg5.barObjetivo} €, Propuesto: ${reg5.proposedPrice} €`
);

// -----------------------------------------------------------------------------
// PRUEBAS DE INTERPRETACIÓN DE EXPEDIA (8 ESCENARIOS OBLIGATORIOS)
// -----------------------------------------------------------------------------
console.log('\n--- PRUEBAS DE INTERPRETACIÓN DE DATOS DE EXPEDIA (8 ESCENARIOS) ---');

// Escenario 1: Competidor sin tarifa durante un día
// No debe considerarse lleno ni subir tarifa automáticamente; se trata como hipótesis
const exp1 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-02-17', // Miércoles base 2027 = 70 €
    currentPrice: 70,
    marketAvg: 75,
    otbRooms: 20, // 18.5%
    occupancyPct: 18.5,
    soldCompsCount: 1, // 1 competidor sin tarifa en Expedia
    otbChange: 0
});
assert(
    exp1.action === 'MANTENER' && exp1.proposedPrice === 70 &&
    exp1.reasons.some(r => r.includes('Hipótesis comercial') && r.includes('no certifica ocupación')),
    'Escenario Expedia 1: Competidor sin tarifa 1 día (Tratado como hipótesis, sin subida automática)',
    `Acción: ${exp1.action}, Propuesto: ${exp1.proposedPrice} €, Razón OTA: ${exp1.reasons.find(r => r.includes('Hipótesis'))}`
);

// Escenario 2: Competidor sin tarifa durante varios días consecutivos
// Se evalúa como hipótesis de inventario pendiente de carga o cierre de canal
const exp2 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-02-18', // Jueves base 2027 = 68 €
    currentPrice: 68,
    marketAvg: 72,
    otbRooms: 22,
    occupancyPct: 20.3,
    soldCompsCount: 1,
    otbChange: 0
});
assert(
    exp2.action === 'MANTENER' && exp2.proposedPrice === 68 &&
    !exp2.reasons.some(r => r.includes('Lleno técnico') || r.includes('lleno confirmado')),
    'Escenario Expedia 2: Sin tarifa en varios días consecutivos (Hipótesis inventario no cargado)',
    `Acción: ${exp2.action}, Propuesto: ${exp2.proposedPrice} € (Sin inventar 100% de ocupación)`
);

// Escenario 3: Varios competidores sin disponibilidad en Expedia
// Precios de mercado calculados solo con tarifas válidas observables
const exp3 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-03-24', // Miércoles base = 70 €
    currentPrice: 70,
    marketAvg: 82, // Calculado exclusivamente sobre competidores con tarifa válida
    otbRooms: 25,
    occupancyPct: 23,
    soldCompsCount: 3, // 3 competidores sin tarifa
    otbChange: 0
});
assert(
    exp3.action === 'MANTENER' && exp3.proposedPrice === 70 &&
    exp3.reasons.some(r => r.includes('exclusivamente sobre tarifas observadas válidas')),
    'Escenario Expedia 3: Varios competidores sin tarifa (Muestra parcial, media solo con precios válidos)',
    `Acción: ${exp3.action}, Propuesto: ${exp3.proposedPrice} €, Diagnóstico: ${exp3.demandStatus}`
);

// Escenario 4: Competidores con incrementos de precio
// La subida ajena no provoca subida automática si la ocupación propia es baja
const exp4 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-03-16', // Martes base = 70 €
    currentPrice: 70,
    marketAvg: 95, // Competidores suben precios (+25 € sobre nuestro precio)
    otbRooms: 20,  // Ocupación propia baja (18.5%)
    occupancyPct: 18.5,
    otbChange: 0
});
assert(
    exp4.action === 'MANTENER' && exp4.proposedPrice === 70,
    'Escenario Expedia 4: Competidores con subida de precio (No arrastra subida con ocupación baja 18.5%)',
    `Acción: ${exp4.action}, Propuesto: ${exp4.proposedPrice} € (Mercado: 95 €)`
);

// Escenario 5: Guadiana con alta ocupación y mercado sin tarifas
// Guadiana sube por su PROPIA demanda si hay pickup, o mantiene tarifa alta protegida si pickup es nulo
const exp5 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-04-24', // Sábado base = 85 €
    currentPrice: 124,
    marketAvg: 0,         // Mercado sin tarifas visibles en Expedia
    soldCompsCount: 4,     // Todos sin disponibilidad
    otbRooms: 98,          // 91% ocupación propia
    occupancyPct: 91,
    otbChange: 0
});
assert(
    exp5.action === 'MANTENER' && exp5.proposedPrice === 124 && exp5.barObjetivo === 130,
    'Escenario Expedia 5: Guadiana 91% con mercado sin tarifas (Mantiene 124 € y no baja por falta de mercado)',
    `Acción: ${exp5.action}, Propuesto: ${exp5.proposedPrice} € (Base: ${exp5.baseBar} €, Objetivo: ${exp5.barObjetivo} €)`
);

// Escenario 6: Cumbria con baja ocupación y competidores sin disponibilidad
// No se sube precio a Cumbria solo porque la competencia no tenga disponibilidad en Expedia
const exp6 = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2027-02-10', // Miércoles base Cumbria = 61 €
    currentPrice: 61,
    marketAvg: 0,
    soldCompsCount: 3,
    otbRooms: 15,          // 25% ocupación baja (15/59)
    occupancyPct: 25.4,
    otbChange: 0
});
assert(
    exp6.action === 'MANTENER' && exp6.proposedPrice === 61,
    'Escenario Expedia 6: Cumbria 25% ocupación con competidores sin tarifa (Mantiene 61 €)',
    `Acción: ${exp6.action}, Propuesto: ${exp6.proposedPrice} € (Sin subidas ficticias)`
);

// Escenario 7: Datos de competencia incompletos
// Señala la limitación y toma decisión basada en ocupación confirmada OTB y BAR base
const exp7 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-05-12',
    currentPrice: 70,
    marketAvg: 0,
    soldCompsCount: 0,
    otbRooms: 30,
    occupancyPct: 28,
    otbChange: 0
});
assert(
    exp7.action === 'MANTENER' && exp7.proposedPrice === 70 &&
    exp7.reasons.some(r => r.includes('ocupación OTB y BAR base') || r.includes('MANTENER')),
    'Escenario Expedia 7: Datos de competencia incompletos (Decisión fundamentada en OTB y BAR base)',
    `Acción: ${exp7.action}, Propuesto: ${exp7.proposedPrice} €`
);

// Escenario 8: Evento especial con precio elevado y competencia sin disponibilidad
// Se respeta la tarifa especial aprobada sin alteraciones por falta de datos en Expedia
const exp8 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-09-18', // Sábado con evento
    currentPrice: 120,
    marketAvg: 0,
    soldCompsCount: 4,
    otbRooms: 60,
    occupancyPct: 55,
    customEvent: { name: 'Feria Regional', barBase: 135 }
});
assert(
    exp8.action === 'SUBIR' && exp8.proposedPrice === 135 && exp8.isException === true &&
    exp8.triggerText.includes('Alinear a Evento'),
    'Escenario Expedia 8: Evento especial con mercado sin tarifas (Prevalece tarifa de evento 135 €)',
    `Acción: ${exp8.action}, Propuesto: ${exp8.proposedPrice} €, Trigger: ${exp8.triggerText}`
);

// =============================================================================
// PRUEBAS DE VALIDACIÓN: FICHA DE ANÁLISIS REVENUE, PICKUP Y PRESUPUESTO 2027
// 10 Casos de Prueba Obligatorios
// =============================================================================
console.log('\n--- PRUEBAS DE LA FICHA DE ANÁLISIS REVENUE (10 CASOS OBLIGATORIOS) ---');

// 1. Fecha con una sola captura
// No debe inventar curva de evolución; horizontes multidiarios deben indicar 'Sin datos' (diffRooms: null).
const snapDbSingle = {
    Guadiana: {
        '2027-05-10': [
            { captureDate: '2026-10-31', timestamp: Date.now(), rooms: 20, revenue: 1400, adr: 70, occupancyPct: 18.5 }
        ]
    },
    Cumbria: {}
};
PI.saveSnapshotsDB(snapDbSingle);
const pSingle = PI.calculateDailyPickup('Guadiana', '2027-05-10', { rooms: 20, revenue: 1400, adr: 70, occupancyPct: 18.5 });
assert(
    pSingle.snapshotsCount === 1 &&
    pSingle.d7.available === false && pSingle.d7.diffRooms === null && pSingle.d7.label === 'Sin datos' &&
    pSingle.d3.available === false && pSingle.d3.diffRooms === null,
    'Prueba Ficha 1: Fecha con una sola captura (Horizontes multi-día = "Sin datos", diffRooms: null)',
    `Snapshots: ${pSingle.snapshotsCount}, 7d Available: ${pSingle.d7.available}, 7d Label: "${pSingle.d7.label}"`
);

// 2. Fecha con varias capturas y pickup positivo
// Debe reflejar la diferencia real observada entre snapshots comparables.
const snapDbMulti = {
    Guadiana: {
        '2027-06-15': [
            { captureDate: '2026-10-24', timestamp: Date.now() - (7 * 24 * 3600 * 1000), rooms: 30, revenue: 2100, adr: 70, occupancyPct: 27.7 },
            { captureDate: '2026-10-31', timestamp: Date.now(), rooms: 36, revenue: 2592, adr: 72, occupancyPct: 33.3 }
        ]
    },
    Cumbria: {}
};
PI.saveSnapshotsDB(snapDbMulti);
const pMulti = PI.calculateDailyPickup('Guadiana', '2027-06-15', { rooms: 36, revenue: 2592, adr: 72, occupancyPct: 33.3 });
assert(
    pMulti.snapshotsCount === 2 && pMulti.d7.available === true && pMulti.d7.diffRooms === 6 && pMulti.d7.label === '+6 RN' && pMulti.d7.status === 'GROWTH',
    'Prueba Ficha 2: Fecha con varias capturas y pickup positivo (+6 RN en 7d)',
    `Snapshots: ${pMulti.snapshotsCount}, 7d: ${pMulti.d7.label}, Status: ${pMulti.d7.status}`
);

// 3. Fecha con pickup neto cero real
// Debe diferenciar '0 RN' de 'Sin datos' cuando existe una captura comparable sin variación de plazas.
const snapDbZero = {
    Guadiana: {
        '2027-07-20': [
            { captureDate: '2026-10-24', timestamp: Date.now() - (7 * 24 * 3600 * 1000), rooms: 45, revenue: 3150, adr: 70, occupancyPct: 41.6 },
            { captureDate: '2026-10-31', timestamp: Date.now(), rooms: 45, revenue: 3150, adr: 70, occupancyPct: 41.6 }
        ]
    },
    Cumbria: {}
};
PI.saveSnapshotsDB(snapDbZero);
const pZero = PI.calculateDailyPickup('Guadiana', '2027-07-20', { rooms: 45, revenue: 3150, adr: 70, occupancyPct: 41.6 });
assert(
    pZero.d7.available === true && pZero.d7.diffRooms === 0 && pZero.d7.label === '0 RN' && pZero.d7.status === 'STABLE',
    'Prueba Ficha 3: Fecha con pickup neto cero real (Diferenciado de falta de datos: "0 RN")',
    `7d Available: ${pZero.d7.available}, Diff: ${pZero.d7.diffRooms}, Label: "${pZero.d7.label}"`
);

// 4. Fecha con cancelaciones
// Debe reflejar decrementos de reservas observados (pickup negativo) con indicación de cancelaciones.
const snapDbCancel = {
    Guadiana: {
        '2027-08-10': [
            { captureDate: '2026-10-24', timestamp: Date.now() - (7 * 24 * 3600 * 1000), rooms: 50, revenue: 3500, adr: 70, occupancyPct: 46.3 },
            { captureDate: '2026-10-31', timestamp: Date.now(), rooms: 46, revenue: 3220, adr: 70, occupancyPct: 42.6 }
        ]
    },
    Cumbria: {}
};
PI.saveSnapshotsDB(snapDbCancel);
const pCancel = PI.calculateDailyPickup('Guadiana', '2027-08-10', { rooms: 46, revenue: 3220, adr: 70, occupancyPct: 42.6 });
assert(
    pCancel.d7.available === true && pCancel.d7.diffRooms === -4 && pCancel.d7.status === 'CANCELLATION' && pCancel.d7.label.includes('-4 RN'),
    'Prueba Ficha 4: Fecha con cancelaciones (-4 RN en 7d, status: CANCELLATION)',
    `7d: ${pCancel.d7.label}, Status: ${pCancel.d7.status}`
);

// 5. Fecha sin histórico suficiente
// Previsión de demanda no disponible, confianza adaptada y sin afirmar 'pickup débil' por falta de datos.
const rNoHist = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-10-14',
    currentPrice: 70,
    otbRooms: 15,
    occupancyPct: 13.8,
    pickupData: null
});
assert(
    rNoHist.hasSufficientPickupHistory === false &&
    rNoHist.confidenceScore === 'Media' &&
    rNoHist.forecastStatus === 'Previsión no disponible' &&
    rNoHist.reasons.some(r => r.includes('insuficiente')),
    'Prueba Ficha 5: Fecha sin histórico suficiente (Previsión no disponible, confianza Media, sin alertar pickup débil)',
    `Histórico suficiente: ${rNoHist.hasSufficientPickupHistory}, Confianza: ${rNoHist.confidenceScore}, Previsión: ${rNoHist.forecastStatus}`
);

// 6. Evolución económica con datos disponibles
// Snapshots conservan revenue y adr, calculando variaciones económicas entre capturas.
const snapDbEco = {
    Guadiana: {
        '2027-09-25': [
            { captureDate: '2026-10-24', timestamp: Date.now() - (7 * 24 * 3600 * 1000), rooms: 40, revenue: 2800, adr: 70, occupancyPct: 37 },
            { captureDate: '2026-10-31', timestamp: Date.now(), rooms: 45, revenue: 3375, adr: 75, occupancyPct: 41.6 }
        ]
    },
    Cumbria: {}
};
PI.saveSnapshotsDB(snapDbEco);
const pEco = PI.calculateDailyPickup('Guadiana', '2027-09-25', { rooms: 45, revenue: 3375, adr: 75, occupancyPct: 41.6 });
assert(
    pEco.d7.diffRev === 575 && pEco.d7.diffAdr === 5 && pEco.d7.adrPickup === 115,
    'Prueba Ficha 6: Evolución económica (diffRev: +575 €, diffAdr: +5 €, adrPickup: 115 €)',
    `diffRev: ${pEco.d7.diffRev} €, diffAdr: ${pEco.d7.diffAdr} €, adrPickup: ${pEco.d7.adrPickup} €`
);

// 7. Separación entre ambos hoteles
// Validar aislamiento total de snapshots y presupuestos entre Guadiana (108 habs) y Cumbria (59 habs).
const bgtGuadiana = PI.getMonthlyBudget('Guadiana', 2027, 5); // Mayo Guadiana V2
const bgtCumbria = PI.getMonthlyBudget('Cumbria', 2027, 5);   // Mayo Cumbria
assert(
    bgtGuadiana.capacity === 108 && bgtGuadiana.targetRev === 200620 && bgtGuadiana.targetRN === 2445 &&
    bgtCumbria.capacity === 59 && bgtCumbria.targetRev === 107569 && bgtCumbria.targetRN === 1523 &&
    bgtGuadiana.annualTotals.revenue === 1575124.93 && bgtCumbria.annualTotals.revenue === 992145.45,
    'Prueba Ficha 7: Separación estricta entre hoteles y conciliación presupuestaria (Guadiana 1.575.124,93 € vs Cumbria 992.145,45 €)',
    `Guadiana Mayo: ${bgtGuadiana.targetRev} € (${bgtGuadiana.targetRN} RN) | Cumbria Mayo: ${bgtCumbria.targetRev} € (${bgtCumbria.targetRN} RN)`
);

// 8. Ejercicios 2026 y 2027
// Comprobar procedencia de BAR base y ejercicio dinámico en ficha (2026 vs 2027).
const r2026 = PI.evaluateDailyRecommendation({ hotelName: 'Guadiana', dateISO: '2026-11-02', currentPrice: 66, otbRooms: 20 });
const r2027 = PI.evaluateDailyRecommendation({ hotelName: 'Guadiana', dateISO: '2027-11-02', currentPrice: 68, otbRooms: 20 });
assert(
    r2026.year === 2026 && r2026.baseBar === 64 &&
    r2027.year === 2027 && r2027.baseBar === 68 &&
    r2026.budgetContext.year === 2026 && r2027.budgetContext.year === 2027,
    'Prueba Ficha 8: Ejercicios 2026 y 2027 (Lunes Nov 2026 = 64 € vs Martes Nov 2027 = 68 €)',
    `2026 Base: ${r2026.baseBar} € (Año: ${r2026.year}) | 2027 Base: ${r2027.baseBar} € (Año: ${r2027.year})`
);

// 9. Recomendación manual sin cambio de precio
// Si la tarifa recomendada coincide con la vigente o es REVISIÓN MANUAL, diffAmount es 0 y se exige intervención manual.
const rManual = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2026-11-15',
    currentPrice: 95,
    marketAvg: 70,
    otbRooms: 19,
    occupancyPct: 17.5,
    otbChange: 0
});
assert(
    rManual.action === 'REVISAR' && rManual.proposedPrice === 95 && rManual.diffAmount === 0,
    'Prueba Ficha 9: Recomendación manual sin cambio de precio (diffAmount = 0, tarifa protegida en 95 €)',
    `Acción: ${rManual.action}, Propuesto: ${rManual.proposedPrice} €, diffAmount: ${rManual.diffAmount} €`
);

// 10. Correcta conservación de la información entre actualizaciones
// Snapshots registran captureDateTime, publishedBar, availableRooms y persisten sin corrupción.
const testSnapDate = '2027-12-05';
PI.recordDailySnapshot('Guadiana', testSnapDate, { rooms: 40, revenue: 2600, adr: 65, publishedBar: 75 }, new Date('2026-10-31T14:30:00'));
const dbCheck = PI.getSnapshotsDB();
const savedSnaps = dbCheck.Guadiana[testSnapDate];
const latestSaved = savedSnaps ? savedSnaps[savedSnaps.length - 1] : null;
assert(
    latestSaved && latestSaved.rooms === 40 && latestSaved.revenue === 2600 && latestSaved.publishedBar === 75 &&
    latestSaved.availableRooms === (108 - 40) && latestSaved.captureDateTime.includes('2026-10-31'),
    'Prueba Ficha 10: Conservación inmutable de snapshots (rooms, revenue, adr, publishedBar, availableRooms, captureDateTime)',
    `Guardado: ${latestSaved?.captureDateTime}, Hab: ${latestSaved?.rooms}, Libres: ${latestSaved?.availableRooms}, BAR: ${latestSaved?.publishedBar} €`
);

// =========================================================================
// PRUEBAS DE OPTIMIZACIÓN DE FIREBASE Y ALMACENAMIENTO DE SNAPSHOTS (6 CASOS)
// =========================================================================
console.log('\n--- PRUEBAS DE OPTIMIZACIÓN DE FIREBASE Y ALMACENAMIENTO ---');

// 1. Reducción drástica de volumen de datos (> 70% de ahorro frente al esquema verbose)
const verboseMock = {
    captureDate: '2026-10-31',
    captureTime: '12:00:00',
    captureDateTime: '2026-10-31 12:00:00',
    timestamp: 1793444400000,
    rooms: 85,
    revenue: 6800,
    adr: 80.00,
    publishedBar: 95,
    occupancyPct: 78.7,
    availableRooms: 23
};
const compactMock = PI.compactSnapshotEntry(verboseMock);
const verboseBytes = Buffer.byteLength(JSON.stringify(verboseMock), 'utf8');
const compactBytes = Buffer.byteLength(JSON.stringify(compactMock), 'utf8');
const reductionPct = ((verboseBytes - compactBytes) / verboseBytes) * 100;
assert(
    reductionPct >= 70 && compactMock.d === '2026-10-31' && compactMock.r === 85 && compactMock.rev === 6800 && compactMock.bar === 95,
    'Optimización 1: Esquema compacto ahorra > 70% de datos en almacenamiento y red',
    `Verbose: ${verboseBytes} B -> Compacto: ${compactBytes} B (Ahorro: ${reductionPct.toFixed(1)}%)`
);

// 2. Compatibilidad retroactiva total: snapshots antiguos se normalizan sin pérdida de datos
const legacyDB = {
    Guadiana: {
        '2027-06-15': [
            {
                captureDate: '2026-10-01',
                captureTime: '09:00:00',
                captureDateTime: '2026-10-01 09:00:00',
                timestamp: 1790845200000,
                rooms: 35,
                revenue: 2800,
                adr: 80.00,
                publishedBar: 85,
                occupancyPct: 32.4,
                availableRooms: 73
            }
        ]
    },
    Cumbria: {}
};
// Guardamos directamente en storage simulado
PI.saveSnapshotsDB(legacyDB);
const readBack = PI.getSnapshotsDB();
const normSnap = readBack.Guadiana['2027-06-15'][0];
assert(
    normSnap.rooms === 35 && normSnap.revenue === 2800 && normSnap.adr === 80 && normSnap.publishedBar === 85 &&
    normSnap.occupancyPct === 32.4 && normSnap.availableRooms === (108 - 35) && normSnap.captureDate === '2026-10-01',
    'Optimización 2: Compatibilidad retroactiva transparente al leer snapshots en formato anterior',
    `Normalizado: ${normSnap.captureDate}, Hab: ${normSnap.rooms}, Rev: ${normSnap.revenue} €, BAR: ${normSnap.publishedBar} €`
);

// 3. Consolidación diaria intradiaria (múltiples cargas en el mismo día no duplican registros)
const testDateConsol = '2027-07-20';
PI.recordDailySnapshot('Guadiana', testDateConsol, { rooms: 20, revenue: 1500, publishedBar: 75 }, new Date('2026-10-31T08:00:00'));
// Segunda carga en el mismo día a las 18:00 con 22 habs vendidas
PI.recordDailySnapshot('Guadiana', testDateConsol, { rooms: 22, revenue: 1650, publishedBar: 75 }, new Date('2026-10-31T18:00:00'));
const dbConsol = PI.getSnapshotsDB();
const snapsConsol = dbConsol.Guadiana[testDateConsol];
assert(
    snapsConsol.length === 1 && snapsConsol[0].rooms === 22 && snapsConsol[0].revenue === 1650,
    'Optimización 3: Consolidación intradiaria actualiza la captura del día sin duplicar historial',
    `Registros: ${snapsConsol.length}, Habitaciones actualizadas: ${snapsConsol[0].rooms} (última intradiaria)`
);

// 4. Idempotencia y cero escrituras redundantes ante cargas idénticas (prevención de sync churn)
const batchMap = {
    '2027-08-01': { rooms: 50, revenue: 4000, price: 80 },
    '2027-08-02': { rooms: 55, revenue: 4400, price: 80 }
};
const firstBatchCount = PI.captureBatchSnapshots('Guadiana', batchMap, new Date('2026-10-31T10:00:00'));
const dbAfterBatch1 = PI.getSnapshotsDB();
// Segunda carga exactamente con los mismos datos
const secondBatchCount = PI.captureBatchSnapshots('Guadiana', batchMap, new Date('2026-10-31T10:05:00'));
const dbAfterBatch2 = PI.getSnapshotsDB();
assert(
    firstBatchCount === 2 && secondBatchCount === 2 &&
    dbAfterBatch1.Guadiana['2027-08-01'].length === 1 &&
    dbAfterBatch2.Guadiana['2027-08-01'].length === 1 &&
    dbAfterBatch2.Guadiana['2027-08-01'][0].rooms === 50,
    'Optimización 4: Idempotencia en cargas idénticas sin churn ni escrituras duplicadas',
    `Carga 1 procesó ${firstBatchCount} fechas, Carga 2 idempotentemente conservó 1 registro por fecha`
);

// 5. Límite de retención provisional (tope de 90 capturas por fecha de estancia sin desbordamiento)
const testDateRetention = '2027-09-10';
const manySnaps = [];
for (let i = 1; i <= 95; i++) {
    const dayPad = String(i).padStart(3, '0');
    manySnaps.push({
        d: `2026-0${Math.floor(i/30)+1}-${String((i%28)+1).padStart(2, '0')}`,
        r: i,
        rev: i * 80,
        bar: 75
    });
}
const testRetentionDB = PI.getSnapshotsDB();
testRetentionDB.Guadiana[testDateRetention] = manySnaps;
PI.saveSnapshotsDB(testRetentionDB);
const dbRetentionCheck = PI.getSnapshotsDB();
const keptSnaps = dbRetentionCheck.Guadiana[testDateRetention];
assert(
    keptSnaps.length === 90 && keptSnaps[keptSnaps.length - 1].rooms === 95,
    'Optimización 5: Límite de retención conserva exactamente las 90 capturas más recientes en orden',
    `Total capturas: ${keptSnaps.length} (límite 90 respetado, última hab: ${keptSnaps[keptSnaps.length - 1].rooms})`
);

// 6. Independencia multi-hotel estricta en base de snapshots
const testDateIndep = '2027-10-10';
PI.recordDailySnapshot('Guadiana', testDateIndep, { rooms: 54, revenue: 4320 }, new Date('2026-10-31'));
PI.recordDailySnapshot('Cumbria', testDateIndep, { rooms: 45, revenue: 3150 }, new Date('2026-10-31'));
const dbIndep = PI.getSnapshotsDB();
const snapG = dbIndep.Guadiana[testDateIndep][0];
const snapC = dbIndep.Cumbria[testDateIndep][0];
assert(
    snapG.rooms === 54 && snapG.occupancyPct === 50.0 && // 54 / 108 = 50%
    snapC.rooms === 45 && snapC.occupancyPct === 76.3,  // 45 / 59 = 76.27% -> 76.3%
    'Optimización 6: Separación estricta de snapshots y capacidades entre Guadiana (108) y Cumbria (59)',
    `Guadiana: 54 habs = ${snapG.occupancyPct}% (cap 108) | Cumbria: 45 habs = ${snapC.occupancyPct}% (cap 59)`
);

// =========================================================================
// VALIDACIONES OBLIGATORIAS: 10 ESCENARIOS CLAVE EXIGIDOS
// =========================================================================
console.log('\n--- VALIDACIONES OBLIGATORIAS: 10 ESCENARIOS CLAVE ---');

// 1. Cumbria con tarifa inferior a BAR base y ocupación del 32 %: REVISAR, no SUBIR automáticamente
const v1 = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2026-11-02', // Lunes Nov 2026 Cumbria base = 61 €
    currentPrice: 56,      // 56 € < 61 €
    otbRooms: 19,          // 19/59 = 32%
    occupancyPct: 32,
    otbChange: 0
});
assert(
    v1.action === 'REVISAR' && v1.proposedPrice === 56 && v1.diffAmount === 0 && v1.triggerText.includes('TARIFA INFERIOR A BAR BASE'),
    'Validación 1: Cumbria tarifa inferior a base y ocupación 32% -> REVISAR, no SUBIR automáticamente',
    `Acción: ${v1.action}, Propuesto: ${v1.proposedPrice} € (Vigente: 56 €, Base: 61 €), Trigger: ${v1.triggerText}`
);

// 2. Cumbria con ocupación del 63 % y pickup -1: no recomendar subida sin justificación adicional
const v2 = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2026-11-09', // Lunes Cumbria base 61 €, target +13% = 69 €
    currentPrice: 67,
    otbRooms: 37,          // 37/59 = 63%
    occupancyPct: 63,
    otbChange: -1          // Pickup negativo -1 RN
});
assert(
    v2.action === 'MANTENER' && v2.proposedPrice === 67 && v2.diffAmount === 0 && v2.triggerText.includes('Pickup Negativo'),
    'Validación 2: Cumbria ocupación 63% y pickup -1 -> MANTENER 67 € sin subir a 69 €',
    `Acción: ${v2.action}, Propuesto: ${v2.proposedPrice} € (Base: 61 €, Objetivo: 69 €), Trigger: ${v2.triggerText}`
);

// 3. Cumbria con ocupación del 97 % y pickup cero: proteger inventario sin obligar a aplicar el +77 %
const v3 = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2026-11-06', // Viernes Cumbria base 72 €, target +77% = 127 €
    currentPrice: 99,
    otbRooms: 57,          // 57/59 = 97%, 2 libres
    occupancyPct: 97,
    otbChange: 0           // Pickup plano 0 RN
});
assert(
    v3.action === 'MANTENER' && v3.proposedPrice === 99 && v3.diffAmount === 0 && v3.triggerText.includes('REVISAR PROMOCIONES'),
    'Validación 3: Cumbria ocupación 97% y pickup cero -> MANTENER 99 € y REVISAR PROMOCIONES sin cerrar venta',
    `Acción: ${v3.action}, Propuesto: ${v3.proposedPrice} € (Sin auto-subida a +77%), Trigger: ${v3.triggerText}`
);

// 4. Cumbria con ocupación del 51 % y pickup positivo: comprobar el condicionamiento del +5 %
const v4 = PI.evaluateDailyRecommendation({
    hotelName: 'Cumbria',
    dateISO: '2026-11-02', // Lunes Cumbria base 61 €, target +5% = 64 €
    currentPrice: 61,
    otbRooms: 30,          // 30/59 = 51%
    occupancyPct: 51,
    otbChange: 2           // Pickup positivo +2 RN
});
assert(
    v4.action === 'SUBIR' && v4.proposedPrice === 64 && v4.triggerText.includes('+5%'),
    'Validación 4: Cumbria ocupación 51% con pickup positivo -> SUBIR a 64 € (+5% condicionado)',
    `Acción: ${v4.action}, Propuesto: ${v4.proposedPrice} € (Base: 61 € -> Objetivo: 64 €), Trigger: ${v4.triggerText}`
);

// 5. Guadiana con ocupación del 18 % y pickup +5: MANTENER salvo excepción justificada
const v5 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-04-14',
    currentPrice: 80,
    otbRooms: 20,
    occupancyPct: 18.5,
    otbChange: 5
});
assert(
    v5.action === 'MANTENER' && v5.proposedPrice === 80 && v5.diffAmount === 0 && v5.triggerText.includes('Vigilar (+5)'),
    'Validación 5: Guadiana ocupación 18% con pickup +5 RN -> MANTENER tarifa vigente 80 €',
    `Acción: ${v5.action}, Propuesto: ${v5.proposedPrice} € (Diff: 0 €), Trigger: ${v5.triggerText}`
);

// 6. Fecha con BAR vigente superior al objetivo: no recomendar bajada automática
const v6 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-03-10', // Base 66 €, Target 70 €
    currentPrice: 85,      // Vigente 85 € > Objetivo 70 €
    otbRooms: 30,
    occupancyPct: 28,
    otbChange: 0
});
assert(
    v6.action === 'MANTENER' && v6.proposedPrice === 85 && v6.diffAmount === 0,
    'Validación 6: BAR vigente (85 €) superior al objetivo (70 €) -> MANTENER sin bajada automática',
    `Acción: ${v6.action}, Propuesto: ${v6.proposedPrice} € (Tarifa vigente protegida), Diff: ${v6.diffAmount} €`
);

// 7. Fecha con tarifa especial aprobada: respetar la excepción
const v7 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-09-15',
    currentPrice: 90,
    customEvent: { name: 'Congreso Médico Provincial', barBase: 110 }
});
assert(
    v7.action === 'SUBIR' && v7.proposedPrice === 110 && v7.isException === true && v7.triggerText.includes('Alinear a Evento (110€)'),
    'Validación 7: Tarifa especial aprobada (110 €) -> Respetar la excepción prioritariamente',
    `Acción: ${v7.action}, Propuesto: ${v7.proposedPrice} € (Evento: ${v7.eventName}), Trigger: ${v7.triggerText}`
);

// 8. Competidores sin tarifa en Expedia: no generar falsas alertas de hotel completo
const v8 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-05-20',
    currentPrice: 70,
    otbRooms: 20,
    occupancyPct: 18.5,
    soldCompsCount: 2, // 2 competidores sin tarifa observable
    marketAvg: 0
});
assert(
    v8.action === 'MANTENER' && v8.proposedPrice === 70 && v8.reasons.some(r => r.includes('Hipótesis comercial')),
    'Validación 8: Competidores sin tarifa en Expedia -> Tratado como hipótesis comercial, sin falso lleno',
    `Acción: ${v8.action}, Propuesto: ${v8.proposedPrice} €, Competidores sin tarifa: 2`
);

// 9. Histórico insuficiente: no mostrar pickup cero ficticio
const v9 = PI.evaluateDailyRecommendation({
    hotelName: 'Guadiana',
    dateISO: '2027-11-20',
    currentPrice: 68,
    otbRooms: 15,
    pickupData: { snapshotsCount: 0, h24h: { available: false, diffRooms: null } }
});
assert(
    v9.hasSufficientPickupHistory === false && v9.forecastStatus === 'Previsión no disponible' && v9.confidenceScore === 'Media',
    'Validación 9: Histórico insuficiente -> Sin pickup cero ficticio, confianza Media y previsión no disponible',
    `Histórico suficiente: ${v9.hasSufficientPickupHistory}, Previsión: ${v9.forecastStatus}, Confianza: ${v9.confidenceScore}`
);

// 10. Carga repetida de datos OTB: no duplicar snapshots ni escrituras innecesarias
const v10Date = '2027-12-20';
PI.recordDailySnapshot('Cumbria', v10Date, { rooms: 25, revenue: 1750, publishedBar: 70 }, new Date('2026-10-31T09:00:00'));
PI.recordDailySnapshot('Cumbria', v10Date, { rooms: 26, revenue: 1820, publishedBar: 70 }, new Date('2026-10-31T15:00:00'));
const dbV10 = PI.getSnapshotsDB();
const v10List = dbV10.Cumbria[v10Date];
assert(
    v10List.length === 1 && v10List[0].rooms === 26,
    'Validación 10: Carga repetida de OTB en el mismo día -> Consolida captura en 1 registro sin duplicar',
    `Registros para la fecha: ${v10List.length}, Habitaciones actualizadas: ${v10List[0].rooms}`
);

console.log('\n================================================================');
console.log(`RESUMEN DE PRUEBAS: ${passedTests}/${totalTests} pruebas superadas (${failedTests} fallos)`);
console.log('================================================================');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
