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
// Debe recomendar SUBIR inmediatamente para alinear a BAR base (suelo inviolable).
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
    r5.action === 'SUBIR' && r5.proposedPrice === 66 && r5.triggerText.includes('Alinear a Base (66€)'),
    'Caso 5: BAR vigente (60 €) inferior a BAR base (66 €)',
    `Acción: ${r5.action}, Propuesto: ${r5.proposedPrice} € (Alineado a base), Trigger: ${r5.triggerText}`
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
    r7.action === 'REVISIÓN MANUAL' && r7.triggerText === '100% LLENO' && r7.demandStatus === 'INVENTARIO AGOTADO' && r7.proposedPrice === 120,
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
    r11Custom.action === 'REVISIÓN MANUAL' && r11Custom.proposedPrice === 95 && r11Custom.diffAmount === 0 && r11Custom.triggerText.includes('Competitividad'),
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

console.log('\n================================================================');
console.log(`RESUMEN DE PRUEBAS: ${passedTests}/${totalTests} pruebas superadas (${failedTests} fallos)`);
console.log('================================================================');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
