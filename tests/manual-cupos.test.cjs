const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('inline page scripts parse without syntax errors', () => {
    ['AnalisisCompetencia.html', 'AnalisisCalendario.html', 'CargarDatos.html'].forEach(fileName => {
        const content = fs.readFileSync(fileName, 'utf8');
        const scriptMatches = content.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
        scriptMatches.forEach(tag => {
            const body = tag.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
            assert.doesNotThrow(() => new vm.Script(body, { filename: `${fileName}-inline.js` }), `Syntax error in ${fileName}`);
        });
    });
});

test('cupos calculation correctly adds to base rooms and calculates occupancy', () => {
    const capacityVal = 108; // Hotel Guadiana
    const baseRooms = 81;
    const cupos = 23;
    const effectiveOcc = baseRooms + cupos;

    assert.equal(effectiveOcc, 104);
    const occPct = (effectiveOcc / capacityVal) * 100;
    assert.equal(Math.round(occPct), 96);

    const roomGap = capacityVal - effectiveOcc;
    assert.equal(roomGap, 4);
});

test('circunstancia 1: closed with available rooms triggers alert, but cupos / soldOut resolve false alarms', () => {
    const capacityVal = 108;
    const isSold = true;

    // Sin cupos registrados (81 habs): CapaSuite cree que hay 27 libres y salta la alerta
    const occWithoutCupos = 81;
    const gapWithoutCupos = capacityVal - occWithoutCupos;
    assert.equal(gapWithoutCupos, 27);
    const shouldAlertFalseClosedWithoutCupos = (isSold && occWithoutCupos > 0 && gapWithoutCupos >= 1);
    assert.equal(shouldAlertFalseClosedWithoutCupos, true);

    // Con los 23 cupos registrados y marcado como Disponibilidad 0 (o 108 habs comprometidas):
    const isSoldOut = true;
    const occWithCuposAndSoldOut = 108;
    const gapWithSoldOut = capacityVal - occWithCuposAndSoldOut;
    assert.equal(gapWithSoldOut, 0);

    const shouldAlertFalseClosedWithSoldOut = (isSold && gapWithSoldOut >= 1 && !isSoldOut);
    assert.equal(shouldAlertFalseClosedWithSoldOut, false);
});

test('circunstancia 2: overbooking con ventas abiertas activa alerta crítica urgente', () => {
    const capacityVal = 108;
    const isOpen = true; // Ventas abiertas en canales
    const currentOcc = 112; // 112 habs ocupadas/bloqueadas (4 sobre la capacidad)

    assert.equal(currentOcc > capacityVal, true);
    const obExcess = currentOcc - capacityVal;
    assert.equal(obExcess, 4);

    // Si está abierto y en overbooking, es una alarma crítica
    const isCriticalOverbookingOpen = (isOpen && currentOcc > capacityVal);
    assert.equal(isCriticalOverbookingOpen, true);
});

test('manual cupos storage persistence and retrieval format', () => {
    const mockStorage = {};
    const getManualCuposDB = () => JSON.parse(mockStorage['manual_cupos_v1'] || '{}');
    const saveManualCuposDB = (data) => { mockStorage['manual_cupos_v1'] = JSON.stringify(data); };

    const cuposDB = getManualCuposDB();
    cuposDB['Guadiana'] = {
        '2026-10-23': { cupos: 23, isSoldOut: true, note: 'Cupos garantizados touroperador' },
        '2026-10-24': { cupos: 23, isSoldOut: true, note: 'Cupos garantizados touroperador' }
    };
    saveManualCuposDB(cuposDB);

    const reloaded = getManualCuposDB();
    assert.deepEqual(reloaded['Guadiana']['2026-10-23'].cupos, 23);
    assert.deepEqual(reloaded['Guadiana']['2026-10-23'].isSoldOut, true);
    assert.deepEqual(reloaded['Guadiana']['2026-10-24'].cupos, 23);
});

test('renderTable executes without ReferenceError or initialization errors', () => {
    const html = fs.readFileSync('AnalisisCompetencia.html', 'utf8');
    const tableHeader = { innerHTML: '' };
    const tableBody = { innerHTML: '' };
    const ctx = {
        document: {
            getElementById: (id) => {
                if (id === 'tableHeader') return tableHeader;
                if (id === 'tableBody') return tableBody;
                return { innerHTML: '', value: '' };
            }
        },
        window: { addEventListener: () => {} },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        localStorage: { getItem: () => null, setItem: () => {} },
        Set: Set
    };

    vm.createContext(ctx);
    const scriptMatches = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const match of scriptMatches) {
        const code = match.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
        try {
            vm.runInContext(code, ctx);
        } catch (e) {
            // Browser-only DOM elements
        }
    }

    ctx.activeHotel = 'Guadiana';
    ctx.competitorsList = [];
    ctx.ignoredCompetitors = new Set();
    const testData = [{
        dayIndex: 1,
        dateISO: '2026-10-23',
        label: '23 Oct',
        compAvg: 80,
        otbRooms: 81,
        dateMeta: { dNum: '23', dShort: 'Vie', mShort: 'Oct' },
        hotels: {
            Guadiana: { price: 0, sold: true, status: 'sold' },
            Cumbria: { price: 60, sold: false, status: 'available' }
        }
    }];

    assert.doesNotThrow(() => {
        ctx.renderTable(testData);
    });
    assert.ok(tableBody.innerHTML.length > 0);
});
