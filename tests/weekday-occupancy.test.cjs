const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../AnalisisProduccion.html'), 'utf8');

function mockElements() {
    const values = {};
    return {
        values,
        getElementById(id) {
            return values[id] ||= { style: {}, innerHTML: '', innerText: '', value: '' };
        }
    };
}

test('AnalisisProduccion.html contains weekday occupancy table, summary tranches and cutoff banner', () => {
    // 1. Check HTML elements
    assert.match(html, /id="weekday-occupancy-table"/);
    assert.match(html, /id="weekday-summary-cards"/);
    assert.match(html, /id="weekday-cutoff-banner"/);
    assert.match(html, /id="weekday-heatmap"/);

    // 2. Check CSS classes
    assert.match(html, /\.weekday-occ-table/);
    assert.match(html, /\.weekday-tranches-grid/);
    assert.match(html, /\.weekday-tranche-card/);

    // 3. Check table columns
    assert.match(html, /<th>Día de la Semana<\/th>/);
    assert.match(html, /<th>Días con Datos Reales<\/th>/);
    assert.match(html, /<th>Hab\.-Noche Vendidas<\/th>/);
    assert.match(html, /<th>Hab\.-Noche Disponibles<\/th>/);
    assert.match(html, /<th>Ocupación Media<\/th>/);
    assert.match(html, /<th>Días sin Datos<\/th>/);

    // 4. Check OTB separation note
    assert.match(html, /Previsión OTB excluida/);
});

test('Guadiana weekday occupancy uses weighted formula (sum sold / sum avail * 100) and includes zero sales days while excluding missing days', () => {
    const heatmapCode = html.slice(html.indexOf('        function renderHeatmap()'), html.lastIndexOf('</script>'));
    const document = mockElements();
    document.getElementById('heatmapMetricSelector').value = 'rn';
    // Select month 9 (October 2026: 31 days)
    document.getElementById('monthSelector').value = '9';

    // October 2026 has:
    // Mondays: Oct 5, Oct 12, Oct 19, Oct 26 (4 Mondays)
    // Tuesdays: Oct 6, Oct 13, Oct 20, Oct 27 (4 Tuesdays)
    // We load:
    // Oct 5 (Mon): 50 rooms sold
    // Oct 12 (Mon): 0 rooms sold (cero ventas cargado!)
    // (Oct 19 & Oct 26 are missing / without data)
    // Oct 6 (Tue): 80 rooms sold
    // Oct 13 (Tue): 100 rooms sold
    // Guadiana base capacity: 108 rooms.
    const mockDb = {
        Guadiana: {
            '2026': {
                daily: {
                    '2026-10-05': { rooms: 50, revenue: 4000 },
                    '2026-10-12': { rooms: 0, revenue: 0 }, // 0 sales day loaded!
                    '2026-10-06': { rooms: 80, revenue: 6400 },
                    '2026-10-13': { rooms: 100, revenue: 8000 }
                },
                updates: { prod: '15/10/2026 14:00' }
            }
        }
    };

    const context = vm.createContext({
        document,
        currentHotel: 'Guadiana',
        currentYear: '2026',
        HOTELS: { Guadiana: { rooms: 108 } },
        db: mockDb,
        fmt: (n) => `${n} €`,
        fmtNum: (n) => String(n)
    });

    vm.runInContext(heatmapCode, context);
    vm.runInContext('renderHeatmap()', context);

    const tableHtml = document.getElementById('weekday-occupancy-table').innerHTML;
    const bannerHtml = document.getElementById('weekday-cutoff-banner').innerHTML;

    // 1. Monday verification:
    // Real days = 2 (Oct 5 + Oct 12), missing days = 2 (Oct 19, Oct 26)
    // Rooms sold = 50 + 0 = 50
    // Rooms available = 108 + 108 = 216
    // Occupancy = (50 / 216) * 100 = 23.1%
    assert.match(tableHtml, /<b>Lunes<\/b>[\s\S]*?2 <span[^>]*>\(1 con 0 vtas\)<\/span>[\s\S]*?<b>50<\/b> hab\.[\s\S]*?216 hab\.[\s\S]*?23\.1%/);

    // 2. Tuesday verification:
    // Real days = 2 (Oct 6 + Oct 13), missing days = 2 (Oct 20, Oct 27)
    // Rooms sold = 80 + 100 = 180
    // Rooms available = 108 + 108 = 216
    // Occupancy = (180 / 216) * 100 = 83.3%
    assert.match(tableHtml, /<b>Martes<\/b>[\s\S]*?2[\s\S]*?<b>180<\/b> hab\.[\s\S]*?216 hab\.[\s\S]*?83\.3%/);

    // 3. Tranche Lunes–Jueves verification:
    // Real days = 2 (Mon) + 2 (Tue) = 4 days
    // Total sold = 50 + 180 = 230
    // Total available = 216 + 216 = 432
    // Weighted Occupancy = (230 / 432) * 100 = 53.2%
    // Note: simple average of (23.15 + 83.33) / 2 would be 53.24%, but weighted formula ensures sum(sold)/sum(avail).
    const summaryHtml = document.getElementById('weekday-summary-cards').innerHTML;
    assert.match(summaryHtml, /Lunes – Jueves[\s\S]*?53\.2%/);
    assert.match(summaryHtml, /<b>230<\/b> vendidas \/ <b>432<\/b> disp\./);

    // 4. Banner verification: Cutoff date and OTB exclusion
    assert.match(bannerHtml, /15\/10\/2026 14:00/);
    assert.match(bannerHtml, /Previsión OTB excluida/);
    assert.match(bannerHtml, /4 de 31 días/);
});

test('Cumbria weekday occupancy discounts out-of-order rooms and shows limitation when inventory is missing', () => {
    const heatmapCode = html.slice(html.indexOf('        function renderHeatmap()'), html.lastIndexOf('</script>'));
    const document = mockElements();
    document.getElementById('heatmapMetricSelector').value = 'rn';
    document.getElementById('monthSelector').value = '9'; // October 2026

    // Cumbria base capacity: 59 rooms.
    // Friday Oct 2: 40 sold, 0 out of order -> 59 avail.
    // Saturday Oct 3: 50 sold, 2 out of order -> 57 avail.
    const mockDb = {
        Cumbria: {
            '2026': {
                daily: {
                    '2026-10-02': { rooms: 40, revenue: 3200 },
                    '2026-10-03': { rooms: 50, revenue: 4500, out_of_order: 2 }
                },
                updates: { prod: '04/10/2026' }
            }
        }
    };

    const context = vm.createContext({
        document,
        currentHotel: 'Cumbria',
        currentYear: '2026',
        HOTELS: { Cumbria: { rooms: 59 } },
        db: mockDb,
        fmt: (n) => `${n} €`,
        fmtNum: (n) => String(n)
    });

    vm.runInContext(heatmapCode, context);
    vm.runInContext('renderHeatmap()', context);

    const tableHtml = document.getElementById('weekday-occupancy-table').innerHTML;
    const summaryHtml = document.getElementById('weekday-summary-cards').innerHTML;

    // Friday: 40 sold / 59 avail = 67.8%
    assert.match(tableHtml, /<b>Viernes<\/b>[\s\S]*?<b>40<\/b> hab\.[\s\S]*?59 hab\.[\s\S]*?67\.8%/);

    // Saturday: 50 sold / 57 avail (59 - 2 out of order) = 87.7%
    assert.match(tableHtml, /<b>Sábado<\/b>[\s\S]*?<b>50<\/b> hab\.[\s\S]*?57 hab\.[\s\S]*?87\.7%/);

    // Tranche Viernes–Sábado:
    // Sold = 40 + 50 = 90
    // Avail = 59 + 57 = 116
    // Weighted Occupancy = (90 / 116) * 100 = 77.6% (77.586%)
    // (Notice simple average would be (67.8 + 87.7) / 2 = 77.75%)
    assert.match(summaryHtml, /Viernes – Sábado[\s\S]*?77\.6%/);
    assert.match(summaryHtml, /<b>90<\/b> vendidas \/ <b>116<\/b> disp\./);

    // Test missing inventory limitation (HOTELS capacity 0):
    const contextNoInv = vm.createContext({
        document: mockElements(),
        currentHotel: 'Cumbria',
        currentYear: '2026',
        HOTELS: { Cumbria: { rooms: 0 } },
        db: mockDb,
        fmt: (n) => `${n} €`,
        fmtNum: (n) => String(n)
    });
    vm.runInContext(heatmapCode, contextNoInv);
    vm.runInContext('renderHeatmap()', contextNoInv);
    const tableNoInvHtml = contextNoInv.document.getElementById('weekday-occupancy-table').innerHTML;
    assert.match(tableNoInvHtml, /N\/D/);
});

test('Re-importing production data in CargarDatos clears month prefix to prevent room duplication', () => {
    const cargarDatosHtml = fs.readFileSync(path.join(__dirname, '../CargarDatos.html'), 'utf8');

    // Verify clearExistingMonthData deletes keys starting with prefix before parsing
    assert.match(cargarDatosHtml, /if \(dbYear\.daily\) \{[\s\S]*?const prefix = `\$\{reportYear\}-\$\{String\(mIdx \+ 1\)\.padStart\(2, '0'\)\}`;[\s\S]*?delete dbYear\.daily\[k\];/);

    // Verify daily entry assignment overwrites by ISO key
    assert.match(cargarDatosHtml, /dbYear\.daily\[iso\]\s*=\s*\{\s*rooms:\s*rms,\s*revenue:\s*dailyRev\s*\};/);
});
