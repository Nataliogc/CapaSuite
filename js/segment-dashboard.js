'use strict';
const MONTH_ORDER = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SHORT_MONTHS = MONTH_ORDER.map(m => m.slice(0, 3));
const STORAGE_KEY = 'hotel_manager_db_v2';
const HOTELS = { Guadiana: { rooms: 108 }, Cumbria: { rooms: 59 } };
let historicalDB = {}, forecastDB = {}, segmentDB = {}, currentHotel = window.CapaState.activeHotel, currentYear = '', currentMetric = 'revenue', charts = {};
let currentMode = 'historical';
let currentSegment = '';
let isNetRevenueMode = false;
let expandedSegments = new Set();
let expandedChannelSegments = new Set();
function toggleChannelSegment(name) {
    if (expandedChannelSegments.has(name)) {
        expandedChannelSegments.delete(name);
    } else {
        expandedChannelSegments.add(name);
    }
    renderDashboard();
}
function toggleAllChannelSegments() {
    const hotelData = segmentDB[currentHotel]?.[currentYear];
    if (!hotelData) return;
    const segsWithChannels = SegmentAnalysis.segments(hotelData).filter(s => s.channels && Object.values(s.channels).some(c => c && c.name && !SegmentAnalysis.isSegment(c.name)));
    if (expandedChannelSegments.size >= segsWithChannels.length && segsWithChannels.length > 0) {
        expandedChannelSegments.clear();
    } else {
        segsWithChannels.forEach(s => expandedChannelSegments.add(s.name));
    }
    renderDashboard();
}
function selectSegment(name) { currentSegment = name; renderDashboard(); }
function setRevenueNetMode(enableNet) {
    isNetRevenueMode = !!enableNet;
    const btnGross = el('btn-mode-gross');
    const btnNet = el('btn-mode-net');
    if (btnGross) btnGross.classList.toggle('active', !isNetRevenueMode);
    if (btnNet) btnNet.classList.toggle('active', isNetRevenueMode);
    renderDashboard();
}

function openCommissionModal() {
    const modal = el('commissionConfigModal');
    if (!modal) return;
    const hotelTitle = el('modalHotelName');
    if (hotelTitle) hotelTitle.textContent = currentHotel === 'Guadiana' ? 'Hotel Guadiana' : 'Hotel Cumbria';
    
    const config = SegmentAnalysis.getChannelCommissionConfig(currentHotel);
    const tbody = el('commissionModalTableBody');
    if (!tbody) return;

    // Obtener canales actuales presentes en los datos del hotel para destacarlos primero
    const currentChannels = new Set();
    const hotelData = segmentDB[currentHotel]?.[currentYear];
    if (hotelData) {
        for (const seg of SegmentAnalysis.segments(hotelData)) {
            const chs = SegmentAnalysis.getSegmentChannels(seg, [], currentHotel);
            chs.forEach(c => {
                if (!SegmentAnalysis.isSegment(c.name)) currentChannels.add(c.name);
            });
        }
    }

    const allKeys = [...new Set([...currentChannels, ...Object.keys(config)])]
        .filter(k => !SegmentAnalysis.isSegment(k))
        .sort((a, b) => {
            const aIn = currentChannels.has(a);
            const bIn = currentChannels.has(b);
            if (aIn && !bIn) return -1;
            if (!aIn && bIn) return 1;
            return a.localeCompare(b, 'es');
        });

    tbody.innerHTML = allKeys.map(chName => {
        const item = config[chName] || { pct: 0, fixedPerRN: 0 };
        const isPresent = currentChannels.has(chName);
        const marginPct = (100 - (Number(item.pct) || 0)).toFixed(1);
        return `<tr data-ch="${escapeHTML(chName)}" style="${isPresent ? 'background: rgba(99,102,241,0.03);' : ''}">
            <td style="padding: 10px 14px;">
                <strong>${escapeHTML(chName)}</strong>
                ${isPresent ? '<span style="font-size:0.7rem; color:var(--primary); margin-left:6px; font-weight:600;">(En uso)</span>' : ''}
            </td>
            <td style="padding: 10px 14px; text-align: right;">
                <input type="number" step="0.5" min="0" max="100" class="commission-pct-input form-select" value="${Number(item.pct) || 0}"
                    oninput="updateModalMargin(this)" style="width: 85px; text-align: right; padding: 4px 8px; display: inline-block;"> %
            </td>
            <td style="padding: 10px 14px; text-align: right;">
                <input type="number" step="0.25" min="0" max="100" class="commission-fee-input form-select" value="${Number(item.fixedPerRN) || 0}"
                    style="width: 85px; text-align: right; padding: 4px 8px; display: inline-block;"> €
            </td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: ${Number(marginPct) < 85 ? '#e11d48' : '#10b981'};" class="modal-margin-cell">
                ${marginPct}%
            </td>
        </tr>`;
    }).join('');

    modal.style.display = 'flex';
}

function updateModalMargin(input) {
    const row = input.closest('tr');
    if (!row) return;
    const val = parseFloat(input.value) || 0;
    const margin = (100 - val).toFixed(1);
    const cell = row.querySelector('.modal-margin-cell');
    if (cell) {
        cell.textContent = margin + '%';
        cell.style.color = Number(margin) < 85 ? '#e11d48' : '#10b981';
    }
}

function closeCommissionModal() {
    const modal = el('commissionConfigModal');
    if (modal) modal.style.display = 'none';
}

function saveCommissionsFromModal() {
    const tbody = el('commissionModalTableBody');
    if (!tbody) return;
    const newConfig = {};
    tbody.querySelectorAll('tr[data-ch]').forEach(row => {
        const name = row.getAttribute('data-ch');
        if (SegmentAnalysis && SegmentAnalysis.isSegment && SegmentAnalysis.isSegment(name)) return;
        const pctVal = parseFloat(row.querySelector('.commission-pct-input')?.value) || 0;
        const feeVal = parseFloat(row.querySelector('.commission-fee-input')?.value) || 0;
        newConfig[name] = { pct: pctVal, fixedPerRN: feeVal };
    });
    SegmentAnalysis.saveChannelCommissionConfig(currentHotel, newConfig);
    closeCommissionModal();
    if (typeof showToast === 'function') {
        showToast(`Comisiones guardadas para ${currentHotel}.`, 'success');
    }
    renderDashboard();
}

function resetDefaultCommissions() {
    if (!confirm('¿Restablecer las comisiones por defecto para este hotel?')) return;
    SegmentAnalysis.saveChannelCommissionConfig(currentHotel, SegmentAnalysis.DEFAULT_CHANNEL_COMMISSIONS);
    openCommissionModal();
    if (typeof showToast === 'function') {
        showToast(`Comisiones restablecidas a valores de mercado.`, 'info');
    }
    renderDashboard();
}

function toggleAllChannels() {
    const hotelData = segmentDB[currentHotel]?.[currentYear];
    const segsWithChannels = SegmentAnalysis.segments(hotelData).filter(s => s.channels && Object.keys(s.channels).length > 1);
    if (expandedSegments.size >= segsWithChannels.length && segsWithChannels.length > 0) {
        expandedSegments.clear();
    } else {
        segsWithChannels.forEach(s => expandedSegments.add(s.name));
    }
    renderDashboard();
}
const el = id => document.getElementById(id);
const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, metric = 'revenue') => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-ES', metric === 'rooms' ? { maximumFractionDigits: 0 } : { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = n => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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
                const dayNum = Number(dd);
                
                result[hotel][year] ||= { segment: {}, coverage: {}, segmentCoverage: {} };
                const yData = result[hotel][year];
                yData.coverage[monthIdx] ||= [];
                if (!yData.coverage[monthIdx].includes(dayNum)) yData.coverage[monthIdx].push(dayNum);
                yData.segmentCoverage[monthIdx] = yData.coverage[monthIdx];

                const seg = yData.segment[segName] ||= { name: segName, revenue: Array(12).fill(0), rooms: Array(12).fill(0), accommodation: Array(12).fill(0), concepts: {}, accommodationVerified: Array(12).fill(true), channels: {} };
                seg.revenue[monthIdx] += daily.revenue || 0;
                seg.rooms[monthIdx] += daily.rooms || 0;
                seg.accommodation[monthIdx] += daily.accommodation || 0;
                if (daily.accommodationVerified === false || daily.accommodation == null) seg.accommodationVerified[monthIdx] = false;

                if (daily.concepts) {
                    for (const [cName, cVal] of Object.entries(daily.concepts)) {
                        seg.concepts[cName] ||= Array(12).fill(0);
                        seg.concepts[cName][monthIdx] += (cVal || 0);
                    }
                }
            }
            if (segData.channels) {
                for (const [chName, chData] of Object.entries(segData.channels)) {
                    if (SegmentAnalysis && SegmentAnalysis.isSegment && SegmentAnalysis.isSegment(chName)) continue;
                    for (const [iso, daily] of Object.entries(chData.days || {})) {
                        const [yyyy, mm] = iso.split('-');
                        const year = yyyy;
                        const monthIdx = Number(mm) - 1;
                        if (!result[hotel]?.[year]?.segment?.[segName]) continue;
                        const seg = result[hotel][year].segment[segName];
                        seg.channels ||= {};
                        const ch = seg.channels[chName] ||= { name: chName, revenue: Array(12).fill(0), rooms: Array(12).fill(0), accommodation: Array(12).fill(0), totalRevenue: Array(12).fill(0) };
                        ch.revenue[monthIdx] += daily.revenue || 0;
                        ch.rooms[monthIdx] += daily.rooms || 0;
                        ch.accommodation[monthIdx] += daily.accommodation || 0;
                        ch.totalRevenue[monthIdx] += daily.totalRevenue || 0;
                    }
                }
            }
        }
    }
    return result;
}
function updateMode(triggerRender = true) {
    const selector = el('modeSelector');
    currentMode = selector ? selector.value : 'historical';
    if (currentMode === 'forecast') {
        forecastDB = JSON.parse(CapaStorage.getItem('segment_forecast_v2') || '{}') || {};
        segmentDB = buildMonthlyFromForecast(forecastDB);
    } else {
        segmentDB = historicalDB;
    }
    const years = Object.keys(segmentDB[currentHotel] || {}).sort().reverse();
    currentYear = years[0] || '';
    if (triggerRender) initControls(); setupDragDrop();
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
                const segs = historicalDB[h][y]?.segment || {};
                for (const seg of Object.values(segs)) {
                    if (seg.channels) {
                        for (const chName of Object.keys(seg.channels)) {
                            if (SegmentAnalysis && SegmentAnalysis.isSegment && SegmentAnalysis.isSegment(chName)) {
                                delete seg.channels[chName];
                                cleaned = true;
                            }
                        }
                    }
                }
            }
        }
        let cleanedForecast = false;
        for (const h of Object.keys(forecastDB)) {
            const segs = forecastDB[h]?.segment || {};
            for (const seg of Object.values(segs)) {
                if (seg.channels) {
                    for (const chName of Object.keys(seg.channels)) {
                        if (SegmentAnalysis && SegmentAnalysis.isSegment && SegmentAnalysis.isSegment(chName)) {
                            delete seg.channels[chName];
                            cleanedForecast = true;
                        }
                    }
                }
            }
        }
        if (cleaned) CapaStorage.setItem(STORAGE_KEY, JSON.stringify(historicalDB));
        if (cleanedForecast) CapaStorage.setItem('segment_forecast_v2', JSON.stringify(forecastDB));

        if (!CapaStorage.getItem('channel_commissions_zero_v1')) {
            CapaStorage.setItem('channel_commissions_zero_v1', '1');
            SegmentAnalysis.saveChannelCommissionConfig('Guadiana', SegmentAnalysis.DEFAULT_CHANNEL_COMMISSIONS);
            SegmentAnalysis.saveChannelCommissionConfig('Cumbria', SegmentAnalysis.DEFAULT_CHANNEL_COMMISSIONS);
        }

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
    currentHotel = hotel; currentYear = ''; currentSegment = '';
    expandedSegments.clear();
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
    
    if (currentMode === 'forecast') {
        const histYears = Object.keys(historicalDB[currentHotel] || {}).filter(y => /^20\d{2}$/.test(y) && SegmentAnalysis.segments(historicalDB[currentHotel][y]).length);
        const forecastYears = Object.keys(segmentDB[currentHotel] || {}).filter(y => /^20\d{2}$/.test(y));
        const allCompareYears = [...new Set([...forecastYears, ...histYears])].filter(y => y !== currentYear).sort().reverse();
        el('compareSelector').innerHTML = '<option value="">Sin comparación</option>' + allCompareYears.map(y => {
            const isHist = histYears.includes(y);
            return `<option value="${y}">${y}${isHist ? ' (Histórico Real)' : ' (Previsión)'}</option>`;
        }).join('');
        const defaultCompare = String(Number(currentYear) - 1);
        el('compareSelector').value = allCompareYears.includes(previous) && previous !== currentYear ? previous : (allCompareYears.includes(defaultCompare) ? defaultCompare : (allCompareYears[0] || ''));
    } else {
        el('compareSelector').innerHTML = '<option value="">Sin comparación</option>' + years.filter(y => y !== currentYear).map(y => `<option>${y}</option>`).join('');
        el('compareSelector').value = years.includes(previous) && previous !== currentYear ? previous : (years.includes(String(Number(currentYear) - 1)) ? String(Number(currentYear) - 1) : years.find(y => y !== currentYear) || '');
    }
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

let pendingSegFile = null;

function extractDateFromFilename(name) {
    const rawName = String(name || '');
    const upName = rawName.toUpperCase().replace(/[_]/g, ' ');
    const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const toFullYear = (y) => {
        if (!y) return null;
        const s = String(y).trim();
        if (s.length === 4) return s;
        if (s.length === 2) {
            const n = parseInt(s, 10);
            return n > 50 ? '19' + s : '20' + s;
        }
        return s;
    };

    // 1. Rango explícito con fechas numéricas (ej: "01-09-26 hasta 26-09-26", "01/09/2026 al 26/09/2026")
    const dateRegex = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/g;
    const matches = [...rawName.matchAll(dateRegex)];

    if (matches.length >= 2) {
        const start = matches[0];
        const end = matches[matches.length - 1];
        const sY = toFullYear(start[3]);
        const eY = toFullYear(end[3]);
        const startDateStr = `${String(start[1]).padStart(2, '0')}-${String(start[2]).padStart(2, '0')}-${sY}`;
        const endDateStr = `${String(end[1]).padStart(2, '0')}-${String(end[2]).padStart(2, '0')}-${eY}`;
        const fullRange = `${startDateStr} al ${endDateStr}`;
        return {
            startDate: startDateStr,
            endDate: endDateStr,
            full: fullRange,
            year: sY,
            startYear: sY,
            endYear: eY,
            day: parseInt(start[1]),
            month: parseInt(start[2]) - 1,
            endDay: parseInt(end[1]),
            endMonth: parseInt(end[2]) - 1,
            isRange: true
        };
    }

    if (matches.length === 1) {
        const m = matches[0];
        const y = toFullYear(m[3]);
        const dStr = `${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}-${y}`;
        return {
            startDate: dStr,
            endDate: dStr,
            full: dStr,
            year: y,
            startYear: y,
            endYear: y,
            day: parseInt(m[1]),
            month: parseInt(m[2]) - 1,
            endDay: parseInt(m[1]),
            endMonth: parseInt(m[2]) - 1,
            isRange: false
        };
    }

    // 2. Nombres de meses (ej: "ENERO - 25 Hasta DICIEMBRE - 25", "Diciembre 2025", "DICIEMBRE - 25")
    const monthPattern = /\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/g;
    const monthMatches = [...upName.matchAll(monthPattern)];

    if (monthMatches.length >= 2) {
        const m1Name = monthMatches[0][1];
        const m2Name = monthMatches[monthMatches.length - 1][1];
        const idx1 = months.indexOf(m1Name);
        const idx2 = months.indexOf(m2Name);

        const after1 = upName.slice(monthMatches[0].index + m1Name.length);
        const y1Match = after1.match(/^\s*[-/ ]*\s*(\d{2,4})\b/);
        const after2 = upName.slice(monthMatches[monthMatches.length - 1].index + m2Name.length);
        const y2Match = after2.match(/^\s*[-/ ]*\s*(\d{2,4})\b/);

        let y1 = y1Match ? toFullYear(y1Match[1]) : null;
        let y2 = y2Match ? toFullYear(y2Match[1]) : null;

        const anyYear4 = upName.match(/\b(20\d{2})\b/);
        const anyYear2 = upName.match(/(?:[-_ ]|^)(2[0-9])(?:[^0-9]|$)/);
        const fallbackYear = anyYear4 ? anyYear4[1] : (anyYear2 ? '20' + anyYear2[1] : '2026');
        if (!y1) y1 = y2 || fallbackYear;
        if (!y2) y2 = y1 || fallbackYear;

        // Si abarca de ENERO a DICIEMBRE del mismo año, es el año completo
        if (idx1 === 0 && idx2 === 11 && y1 === y2) {
            return {
                full: `Año ${y1}`,
                year: y1,
                startYear: y1,
                endYear: y2,
                month: 0,
                endMonth: 11,
                day: 1,
                endDay: 31,
                startDate: `01-01-${y1}`,
                endDate: `31-12-${y2}`,
                isRange: false
            };
        }

        return {
            full: `${m1Name} ${y1} al ${m2Name} ${y2}`,
            year: y1,
            startYear: y1,
            endYear: y2,
            month: idx1,
            endMonth: idx2,
            day: 1,
            endDay: 28,
            startDate: `01-${String(idx1 + 1).padStart(2, '0')}-${y1}`,
            endDate: `28-${String(idx2 + 1).padStart(2, '0')}-${y2}`,
            isRange: true
        };
    }

    if (monthMatches.length === 1) {
        const mName = monthMatches[0][1];
        const idx = months.indexOf(mName);
        const after = upName.slice(monthMatches[0].index + mName.length);
        const yMatch = after.match(/^\s*[-/ ]*\s*(\d{2,4})\b/);
        const anyYear4 = upName.match(/\b(20\d{2})\b/);
        const anyYear2 = upName.match(/(?:[-_ ]|^)(2[0-9])(?:[^0-9]|$)/);
        let year = yMatch ? toFullYear(yMatch[1]) : (anyYear4 ? anyYear4[1] : (anyYear2 ? '20' + anyYear2[1] : '2026'));
        return {
            full: `${mName} ${year}`,
            year: year,
            startYear: year,
            endYear: year,
            month: idx,
            endMonth: idx,
            day: 1,
            endDay: 28,
            startDate: `01-${String(idx + 1).padStart(2, '0')}-${year}`,
            endDate: `28-${String(idx + 1).padStart(2, '0')}-${year}`,
            isRange: false
        };
    }

    // 3. Solo año (ej: "2025" o "- 25")
    const year4Match = upName.match(/\b(20\d{2})\b/);
    if (year4Match) {
        const y = year4Match[1];
        return { full: `Año ${y}`, year: y, startYear: y, endYear: y, month: 0, endMonth: 11, day: 1, endDay: 31, startDate: `01-01-${y}`, endDate: `31-12-${y}`, isRange: false };
    }
    const year2Match = upName.match(/(?:[-_ ]|^)(2[0-9])(?:[^0-9]|$)/);
    if (year2Match) {
        const y = '20' + year2Match[1];
        return { full: `Año ${y}`, year: y, startYear: y, endYear: y, month: 0, endMonth: 11, day: 1, endDay: 31, startDate: `01-01-${y}`, endDate: `31-12-${y}`, isRange: false };
    }

    return null;
}

function detectHotel(name) {
    const n = String(name || '').toUpperCase();
    if (n.includes('GUADIANA')) return 'Guadiana';
    if (n.includes('CUMBRIA')) return 'Cumbria';
    return currentHotel || 'Guadiana';
}

function detectSegmentFileType(name) {
    const n = String(name || '').toUpperCase();
    if (n.includes('PREVISION') || n.includes('OTB') || n.includes('VALORADA') || n.includes('FUTURO') || n.includes('PICKUP')) {
        return 'forecast';
    }
    return 'historical';
}

function showToast(text, type = 'info') {
    const container = el('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'ℹ️', color = 'var(--primary)';
    if (type === 'success') { icon = '✅'; color = 'var(--secondary)'; }
    if (type === 'error') { icon = '❌'; color = 'var(--danger)'; }
    if (type === 'warning') { icon = '⚠️'; color = 'var(--accent)'; }
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<span style="font-size:1.2rem;">${icon}</span> <span>${text}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

function onSegModalTypeChange(type) {
    const help = el('segPeriodHelp');
    if (help) {
        if (type === 'forecast') {
            help.textContent = 'Indica la fecha inicial o rango de la previsión OTB de segmentos.';
        } else {
            help.textContent = 'Indica el mes o fecha de cierre de la producción real de segmentos.';
        }
    }
}

function closeSegModal() {
    const modal = el('segmentConfirmModal');
    if (modal) modal.style.display = 'none';
    pendingSegFile = null;
    if (el('fileInput')) el('fileInput').value = '';
}

async function handleFiles(files) {
    if (!files?.length) return;
    const file = files[0];
    pendingSegFile = file;

    const detectedHotel = detectHotel(file.name);
    const detectedType = detectSegmentFileType(file.name);
    try {
        const version = await CapaRevenueHistory.inspectFile(file, { hotel: detectedHotel || currentHotel, type: detectedType, mode: detectedType === 'forecast' ? 'forecast' : 'actual' });
        message(version.message);
        if (version.status === 'duplicate') { pendingSegFile = null; showToast(version.message, 'info'); return; }
    } catch (error) { pendingSegFile = null; showToast(error.message, 'error'); return; }
    const dateInfo = extractDateFromFilename(file.name);
    const periodStr = dateInfo ? dateInfo.full : '';

    // Pre-fill modal
    const fnEl = el('detectSegFileName');
    if (fnEl) fnEl.textContent = '📁 Archivo: ' + file.name;

    const typeSel = el('segModalTypeSelector');
    if (typeSel) typeSel.value = detectedType;
    onSegModalTypeChange(detectedType);

    const pInput = el('segManualPeriodInput');
    if (pInput) pInput.value = periodStr;

    // Highlight recommended hotel button
    const btnG = el('btnSegGuadiana');
    const btnC = el('btnSegCumbria');
    if (btnG && btnC) {
        btnG.style.transform = 'scale(1)'; btnG.style.boxShadow = 'none'; btnG.style.opacity = '1';
        btnC.style.transform = 'scale(1)'; btnC.style.boxShadow = 'none'; btnC.style.opacity = '1';
        if (detectedHotel === 'Guadiana') {
            btnG.style.transform = 'scale(1.05)';
            btnG.style.boxShadow = '0 0 20px rgba(79, 70, 229, 0.4)';
            btnC.style.opacity = '0.7';
        } else if (detectedHotel === 'Cumbria') {
            btnC.style.transform = 'scale(1.05)';
            btnC.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.4)';
            btnG.style.opacity = '0.7';
        }
    }

    const modal = el('segmentConfirmModal');
    if (modal) modal.style.display = 'flex';
}

async function confirmSegUpload(targetHotel) {
    if (!pendingSegFile) return;
    const file = pendingSegFile;
    const selectedType = el('segModalTypeSelector')?.value || 'historical';
    const manualPeriod = el('segManualPeriodInput')?.value?.trim() || '';

    const modal = el('segmentConfirmModal');
    if (modal) modal.style.display = 'none';

    el('loader').style.display = 'block';
    el('import-button').disabled = true;
    message('Procesando datos de segmentación…');

    let historyId, successMessage;
    try {
        const hotel = targetHotel || detectHotel(file.name);
        historyId = await CapaRevenueHistory.begin(file, { hotel, type: selectedType, period: manualPeriod, mode: selectedType === 'forecast' ? 'forecast' : 'actual' });
        const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null, range: 0, blankrows: true });
        
        const report = await SegmentReview.read(rows, file.name, manualPeriod, selectedType, hotel);
        if (!report) {
            await CapaRevenueHistory.fail(historyId, 'Importación cancelada');
            showToast('Importación cancelada por el usuario.', 'warning');
            return;
        }

        if (selectedType === 'forecast' || report.segmentData) {
            forecastDB = JSON.parse(CapaStorage.getItem('segment_forecast_v2') || '{}') || {};
            SegmentAnalysis.mergeForecast(forecastDB, hotel, report);
            CapaStorage.setItem('segment_forecast_v2', JSON.stringify(forecastDB));

            // Sincronización automática con Calendario Estratégico
            let revRaw = CapaStorage.getItem('revenue_data_v2');
            let revDB = typeof revRaw === 'string' ? JSON.parse(revRaw) : (revRaw || { data: [] });
            if (!revDB.data) revDB.data = [];

            const dailyTotals = {};
            for (const seg of Object.values(report.segmentData || {})) {
                for (const [iso, dt] of Object.entries(seg.days || {})) {
                    dailyTotals[iso] ||= { rooms: 0, revenue: 0 };
                    dailyTotals[iso].rooms += (dt.rooms || 0);
                    dailyTotals[iso].revenue += (dt.accommodation || dt.revenue || 0);
                }
            }

            let updatedDays = 0;
            for (const [iso, totals] of Object.entries(dailyTotals)) {
                let dayEntry = revDB.data.find(d => d.dateISO === iso);
                if (!dayEntry) {
                    dayEntry = { dateISO: iso, occupancyData: {} };
                    revDB.data.push(dayEntry);
                }
                dayEntry.occupancyData ||= {};
                const hData = dayEntry.occupancyData[hotel] ||= { otb: 0, otb_prev: null, adr: 0, revenue: 0 };
                if (hData.otb !== totals.rooms && hData.otb > 0) hData.otb_prev = hData.otb;
                hData.otb = totals.rooms;
                hData.revenue = totals.revenue;
                hData.adr = totals.rooms > 0 ? totals.revenue / totals.rooms : 0;
                updatedDays++;
            }
            if (updatedDays > 0) CapaStorage.setItem('revenue_data_v2', JSON.stringify(revDB));

            currentMode = 'forecast';
            if (el('modeSelector')) el('modeSelector').value = 'forecast';
            segmentDB = buildMonthlyFromForecast(forecastDB);
            const forecastYears = Object.keys(segmentDB[hotel] || {}).sort().reverse();
            currentHotel = hotel;
            currentYear = forecastYears[0] || '';

            successMessage = `🔮 Previsión OTB de Segmentación para Hotel ${hotel} cargada con éxito (${manualPeriod || currentYear}).`;
        } else {
            const next = JSON.parse(JSON.stringify(historicalDB || {}));
            const years = SegmentAnalysis.merge(next, hotel, report);
            CapaStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            historicalDB = next;
            segmentDB = historicalDB;
            currentMode = 'historical';
            if (el('modeSelector')) el('modeSelector').value = 'historical';
            currentHotel = hotel;
            currentYear = years[0] || '';

            successMessage = `📈 Producción Real de Segmentación para Hotel ${hotel} (${years.join(', ')} - ${manualPeriod || 'Periodo detectado'}) cargada correctamente.`;
        }

        await CapaRevenueHistory.commit(historyId, { mode: report.segmentData ? 'forecast' : 'actual' });
        showToast(successMessage, 'success');
        el('hotelSelector').value = currentHotel;
        el('hotelLogo').src = currentHotel === 'Guadiana' ? 'Imagen/logo-guadiana.svg' : 'Imagen/logo-cumbria.svg';
        initControls();
        message('');
    } catch (err) {
        if (historyId) await CapaRevenueHistory.fail(historyId, err).catch(console.error);
        console.error('Error al procesar segmentación:', err);
        showToast(`❌ Error: ${err.message}`, 'error');
        message('Error: ' + err.message, true);
    } finally {
        el('loader').style.display = 'none';
        el('import-button').disabled = false;
        pendingSegFile = null;
        if (el('fileInput')) el('fileInput').value = '';
    }
}

function setupDragDrop() {
    const area = el('upload-section');
    if (!area) return;
    ['dragenter', 'dragover'].forEach(name => {
        area.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); area.classList.add('dragging'); });
    });
    ['dragleave', 'drop'].forEach(name => {
        area.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); area.classList.remove('dragging'); });
    });
    area.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
            handleFiles(dt.files);
        }
    });
}

function getCutoffDateInfo(hotel, year, mode) {
    let config = {};
    try {
        config = JSON.parse((typeof CapaStorage !== 'undefined' ? CapaStorage.getItem('upload_config_db_v2') : localStorage.getItem('upload_config_db_v2')) || '{}') || {};
    } catch (e) {}
    const hotelConfig = config[hotel] || {};
    const hotelData = segmentDB[hotel]?.[year] || {};

    if (mode === 'forecast') {
        let forecastStart = '', forecastEnd = '';
        let fDB = {};
        try {
            fDB = JSON.parse((typeof CapaStorage !== 'undefined' ? CapaStorage.getItem('segment_forecast_v2') : localStorage.getItem('segment_forecast_v2')) || '{}') || {};
        } catch (e) {}
        const segData = fDB[hotel]?.segment || {};
        const allDays = [];
        for (const seg of Object.values(segData)) {
            if (seg.days) {
                for (const iso of Object.keys(seg.days)) {
                    allDays.push(iso);
                }
            }
        }
        if (allDays.length > 0) {
            allDays.sort();
            forecastStart = allDays[0];
            forecastEnd = allDays[allDays.length - 1];
        }
        const otbPeriod = hotelConfig.lastOtbDate || (forecastStart && forecastEnd ? `${forecastStart} al ${forecastEnd}` : '');
        return {
            type: 'forecast',
            cutoffDate: forecastEnd,
            period: otbPeriod,
            label: otbPeriod ? `🔮 Previsión: <b>${otbPeriod}</b>` : ''
        };
    } else {
        let maxMonth = -1, maxDay = -1;
        const coverage = hotelData.segmentCoverage || hotelData.coverage || {};
        for (let m = 11; m >= 0; m--) {
            const days = coverage[m] || coverage[String(m)] || [];
            if (days.length > 0) {
                maxMonth = m;
                maxDay = Math.max(...days);
                break;
            }
        }

        let cutoffDate = '';
        if (maxMonth >= 0 && maxDay > 0) {
            const dStr = String(maxDay).padStart(2, '0');
            const mStr = String(maxMonth + 1).padStart(2, '0');
            cutoffDate = `${dStr}-${mStr}-${year}`;
        }

        const segPeriod = hotelConfig.lastSegDate || hotelData.updates?.seg || hotelData.lastSegDate || '';
        const prodPeriod = hotelConfig.lastProdDate || hotelData.updates?.prod || '';
        const displayDate = cutoffDate || segPeriod || prodPeriod || hotelData.lastUpdate || '';

        return {
            type: 'historical',
            cutoffDate: cutoffDate || displayDate,
            period: displayDate,
            maxMonth: maxMonth,
            maxDay: maxDay,
            label: displayDate ? `📅 Datos cargados hasta: <b>${displayDate}</b>` : ''
        };
    }
}

function renderDashboard() {
    const hotelData = segmentDB[currentHotel]?.[currentYear];
    if (!hotelData || !currentYear) return;
    const compareYear = el('compareSelector').value;
    const hotelPrevious = currentMode === 'forecast'
        ? (historicalDB[currentHotel]?.[compareYear] || segmentDB[currentHotel]?.[compareYear])
        : segmentDB[currentHotel]?.[compareYear];
    const months = el('monthSelector').value === 'All' ? SegmentAnalysis.availableMonths(hotelData) : [Number(el('monthSelector').value)];
    const segmentNames = [...new Set([...SegmentAnalysis.segments(hotelData), ...SegmentAnalysis.segments(hotelPrevious)].map(s => s.name))].sort((a, b) => a.localeCompare(b, 'es'));
    if (currentSegment && !segmentNames.includes(currentSegment)) currentSegment = '';
    el('segmentSelector').replaceChildren(new Option('Todos los segmentos', ''), ...segmentNames.map(name => new Option(name, name)));
    el('segmentSelector').value = currentSegment;
    const scopeName = currentSegment || 'Todos los segmentos';
    const data = SegmentAnalysis.scope(hotelData, currentSegment), previous = SegmentAnalysis.scope(hotelPrevious, currentSegment);
    const comparable = SegmentAnalysis.comparable(data, previous, months);
    const totals = SegmentAnalysis.aggregate(data, months), prior = previous ? SegmentAnalysis.aggregate(previous, months) : null;
    const hotelTotals = SegmentAnalysis.aggregate(hotelData, months), hotelPrior = previous ? SegmentAnalysis.aggregate(hotelPrevious, months) : null;
    const capacity = HOTELS[currentHotel].rooms;
    
    // Net metrics calculation when isNetRevenueMode is active
    const netTotals = SegmentAnalysis.aggregateNet(data, months, currentHotel);
    const netPrior = previous ? SegmentAnalysis.aggregateNet(previous, months, currentHotel) : null;
    const netHotelTotals = SegmentAnalysis.aggregateNet(hotelData, months, currentHotel);
    const netHotelPrior = previous ? SegmentAnalysis.aggregateNet(hotelPrevious, months, currentHotel) : null;

    const displayProd = isNetRevenueMode ? netTotals.netAccommodation : totals.accommodation;
    const displayPriorProd = isNetRevenueMode ? netPrior?.netAccommodation : prior?.accommodation;
    const adrVal = totals.adr != null ? totals.adr : (totals.rooms > 0 && totals.accommodation != null ? totals.accommodation / totals.rooms : null);
    const priorAdrVal = prior?.adr != null ? prior.adr : (prior?.rooms > 0 && prior.accommodation != null ? prior.accommodation / prior.rooms : null);
    const displayAdr = isNetRevenueMode ? (netTotals.netAdr ?? adrVal) : adrVal;
    const displayPriorAdr = isNetRevenueMode ? (netPrior?.netAdr ?? priorAdrVal) : priorAdrVal;

    const revpar = totals.days ? displayProd / (capacity * totals.days) : null;
    const priorRevpar = prior?.days && displayPriorProd != null ? displayPriorProd / (capacity * prior.days) : null;

    // Indicador y fecha de corte
    const info = getCutoffDateInfo(currentHotel, currentYear, currentMode);
    const badge = el('updateBadge');
    if (badge) {
        if (info.label) {
            badge.innerHTML = info.label;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    const cutoffText = info.cutoffDate ? ` · Corte: ${info.cutoffDate}` : '';
    const netBadgeText = isNetRevenueMode ? ' · 💎 Modo Neto (Deduciendo comisiones)' : '';
    el('metric-years').textContent = `${scopeName} · ${currentYear}${compareYear ? ' vs ' + compareYear : ''} · ${totals.days == null ? 'Cobertura sin verificar' : totals.days + ' días cargados'}${cutoffText}${netBadgeText}`;
    el('revpar-label').textContent = currentSegment ? (isNetRevenueMode ? 'Aportación RevPAR Neto' : 'Aportación al RevPAR del hotel') : (isNetRevenueMode ? 'RevPAR Neto · tras comisiones' : 'RevPAR · solo alojamiento');

    let periodPrefix = '';
    if (currentMode === 'historical' && info.cutoffDate) {
        periodPrefix = `📅 <strong>Datos reales cargados hasta el ${info.cutoffDate}</strong>. `;
    }
    const netCommissionNote = isNetRevenueMode ? ` 💎 <strong>Mostrando valores NETOS</strong> (Comisiones deducidas en el periodo: ${fmt(netTotals.totalCommissions, 'revenue')}, Margen neto global: ${pct((netTotals.netMarginPct || 0) / 100)}). ` : '';
    el('period-note').innerHTML = `${periodPrefix}${netCommissionNote}${months.map(m => MONTH_ORDER[m]).join(', ')}. Producción = ${isNetRevenueMode ? 'Prod. Neta Alojamiento' : 'Prod. Habitación / Alojamiento'} (base para ADR y comparativas). ${compareYear && !comparable ? '(Nota: Días cargados no coinciden, comparativa puede ser inexacta).' : ''}${totals.days == null ? ' Reimporta el Excel para verificar fechas y desglosar el alojamiento.' : ''}`;
    if (currentMode === 'forecast') {
        const availableY = Object.keys(segmentDB[currentHotel] || {}).sort();
        const otherYears = availableY.filter(y => y !== currentYear);
        const yHint = otherYears.length ? ` (Tu previsión también incluye datos para ${otherYears.join(', ')}: selecciona ese año arriba para verlos).` : '';
        el('period-note').innerHTML = `🔮 Modo Previsión (OTB) · Viendo previsión del ejercicio ${currentYear}${yHint}. ` + el('period-note').innerHTML;
    }
    const invalidStored = SegmentAnalysis.segments(data).filter(s => !SegmentAnalysis.validSegments.includes(SegmentAnalysis.canonical(s.name)) && months.some(m => ['rooms', 'revenue', 'accommodation', 'totalRevenue'].some(field => Number(s[field]?.[m]) !== 0 && s[field]?.[m] != null)));
    if (invalidStored.length) el('period-note').innerHTML += ` Atención: hay segmentos incorrectos guardados (${invalidStored.map(s => s.name).join(', ')}). Pulsa Importar Excel para revisarlos y asignar el segmento correcto antes de guardar.`;
    
    [['prod', displayProd, displayPriorProd, 'revenue'], ['rooms', totals.rooms, prior?.rooms, 'rooms'], ['adr', displayAdr, displayPriorAdr, 'adr'], ['revpar', revpar, priorRevpar, 'adr']].forEach(([id, value, before, metric]) => {
        el('kpi-' + id).textContent = fmt(value, metric);
        const trend = el('kpi-' + id + '-diff');
        let diffText = delta(value, before) + (previous && before !== 0 ? ` vs ${compareYear}` : '');
        if (id === 'prod' && isNetRevenueMode && netTotals.totalCommissions > 0) {
            diffText += ` (Comis: -${fmt(netTotals.totalCommissions)})`;
        }
        trend.textContent = diffText;
        trend.className = 'kpi-diff ' + (before != null && value != null ? (value > before ? 'positive' : value < before ? 'negative' : '') : '');
    });
    el('period-note').innerHTML = `<strong>${scopeName}</strong>. ` + el('period-note').innerHTML;
    const names = new Set([...SegmentAnalysis.segments(hotelData), ...(previous ? SegmentAnalysis.segments(hotelPrevious) : [])].map(s => s.name));
    const currentMap = new Map(SegmentAnalysis.segments(hotelData).map(s => [s.name, s]));
    const previousMap = new Map(SegmentAnalysis.segments(hotelPrevious).map(s => [s.name, s]));
    const rows = [...names].map(name => {
        const segment = currentMap.get(name), old = previousMap.get(name);
        const rooms = SegmentAnalysis.sum(segment, 'rooms', months);
        const accommodation = SegmentAnalysis.sum(segment, 'accommodation', months);
        const revenue = SegmentAnalysis.sum(segment, 'revenue', months);
        const oldRooms = previous ? SegmentAnalysis.sum(old, 'rooms', months) : null;
        const oldAccommodation = previous ? SegmentAnalysis.sum(old, 'accommodation', months) : null;
        const oldRevenue = previous ? SegmentAnalysis.sum(old, 'revenue', months) : null;
        const adr = accommodation != null && rooms > 0 ? accommodation / rooms : null;
        const oldAdr = previous && oldRooms > 0 ? oldAccommodation / oldRooms : null;

        // Métricas netas por segmento
        const segNet = isNetRevenueMode ? SegmentAnalysis.aggregateNet({ segment: { [name]: segment } }, months, currentHotel) : null;
        const oldSegNet = (isNetRevenueMode && old) ? SegmentAnalysis.aggregateNet({ segment: { [name]: old } }, months, currentHotel) : null;

        const effectiveAcc = isNetRevenueMode ? (segNet?.netAccommodation ?? accommodation) : accommodation;
        const effectiveOldAcc = isNetRevenueMode ? (oldSegNet?.netAccommodation ?? oldAccommodation) : oldAccommodation;
        const effectiveAdr = isNetRevenueMode ? (segNet?.netAdr ?? adr) : adr;
        const effectiveOldAdr = isNetRevenueMode ? (oldSegNet?.netAdr ?? oldAdr) : oldAdr;

        return {
            name,
            rooms,
            accommodation: effectiveAcc,
            grossAccommodation: accommodation,
            revenue,
            adr: effectiveAdr,
            grossAdr: adr,
            value: currentMetric === 'adr' ? effectiveAdr : currentMetric === 'rooms' ? rooms : effectiveAcc,
            before: currentMetric === 'adr' ? effectiveOldAdr : currentMetric === 'rooms' ? oldRooms : effectiveOldAcc,
            oldAccommodation: effectiveOldAcc,
            oldRevenue,
            oldRooms
        };
    }).filter(row => row.accommodation !== 0 || row.rooms !== 0 || (row.oldAccommodation !== 0 && row.oldAccommodation != null) || (row.oldRooms !== 0 && row.oldRooms != null));
    const sort = el('segment-sort').value;
    rows.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'es') : sort === 'change' ? ((b.value ?? 0) - (b.before ?? 0)) - ((a.value ?? 0) - (a.before ?? 0)) : (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const metricName = currentMetric === 'adr' ? (isNetRevenueMode ? 'ADR Neto' : 'ADR') : currentMetric === 'rooms' ? 'Habitaciones (RN)' : (isNetRevenueMode ? 'Prod. Neta Habitación' : 'Prod. Habitación');
    el('table-title').textContent = `${metricName} · todos los segmentos (pulsa un nombre para analizarlo)`;
    el('evolution-title').textContent = `Evolución de ${metricName.toLowerCase()} · ${scopeName}`;
    el('comparison-title').textContent = `Comparativa de ${metricName.toLowerCase()} · ${scopeName}`;
    el('tableHead').innerHTML = `<tr><th>Segmento</th><th>${currentYear}</th><th>${compareYear || 'Comparación'}</th><th>Diferencia</th><th>Variación</th><th>Peso ${currentMetric === 'rooms' ? 'habitaciones' : (isNetRevenueMode ? 'aloj. neto' : 'alojamiento')}</th><th>Cambio de peso</th></tr>`;
    const mixTotal = currentMetric === 'rooms' ? hotelTotals.rooms : (isNetRevenueMode ? netHotelTotals.netAccommodation : hotelTotals.accommodation);
    const priorMixTotal = hotelPrior && (currentMetric === 'rooms' ? hotelPrior.rooms : (isNetRevenueMode ? netHotelPrior?.netAccommodation : hotelPrior.accommodation));
    const query = el('segment-search').value.trim().toLocaleLowerCase('es');
    const visible = rows.filter(row => row.name.toLocaleLowerCase('es').includes(query));
    const toggleBtn = el('btn-toggle-all-channels');
    if (toggleBtn) {
        toggleBtn.textContent = expandedSegments.size ? '⊟ Colapsar Canales' : '⊞ Desplegar Canales';
    }

    el('tableBody').innerHTML = visible.map(row => {
        const segObj = currentMap.get(row.name);
        const oldSegObj = previousMap.get(row.name);
        const segChannels = segObj?.channels ? Object.values(segObj.channels).filter(c => c && c.name && !SegmentAnalysis.isSegment(c.name)) : [];
        const hasMultipleChannels = segChannels.length > 0;
        const isExpanded = expandedSegments.has(row.name);

        const mix = mixTotal ? (currentMetric === 'rooms' ? row.rooms : row.accommodation) / mixTotal : null;
        const oldMix = priorMixTotal ? (currentMetric === 'rooms' ? row.before : row.oldAccommodation) / priorMixTotal : null;
        const difference = row.before != null && row.value != null ? row.value - row.before : null;

        const expandIcon = hasMultipleChannels ? `<button class="toggle-btn" data-toggle-seg="${escapeHTML(row.name)}" style="padding: 2px 6px; font-size: 0.7rem; margin-right: 6px; border-radius: 4px; line-height: 1;" title="${isExpanded ? 'Colapsar canales' : 'Ver canales de este segmento'}">${isExpanded ? '▼' : '▶'}</button>` : '';
        const channelCountBadge = hasMultipleChannels ? `<span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal; margin-left: 6px;">(${segChannels.length} can.)</span>` : '';

        let mainRow = `<tr><td><div style="display: flex; align-items: center;">${expandIcon}<button class="toggle-btn${row.name === currentSegment ? ' active' : ''}" data-segment="${escapeHTML(row.name)}">${escapeHTML(row.name)}</button>${channelCountBadge}</div></td><td>${fmt(row.value, currentMetric)}</td><td>${fmt(row.before, currentMetric)}</td><td class="${difference > 0 ? 'positive' : difference < 0 ? 'negative' : ''}">${difference > 0 ? '+' : ''}${fmt(difference, currentMetric)}</td><td>${delta(row.value, row.before)}</td><td>${pct(mix)}</td><td>${oldMix == null || mix == null ? '—' : new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' }).format((mix - oldMix) * 100) + ' pp'}</td></tr>`;

        let subRows = '';
        if (isExpanded && hasMultipleChannels) {
            const chList = SegmentAnalysis.getSegmentChannels(segObj, months, currentHotel);
            subRows = chList.map(ch => {
                const oldCh = oldSegObj?.channels?.[ch.name];
                const oldChList = oldSegObj ? SegmentAnalysis.getSegmentChannels({ ...oldSegObj, channels: { [ch.name]: oldCh } }, months, currentHotel) : [];
                const oldChData = oldChList[0];
                const oldChRooms = oldChData?.rooms ?? (oldCh ? SegmentAnalysis.sum(oldCh, 'rooms', months) : null);
                const oldChAcc = isNetRevenueMode ? (oldChData?.netAccommodation ?? null) : (oldCh ? SegmentAnalysis.sum(oldCh, 'accommodation', months) : null);
                const oldChAdr = isNetRevenueMode ? (oldChData?.netAdr ?? null) : (oldChRooms > 0 && oldChAcc > 0 ? oldChAcc / oldChRooms : null);

                const chAcc = isNetRevenueMode ? ch.netAccommodation : ch.accommodation;
                const chAdr = isNetRevenueMode ? ch.netAdr : ch.adr;
                const chVal = currentMetric === 'adr' ? chAdr : currentMetric === 'rooms' ? ch.rooms : chAcc;
                const chBefore = oldCh ? (currentMetric === 'adr' ? oldChAdr : currentMetric === 'rooms' ? oldChRooms : oldChAcc) : null;
                const chDiff = chBefore != null && chVal != null ? chVal - chBefore : null;
                const chMix = mixTotal ? (currentMetric === 'rooms' ? ch.rooms : chAcc) / mixTotal : null;
                const commissionNote = isNetRevenueMode ? ` <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">(${ch.commissionPct}% com.)</span>` : '';
                return `<tr class="channel-subrow" style="background: rgba(99, 102, 241, 0.04); font-size: 0.82rem;">
                    <td style="padding-left: 36px; border-left: 3px solid var(--primary);">
                        <span style="color: var(--primary); font-weight: 700; margin-right: 6px;">↳</span>
                        <span style="font-weight: 600; color: var(--text-main);">${escapeHTML(ch.name)}</span>${commissionNote}
                    </td>
                    <td>${fmt(chVal, currentMetric)}</td>
                    <td>${fmt(chBefore, currentMetric)}</td>
                    <td class="${chDiff > 0 ? 'positive' : chDiff < 0 ? 'negative' : ''}">${chDiff > 0 ? '+' : ''}${fmt(chDiff, currentMetric)}</td>
                    <td>${delta(chVal, chBefore)}</td>
                    <td>${pct(chMix)}</td>
                    <td>—</td>
                </tr>`;
            }).join('');
        }

        return mainRow + subRows;
    }).join('') || '<tr><td colspan="7">No hay segmentos para esta búsqueda.</td></tr>';

    el('tableBody').querySelectorAll('[data-segment]').forEach(button => { button.onclick = () => selectSegment(button.dataset.segment); });
    el('tableBody').querySelectorAll('[data-toggle-seg]').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            const seg = button.dataset.toggleSeg;
            if (expandedSegments.has(seg)) expandedSegments.delete(seg);
            else expandedSegments.add(seg);
            renderDashboard();
        };
    });
    const totalEffectiveAcc = isNetRevenueMode ? netHotelTotals.netAccommodation : hotelTotals.accommodation;
    const priorEffectiveAcc = isNetRevenueMode ? netHotelPrior?.netAccommodation : hotelPrior?.accommodation;
    const totalAdr = isNetRevenueMode ? netHotelTotals.netAdr : (hotelTotals.adr != null ? hotelTotals.adr : (hotelTotals.rooms > 0 && hotelTotals.accommodation != null ? hotelTotals.accommodation / hotelTotals.rooms : null));
    const priorAdr = isNetRevenueMode ? netHotelPrior?.netAdr : (hotelPrior?.adr != null ? hotelPrior.adr : (hotelPrior?.rooms > 0 && hotelPrior.accommodation != null ? hotelPrior.accommodation / hotelPrior.rooms : null));
    const totalValue = currentMetric === 'rooms' ? hotelTotals.rooms : currentMetric === 'adr' ? totalAdr : totalEffectiveAcc;
    const priorValue = currentMetric === 'rooms' ? hotelPrior?.rooms : currentMetric === 'adr' ? priorAdr : priorEffectiveAcc;
    el('tableFoot').innerHTML = `<tr><td>Total del periodo</td><td>${fmt(totalValue, currentMetric)}</td><td>${fmt(priorValue, currentMetric)}</td><td>${fmt(priorValue != null && totalValue != null ? totalValue - priorValue : null, currentMetric)}</td><td>${delta(totalValue, priorValue)}</td><td>${mixTotal ? pct(1) : '—'}</td><td>—</td></tr>`;
    el('table-note').textContent = `${visible.length} de ${rows.length} segmentos. La búsqueda localiza filas; selecciona el nombre para cambiar el análisis. ${isNetRevenueMode ? 'Modo Neto activo: producción y ADR descontando comisiones de comercialización.' : 'Este total corresponde a la producción de habitación del hotel.'} Peso en ADR = peso de alojamiento. pp = puntos porcentuales.`;
    const leaders = [...rows].sort((a, b) => b.accommodation - a.accommodation);
    const leader = leaders[0];
    const mover = previous ? [...rows].sort((a, b) => Math.abs(b.accommodation - (b.oldAccommodation ?? 0)) - Math.abs(a.accommodation - (a.oldAccommodation ?? 0)))[0] : null;
    el('insights').replaceChildren();
    const notes = [];
    if (currentSegment) {
        notes.push(`${scopeName}: ${pct(totalEffectiveAcc ? displayProd / totalEffectiveAcc : null)} de la producción de habitación ${isNetRevenueMode ? 'neta ' : ''}del hotel y ${pct(hotelTotals.rooms ? totals.rooms / hotelTotals.rooms : null)} de sus habitaciones-noche.`);
        if (prior) notes.push(`Frente a ${compareYear}: ${fmt(displayProd - displayPriorProd)} de producción ${isNetRevenueMode ? 'neta ' : ''}de habitación, ${fmt(totals.rooms - prior.rooms, 'rooms')} habitaciones-noche y ${fmt(displayAdr != null && displayPriorAdr != null ? displayAdr - displayPriorAdr : null, 'adr')} de diferencia en ADR.`);
    } else {
        if (leader && displayProd > 0) notes.push(`${leader.name} concentra el ${pct(leader.accommodation / displayProd)} de la producción de habitación ${isNetRevenueMode ? 'neta ' : ''}(${fmt(leader.accommodation)}).`);
        if (mover) notes.push(`${mover.name} presenta el mayor cambio absoluto: ${fmt(mover.accommodation - (mover.oldAccommodation ?? 0))} frente a ${compareYear}.`);
    }
    if (totals.days) notes.push(`${currentSegment ? 'Aportación a la ocupación del hotel' : 'Ocupación del periodo'}: ${pct(totals.rooms / (capacity * totals.days))}. ${fmt(totals.rooms, 'rooms')} habitaciones-noche sobre ${fmt(capacity * totals.days, 'rooms')} disponibles.`);
    if (invalidStored.length) notes.push('Hay errores de segmentación pendientes. Reimporta el informe para corregir los bloques señalados.');
    for (const note of notes) { const item = document.createElement('p'); item.textContent = note; el('insights').append(item); }
    el('monthly-title').textContent = `Detalle mensual · ${scopeName} · ${currentYear}${compareYear ? ' vs ' + compareYear : ''}`;
    el('monthly-body').innerHTML = months.map(m => {
        const value = SegmentAnalysis.aggregate(data, [m]), hotel = SegmentAnalysis.aggregate(hotelData, [m]);
        const old = previous ? SegmentAnalysis.aggregate(previous, [m]) : null;
        const mNet = isNetRevenueMode ? SegmentAnalysis.aggregateNet(data, [m], currentHotel) : null;
        const mOldNet = (isNetRevenueMode && previous) ? SegmentAnalysis.aggregateNet(previous, [m], currentHotel) : null;
        const mHotelNet = isNetRevenueMode ? SegmentAnalysis.aggregateNet(hotelData, [m], currentHotel) : null;

        const mAcc = isNetRevenueMode ? mNet.netAccommodation : value.accommodation;
        const mOldAcc = isNetRevenueMode ? mOldNet?.netAccommodation : old?.accommodation;
        const mHotelAcc = isNetRevenueMode ? mHotelNet.netAccommodation : hotel.accommodation;
        const adr = isNetRevenueMode ? mNet.netAdr : (value.adr != null ? value.adr : (value.rooms > 0 && value.accommodation != null ? value.accommodation / value.rooms : null));
        return `<tr><td>${MONTH_ORDER[m]}</td><td>${fmt(mAcc)}</td><td>${fmt(mOldAcc)}</td><td>${delta(mAcc, mOldAcc)}</td><td>${fmt(value.rooms, 'rooms')}</td><td>${fmt(adr, 'adr')}</td><td>${pct(mHotelAcc ? mAcc / mHotelAcc : null)}</td></tr>`;
    }).join('');
    
    // Render Channels / Operators Section with Net & Gross capabilities
    renderChannelsSection(hotelData, hotelPrevious, currentSegment, months, hotelTotals, hotelPrior, compareYear);

    // Use the same category definitions and matching order as Production.
    const conceptsCard = el('concepts-card');
    const segConcepts = data?.segment?.[currentSegment]?.concepts || {};
    const groups = Object.fromEntries(Object.entries(PRODUCTION_GROUPS).map(([id, group]) => [id, { name: group.name, details: [], revenue: Array(12).fill(0) }]));
    for (const [name, revenue] of Object.entries(segConcepts)) {
        const group = groups[getGroupID(name)];
        if (group) group.details.push({ name, revenue });
    }
    for (const group of Object.values(groups)) {
        const subtotal = group.details.find(row => /TOTAL/.test(normalizeStr(row.name)) &&
            [normalizeStr(group.name).split('.')[1].trim(), 'ALOJAMIENTO', 'RESTAURANTE', 'DESAYUNO', 'EVENTO'].some(key => normalizeStr(row.name).includes(key)));
        for (const row of subtotal ? [subtotal] : group.details) {
            months.forEach(m => { group.revenue[m] += Number(row.revenue[m]) || 0; });
        }
    }
    const activeGroups = Object.values(groups).filter(group => group.details.some(row => months.some(m => row.revenue[m]))).sort((a, b) => parseInt(a.name) - parseInt(b.name));
    const total = months.reduce((sum, m) => sum + activeGroups.reduce((n, group) => n + group.revenue[m], 0), 0);
    const detailRow = (name, values, bold = false) => {
        const amount = months.reduce((sum, m) => sum + (Number(values[m]) || 0), 0);
        return `<tr${bold ? ' style="font-weight:700;background:rgba(99,102,241,.07);color:var(--primary);"' : ''}><td>${escapeHTML(name)}</td>${months.map(m => `<td>${fmt(Number(values[m]) || 0)}</td>`).join('')}<td>${fmt(amount)}</td><td>${pct(total ? amount / total : null)}</td></tr>`;
    };
    el('concepts-head').innerHTML = `<tr><th>Categoría / Concepto</th>${months.map(m => `<th>${MONTH_ORDER[m]}</th>`).join('')}<th>Total del periodo</th><th>Peso sobre el total</th></tr>`;
    el('concepts-body').innerHTML = activeGroups.map(group => detailRow(group.name, group.revenue, true) + group.details.map(row => detailRow(row.name, row.revenue)).join('')).join('') +
        (activeGroups.length ? detailRow('TOTAL', Array.from({length:12}, (_, m) => activeGroups.reduce((n, group) => n + group.revenue[m], 0)), true) : '');
    conceptsCard.style.display = currentSegment && activeGroups.length ? 'block' : 'none';

    updateCharts(data, previous, months, rows, totals, prior, compareYear, metricName);
}

function renderChannelsSection(hotelData, hotelPrevious, currentSegment, months, hotelTotals, hotelPrior, compareYear) {
    const card = el('channels-card');
    if (!card) return;
    if (!hotelData) {
        card.style.display = 'none';
        return;
    }

    const isGlobal = !currentSegment;
    const allSegments = SegmentAnalysis.segments(hotelData);
    const targetSegments = currentSegment 
        ? [allSegments.find(s => s.name === currentSegment)].filter(Boolean)
        : allSegments;

    if (currentSegment && expandedChannelSegments.size === 0) {
        expandedChannelSegments.add(currentSegment);
    }

    let totalRealChannelsCount = 0;
    const allRealChannelsForChart = [];

    const segmentRows = targetSegments.map(segObj => {
        const segName = segObj.name;
        const segRooms = SegmentAnalysis.sum(segObj, 'rooms', months);
        const segAcc = SegmentAnalysis.sum(segObj, 'accommodation', months);
        const segRev = SegmentAnalysis.sum(segObj, 'revenue', months);
        const segTotRev = SegmentAnalysis.sum(segObj, 'totalRevenue', months);

        // Canales reales con actividad que han entrado en este segmento
        const rawChannels = (segObj.channels ? Object.values(segObj.channels) : [])
            .filter(c => c && c.name && !SegmentAnalysis.isSegment(c.name))
            .map(c => {
                const chRooms = SegmentAnalysis.sum(c, 'rooms', months);
                const chAcc = SegmentAnalysis.sum(c, 'accommodation', months);
                const chRev = SegmentAnalysis.sum(c, 'revenue', months);
                const chTotRev = SegmentAnalysis.sum(c, 'totalRevenue', months);
                const adr = chRooms > 0 && chAcc > 0 ? chAcc / chRooms : (chRooms > 0 && chRev > 0 ? chRev / chRooms : null);
                const net = SegmentAnalysis.calculateNetMetrics(chAcc, chRooms, c.name, currentHotel);
                return {
                    name: c.name,
                    segmentName: segName,
                    rooms: chRooms,
                    accommodation: chAcc,
                    revenue: chRev,
                    totalRevenue: chTotRev,
                    adr,
                    commissionPct: net.commissionPct,
                    fixedFeePerRN: net.fixedFeePerRN,
                    commissionAmount: net.commissionAmount,
                    netAccommodation: net.netAccommodation,
                    netAdr: net.netAdr,
                    netMarginPct: net.netMarginPct
                };
            })
            .filter(c => c.rooms > 0 || c.accommodation > 0 || c.revenue > 0 || c.totalRevenue > 0);

        rawChannels.sort((a, b) => b.rooms - a.rooms || b.accommodation - a.accommodation);

        totalRealChannelsCount += rawChannels.length;
        allRealChannelsForChart.push(...rawChannels);

        // Métricas netas del segmento
        let segCommissionAmount = 0;
        let segNetAcc = 0;
        if (rawChannels.length > 0) {
            const rawAccSum = rawChannels.reduce((s, c) => s + c.accommodation, 0);
            const rawCommSum = rawChannels.reduce((s, c) => s + c.commissionAmount, 0);
            if (rawAccSum > 0 && Math.abs(rawAccSum - segAcc) < 1) {
                segCommissionAmount = rawCommSum;
                segNetAcc = segAcc - segCommissionAmount;
            } else {
                segCommissionAmount = rawCommSum;
                const unassignedAcc = Math.max(0, segAcc - rawAccSum);
                const unassignedRooms = Math.max(0, segRooms - rawChannels.reduce((s, c) => s + c.rooms, 0));
                const unassignedNet = SegmentAnalysis.calculateNetMetrics(unassignedAcc, unassignedRooms, segName, currentHotel);
                segCommissionAmount += unassignedNet.commissionAmount;
                segNetAcc = segAcc - segCommissionAmount;
            }
        } else {
            const segNet = SegmentAnalysis.calculateNetMetrics(segAcc, segRooms, segName, currentHotel);
            segCommissionAmount = segNet.commissionAmount;
            segNetAcc = segNet.netAccommodation;
        }

        const segCommPct = segAcc > 0 ? (segCommissionAmount / segAcc) * 100 : 0;
        const segGrossAdr = segRooms > 0 && segAcc > 0 ? segAcc / segRooms : null;
        const segNetAdr = segRooms > 0 && segNetAcc > 0 ? segNetAcc / segRooms : null;
        const segMarginPct = segAcc > 0 ? (segNetAcc / segAcc) * 100 : (100 - segCommPct);

        return {
            name: segName,
            rooms: segRooms,
            accommodation: segAcc,
            commissionPct: segCommPct,
            commissionAmount: segCommissionAmount,
            netAccommodation: segNetAcc,
            adr: segGrossAdr,
            netAdr: segNetAdr,
            netMarginPct: segMarginPct,
            channels: rawChannels
        };
    }).filter(s => s.rooms !== 0 || s.accommodation !== 0);

    segmentRows.sort((a, b) => {
        const valA = currentMetric === 'rooms' ? a.rooms : currentMetric === 'adr' ? (isNetRevenueMode ? (a.netAdr ?? 0) : (a.adr ?? 0)) : (isNetRevenueMode ? a.netAccommodation : a.accommodation);
        const valB = currentMetric === 'rooms' ? b.rooms : currentMetric === 'adr' ? (isNetRevenueMode ? (b.netAdr ?? 0) : (b.adr ?? 0)) : (isNetRevenueMode ? b.netAccommodation : b.accommodation);
        return valB - valA;
    });

    const titleEl = el('channels-title-text');
    if (titleEl) {
        titleEl.textContent = currentSegment 
            ? `Canales de ${currentSegment}` 
            : 'Canales por Segmento';
    }
    const subEl = el('channels-card-subtitle');
    if (subEl) {
        subEl.textContent = currentSegment 
            ? `Desglose de los canales y operadores reales que entran en ${currentSegment}.`
            : 'Desglose de canales por cada segmento. Pulsa el desplegable (▼) para ver qué canales entran en cada uno.';
    }

    const badgeEl = el('channels-badge');
    if (badgeEl) {
        badgeEl.textContent = `${totalRealChannelsCount} ${totalRealChannelsCount === 1 ? 'canal real' : 'canales reales'}`;
    }

    const toggleAllBtn = el('btn-toggle-all-channel-segments');
    if (toggleAllBtn) {
        const segsWithChannelsCount = segmentRows.filter(s => s.channels.length > 0).length;
        toggleAllBtn.style.display = segsWithChannelsCount > 0 ? 'inline-block' : 'none';
        toggleAllBtn.textContent = expandedChannelSegments.size >= segsWithChannelsCount && segsWithChannelsCount > 0
            ? '⊟ Colapsar Canales'
            : '⊞ Desplegar Canales';
    }

    card.style.display = segmentRows.length > 0 ? 'block' : 'none';

    const tbody = el('channels-body');
    if (tbody) {
        let html = '';
        for (const seg of segmentRows) {
            const hasChannels = seg.channels.length > 0;
            const isExpanded = expandedChannelSegments.has(seg.name);
            const expandBtn = hasChannels 
                ? `<button class="toggle-btn" data-toggle-ch-seg="${escapeHTML(seg.name)}" style="padding: 2px 7px; font-size: 0.72rem; margin-right: 6px; border-radius: 4px; line-height: 1; cursor: pointer;" title="${isExpanded ? 'Colapsar canales' : 'Ver canales de este segmento'}">${isExpanded ? '▼' : '▶'}</button>` 
                : '';
            const channelBadge = hasChannels
                ? `<span style="font-size:0.72rem; background:rgba(99,102,241,0.1); color:var(--primary); padding:2px 8px; border-radius:10px; font-weight:700; margin-left:6px;">${seg.channels.length} ${seg.channels.length === 1 ? 'canal' : 'canales'}</span>`
                : `<span style="font-size:0.72rem; color:var(--text-muted); font-style:italic; margin-left:6px;">(Sin canales desglosados)</span>`;

            const marginColor = (seg.netMarginPct || 0) < 82 ? '#e11d48' : (seg.netMarginPct || 0) >= 95 ? '#10b981' : 'var(--text-main)';

            // Fila principal del segmento
            html += `<tr style="border-bottom: 1px solid var(--border); font-weight: 600; background: ${isExpanded ? 'rgba(99, 102, 241, 0.03)' : 'transparent'};">
                <td style="padding: 10px 14px;">
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                        ${expandBtn}
                        <strong style="color: var(--text-main); font-size: 0.9rem;">${escapeHTML(seg.name)}</strong>
                        ${channelBadge}
                    </div>
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 700;">${fmt(seg.rooms, 'rooms')}</td>
                <td style="padding: 10px 14px; text-align: right;">${fmt(seg.accommodation, 'revenue')}</td>
                <td style="padding: 10px 14px; text-align: right; color: ${seg.commissionPct > 0 ? '#e11d48' : 'var(--text-muted)'}; font-weight: 600;">${seg.commissionPct > 0 ? seg.commissionPct.toFixed(1) + '%' : '0%'}</td>
                <td style="padding: 10px 14px; text-align: right; color: ${seg.commissionAmount > 0 ? '#e11d48' : 'var(--text-muted)'};">${seg.commissionAmount > 0 ? '-' + fmt(seg.commissionAmount, 'revenue') : '—'}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: var(--primary);">${fmt(seg.netAccommodation, 'revenue')}</td>
                <td style="padding: 10px 14px; text-align: right;">${fmt(seg.adr, 'adr')}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #10b981;">${fmt(seg.netAdr, 'adr')}</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: ${marginColor};">${pct((seg.netMarginPct || 0) / 100)}</td>
            </tr>`;

            // Subfilas de canales cuando está desplegado (solo los canales, sin importes)
            if (isExpanded && hasChannels) {
                for (const ch of seg.channels) {
                    const chCommissionNote = ch.commissionPct > 0 ? ` <span style="font-size:0.7rem; color:#e11d48; font-weight:600; background:rgba(225,29,72,0.08); padding:1px 6px; border-radius:4px;">${ch.commissionPct}% com.</span>` : '';
                    html += `<tr class="channel-subrow" style="background: rgba(99, 102, 241, 0.05); font-size: 0.82rem; border-bottom: 1px dashed rgba(99, 102, 241, 0.15);">
                        <td style="padding: 8px 14px 8px 38px; border-left: 3px solid var(--primary);">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="color: var(--primary); font-weight: 800;">↳</span>
                                <span style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">${escapeHTML(ch.name)}</span>
                                ${chCommissionNote}
                            </div>
                        </td>
                        <td style="padding: 8px 14px; text-align: right; font-weight: 600; color: var(--text-muted);">${ch.rooms > 0 ? fmt(ch.rooms, 'rooms') : '—'}</td>
                        <td colspan="7" style="padding: 8px 14px; font-size: 0.78rem; color: var(--text-muted); font-style: italic;">
                            Canal activo de ${escapeHTML(seg.name)}
                        </td>
                    </tr>`;
                }
            }
        }

        tbody.innerHTML = html || '<tr><td colspan="9" style="text-align:center; padding: 20px;">No hay segmentos ni canales registrados en el periodo seleccionado.</td></tr>';

        // Listeners para los botones de desplegar
        tbody.querySelectorAll('[data-toggle-ch-seg]').forEach(button => {
            button.onclick = (e) => {
                e.stopPropagation();
                toggleChannelSegment(button.dataset.toggleChSeg);
            };
        });
    }

    const tfoot = el('channels-foot');
    if (tfoot) {
        const totalRooms = segmentRows.reduce((s, c) => s + c.rooms, 0);
        const totalAcc = segmentRows.reduce((s, c) => s + c.accommodation, 0);
        const totalCommissions = segmentRows.reduce((s, c) => s + c.commissionAmount, 0);
        const totalNetAcc = segmentRows.reduce((s, c) => s + c.netAccommodation, 0);
        const totalGrossAdr = totalRooms > 0 && totalAcc > 0 ? totalAcc / totalRooms : null;
        const totalNetAdr = totalRooms > 0 && totalNetAcc > 0 ? totalNetAcc / totalRooms : null;
        const avgMarginPct = totalAcc > 0 ? (totalNetAcc / totalAcc) * 100 : null;
        const avgCommPct = totalAcc > 0 ? (totalCommissions / totalAcc) * 100 : null;

        tfoot.innerHTML = `<tr style="font-weight:700; background:rgba(99,102,241,0.06); border-top: 2px solid var(--border);">
            <td style="padding: 12px 14px;">Total (${segmentRows.length} ${segmentRows.length === 1 ? 'segmento' : 'segmentos'}, ${totalRealChannelsCount} ${totalRealChannelsCount === 1 ? 'canal' : 'canales'})</td>
            <td style="padding: 12px 14px; text-align: right;">${fmt(totalRooms, 'rooms')}</td>
            <td style="padding: 12px 14px; text-align: right;">${fmt(totalAcc, 'revenue')}</td>
            <td style="padding: 12px 14px; text-align: right; color: #e11d48;">${avgCommPct != null ? avgCommPct.toFixed(1) + '%' : '—'}</td>
            <td style="padding: 12px 14px; text-align: right; color: #e11d48;">${totalCommissions > 0 ? '-' + fmt(totalCommissions, 'revenue') : '—'}</td>
            <td style="padding: 12px 14px; text-align: right; color: var(--primary);">${fmt(totalNetAcc, 'revenue')}</td>
            <td style="padding: 12px 14px; text-align: right;">${fmt(totalGrossAdr, 'adr')}</td>
            <td style="padding: 12px 14px; text-align: right; color: #10b981;">${fmt(totalNetAdr, 'adr')}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: var(--primary-dark);">${avgMarginPct != null ? pct(avgMarginPct / 100) : '—'}</td>
        </tr>`;
    }

    updateChannelChart(allRealChannelsForChart, segmentRows);
}

function updateChannelChart(channelList, segmentRows) {
    if (typeof Chart === 'undefined') return;
    const canvas = el('channelChart');
    if (!canvas) return;
    charts['channel']?.destroy();

    const chartTitleEl = el('channel-chart-title');
    const palette = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7', '#64748b'];
    const metricKey = currentMetric === 'rooms' ? 'rooms' : 'accommodation';

    // Si hay canales reales, graficar los canales reales. Si no, graficar los segmentos
    const useChannels = channelList && channelList.length > 0;
    const items = useChannels ? channelList : (segmentRows || []);
    if (!items.length) return;

    if (chartTitleEl) {
        chartTitleEl.textContent = useChannels 
            ? `Distribución de Canales (${channelList.length})` 
            : `Distribución de Segmentos (${segmentRows?.length || 0})`;
    }

    const chartData = items.map(c => c[metricKey] || 0);
    const chartLabels = items.map(c => c.name);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();

    charts['channel'] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartLabels.map((_, i) => palette[i % palette.length]),
                borderWidth: 2,
                borderColor: 'transparent'
            }]
        },
        options: {
            animation: false,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color,
                        boxWidth: 10,
                        padding: 6,
                        font: { size: 10, family: 'Inter, sans-serif' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const val = ctx.parsed;
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const p = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
                            return ` ${ctx.label}: ${fmt(val, currentMetric === 'rooms' ? 'rooms' : 'revenue')} (${p})`;
                        }
                    }
                }
            }
        }
    });
}
function updateCharts(data, previous, months, rows, totals, prior, compareYear, metricName) {
    if (typeof Chart === 'undefined') return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
    // Chart.js mutates its options; give each chart independent axes and plugins.
    const makeOptions = () => ({ animation: false, maintainAspectRatio: false, plugins: { legend: { labels: { color } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label || ctx.label}: ${fmt(ctx.parsed.y ?? ctx.parsed, currentMetric)}` } } }, scales: { x: { ticks: { color } }, y: { beginAtZero: true, ticks: { color } } } });
    const create = (key, canvas, config) => { charts[key]?.destroy(); charts[key] = new Chart(el(canvas), config); };
    const getMetricVal = (agg) => currentMetric === 'revenue' ? (agg?.accommodation ?? 0) : (agg?.[currentMetric] ?? null);
    const datasets = [{ label: currentYear, data: months.map(m => getMetricVal(SegmentAnalysis.aggregate(data, [m]))), borderColor: '#818cf8', backgroundColor: '#818cf8', tension: 0.2 }];
    if (compareYear) datasets.push({ label: compareYear, data: months.map(m => previous ? getMetricVal(SegmentAnalysis.aggregate(previous, [m])) : null), borderColor: '#94a3b8', backgroundColor: '#94a3b8', borderDash: [5, 5] });
    const mainOptions = makeOptions();
    const singleMonth = months.length === 1;
    if (singleMonth) datasets.forEach(dataset => { dataset.maxBarThickness = 90; });
    create('main', 'mainChart', { type: singleMonth ? 'bar' : 'line', data: { labels: months.map(m => SHORT_MONTHS[m]), datasets }, options: mainOptions });
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
