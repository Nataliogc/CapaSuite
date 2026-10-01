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

    // Extract DEFAULT_HOTEL_EMAIL_CONFIG, getHotelEmailConfig, saveCurrentHotelEmailConfig, generateRevenueEmailPlainText
    const startConf = html.indexOf('        const DEFAULT_HOTEL_EMAIL_CONFIG =');
    const endConf = html.indexOf('\n        function openEmailRevenueModal(');
    assert.ok(startConf !== -1 && endConf !== -1, 'Could not find email config in HTML');
    vm.runInContext(html.slice(startConf, endConf), context);

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
