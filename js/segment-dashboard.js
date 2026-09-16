'use strict';
const MONTH_ORDER = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SHORT_MONTHS = MONTH_ORDER.map(m => m.slice(0, 3));
const STORAGE_KEY = 'hotel_manager_db_v2';
const HOTELS = { Guadiana: { rooms: 108 }, Cumbria: { rooms: 59 } };
let historicalDB = {}, forecastDB = {}, segmentDB = {}, currentHotel = 'Guadiana', currentYear = '', currentMetric = 'revenue', charts = {};
let currentMode = 'historical';
let currentSegment = null;
function selectSegment(name) { currentSegment = name; renderDashboard(); }
const el = id => document.getElementById(id);
const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, metric = 'revenue') => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-ES', metric === 'rooms' ? { maximumFractionDigits: 0 } : { style: 'currency', currency: 'EUR', maximumFractionDigits: metric === 'adr' ? 2 : 0 }).format(n);
const pct = n => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 }).format(n);
const delta = (a, b) => a == null || b == null ? '—' : b === 0 ? (a === 0 ? '=' : 'N/A') : `${a >= b ? '+' : ''}${pct((a - b) / Math.abs(b))}`;
function message(text, error = false) { 
    el('import-status').textContent = text; 
    el('import-status').classList.toggle('error', error); 
    if(text) setTimeout(() => message(''), 8000);
}
function buildMonthlyFromForecast(db) {
    const result = {};
    for (const [hotel, hData] of Object.entries(db)) {
        result[hotel] = {};
        for (const [segName, segData] of Object.entries(hData.segment || {})) {
            for (const [iso, daily] of Object.entries(segData.days || {})) {
                const [yyyy, mm, dd] = iso.split('-');
                const year = yyyy;
                const monthIdx = Number(mm) - 1;
                
                result[hotel][year] ||= { segment: {}, coverage: {} };
                const yData = result[hotel][year];
                yData.coverage[monthIdx] ||= [];
                if (!yData.coverage[monthIdx].includes(dd)) yData.coverage[monthIdx].push(dd);

                const seg = yData.segment[segName] ||= { name: segName, revenue: Array(12).fill(0), rooms: Array(12).fill(0), accommodation: Array(12).fill(0), concepts: {} };
                seg.revenue[monthIdx] += daily.revenue || 0;
                seg.rooms[monthIdx] += daily.rooms || 0;
                seg.accommodation[monthIdx] += daily.accommodation || 0;
            }
        }
    }
    return result;
}
function updateMode(triggerRender = true) {
    const selector = el('modeSelector');
    currentMode = selector ? selector.value : 'historical';
    if (currentMode === 'forecast') {
        segmentDB = buildMonthlyFromForecast(forecastDB);
    } else {
        segmentDB = historicalDB;
    }
    const years = Object.keys(segmentDB[currentHotel] || {}).sort().reverse();
    currentYear = years[0] || '';
    if (triggerRender) initControls();
}
function loadData() {
    try {
        historicalDB = JSON.parse(CapaStorage.getItem(STORAGE_KEY) || '{}') || {};
        forecastDB = JSON.parse(CapaStorage.getItem('segment_forecast_v2') || '{}') || {};
        
        let cleaned = false;
        for (const h of Object.keys(historicalDB)) {
            for (const y of Object.keys(historicalDB[h])) {
                if (Number(y) > 2035) {
                    delete historicalDB[h][y];
                    cleaned = true;
                }
            }
        }
        if (cleaned) CapaStorage.setItem(STORAGE_KEY, JSON.stringify(historicalDB));

        const config = JSON.parse(CapaStorage.getItem('upload_config_db_v2') || '{}');
        for (const h of Object.keys(HOTELS)) {
            const rooms = Number(config.options?.['rooms' + h]);
            if (rooms > 0) HOTELS[h].rooms = rooms;
        }
        
        updateMode(false);
        initControls();
    } catch (e) { message('No se han podido leer los datos guardados. ' + e.message, true); }
}
function switchHotel(hotel) {
    currentHotel = hotel; currentYear = ''; currentSegment = null;
    el('hotelLogo').src = hotel === 'Guadiana' ? 'Imagen/logo-guadiana.svg' : 'Imagen/logo-cumbria.svg';
    initControls();
}
function initControls() {
    const years = Object.keys(segmentDB[currentHotel] || {}).filter(y => /^20\d{2}$/.test(y) && SegmentAnalysis.segments(segmentDB[currentHotel][y]).length).sort().reverse();
    if (!years.includes(currentYear)) currentYear = years[0] || '';
    el('yearSelector').innerHTML = years.map(y => `<option>${y}</option>`).join('');
    el('yearSelector').value = currentYear;
    el('upload-section').style.display = currentYear ? 'none' : 'block';
    el('dashboard').style.display = currentYear ? 'flex' : 'none';
    const previous = el('compareSelector').value;
    el('compareSelector').innerHTML = '<option value="">Sin comparación</option>' + years.filter(y => y !== currentYear).map(y => `<option>${y}</option>`).join('');
    el('compareSelector').value = years.includes(previous) && previous !== currentYear ? previous : (years.includes(String(Number(currentYear) - 1)) ? String(Number(currentYear) - 1) : years.find(y => y !== currentYear) || '');
    const savedMonth = el('monthSelector').value;
    const months = SegmentAnalysis.availableMonths(segmentDB[currentHotel]?.[currentYear]);
    el('monthSelector').innerHTML = '<option value="All">Periodo cargado</option>' + months.map(m => `<option value="${m}">${MONTH_ORDER[m]}</option>`).join('');
    el('monthSelector').value = months.includes(Number(savedMonth)) && savedMonth !== '' && savedMonth !== 'All' ? savedMonth : 'All';
    renderDashboard();
}
function updateView() {
    if (currentYear !== el('yearSelector').value) { currentYear = el('yearSelector').value; initControls(); }
    else renderDashboard();
}
function selectMetric(metric) {
    currentMetric = metric;
    document.querySelectorAll('.toggle-btn').forEach(button => { const active = button.id === 'btn-' + metric; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    renderDashboard();
}
async function handleFiles(files) {
    if (!files?.length) return;
    el('loader').style.display = 'block';
    el('import-button').disabled = true;
    message('Leyendo y comprobando los segmentos…');
    const failures = [], successes = [];
    try {
        // Each file is parsed and reconciled before changing its hotel data.
        for (const file of files) {
            try {
                const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null, range: 0, blankrows: true });
                const report = await SegmentReview.read(rows, file.name);
                if (!report) { failures.push(`${file.name}: importación cancelada. No se han guardado cambios.`); continue; }
                const hotel = /guadiana/i.test(file.name) ? 'Guadiana' : /cumbria/i.test(file.name) ? 'Cumbria' : currentHotel;
                if (report.segmentData) {
                    let forecastDB = CapaStorage.getItem('segment_forecast_v2');
                    forecastDB = typeof forecastDB === 'string' ? JSON.parse(forecastDB) : (forecastDB || {});
                    SegmentAnalysis.mergeForecast(forecastDB, hotel, report);
                    CapaStorage.setItem('segment_forecast_v2', JSON.stringify(forecastDB));
                    successes.push(`${file.name}: Previsión OTB importada con éxito (${Object.keys(report.segmentData).length} segmentos).`);
                    currentHotel = hotel;
                } else {
                    const next = JSON.parse(JSON.stringify(segmentDB));
                    const years = SegmentAnalysis.merge(next, hotel, report);
                    CapaStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                    segmentDB = next;
                    currentHotel = hotel; currentYear = years[0];
                    const days = report.years[currentYear].coverage;
                    successes.push(`${file.name}: ${years.join(', ')}. ${Object.values(days).reduce((n, d) => n + d.length, 0)} días en ${currentYear}. Se han sustituido los meses incluidos en el informe.`);
                }
            } catch (e) { failures.push(`${file.name}: ${e.message}`); }
        }
        el('hotelSelector').value = currentHotel;
        el('hotelLogo').src = currentHotel === 'Guadiana' ? 'Imagen/logo-guadiana.svg' : 'Imagen/logo-cumbria.svg';
        initControls();
        message([...successes, ...failures].join('\n'), failures.length > 0);
    } finally { el('loader').style.display = 'none'; el('import-button').disabled = false; el('fileInput').value = ''; }
}
function renderDashboard() {
    const hotelData = segmentDB[currentHotel]?.[currentYear];
    if (!hotelData || !currentYear) return;
    const compareYear = el('compareSelector').value;
    const hotelPrevious = segmentDB[currentHotel]?.[compareYear];
    const months = el('monthSelector').value === 'All' ? SegmentAnalysis.availableMonths(hotelData) : [Number(el('monthSelector').value)];
    const segmentNames = [...new Set([...SegmentAnalysis.segments(hotelData), ...SegmentAnalysis.segments(hotelPrevious)].map(s => s.name))].sort((a, b) => a.localeCompare(b, 'es'));
    if (currentSegment === null || currentSegment && !segmentNames.includes(currentSegment)) currentSegment = SegmentAnalysis.segments(hotelData).slice().sort((a, b) => SegmentAnalysis.sum(b, 'revenue', months) - SegmentAnalysis.sum(a, 'revenue', months))[0]?.name || '';
    el('segmentSelector').replaceChildren(new Option('Todos los segmentos', ''), ...segmentNames.map(name => new Option(name, name)));
    el('segmentSelector').value = currentSegment;
    const scopeName = currentSegment || 'Todos los segmentos';
    const data = SegmentAnalysis.scope(hotelData, currentSegment), previous = SegmentAnalysis.scope(hotelPrevious, currentSegment);
    const comparable = SegmentAnalysis.comparable(data, previous, months);
    const totals = SegmentAnalysis.aggregate(data, months), prior = previous ? SegmentAnalysis.aggregate(previous, months) : null;
    const hotelTotals = SegmentAnalysis.aggregate(hotelData, months), hotelPrior = previous ? SegmentAnalysis.aggregate(hotelPrevious, months) : null;
    const capacity = HOTELS[currentHotel].rooms;
    const revpar = totals.days ? totals.accommodation / (capacity * totals.days) : null;
    const priorRevpar = prior?.days ? prior.accommodation / (capacity * prior.days) : null;
    el('metric-years').textContent = `${scopeName} · ${currentYear}${compareYear ? ' vs ' + compareYear : ''} · ${totals.days == null ? 'Cobertura sin verificar' : totals.days + ' días cargados'}`;
    el('revpar-label').textContent = currentSegment ? 'Aportación al RevPAR del hotel' : 'RevPAR · solo alojamiento';
    el('period-note').textContent = `${months.map(m => MONTH_ORDER[m]).join(', ')}. Producción = Ingresos totales del segmento (todas las categorías). ADR utiliza solo alojamiento. ${compareYear && !comparable ? '(Nota: Días cargados no coinciden, comparativa puede ser inexacta).' : ''}${totals.days == null ? ' Reimporta el Excel para verificar fechas y desglosar el alojamiento.' : ''}`;
    const invalidStored = SegmentAnalysis.segments(data).filter(s => !SegmentAnalysis.validSegments.includes(SegmentAnalysis.canonical(s.name)) && months.some(m => ['rooms', 'revenue', 'totalRevenue'].some(field => Number(s[field]?.[m]) !== 0 && s[field]?.[m] != null)));
    if (invalidStored.length) el('period-note').textContent += ` Atención: hay segmentos incorrectos guardados (${invalidStored.map(s => s.name).join(', ')}). Pulsa Importar Excel para revisarlos y asignar el segmento correcto antes de guardar.`;
    [['prod', totals.revenue, prior?.revenue, 'revenue'], ['rooms', totals.rooms, prior?.rooms, 'rooms'], ['adr', totals.adr, prior?.adr, 'adr'], ['revpar', revpar, priorRevpar, 'adr']].forEach(([id, value, before, metric]) => {
        el('kpi-' + id).textContent = fmt(value, metric);
        const trend = el('kpi-' + id + '-diff');
        trend.textContent = delta(value, before) + (previous && before !== 0 ? ` vs ${compareYear}` : '');
        trend.className = 'kpi-diff ' + (before != null && value != null ? (value > before ? 'positive' : value < before ? 'negative' : '') : '');
    });
    el('period-note').textContent = `${scopeName}. ` + el('period-note').textContent;
    const names = new Set([...SegmentAnalysis.segments(hotelData), ...(previous ? SegmentAnalysis.segments(hotelPrevious) : [])].map(s => s.name));
    const currentMap = new Map(SegmentAnalysis.segments(hotelData).map(s => [s.name, s]));
    const previousMap = new Map(SegmentAnalysis.segments(hotelPrevious).map(s => [s.name, s]));
    const rows = [...names].map(name => {
        const segment = currentMap.get(name), old = previousMap.get(name);
        const revenue = SegmentAnalysis.sum(segment, 'revenue', months), rooms = SegmentAnalysis.sum(segment, 'rooms', months);
        const accommodation = totals.days != null ? SegmentAnalysis.sum(segment, 'accommodation', months) : null;
        const oldRevenue = previous ? SegmentAnalysis.sum(old, 'revenue', months) : null;
        const oldRooms = previous ? SegmentAnalysis.sum(old, 'rooms', months) : null;
        const adr = accommodation != null && rooms > 0 ? accommodation / rooms : null;
        const oldAdr = previous && oldRooms > 0 ? SegmentAnalysis.sum(old, 'accommodation', months) / oldRooms : null;
        return { name, revenue, rooms, adr, value: currentMetric === 'adr' ? adr : currentMetric === 'rooms' ? rooms : revenue, before: currentMetric === 'adr' ? oldAdr : currentMetric === 'rooms' ? oldRooms : oldRevenue, oldRevenue, oldRooms };
    }).filter(row => row.revenue !== 0 || row.rooms !== 0 || row.oldRevenue !== 0 && row.oldRevenue != null || row.oldRooms !== 0 && row.oldRooms != null);
    const sort = el('segment-sort').value;
    rows.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'es') : sort === 'change' ? ((b.value ?? 0) - (b.before ?? 0)) - ((a.value ?? 0) - (a.before ?? 0)) : (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const metricName = currentMetric === 'adr' ? 'ADR' : currentMetric === 'rooms' ? 'Habitaciones (RN)' : 'Producción';
    el('table-title').textContent = `${metricName} · todos los segmentos (pulsa un nombre para analizarlo)`;
    el('evolution-title').textContent = `Evolución de ${metricName.toLowerCase()} · ${scopeName}`;
    el('comparison-title').textContent = `Comparativa de ${metricName.toLowerCase()} · ${scopeName}`;
    el('tableHead').innerHTML = `<tr><th>Segmento</th><th>${currentYear}</th><th>${compareYear || 'Comparación'}</th><th>Diferencia</th><th>Variación</th><th>Peso ${currentMetric === 'rooms' ? 'habitaciones' : 'producción'}</th><th>Cambio de peso</th></tr>`;
    const mixTotal = currentMetric === 'rooms' ? hotelTotals.rooms : hotelTotals.revenue;
    const priorMixTotal = hotelPrior && (currentMetric === 'rooms' ? hotelPrior.rooms : hotelPrior.revenue);
    const query = el('segment-search').value.trim().toLocaleLowerCase('es');
    const visible = rows.filter(row => row.name.toLocaleLowerCase('es').includes(query));
    el('tableBody').innerHTML = visible.map(row => {
        const mix = mixTotal ? (currentMetric === 'rooms' ? row.rooms : row.revenue) / mixTotal : null;
        const oldMix = priorMixTotal ? (currentMetric === 'rooms' ? row.before : row.oldRevenue) / priorMixTotal : null;
        const difference = row.before != null && row.value != null ? row.value - row.before : null;
        return `<tr><td><button class="toggle-btn${row.name === currentSegment ? ' active' : ''}" data-segment="${escapeHTML(row.name)}">${escapeHTML(row.name)}</button></td><td>${fmt(row.value, currentMetric)}</td><td>${fmt(row.before, currentMetric)}</td><td class="${difference > 0 ? 'positive' : difference < 0 ? 'negative' : ''}">${difference > 0 ? '+' : ''}${fmt(difference, currentMetric)}</td><td>${delta(row.value, row.before)}</td><td>${pct(mix)}</td><td>${oldMix == null || mix == null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, signDisplay: 'always' }).format((mix - oldMix) * 100) + ' pp'}</td></tr>`;
    }).join('') || '<tr><td colspan="7">No hay segmentos para esta búsqueda.</td></tr>';
    el('tableBody').querySelectorAll('[data-segment]').forEach(button => { button.onclick = () => selectSegment(button.dataset.segment); });
    const totalValue = hotelTotals[currentMetric], priorValue = hotelPrior?.[currentMetric];
    el('tableFoot').innerHTML = `<tr><td>Total del periodo</td><td>${fmt(totalValue, currentMetric)}</td><td>${fmt(priorValue, currentMetric)}</td><td>${fmt(priorValue != null && totalValue != null ? totalValue - priorValue : null, currentMetric)}</td><td>${delta(totalValue, priorValue)}</td><td>${mixTotal ? '100 %' : '—'}</td><td>—</td></tr>`;
    el('table-note').textContent = `${visible.length} de ${rows.length} segmentos. La búsqueda localiza filas; selecciona el nombre para cambiar el análisis. Este total corresponde al hotel. Peso en ADR = peso de producción. pp = puntos porcentuales.`;
    const leaders = [...rows].sort((a, b) => b.revenue - a.revenue);
    const leader = leaders[0];
    const mover = previous ? [...rows].sort((a, b) => Math.abs(b.revenue - b.oldRevenue) - Math.abs(a.revenue - a.oldRevenue))[0] : null;
    el('insights').replaceChildren();
    const notes = [];
    if (currentSegment) {
        notes.push(`${scopeName}: ${pct(hotelTotals.revenue ? totals.revenue / hotelTotals.revenue : null)} de la producción del hotel y ${pct(hotelTotals.rooms ? totals.rooms / hotelTotals.rooms : null)} de sus habitaciones-noche.`);
        if (prior) notes.push(`Frente a ${compareYear}: ${fmt(totals.revenue - prior.revenue)} de producción, ${fmt(totals.rooms - prior.rooms, 'rooms')} habitaciones-noche y ${fmt(totals.adr != null && prior.adr != null ? totals.adr - prior.adr : null, 'adr')} de diferencia en ADR.`);
    } else {
        if (leader && totals.revenue > 0) notes.push(`${leader.name} concentra el ${pct(leader.revenue / totals.revenue)} de la producción (${fmt(leader.revenue)}).`);
        if (mover) notes.push(`${mover.name} presenta el mayor cambio absoluto: ${fmt(mover.revenue - mover.oldRevenue)} frente a ${compareYear}.`);
    }
    if (totals.days) notes.push(`${currentSegment ? 'Aportación a la ocupación del hotel' : 'Ocupación del periodo'}: ${pct(totals.rooms / (capacity * totals.days))}. ${fmt(totals.rooms, 'rooms')} habitaciones-noche sobre ${fmt(capacity * totals.days, 'rooms')} disponibles.`);
    if (invalidStored.length) notes.push('Hay errores de segmentación pendientes. Reimporta el informe para corregir los bloques señalados.');
    for (const note of notes) { const item = document.createElement('p'); item.textContent = note; el('insights').append(item); }
    el('monthly-title').textContent = `Detalle mensual · ${scopeName} · ${currentYear}${compareYear ? ' vs ' + compareYear : ''}`;
    el('monthly-body').innerHTML = months.map(m => {
        const value = SegmentAnalysis.aggregate(data, [m]), hotel = SegmentAnalysis.aggregate(hotelData, [m]);
        const old = previous ? SegmentAnalysis.aggregate(previous, [m]) : null;
        return `<tr><td>${MONTH_ORDER[m]}</td><td>${fmt(value.revenue)}</td><td>${fmt(old?.revenue)}</td><td>${delta(value.revenue, old?.revenue)}</td><td>${fmt(value.rooms, 'rooms')}</td><td>${fmt(value.adr, 'adr')}</td><td>${pct(hotel.revenue ? value.revenue / hotel.revenue : null)}</td></tr>`;
    }).join('');
    
    // CONCEPTS TABLE
    const conceptsCard = el('concepts-card');
    const conceptsBody = el('concepts-body');
    if (currentSegment && data && data.segment && data.segment[currentSegment] && data.segment[currentSegment].concepts) {
        const segConcepts = data.segment[currentSegment].concepts;
        let cData = [];
        let totalConcepts = 0;
        for (const [cName, cArr] of Object.entries(segConcepts)) {
            const sum = months.reduce((n, m) => n + (cArr[m] || 0), 0);
            if (sum !== 0) {
                cData.push({ name: cName, value: sum });
                totalConcepts += sum;
            }
        }
        if (cData.length > 0) {
            cData.sort((a, b) => b.value - a.value);
            conceptsBody.innerHTML = cData.map(c => `<tr>
                <td style="font-weight:700;">${c.name}</td>
                <td>${fmt(c.value)}</td>
                <td style="color:var(--text-muted);">${pct(totalConcepts ? c.value / totalConcepts : 0)}</td>
            </tr>`).join('');
            conceptsCard.style.display = 'block';
        } else {
            conceptsCard.style.display = 'none';
        }
    } else {
        conceptsCard.style.display = 'none';
    }

    updateCharts(data, previous, months, rows, totals, prior, compareYear, metricName);
}
function updateCharts(data, previous, months, rows, totals, prior, compareYear, metricName) {
    if (typeof Chart === 'undefined') return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
    // Chart.js mutates its options; give each chart independent axes and plugins.
    const makeOptions = () => ({ animation: false, maintainAspectRatio: false, plugins: { legend: { labels: { color } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label || ctx.label}: ${fmt(ctx.parsed.y ?? ctx.parsed, currentMetric)}` } } }, scales: { x: { ticks: { color } }, y: { beginAtZero: true, ticks: { color } } } });
    const create = (key, canvas, config) => { charts[key]?.destroy(); charts[key] = new Chart(el(canvas), config); };
    const datasets = [{ label: currentYear, data: months.map(m => SegmentAnalysis.aggregate(data, [m])[currentMetric]), borderColor: '#818cf8', backgroundColor: '#818cf8', tension: 0.2 }];
    if (compareYear) datasets.push({ label: compareYear, data: months.map(m => previous ? SegmentAnalysis.aggregate(previous, [m])[currentMetric] : null), borderColor: '#94a3b8', backgroundColor: '#94a3b8', borderDash: [5, 5] });
    create('main', 'mainChart', { type: 'line', data: { labels: months.map(m => SHORT_MONTHS[m]), datasets }, options: makeOptions() });
    const topOptions = makeOptions(); topOptions.plugins.legend.display = false;
    create('top', 'topChart', { type: 'bar', data: { labels: [currentYear, ...(compareYear ? [compareYear] : [])], datasets: [{ label: metricName, data: [totals[currentMetric], ...(compareYear ? [prior?.[currentMetric] ?? null] : [])], backgroundColor: ['#818cf8', '#94a3b8'] }] }, options: topOptions });
    // ADR is a rate, so compare it with bars rather than a share-of-total chart.
    const ranked = [...rows].filter(r => r.value != null).sort((a, b) => b.value - a.value);
    const distOptions = makeOptions();
    distOptions.indexAxis = 'y'; distOptions.plugins.legend.display = false;
    distOptions.scales = { x: { type: 'linear', beginAtZero: true, ticks: { color } }, y: { type: 'category', ticks: { color, autoSkip: false, font: { size: 10 } } } };
    distOptions.plugins.tooltip.callbacks.label = ctx => fmt(ctx.parsed.x, currentMetric);
    distOptions.onClick = (_event, elements) => { if (elements.length) selectSegment(ranked[elements[0].index].name); };
    create('dist', 'distChart', { type: 'bar', data: { labels: ranked.map(r => r.name), datasets: [{ label: metricName, data: ranked.map(r => r.value), backgroundColor: '#818cf8' }] }, options: distOptions });
}
window.addEventListener('load', loadData);
window.addEventListener('capasuite-data-synced', loadData);
new MutationObserver(() => { if (currentYear) renderDashboard(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
