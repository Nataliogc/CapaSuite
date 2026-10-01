const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/production-groups.js'), 'utf8'), context);
test('commercial segments are excluded without suppressing billed services', () => {
    for (const name of ['SEG.', 'AGENCIAS', 'CORPORATI', 'TTOO DINA', 'GRUPOS', 'DIRECTO O', 'DIRONLINE', 'OTROS', 'OTA/AAVV', 'PARTICULA', 'GRTANTEO', 'BONO SPA', 'BONO LINE']) {
        assert.equal(context.getGroupID(name), 'OMIT', name);
    }
    assert.equal(context.getGroupID('SPA 10'), 'SPA');
    assert.equal(context.getGroupID('DESAYUNO GRUPO'), 'DESAYUNOS');
    assert.equal(context.getGroupID('HABITACION DOBLE'), 'HABITACION');
    assert.equal(context.getGroupID('VARIOS'), 'VARIOS');
});
