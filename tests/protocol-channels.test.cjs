const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('getProtocolChannelsDescription distinguishes Guadiana vs Cumbria channels and segments', () => {
    const dashCode = fs.readFileSync('js/segment-dashboard.js', 'utf8');
    const fnDef = dashCode.match(/function getProtocolChannelsDescription[\s\S]*?\n\}/)[0];
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(fnDef, sandbox);
    const desc = sandbox.getProtocolChannelsDescription;

    // Directo Online differentiation
    const guadiOnline = desc('DIRECTO ONLINE', 'Guadiana');
    const cumbriaOnline = desc('DIRECTO ONLINE', 'Cumbria');
    assert.ok(guadiOnline.includes('Roiback') && guadiOnline.includes('SynXis') && guadiOnline.includes('Witbooking'), 'Guadiana has Roiback/SynXis/Witbooking');
    assert.ok(!guadiOnline.includes('SYNERGY'), 'Guadiana does not include Synergy');
    assert.ok(cumbriaOnline.includes('WEB HOTEL') && cumbriaOnline.includes('SYNERGY'), 'Cumbria has Web Hotel/Synergy');
    assert.ok(!cumbriaOnline.includes('Roiback'), 'Cumbria does not include Roiback');

    // Bono Spa differentiation
    const cumbriaBonoSpa = desc('BONO SPA', 'Cumbria');
    const guadiBonoSpa = desc('BONO SPA', 'Guadiana');
    assert.ok(cumbriaBonoSpa.includes('Bono interno propio del Spa'), 'Cumbria Bono Spa is internal spa voucher');
    assert.ok(cumbriaBonoSpa.includes('Cumbria'));
    assert.ok(guadiBonoSpa.includes('No aplica en Guadiana'), 'Guadiana has no Spa');

    // Bono Online differentiation
    const cumbriaBonoOnline = desc('BONO ONLINE', 'Cumbria');
    assert.ok(cumbriaBonoOnline.includes('Cumbria'));

    // Corporativo Lineal differentiation
    const guadiCorp = desc('CORPORATIVO LINEAL', 'Guadiana');
    const cumbriaCorp = desc('CORPORATIVO LINEAL', 'Cumbria');
    assert.ok(guadiCorp.includes('Guadiana'));
    assert.ok(cumbriaCorp.includes('Cumbria'));

    // PARTICULARES and AGENCIAS are historic and no longer active in either hotel
    assert.ok(desc('PARTICULARES', 'Guadiana').includes('DIRECTO OFFLINE'));
    assert.ok(desc('PARTICULARES', 'Cumbria').includes('DIRECTO OFFLINE'));
    assert.ok(desc('AGENCIAS', 'Guadiana').includes('OTA / AAVV'));
    assert.ok(desc('AGENCIAS', 'Cumbria').includes('OTA / AAVV'));
    assert.ok(desc('OTROS', 'Cumbria').includes('no existe en Cumbria'));
});

test('CalculadoraPresupuesto normalizeSegmentDisplayName consolidates legacy segments in both hotels', () => {
    const calcCode = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');
    const fnDef = calcCode.match(/function normalizeSegmentDisplayName[\s\S]*?\n\s{8}\}/)[0];
    const sandbox = { currentHotel: 'Cumbria' };
    vm.createContext(sandbox);
    vm.runInContext(fnDef, sandbox);
    const norm = sandbox.normalizeSegmentDisplayName;

    // Both hotels: PARTICULARES -> DIRECTO OFFLINE, AGENCIAS -> OTA / AAVV
    assert.equal(norm('PARTICULARES', 'Cumbria'), 'DIRECTO OFFLINE');
    assert.equal(norm('PARTICULARES', 'Guadiana'), 'DIRECTO OFFLINE');
    assert.equal(norm('AGENCIAS', 'Cumbria'), 'OTA / AAVV');
    assert.equal(norm('AGENCIAS', 'Guadiana'), 'OTA / AAVV');

    // Cumbria only: OTROS -> BONO ONLINE
    assert.equal(norm('OTROS', 'Cumbria'), 'BONO ONLINE');
    assert.equal(norm('OTROS', 'Guadiana'), 'OTROS');
});

test('CalculadoraPresupuesto Cumbria Bono Spa is treated as complimentary with zero targets', () => {
    const calcCode = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');
    assert.ok(calcCode.includes("if (hotel === 'Cumbria' && s.name === 'BONO SPA') return;"));
    assert.ok(calcCode.includes("isCumbriaBonoSpa"));
    assert.ok(calcCode.includes("segTargetRev = 0;"));
    assert.ok(calcCode.includes("segTargetRN = 0;"));
});
