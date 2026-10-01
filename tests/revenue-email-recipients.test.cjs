const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../AnalisisCompetencia.html'), 'utf8');

function setupEnvironment() {
    const storage = {};
    const context = {
        activeHotel: 'Guadiana',
        CapaStorage: {
            getItem: k => storage[k] || null,
            setItem: (k, v) => { storage[k] = v; }
        },
        document: {
            getElementById: () => null
        },
        console: { log: () => {}, warn: () => {}, error: () => {} }
    };

    vm.createContext(context);

    // Extract formatSpanishDate
    const startFmt = html.indexOf('        function formatSpanishDate(');
    const endFmt = html.indexOf('\n        function getModifiedRatesReport(');
    assert.ok(startFmt !== -1 && endFmt !== -1, 'Could not find formatSpanishDate in HTML');
    vm.runInContext(html.slice(startFmt, endFmt), context);

    // Extract DEFAULT_HOTEL_EMAIL_CONFIG, getHotelEmailConfig, saveCurrentHotelEmailConfig
    const startConf = html.indexOf('        const DEFAULT_HOTEL_EMAIL_CONFIG =');
    const endConf = html.indexOf('\n        function openEmailRevenueModal(');
    assert.ok(startConf !== -1 && endConf !== -1, 'Could not find email config in HTML');
    vm.runInContext(html.slice(startConf, endConf), context);

    const startHtml = html.indexOf('        function generateRevenueEmailHtml(');
    const endHtml = html.indexOf('\n        function generateRevenueEmailPlainText(');
    assert.ok(startHtml !== -1 && endHtml !== -1, 'Could not find generateRevenueEmailHtml in HTML');
    vm.runInContext(html.slice(startHtml, endHtml), context);

    // Extract countModifiedPrices, countSavedManualPrices, getHotelModificationsSummary
    const startCounts = html.indexOf('        function countModifiedPrices(');
    const endCounts = html.indexOf('\n        function resetAllManualPrices(');
    if (startCounts !== -1 && endCounts !== -1) {
        vm.runInContext(html.slice(startCounts, endCounts), context);
    }

    const startPlain = html.indexOf('        function generateRevenueEmailPlainText(');
    const endPlain = html.indexOf('\n        function sendRevenueEmailViaMailto(');
    assert.ok(startPlain !== -1 && endPlain !== -1, 'Could not find generateRevenueEmailPlainText in HTML');
    vm.runInContext(html.slice(startPlain, endPlain), context);

    return { context, storage };
}

test('distinguishes email recipients and branding between Guadiana and Cumbria', () => {
    const { context } = setupEnvironment();

    const guadianaConfig = context.getHotelEmailConfig('Guadiana');
    const cumbriaConfig = context.getHotelEmailConfig('Cumbria');

    // Guadiana is Sercotel RM (Mihail Stavila)
    assert.equal(guadianaConfig.to, 'mstavila@sercotel.com');
    assert.equal(guadianaConfig.name, 'Mihail Stavila');
    assert.equal(guadianaConfig.badge, 'SERCOTEL RM');
    assert.match(guadianaConfig.salutation, /Mihail/);
    assert.match(guadianaConfig.signoff, /Sercotel/);

    // Cumbria is Cumbria RM (distinct from Guadiana)
    assert.notEqual(cumbriaConfig.badge, guadianaConfig.badge);
    assert.notEqual(cumbriaConfig.to, guadianaConfig.to);
    assert.notEqual(cumbriaConfig.org, guadianaConfig.org);
    assert.match(cumbriaConfig.org, /Cumbria/);
    assert.match(cumbriaConfig.signoff, /Cumbria/);
    assert.doesNotMatch(cumbriaConfig.signoff, /Sercotel/);
});

test('per-hotel custom recipient saves and persists independently', () => {
    const { context, storage } = setupEnvironment();

    // User saves custom email for Cumbria
    storage.revenue_email_recipients_v2 = JSON.stringify({
        Cumbria: {
            to: 'direccion@cumbriahotel.es',
            cc: 'administracion@cumbriahotel.es',
            name: 'Dirección Cumbria'
        }
    });

    const cumbria = context.getHotelEmailConfig('Cumbria');
    const guadiana = context.getHotelEmailConfig('Guadiana');

    assert.equal(cumbria.to, 'direccion@cumbriahotel.es');
    assert.equal(cumbria.cc, 'administracion@cumbriahotel.es');
    assert.equal(cumbria.name, 'Dirección Cumbria');

    // Guadiana remains untouched with its Sercotel recipient
    assert.equal(guadiana.to, 'mstavila@sercotel.com');
    assert.equal(guadiana.name, 'Mihail Stavila');
});

test('generateRevenueEmailPlainText customizes greeting and signoff by hotel', () => {
    const { context } = setupEnvironment();

    const sampleReportGuadiana = {
        hotel: 'Guadiana', count: 1, avgOld: 70, avgNew: 80, avgDelta: 10, avgDeltaPct: 14.3,
        items: []
    };
    const sampleReportCumbria = {
        hotel: 'Cumbria', count: 1, avgOld: 60, avgNew: 65, avgDelta: 5, avgDeltaPct: 8.3,
        items: []
    };

    const textGuadiana = context.generateRevenueEmailPlainText(sampleReportGuadiana, '');
    const textCumbria = context.generateRevenueEmailPlainText(sampleReportCumbria, '');

    assert.match(textGuadiana, /Hola Mihail/);
    assert.match(textGuadiana, /Hotel Guadiana - Sercotel|Hotel Guadiana · Sercotel/);

    assert.match(textCumbria, /Estimados|Hola/);
    assert.match(textCumbria, /Hotel Cumbria/);
    assert.doesNotMatch(textCumbria, /Mihail/);
    assert.doesNotMatch(textCumbria, /Sercotel/);
});

test('email HTML uses 100% full width and communicates changes made today without "propuesta"', () => {
    const { context } = setupEnvironment();

    const sampleReport = {
        hotel: 'Cumbria',
        count: 6,
        avgOld: 65.17,
        avgNew: 76.00,
        avgDelta: 10.83,
        avgDeltaPct: 16.6,
        items: [
            {
                dateDisplay: '02/10/2026',
                dayName: 'viernes',
                rooms: 20,
                capacity: 50,
                occPct: 40,
                oldPrice: 65.17,
                newPrice: 76.00,
                delta: 10.83,
                marketAvg: 75,
                actionText: 'Ajuste demanda',
                competitors: [{ name: 'Exe Doña Carlota', price: '75€' }]
            }
        ]
    };

    const htmlOutput = context.generateRevenueEmailHtml(sampleReport, '');
    const plainOutput = context.generateRevenueEmailPlainText(sampleReport, '');

    // Full width verification: must have width 100%, and must NOT constrain to 780px
    assert.match(htmlOutput, /width:\s*100%/);
    assert.match(htmlOutput, /width="100%"/);
    assert.doesNotMatch(htmlOutput, /width="780"/);
    assert.doesNotMatch(htmlOutput, /max-width:\s*780px/);

    // Communicates changes made today, no "propuesta"
    assert.match(htmlOutput, /Cambios de Tarifas Realizados Hoy/);
    assert.match(htmlOutput, /CAMBIOS REALIZADOS/);
    assert.match(htmlOutput, /TARIFA APLICADA/);
    assert.doesNotMatch(htmlOutput, /propuesta/i);

    assert.match(plainOutput, /cambios de tarifas realizados hoy/i);
    assert.match(plainOutput, /RESUMEN DE CAMBIOS EFECTUADOS/);
    assert.match(plainOutput, /Precio medio nuevo aplicado/);
    assert.doesNotMatch(plainOutput, /propuesta/i);
});

test('formatSpanishDate correctly converts various date formats to dd/mm/aaaa', () => {
    const { context } = setupEnvironment();
    const { formatSpanishDate } = context;

    assert.equal(formatSpanishDate('2026-10-02'), '02/10/2026');
    assert.equal(formatSpanishDate('2026-05-09'), '09/05/2026');
    assert.equal(formatSpanishDate('2/10/2026'), '02/10/2026');
    assert.equal(formatSpanishDate('02/10/2026'), '02/10/2026');
    assert.equal(formatSpanishDate('2026-10-02T14:30:00Z'), '02/10/2026');
    assert.equal(formatSpanishDate(''), '');
    assert.equal(formatSpanishDate(null), '');
});

test('email HTML renders hotel branding, clear table headers, and free rooms correctly', () => {
    const { context } = setupEnvironment();

    const sampleReportCumbria = {
        hotel: 'Cumbria',
        count: 6,
        avgOld: 65.17,
        avgNew: 76.00,
        avgDelta: 10.83,
        avgDeltaPct: 16.6,
        items: [
            {
                dateDisplay: '02/10/2026',
                dayName: 'viernes',
                rooms: 20,
                capacity: 50,
                occPct: 40,
                oldPrice: 65.17,
                newPrice: 76.00,
                delta: 10.83,
                marketAvg: 75,
                actionText: 'Ajuste demanda',
                competitors: [{ name: 'Exe Doña Carlota', price: '75€' }]
            }
        ]
    };

    const sampleReportGuadiana = {
        hotel: 'Guadiana',
        count: 3,
        avgOld: 70.00,
        avgNew: 82.00,
        avgDelta: 12.00,
        avgDeltaPct: 17.1,
        items: [
            {
                dateDisplay: '03/10/2026',
                dayName: 'sábado',
                rooms: 45,
                capacity: 50,
                occPct: 90,
                oldPrice: 70.00,
                newPrice: 82.00,
                delta: 12.00,
                marketAvg: 80,
                actionText: 'Alta demanda',
                competitors: [{ name: 'Exe Doña Carlota', price: '80€' }]
            }
        ]
    };

    const htmlCumbria = context.generateRevenueEmailHtml(sampleReportCumbria, '');
    const plainCumbria = context.generateRevenueEmailPlainText(sampleReportCumbria, '');

    const htmlGuadiana = context.generateRevenueEmailHtml(sampleReportGuadiana, '');

    // Cumbria branding
    assert.match(htmlCumbria, /CUMBRIA - REVENUE/);
    assert.doesNotMatch(htmlCumbria, /SERCOTEL - REVENUE MANAGEMENT CENTRAL/);
    assert.match(htmlCumbria, /Cumbria Spa &amp; Hotel|Cumbria Spa & Hotel/);
    assert.doesNotMatch(htmlCumbria, /Sercotel Hotel Group/);

    // Guadiana branding
    assert.match(htmlGuadiana, /SERCOTEL - REVENUE MANAGEMENT CENTRAL/);
    assert.match(htmlGuadiana, /Sercotel Hotel Group/);

    // Free rooms (libres): Cumbria has capacity 50 - 20 rooms = 30 libres
    assert.match(htmlCumbria, /30\s*<span[^>]*>libres<\/span>/i);
    assert.match(plainCumbria, /30 libres/);

    // Guadiana has capacity 50 - 45 rooms = 5 libres
    assert.match(htmlGuadiana, /5\s*<span[^>]*>libres<\/span>/i);

    // Clear / light styling in table headers (no dark #334155 / #1e1b4b)
    assert.match(htmlCumbria, /background:#f1f5f9;\s*color:#1e293b/);
    assert.doesNotMatch(htmlCumbria, /background:#334155/);
    assert.doesNotMatch(htmlCumbria, /background:#1e1b4b/);

    // Header label includes Ocup. / Libres
    assert.match(htmlCumbria, /Ocup\.\s*\/\s*Libres/);

    // Scaled-up typography for generous table cell space
    assert.match(htmlCumbria, /font-size:\s*12px/); // Headers in thead
    assert.match(htmlCumbria, /font-size:\s*13\.5px/); // Date in tbody
    assert.match(htmlCumbria, /font-size:\s*16\.5px/); // New price
    assert.match(htmlCumbria, /16px;\s*font-weight:\s*900/); // Libres number
    assert.match(htmlCumbria, /font-size:\s*13px/); // Competitor prices
    assert.match(htmlCumbria, /font-size:\s*11\.5px/); // Action text & badges
});

test('getHotelModificationsSummary auto-detects the hotel where modifications occurred', () => {
    const { context } = setupEnvironment();
    context.processedData = [
        {
            dayIndex: 1,
            hotels: {
                Cumbria: { price: 80, originalPrice: 65, savedPrice: 80, sold: false, originalSold: false, savedSold: false },
                Guadiana: { price: 70, originalPrice: 70, savedPrice: 70, sold: false, originalSold: false, savedSold: false }
            }
        },
        {
            dayIndex: 2,
            hotels: {
                Cumbria: { price: 95, originalPrice: 80, savedPrice: 95, sold: false, originalSold: false, savedSold: false },
                Guadiana: { price: 75, originalPrice: 75, savedPrice: 75, sold: false, originalSold: false, savedSold: false }
            }
        }
    ];

    // Even if activeHotel is Guadiana, modifications are on Cumbria!
    context.activeHotel = 'Guadiana';
    const summaryCumbria = context.getHotelModificationsSummary();
    assert.equal(summaryCumbria.Cumbria.saved, 2);
    assert.equal(summaryCumbria.Guadiana.saved, 0);
    assert.equal(summaryCumbria.detectedHotel, 'Cumbria');

    // Switch modifications to Guadiana
    context.processedData[0].hotels.Cumbria = { price: 65, originalPrice: 65, savedPrice: 65, sold: false, originalSold: false, savedSold: false };
    context.processedData[1].hotels.Cumbria = { price: 80, originalPrice: 80, savedPrice: 80, sold: false, originalSold: false, savedSold: false };
    context.processedData[0].hotels.Guadiana = { price: 90, originalPrice: 70, savedPrice: 90, sold: false, originalSold: false, savedSold: false };

    context.activeHotel = 'Cumbria';
    const summaryGuadiana = context.getHotelModificationsSummary();
    assert.equal(summaryGuadiana.Guadiana.saved, 1);
    assert.equal(summaryGuadiana.Cumbria.saved, 0);
    assert.equal(summaryGuadiana.detectedHotel, 'Guadiana');
});

test('header and toolbar have zero duplicities for Precios Mínimos and Enviar a Central', () => {
    // 1. In HTML, the table sub-bar statusHtml must NOT have duplicate "Precios mín." button
    const updateDisplayMatch = html.match(/function updateRecordCountDisplay\([^{]*\{([\s\S]*?)\n        \}/);
    assert.ok(updateDisplayMatch, 'updateRecordCountDisplay found');
    const updateDisplayBody = updateDisplayMatch[1];
    assert.doesNotMatch(updateDisplayBody, /Precios mín\./, 'updateRecordCountDisplay should not duplicate Precios mín.');
    assert.doesNotMatch(updateDisplayBody, /openEmailRevenueModal/, 'updateRecordCountDisplay should not duplicate Enviar a Central');

    // 2. Main header has .header-brand and .header-brand-sep
    assert.match(html, /class="header-brand"/);
    assert.match(html, /class="header-brand-sep"/);
});

test('email HTML table centers all price columns and matches Image 2 card and badge styling', () => {
    const { context } = setupEnvironment();

    const sampleReport = {
        hotel: 'Cumbria',
        count: 6,
        avgOld: 65.17,
        avgNew: 76.00,
        avgDelta: 10.83,
        avgDeltaPct: 16.6,
        items: [
            {
                dateDisplay: '02/10/2026',
                dayName: 'viernes',
                rooms: 40,
                capacity: 59,
                occPct: 68,
                oldPrice: 65.17,
                newPrice: 76.00,
                delta: 10.83,
                marketAvg: 80,
                actionText: 'Demanda alta',
                competitors: [
                    { name: 'Hotel Guadiana', price: 'cerrado' },
                    { name: 'Hotel Santa Cecilia', price: 'min 2n' },
                    { name: 'Hotel Silken', price: '85€' }
                ]
            }
        ]
    };

    const htmlOutput = context.generateRevenueEmailHtml(sampleReport, '');

    // 1. 5 KPI cards with 20% width each
    assert.match(htmlOutput, /width="20%"[^>]*>[\s\S]*?&#127976;\s*HOTEL/);
    assert.match(htmlOutput, /Hotel Cumbria/);
    assert.match(htmlOutput, /&#128197;\s*CAMBIOS/);
    assert.match(htmlOutput, /TARIFA ANTERIOR/);
    assert.match(htmlOutput, /&#9989;\s*TARIFA APLICADA/);
    assert.match(htmlOutput, /VARIACI&Oacute;N/);

    // 2. Centered amount headers in thead
    assert.match(htmlOutput, /<th[^>]*color:#475569;\s*text-align:center;[^>]*>Ant\.<\/th>/);
    assert.match(htmlOutput, /<th[^>]*text-align:center;[^>]*>&#9654;\s*NUEVA<\/th>/);
    assert.match(htmlOutput, /<th[^>]*text-align:center;[^>]*>Mercado<\/th>/);

    // 3. Centered price cells in tbody
    assert.match(htmlOutput, /<td[^>]*text-align:center;[^>]*color:#64748b;[^>]*>[\s\S]*?<span style="text-decoration:line-through; font-weight:600; opacity:0.8;">65&euro;<\/span>/);
    assert.match(htmlOutput, /<td[^>]*border:1\.5px solid #818cf8;\s*background:#eef2ff;\s*text-align:center;/);
    assert.match(htmlOutput, /<td[^>]*text-align:center;\s*font-weight:800;\s*color:#4f46e5;\s*font-size:14px;/);

    // 4. Competitor pill badges: CERRADO and MIN 2N
    assert.match(htmlOutput, /<span[^>]*color:#dc2626;[^>]*>CERRADO<\/span>/);
    assert.match(htmlOutput, /<span[^>]*color:#d97706;[^>]*>MIN 2N<\/span>/);
});

test('page layout adapts to full screen width without 1300px limitation', () => {
    const liveHtml = fs.readFileSync(path.join(__dirname, '../AnalisisCompetencia.html'), 'utf8');

    // .container must use 100% width and not constrain to 1300px
    assert.match(liveHtml, /\.container\s*\{[^}]*width:\s*100%;/);
    assert.match(liveHtml, /\.container\s*\{[^}]*max-width:\s*100%;/);
    assert.doesNotMatch(liveHtml, /\.container\s*\{[^}]*max-width:\s*1300px;/);
});




