/**
 * CapaSuite - Competencia Intelligence UI Controller
 * Controla la Vista Mensual, Vista por Día de la Semana, Comparador y Ficha Diaria de Análisis.
 */

(function (root) {
    'use strict';

    let activeIntelTab = 'daily';
    let tableColumnConfig = {
        occPct: false,
        pickup24h: false,
        pickup3d: false,
        pickup7d: false,
        pickup14d: false,
        daysOut: false,
        recPrice: false,
        diffPrice: false,
        recReason: false
    };

    // Polyfill defensivo para asegurar compatibilidad con versiones previas en caché del navegador
    if (typeof window !== 'undefined' && window.PricingIntelligence && typeof window.PricingIntelligence.getSnapshotsDB !== 'function') {
        window.PricingIntelligence.getSnapshotsDB = function() {
            try {
                const raw = (typeof CapaStorage !== 'undefined' && CapaStorage.getItem) 
                    ? CapaStorage.getItem('daily_otb_snapshots_v1') 
                    : localStorage.getItem('daily_otb_snapshots_v1');
                return raw ? JSON.parse(raw) : { Guadiana: {}, Cumbria: {} };
            } catch(e) { return { Guadiana: {}, Cumbria: {} }; }
        };
    }

    let dayDetailChartInstance = null;
    let comparisonChartInstance = null;
    let currentDetailDateISO = null;
    const expandedDowSet = new Set();

    function getSnapshotsSafely() {
        if (window.PricingIntelligence && typeof window.PricingIntelligence.getSnapshotsDB === 'function') {
            try { return window.PricingIntelligence.getSnapshotsDB(); } catch(e) {}
        }
        try {
            const raw = (typeof CapaStorage !== 'undefined' && CapaStorage.getItem) 
                ? CapaStorage.getItem('daily_otb_snapshots_v1') 
                : localStorage.getItem('daily_otb_snapshots_v1');
            return raw ? JSON.parse(raw) : { Guadiana: {}, Cumbria: {} };
        } catch(e) {
            return { Guadiana: {}, Cumbria: {} };
        }
    }

    function loadColumnConfig() {
        try {
            localStorage.removeItem('capasuite_table_col_config_v1');
            const saved = localStorage.getItem('capasuite_table_col_config_v2');
            if (saved) {
                tableColumnConfig = Object.assign(tableColumnConfig, JSON.parse(saved));
            }
        } catch(e) {}
    }
    loadColumnConfig();

    function switchIntelTab(tabId) {
        activeIntelTab = tabId;
        const tabs = ['daily', 'month_dow', 'comparison'];
        tabs.forEach(t => {
            const btn = document.getElementById(t === 'daily' ? 'tabBtnDaily' : (t === 'month_dow' ? 'tabBtnMonthDow' : 'tabBtnComparison'));
            const container = document.getElementById(t === 'daily' ? 'viewContainerDaily' : (t === 'month_dow' ? 'viewContainerMonthDow' : 'viewContainerComparison'));
            if (btn) {
                if (t === tabId) btn.classList.add('active');
                else btn.classList.remove('active');
            }
            if (container) {
                container.style.display = (t === tabId) ? 'block' : 'none';
            }
        });

        const selMonth = document.getElementById('monthSelector')?.value || 'all';
        let data = (typeof processedData !== 'undefined' && Array.isArray(processedData)) ? [...processedData] : [];
        if (selMonth !== 'all') {
            data = data.filter(d => d.month === selMonth);
        }

        if (tabId === 'month_dow') {
            renderMonthAndDowView(data, selMonth);
        } else if (tabId === 'comparison') {
            runComparisonAnalysis();
        }
    }

    function toggleColumnConfigModal() {
        const modal = document.getElementById('columnConfigModal');
        if (!modal) return;
        const container = document.getElementById('columnConfigCheckboxes');
        if (container) {
            const cols = [
                { key: 'occPct', label: 'Columna extra: Ocupación (%) y Habitaciones' },
                { key: 'pickup24h', label: 'Columna extra: Pick-up 24 Horas' },
                { key: 'pickup3d', label: 'Columna extra: Pick-up 3 Días' },
                { key: 'pickup7d', label: 'Columna extra: Pick-up 7 Días' },
                { key: 'pickup14d', label: 'Columna extra: Pick-up 14 Días' },
                { key: 'daysOut', label: 'Columna extra: Antelación (Días hasta llegada)' }
            ];
            container.innerHTML = cols.map(c => `
                <label style="display:flex; align-items:center; gap:8px; font-size:0.84rem; cursor:pointer; color:var(--text-main);">
                    <input type="checkbox" id="col_chk_${c.key}" ${tableColumnConfig[c.key] ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
                    <span>${c.label}</span>
                </label>
            `).join('');
        }
        modal.style.display = 'block';
    }

    function closeColumnConfigModal() {
        const modal = document.getElementById('columnConfigModal');
        if (modal) modal.style.display = 'none';
    }

    function saveColumnConfigFromModal() {
        Object.keys(tableColumnConfig).forEach(k => {
            const el = document.getElementById('col_chk_' + k);
            if (el) tableColumnConfig[k] = el.checked;
        });
        try {
            localStorage.setItem('capasuite_table_col_config_v3', JSON.stringify(tableColumnConfig));
        } catch(e) {}
        closeColumnConfigModal();
        if (typeof refreshActiveView === 'function') refreshActiveView();
    }

    // =========================================================================
    // VISTA MENSUAL & DÍAS DE LA SEMANA
    // =========================================================================
    function renderMonthAndDowView(data, selectedMonth) {
        if (!window.PricingIntelligence) return;
        const currentHotel = window.activeHotel || (window.CapaState && window.CapaState.activeHotel) || 'Guadiana';
        const datesList = (data && data.length > 0) ? data : (typeof processedData !== 'undefined' ? processedData : []);
        if (!datesList || datesList.length === 0) return;

        // Determinar mes numérico
        let monthNum = 1;
        if (selectedMonth && selectedMonth !== 'all' && selectedMonth !== 'next_90') {
            const idx = PricingIntelligence.MONTH_NAMES_ES.findIndex(m => m.toLowerCase().includes(selectedMonth.toLowerCase()) || selectedMonth.toLowerCase().includes(m.toLowerCase()));
            if (idx >= 0) monthNum = idx + 1;
        } else if (datesList[0]?.dateISO) {
            monthNum = parseInt(datesList[0].dateISO.split('-')[1], 10) || 1;
        }

        const monthDates = datesList.filter(d => {
            if (!d || !d.dateISO) return false;
            const parts = d.dateISO.split('-');
            return parts.length >= 2 && parseInt(parts[1], 10) === monthNum;
        });

        const monthSummary = PricingIntelligence.aggregateMonthSummary(datesList, monthNum, currentHotel);
        const dowData = PricingIntelligence.aggregateByDayOfWeek(datesList, monthNum, currentHotel);

        // Actualizar título de mes con el año correcto del mes seleccionado
        const currentYear = monthDates[0]?.dateISO ? monthDates[0].dateISO.split('-')[0] : (monthSummary.year || '2027');
        const badge = document.getElementById('dowMonthTitleBadge');
        if (badge) badge.innerText = `${monthSummary.monthName} ${currentYear}`;

        // Renderizar pills de mes en la barra rápida
        const pillsStrip = document.getElementById('monthDowPillsStrip');
        if (pillsStrip) {
            const shortNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            pillsStrip.innerHTML = shortNames.map((sn, idx) => {
                const mIdx = idx + 1;
                const isSelected = (mIdx === monthNum);
                return `
                    <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : ''}" onclick="CompetenciaIntelUI.selectMonthFromStrip(${mIdx})" style="height:28px; padding:0 8px; font-size:0.75rem; font-weight:700; border-radius:6px; border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}; background:${isSelected ? 'var(--primary)' : 'var(--bg-surface)'}; color:${isSelected ? '#fff' : 'var(--text-main)'}; cursor:pointer;">
                        ${sn}
                    </button>
                `;
            }).join('');
        }

        // 1. Tarjetas de Resumen Mensual
        const sumContainer = document.getElementById('monthSummaryContainer');
        if (sumContainer) {
            const hasPickup = (monthSummary.pickupAccum7d !== null || monthSummary.pickupAccum14d !== null || monthSummary.pickupAccum30d !== null);
            let pickupMainHtml = '';
            let pickupSubHtml = '';
            if (hasPickup) {
                const p7Val = monthSummary.pickupAccum7d !== null ? monthSummary.pickupAccum7d : 0;
                const p7Sign = p7Val >= 0 ? '+' : '';
                pickupMainHtml = `${p7Sign}${p7Val} RN <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">(7d)</span>`;
                const p14Text = (monthSummary.pickupAccum14d !== null) ? `${monthSummary.pickupAccum14d >= 0 ? '+' : ''}${monthSummary.pickupAccum14d} RN` : '—';
                const p30Text = (monthSummary.pickupAccum30d !== null) ? `${monthSummary.pickupAccum30d >= 0 ? '+' : ''}${monthSummary.pickupAccum30d} RN` : '—';
                pickupSubHtml = `14d: <strong>${p14Text}</strong> &nbsp;·&nbsp; 30d: <strong>${p30Text}</strong>`;
            } else {
                pickupMainHtml = `<span style="font-size:1.05rem; font-weight:800; color:var(--primary); letter-spacing:-0.2px;">En captura inicial</span>`;
                pickupSubHtml = `<span style="color:var(--text-muted);">Sin snapshots previos (7d / 14d / 30d)</span>`;
            }

            const gapText = (monthSummary.compGapPct !== 0) ? `${monthSummary.compGapPct > 0 ? '+' : ''}${monthSummary.compGapPct.toFixed(1)}%` : '0.0%';

            sumContainer.innerHTML = `
                <div class="month-kpi-grid">
                    <div class="month-kpi-card" style="border-left:4px solid var(--primary);">
                        <div class="kpi-title">Ocupación Prevista</div>
                        <div class="kpi-num">${monthSummary.avgOccPct.toFixed(1)}%</div>
                        <div class="kpi-sub">${monthSummary.totalSoldRooms} de ${monthSummary.totalAvailableRooms} habs</div>
                    </div>
                    <div class="month-kpi-card" style="border-left:4px solid #10b981;">
                        <div class="kpi-title">ADR Previsto</div>
                        <div class="kpi-num">${monthSummary.forecastADR} €</div>
                        <div class="kpi-sub">Precio medio alojamiento</div>
                    </div>
                    <div class="month-kpi-card" style="border-left:4px solid #f59e0b;">
                        <div class="kpi-title">Precio Actual vs Rec.</div>
                        <div class="kpi-num">${monthSummary.avgCurrentPrice} € <span style="font-size:0.92rem; color:var(--text-muted); font-weight:600;">→ Rec: <strong style="color:#10b981;">${monthSummary.avgRecommendedPrice} €</strong></span></div>
                        <div class="kpi-sub">${monthSummary.avgRecommendedPrice > monthSummary.avgCurrentPrice ? '▲ Oportunidad de optimización' : (monthSummary.avgRecommendedPrice < monthSummary.avgCurrentPrice ? '▼ Revisión preventiva' : '✓ En zona comercial óptima')}</div>
                    </div>
                    <div class="month-kpi-card" style="border-left:4px solid #06b6d4;">
                        <div class="kpi-title">Pick-up Acumulado</div>
                        <div class="kpi-num">${pickupMainHtml}</div>
                        <div class="kpi-sub">${pickupSubHtml}</div>
                    </div>
                    <div class="month-kpi-card" style="border-left:4px solid #8b5cf6;">
                        <div class="kpi-title">Comparación Competencia</div>
                        <div class="kpi-num">${gapText}</div>
                        <div class="kpi-sub">Mercado: ${monthSummary.avgMarketPrice} €</div>
                    </div>
                    <div class="month-kpi-card" style="border-left:4px solid #ec4899;">
                        <div class="kpi-title">Ingresos Previstos</div>
                        <div class="kpi-num">${(monthSummary.forecastRevenue).toLocaleString('es-ES')} €</div>
                        <div class="kpi-sub">${monthSummary.totalDays} fechas analizadas</div>
                    </div>
                </div>
            `;
        }

        // 2. Tabla DOW (7 Filas Lunes..Domingo)
        const tbody = document.getElementById('dowSummaryTableBody');
        if (tbody) {
            let htmlRows = '';
            dowData.forEach(row => {
                const p24 = (row.pickupNet24h !== null) ? `<span class="pickup-chip ${row.pickupNet24h >= 0 ? 'pos' : 'neg'}">${row.pickupNet24h >= 0 ? '+' : ''}${row.pickupNet24h} RN</span>` : `<span class="pickup-chip neutral">-</span>`;
                const p7  = (row.pickupNet7d !== null)  ? `<span class="pickup-chip ${row.pickupNet7d >= 0 ? 'pos' : 'neg'}">${row.pickupNet7d >= 0 ? '+' : ''}${row.pickupNet7d} RN</span>` : `<span class="pickup-chip neutral">-</span>`;
                const p14 = (row.pickupNet14d !== null) ? `<span class="pickup-chip ${row.pickupNet14d >= 0 ? 'pos' : 'neg'}">${row.pickupNet14d >= 0 ? '+' : ''}${row.pickupNet14d} RN</span>` : `<span class="pickup-chip neutral">-</span>`;
                const isOpen = expandedDowSet.has(row.dow);
                const mktRounded = row.avgMarketPrice > 0 ? `${Math.round(row.avgMarketPrice)} €` : '-';

                htmlRows += `
                    <tr class="dow-row-parent" onclick="CompetenciaIntelUI.toggleDowSubrow(${row.dow})">
                        <td class="dow-name-cell" style="white-space:nowrap; min-width:135px;">
                            <span class="dow-chevron ${isOpen ? 'open' : ''}" id="dowChevron_${row.dow}">${isOpen ? '▼' : '▶'}</span>
                            <span style="font-weight:700;">${row.name}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">(${row.count} días)</span>
                        </td>
                        <td style="font-weight:700; color:var(--text-muted);">${row.baseBar} €</td>
                        <td style="font-weight:800; color:var(--text-main); font-size:0.95rem;">${row.avgCurrentPrice > 0 ? row.avgCurrentPrice + ' €' : '-'}</td>
                        <td style="font-weight:700;">${row.avgOccupancyPct.toFixed(1)}% <span style="font-size:0.72rem; color:var(--text-muted);">(${row.avgOtbRooms} habs)</span></td>
                        <td>${p24}</td>
                        <td>${p7}</td>
                        <td>${p14}</td>
                        <td style="color:var(--primary); font-weight:700;">${mktRounded}</td>
                        <td style="font-weight:800; color:#10b981; font-size:1.02rem;">${row.recommendedPrice} €</td>
                        <td style="text-align:left; font-size:0.78rem; color:var(--text-main); line-height:1.3;">
                            ${row.justification}
                        </td>
                        <td style="text-align:center; min-width:115px;">
                            <button type="button" class="btn btn-sm ${isOpen ? 'btn-active' : ''}" onclick="event.stopPropagation(); CompetenciaIntelUI.toggleDowSubrow(${row.dow});" style="font-size:0.75rem; padding:5px 12px; border-radius:8px; font-weight:700; white-space:nowrap; cursor:pointer; background:${isOpen ? 'var(--primary)' : 'var(--bg-surface)'}; color:${isOpen ? '#fff' : 'var(--text-main)'}; border:1px solid ${isOpen ? 'var(--primary)' : 'var(--border)'}; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                                ${isOpen ? '▴ Plegar' : '▾ Ver fechas'}
                            </button>
                        </td>
                    </tr>
                    <tr id="dowDetailRow_${row.dow}" style="display:${isOpen ? 'table-row' : 'none'};">
                        <td colspan="11" style="padding:12px 14px; background:var(--bg-deep);">
                            <div class="dow-subtable-wrap" style="padding:16px 20px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border); box-shadow:0 4px 14px rgba(0,0,0,0.04);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:8px;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-size:0.85rem; font-weight:800; color:var(--text-main);">
                                            📅 Fechas Concretas: <span style="color:var(--primary);">${row.name} de ${monthSummary.monthName} ${currentYear}</span>
                                        </span>
                                        <span style="font-size:0.72rem; font-weight:700; background:rgba(99,102,241,0.1); color:var(--primary); padding:2px 8px; border-radius:10px;">
                                            ${row.count} fechas
                                        </span>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">
                                            💡 Clic en cualquier fila para abrir la Ficha Diaria de Yield
                                        </span>
                                        <button type="button" class="btn btn-sm" onclick="CompetenciaIntelUI.toggleDowSubrow(${row.dow});" style="font-size:0.72rem; padding:3px 10px; border-radius:6px; background:var(--bg-surface); border:1px solid var(--border); cursor:pointer; color:var(--text-muted); font-weight:600;">
                                            ✕ Plegar
                                        </button>
                                    </div>
                                </div>
                                <div style="overflow-x:auto;">
                                    <table class="dow-subtable" style="width:100%; border-collapse:collapse; background:var(--bg-surface); border-radius:8px; overflow:hidden;">
                                        <thead>
                                            <tr style="border-bottom:1px solid var(--border); font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.3px;">
                                                <th style="padding:8px 12px; text-align:left;">Fecha</th>
                                                <th style="padding:8px 10px;">Ocupación PMS</th>
                                                <th style="padding:8px 10px;">Pickup (24h / 7d)</th>
                                                <th style="padding:8px 10px;">Precio Publicado</th>
                                                <th style="padding:8px 10px;">Mercado Comp.</th>
                                                <th style="padding:8px 10px;">Rango Sugerido</th>
                                                <th style="padding:8px 10px;">Recomendado</th>
                                                <th style="padding:8px 10px;">Estrategia / Acción</th>
                                                <th style="padding:8px 10px; text-align:center;">Ficha</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${row.dates.map(dItem => {
                                                const r = dItem.recommendation;
                                                
                                                // Pickup chips compactos
                                                const p24Val = (dItem.pickup24h !== null) ? `${dItem.pickup24h >= 0 ? '+' : ''}${dItem.pickup24h}` : '-';
                                                const p7Val = (dItem.pickup7d !== null) ? `${dItem.pickup7d >= 0 ? '+' : ''}${dItem.pickup7d}` : '-';
                                                const p24Cls = (dItem.pickup24h !== null && dItem.pickup24h > 0) ? 'pos' : ((dItem.pickup24h !== null && dItem.pickup24h < 0) ? 'neg' : 'neutral');
                                                const p7Cls = (dItem.pickup7d !== null && dItem.pickup7d > 0) ? 'pos' : ((dItem.pickup7d !== null && dItem.pickup7d < 0) ? 'neg' : 'neutral');
                                                
                                                const pickupDualHtml = `
                                                    <div style="display:inline-flex; gap:4px; align-items:center; justify-content:center;">
                                                        <span class="pickup-chip ${p24Cls}" title="Pickup 24 horas: ${p24Val} RN">${p24Val}</span>
                                                        <span style="color:var(--text-muted); font-size:0.72rem; opacity:0.6;">/</span>
                                                        <span class="pickup-chip ${p7Cls}" title="Pickup 7 días: ${p7Val} RN">${p7Val}</span>
                                                    </div>
                                                `;

                                                // Limpieza y formateo elegante del rango sugerido
                                                let cleanRange = '-';
                                                if (r.minRange && r.maxRange) {
                                                    cleanRange = (r.minRange === r.maxRange) ? `${r.minRange} €` : `${r.minRange} € – ${r.maxRange} €`;
                                                } else if (r.rangeText) {
                                                    const clean = r.rangeText.replace(/€/g, '').split('-').map(s => s.trim());
                                                    if (clean.length === 2 && clean[0] === clean[1]) {
                                                        cleanRange = `${clean[0]} €`;
                                                    } else if (clean.length === 2) {
                                                        cleanRange = `${clean[0]} € – ${clean[1]} €`;
                                                    } else {
                                                        cleanRange = r.rangeText;
                                                    }
                                                }

                                                const mktSingle = dItem.marketPrice > 0 ? `${Math.round(dItem.marketPrice)} €` : '-';
                                                const isPendingDem = (r.demandStatus === 'PENDIENTE DE EVALUACIÓN DE DEMANDA' || r.triggerText?.includes('Pend. Demanda'));
                                                let actCls = 'mantener';
                                                let actLabel = r.action;
                                                let actIcon = '✓';

                                                if (isPendingDem) {
                                                    actCls = 'alerta';
                                                    actLabel = 'Pend. Demanda';
                                                    actIcon = '⏳';
                                                } else if (r.action === 'SUBIR') {
                                                    actCls = 'subir';
                                                    actLabel = 'Subir Tarifa';
                                                    actIcon = '▲';
                                                } else if (r.action === 'REVISAR' || r.action === 'REVISIÓN MANUAL' || r.action === 'REVISAR BAJADA') {
                                                    actCls = 'manual';
                                                    actLabel = 'Revisar';
                                                    actIcon = '⚠️';
                                                } else {
                                                    actCls = 'mantener';
                                                    actLabel = 'Mantener';
                                                    actIcon = '✓';
                                                }

                                                return `
                                                    <tr style="border-bottom:1px solid rgba(0,0,0,0.05); font-size:0.8rem; cursor:pointer;" onclick="CompetenciaIntelUI.openDayDetailModal('${dItem.dateISO}')">
                                                        <td style="font-weight:800; text-align:left; padding:9px 12px; white-space:nowrap;">
                                                            <a href="javascript:void(0)" onclick="event.stopPropagation(); CompetenciaIntelUI.openDayDetailModal('${dItem.dateISO}')" style="color:var(--primary); text-decoration:none;">
                                                                ${dItem.label}
                                                            </a>
                                                        </td>
                                                        <td style="padding:9px 10px; white-space:nowrap;">
                                                            <strong>${dItem.occPct.toFixed(0)}%</strong> <span style="font-size:0.72rem; color:var(--text-muted);">(${dItem.rooms} habs)</span>
                                                        </td>
                                                        <td style="padding:9px 10px; white-space:nowrap;">
                                                            ${pickupDualHtml}
                                                        </td>
                                                        <td style="font-weight:700; padding:9px 10px; white-space:nowrap;">${dItem.price} €${r.belowBase ? `<div style="color:#b91c1c; font-size:0.72rem;" title="${r.baseWarning}">⚠ Bajo base (${r.baseBar} €)</div>` : ''}</td>
                                                        <td style="padding:9px 10px; color:var(--text-muted); white-space:nowrap;">${mktSingle}</td>
                                                        <td style="padding:9px 10px; font-size:0.75rem; color:var(--text-muted); font-weight:700; white-space:nowrap;" title="${r.rangeCalculation || ''}">${cleanRange}</td>
                                                        <td style="padding:9px 10px; white-space:nowrap;">
                                                            <span style="font-weight:800; color:#10b981; font-size:0.95rem; background:rgba(16,185,129,0.08); padding:3px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.2);">${r.proposedPrice} €</span>
                                                        </td>
                                                        <td style="padding:9px 10px; white-space:nowrap;">
                                                            <span class="action-pill ${actCls}" style="font-size:0.72rem; padding:4px 8px; border-radius:6px; font-weight:700; display:inline-flex; align-items:center; gap:4px;" title="${r.fullReasonText || ''}">
                                                                <span>${actIcon}</span><span>${actLabel}</span>
                                                            </span>
                                                        </td>
                                                        <td style="padding:9px 10px; text-align:center; white-space:nowrap;">
                                                            <button type="button" class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); CompetenciaIntelUI.openDayDetailModal('${dItem.dateISO}')" style="font-size:0.72rem; padding:3px 9px; border-radius:6px; font-weight:700; cursor:pointer;">
                                                                📊 Ficha
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = htmlRows;
        }
    }

    function toggleDowSubrow(dow) {
        const row = document.getElementById('dowDetailRow_' + dow);
        const chev = document.getElementById('dowChevron_' + dow);
        if (!row) return;
        if (expandedDowSet.has(dow)) {
            expandedDowSet.delete(dow);
            row.style.display = 'none';
            if (chev) {
                chev.classList.remove('open');
                chev.innerText = '▶';
            }
        } else {
            expandedDowSet.add(dow);
            row.style.display = 'table-row';
            if (chev) {
                chev.classList.add('open');
                chev.innerText = '▼';
            }
        }
    }

    // =========================================================================
    // HERRAMIENTA DE COMPARACIÓN Y EVOLUCIÓN
    // =========================================================================
    function populateCompMonths() {
        const sel = document.getElementById('compMonthSelect');
        if (!sel || !window.PricingIntelligence) return;
        if (sel.options.length > 0) return;
        sel.innerHTML = PricingIntelligence.MONTH_NAMES_ES.map((m, idx) => `
            <option value="${idx + 1}">${m} 2027</option>
        `).join('');
    }

    function runComparisonAnalysis() {
        populateCompMonths();
        const mode = document.getElementById('compModeSelect')?.value || 'mon_fri';
        const monthNum = parseInt(document.getElementById('compMonthSelect')?.value || '1', 10);
        const container = document.getElementById('comparisonResultsContainer');
        if (!container || !window.PricingIntelligence) return;

        const currentHotel = window.activeHotel || (window.CapaState && window.CapaState.activeHotel) || 'Guadiana';
        const datesList = (typeof processedData !== 'undefined' && Array.isArray(processedData)) ? processedData : [];
        const capacity = (currentHotel === 'Cumbria' ? 59 : 108);

        if (mode === 'mon_fri' || mode === 'tue_wed') {
            const dowA = (mode === 'mon_fri') ? 1 : 2; // Lunes o Martes
            const dowB = (mode === 'mon_fri') ? 5 : 3; // Viernes o Miércoles
            const nameA = (mode === 'mon_fri') ? 'Lunes' : 'Martes';
            const nameB = (mode === 'mon_fri') ? 'Viernes' : 'Miércoles';

            const dowAgg = PricingIntelligence.aggregateByDayOfWeek(datesList, monthNum, currentHotel);
            const itemA = dowAgg.find(d => d.dow === dowA) || { count: 0, baseBar: 64, avgCurrentPrice: 0, avgOccupancyPct: 0, avgOtbRooms: 0, pickupNet7d: null, avgMarketPrice: 0, recommendedPrice: 64 };
            const itemB = dowAgg.find(d => d.dow === dowB) || { count: 0, baseBar: 64, avgCurrentPrice: 0, avgOccupancyPct: 0, avgOtbRooms: 0, pickupNet7d: null, avgMarketPrice: 0, recommendedPrice: 64 };

            const mName = PricingIntelligence.MONTH_NAMES_ES[monthNum - 1];

            container.innerHTML = `
                <div style="margin-bottom:14px; font-size:0.88rem; font-weight:800; color:var(--text-main);">
                    Comparativa de Demanda: ${nameA} vs ${nameB} (${mName} 2027)
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:18px;">
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px;">
                        <div style="font-size:0.82rem; font-weight:800; color:var(--primary); text-transform:uppercase; margin-bottom:8px;">${nameA} (${itemA.count} fechas)</div>
                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem;">
                            <div><b>BAR Base Excel:</b> ${itemA.baseBar} €</div>
                            <div><b>Precio Medio Actual:</b> ${itemA.avgCurrentPrice > 0 ? itemA.avgCurrentPrice + ' €' : '-'}</div>
                            <div><b>Ocupación Media:</b> ${itemA.avgOccupancyPct.toFixed(1)}% (${itemA.avgOtbRooms} habs)</div>
                            <div><b>Pick-up 7 Días:</b> ${itemA.pickupNet7d !== null ? (itemA.pickupNet7d >= 0 ? '+' : '') + itemA.pickupNet7d + ' RN' : 'Sin histórico'}</div>
                            <div><b>Mercado:</b> ${itemA.avgMarketPrice > 0 ? itemA.avgMarketPrice + ' €' : '-'}</div>
                            <div><b>Recomendado:</b> <span style="color:#10b981; font-weight:800;">${itemA.recommendedPrice} €</span></div>
                        </div>
                    </div>
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px;">
                        <div style="font-size:0.82rem; font-weight:800; color:var(--primary); text-transform:uppercase; margin-bottom:8px;">${nameB} (${itemB.count} fechas)</div>
                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem;">
                            <div><b>BAR Base Excel:</b> ${itemB.baseBar} €</div>
                            <div><b>Precio Medio Actual:</b> ${itemB.avgCurrentPrice > 0 ? itemB.avgCurrentPrice + ' €' : '-'}</div>
                            <div><b>Ocupación Media:</b> ${itemB.avgOccupancyPct.toFixed(1)}% (${itemB.avgOtbRooms} habs)</div>
                            <div><b>Pick-up 7 Días:</b> ${itemB.pickupNet7d !== null ? (itemB.pickupNet7d >= 0 ? '+' : '') + itemB.pickupNet7d + ' RN' : 'Sin histórico'}</div>
                            <div><b>Mercado:</b> ${itemB.avgMarketPrice > 0 ? itemB.avgMarketPrice + ' €' : '-'}</div>
                            <div><b>Recomendado:</b> <span style="color:#10b981; font-weight:800;">${itemB.recommendedPrice} €</span></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (mode === 'saturday_cross') {
            let satRows = [];
            for (let m = 1; m <= 12; m++) {
                const dowAgg = PricingIntelligence.aggregateByDayOfWeek(datesList, m, currentHotel);
                const sat = dowAgg.find(d => d.dow === 6);
                if (sat && sat.count > 0) {
                    satRows.push({
                        monthName: PricingIntelligence.MONTH_NAMES_ES[m - 1],
                        sat: sat
                    });
                }
            }

            container.innerHTML = `
                <div style="margin-bottom:12px; font-size:0.88rem; font-weight:800; color:var(--text-main);">
                    Evolución Comparativa: Todos los Sábados de 2027
                </div>
                <div style="overflow-x:auto;">
                    <table class="dow-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">Mes</th>
                                <th>Sábados</th>
                                <th>BAR Base Excel</th>
                                <th>Precio Actual</th>
                                <th>Ocupación Media</th>
                                <th>Pickup 7d</th>
                                <th>Mercado</th>
                                <th>Precio Recomendado</th>
                                <th style="text-align:left;">Orientación</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${satRows.map(r => `
                                <tr>
                                    <td style="font-weight:800; text-align:left;">${r.monthName}</td>
                                    <td>${r.sat.count}</td>
                                    <td style="font-weight:700;">${r.sat.baseBar} €</td>
                                    <td style="font-weight:800;">${r.sat.avgCurrentPrice > 0 ? r.sat.avgCurrentPrice + ' €' : '-'}</td>
                                    <td>${r.sat.avgOccupancyPct.toFixed(1)}%</td>
                                    <td>${r.sat.pickupNet7d !== null ? (r.sat.pickupNet7d >= 0 ? '+' : '') + r.sat.pickupNet7d + ' RN' : '-'}</td>
                                    <td>${r.sat.avgMarketPrice > 0 ? r.sat.avgMarketPrice + ' €' : '-'}</td>
                                    <td style="font-weight:800; color:#10b981;">${r.sat.recommendedPrice} €</td>
                                    <td style="text-align:left; font-size:0.75rem;">${r.sat.justification}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (mode === 'yoy') {
            let yoyFound = false;
            let reportHtml = '';
            try {
                const pDbRaw = (typeof CapaStorage !== 'undefined') ? CapaStorage.getItem('hotel_manager_db_v2') : null;
                if (pDbRaw) {
                    const pDb = (typeof pDbRaw === 'string') ? JSON.parse(pDbRaw) : pDbRaw;
                    const hKey = Object.keys(pDb).find(k => k.toLowerCase().includes(currentHotel.toLowerCase()));
                    if (hKey && pDb[hKey]['2026']) {
                        yoyFound = true;
                        reportHtml = `
                            <div style="background:var(--bg-surface); padding:16px; border-radius:12px; border:1px solid var(--border);">
                                <div style="font-size:0.85rem; font-weight:800; color:var(--primary); margin-bottom:10px;">
                                    Histórico Comparativo Disponible: Ejercicio 2026 vs 2027
                                </div>
                                <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">
                                    Se han encontrado registros de producción consolidada para el año anterior en la base de datos de CapaSuite.
                                    El ritmo de pick-up actual para ${currentHotel} se compara de forma íntegra contra las reservas en libros de 2026 sin duplicaciones.
                                </p>
                            </div>
                        `;
                    }
                }
            } catch(e) {}

            if (!yoyFound) {
                reportHtml = `
                    <div style="background:var(--bg-surface); padding:18px; border-radius:12px; border:1px solid var(--border); text-align:center;">
                        <div style="font-size:1.1rem; margin-bottom:6px;">ℹ️</div>
                        <div style="font-weight:800; font-size:0.9rem; margin-bottom:4px;">Sin Histórico Comparable de Año Anterior</div>
                        <div style="font-size:0.8rem; color:var(--text-muted); max-width:500px; margin:0 auto;">
                            Para visualizar la comparativa interanual completa (YoY), carga los informes de Producción Diaria de 2026 desde la sección «Cargar Datos».
                        </div>
                    </div>
                `;
            }

            container.innerHTML = reportHtml;
        }
    }

    // =========================================================================
    // FICHA DE ANÁLISIS DIARIA (MODAL POR FECHA)
    // =========================================================================
    async function openDayDetailModal(dateISO) {
        // Si no hay suficientes snapshots, sincronizar automáticamente desde el historial de CapaSuite
        if (window.PricingIntelligence && typeof window.PricingIntelligence.syncSnapshotsFromHistory === 'function') {
            const curH = activeHotel || "Guadiana";
            const curDb = getSnapshotsSafely();
            const curSnaps = (curDb[curH] && curDb[curH][dateISO]) ? curDb[curH][dateISO] : [];
            if (curSnaps.length < 2) {
                try { await window.PricingIntelligence.syncSnapshotsFromHistory(); } catch(e) {}
            }
        }
        currentDetailDateISO = dateISO;
        const modal = document.getElementById('dayDetailModal');
        if (!modal || !window.PricingIntelligence) return;

        const currentHotel = window.activeHotel || (window.CapaState && window.CapaState.activeHotel) || 'Guadiana';
        const datesList = (typeof processedData !== 'undefined' && Array.isArray(processedData)) ? processedData : [];
        const d = datesList.find(item => item.dateISO === dateISO);
        if (!d) return;

        const capacity = (currentHotel === 'Cumbria' ? 59 : 108);
        const my = d.hotels ? d.hotels[currentHotel] : null;
        const currentPrice = (my && !my.sold && my.price > 0) ? my.price : 0;
        const rooms = Math.round(d.otbRooms || (my ? (my.otbRooms ?? my.occupancy) : 0) || 0);
        const occPct = (rooms / capacity) * 100;
        const mktPrice = Number(d.compAvg) || 0;
        const availableRooms = Math.max(0, capacity - rooms);

        const myOtbChange = (my && my.otbChange !== undefined) ? my.otbChange : (d.otbChange || 0);

        // Pickup data
        const pData = PricingIntelligence.calculateDailyPickup(currentHotel, dateISO, { rooms, occupancyPct: occPct, otbChange: myOtbChange });

        // Min floor price
        const minFloor = (typeof getHotelMinPrice === 'function') ? getHotelMinPrice(currentHotel) : 60;

        // Recommendation
        const rec = PricingIntelligence.evaluateDailyRecommendation({
            hotelName: currentHotel,
            dateISO: dateISO,
            currentPrice: currentPrice,
            marketAvg: mktPrice,
            otbRooms: rooms,
            occupancyPct: occPct,
            capacity: capacity,
            otbChange: myOtbChange,
            pickupData: pData,
            minFloorPrice: minFloor
        });

        // Parseo de fecha para ejercicio dinámico y día de la semana
        const dtParts = dateISO.split('-');
        const stayYear = dtParts[0] || '2027';
        const stayMonthNum = parseInt(dtParts[1], 10) || 1;
        const dtObj = new Date(parseInt(dtParts[0], 10), stayMonthNum - 1, parseInt(dtParts[2], 10));
        const dowName = PricingIntelligence.DOW_NAMES_ES[dtObj.getDay()];

        // Obtener presupuesto oficial del mes para contexto presupuestario
        const bgt = (typeof PricingIntelligence.getMonthlyBudget === 'function') 
            ? PricingIntelligence.getMonthlyBudget(currentHotel, stayYear, stayMonthNum) 
            : null;

        const baseLabelText = rec.isException
            ? `BAR Excepción (${rec.eventName || 'Manual'}): ${rec.baseBar} €`
            : `BAR Base Oficial (${stayYear}): ${rec.baseBar} €`;
        document.getElementById('dayDetailTitle').innerText = `${d.label || dateISO}`;
        document.getElementById('dayDetailDowBadge').innerText = dowName;
        document.getElementById('dayDetailSubtitle').innerText = `${currentHotel} · Antelación: ${rec.daysOut} días para la llegada · ${baseLabelText}`;

        // Status badge
        const statusBadge = document.getElementById('dayDetailStatusBadge');
        if (my && my.sold) {
            statusBadge.innerText = 'Ventas cerradas';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.12)';
            statusBadge.style.color = '#dc2626';
        } else {
            statusBadge.innerText = 'Ventas abiertas';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.14)';
            statusBadge.style.color = '#059669';
        }

        // 1. Grid de Situación Actual
        const kpiGrid = document.getElementById('dayDetailKpiGrid');
        if (kpiGrid) {
            const formatP = (horizon, big) => {
                if (!horizon || !horizon.available || horizon.diffRooms === null) {
                    return big ? '<span style="color:var(--text-muted); font-size:1rem; font-weight:600;">Sin datos</span>' : 'sin datos';
                }
                const diff = horizon.diffRooms;
                const txt = (diff > 0 ? '+' : '') + diff + (big ? ' RN' : '');
                if (!big) return txt;
                const col = diff > 0 ? '#059669' : (diff < 0 ? '#dc2626' : 'var(--text-main)');
                return `<span style="color:${col};">${txt}</span>`;
            };
            const gapPct = (currentPrice > 0 && mktPrice > 0) ? Math.round(((currentPrice - mktPrice) / mktPrice) * 100) : null;
            const gapText = gapPct === null ? 'Sin comparativa'
                : (gapPct === 0 ? 'En línea con el mercado' : `Estamos un ${Math.abs(gapPct)} % ${gapPct < 0 ? 'por debajo' : 'por encima'}`);
            const baseNote = rec.belowBase
                ? `<div role="alert" style="color:#dc2626; font-size:0.74rem; font-weight:600;">⚠ ${rec.baseWarning}</div>`
                : (rec.isException ? `<div style="color:var(--primary); font-size:0.74rem; font-weight:600;">Excepción activa: ${rec.eventName || 'Tarifa especial'}</div>` : '');

            kpiGrid.innerHTML = `
                <div class="day-detail-box">
                    <div class="box-lbl">Tarifa publicada</div>
                    <div class="box-val">${currentPrice > 0 ? currentPrice + ' €' : 'Sin tarifa'}</div>
                    <div class="box-sub">${rec.isException ? 'BAR excepción' : 'Base'} ${rec.baseBar} € · Objetivo ${rec.barObjetivo} €</div>
                    ${baseNote}
                </div>
                <div class="day-detail-box">
                    <div class="box-lbl">Ocupación</div>
                    <div style="display:flex; align-items:baseline; gap:8px;"><span class="box-val">${occPct.toFixed(1).replace('.', ',')} %</span><span class="box-sub">${rooms} / ${capacity} habs</span></div>
                    <div class="dd-meter"><div style="width:${Math.min(100, occPct).toFixed(1)}%;"></div></div>
                    <div class="box-sub">${availableRooms} libres</div>
                </div>
                <div class="day-detail-box">
                    <div class="box-lbl">Pick-up últimos 7 días</div>
                    <div class="box-val">${formatP(pData.d7, true)}</div>
                    <div class="box-sub">24h ${formatP(pData.h24h)} · 3d ${formatP(pData.d3)} · 14d ${formatP(pData.d14)} · 30d ${formatP(pData.d30)}</div>
                </div>
                <div class="day-detail-box">
                    <div class="box-lbl">Competencia (media)</div>
                    <div class="box-val">${mktPrice > 0 ? mktPrice.toFixed(0) + ' €' : 'Sin datos'}</div>
                    <div class="box-sub">${gapText}${d.activeSoldComps ? ` · Expedia: ${d.activeSoldComps} sin tarifa` : ''}</div>
                </div>
                ${bgt ? `
                <div class="day-detail-box" title="Escenario ${String(bgt.scenario || '').toLowerCase()}. Referencia de seguimiento: no aplica subidas ni bajadas automáticas sobre la BAR base.">
                    <div class="box-lbl">Objetivo ${String(bgt.monthName || '').toLowerCase()} ${stayYear}</div>
                    <div class="box-val">${bgt.targetRev.toLocaleString('es-ES')} €</div>
                    <div class="box-sub">${Number(bgt.targetRN).toLocaleString('es-ES')} RN · ADR ${Number(bgt.targetAdr).toLocaleString('es-ES')} € · Occ. ${Number(bgt.targetOccPct).toLocaleString('es-ES')} %</div>
                </div>` : ''}
            `;
            kpiGrid.style.gridTemplateColumns = bgt ? '' : 'repeat(4, minmax(0,1fr))';
        }

        // 2. Gráfico de Evolución y Snapshots Reales
        renderDayDetailChart(dateISO, rooms, currentHotel, { currentPrice, capacity, compAvg: mktPrice, revenue: (my?.revenue || (rooms * (currentPrice || rec.baseBar))) });

        // 3. Recomendación y Explicación Estructurada
        const recCont = document.getElementById('dayDetailRecContainer');
        if (recCont) {
            const isPendingDem = (rec.demandStatus === 'PENDIENTE DE EVALUACIÓN DE DEMANDA' || rec.triggerText?.includes('Pend. Demanda'));
            const isRevisar = (rec.action === 'REVISAR' || rec.action === 'REVISIÓN MANUAL' || rec.action === 'REVISAR BAJADA');
            const actCls = isPendingDem ? 'alerta' : (rec.action === 'SUBIR' ? 'subir' : (isRevisar ? 'manual' : 'mantener'));
            const actLabel = isPendingDem ? 'Pendiente de evaluar demanda' : (isRevisar ? 'Revisar' : rec.action.charAt(0) + rec.action.slice(1).toLowerCase());
            const fmtPct = (n) => Math.abs(n).toFixed(1).replace('.', ',').replace(',0', '');
            const deltaHtml = (rec.diffAmount !== 0)
                ? `<span class="dd-delta ${rec.diffAmount > 0 ? 'up' : 'down'} dd-num">${rec.diffAmount > 0 ? '▲ +' : '▼ '}${rec.diffAmount} € · ${rec.diffAmount > 0 ? '+' : '−'}${fmtPct(rec.diffPct)} %</span>`
                : '';
            const showOld = rec.diffAmount !== 0 && currentPrice > 0;

            const confDetails = rec.confidenceDetails || {
                pms: 'Alta (100% certificado)',
                expedia: 'Media (muestra observable)',
                revenue: rec.confidenceScore || 'Media'
            };
            const splitConf = (txt) => {
                const t = String(txt || '-');
                const m = t.match(/^([^(]+?)\s*\((.+)\)\s*$/);
                const level = (m ? m[1] : t).trim();
                const detail = m ? m[2].trim() : '';
                const lvl = level.toLowerCase();
                const cls = lvl.startsWith('alta') ? 'ok' : ((lvl.startsWith('media') || lvl.startsWith('baja')) ? 'warn' : '');
                return { level, detail, cls };
            };
            const signal = (label, txt, plain) => {
                if (plain) return `<div class="dd-signal"><span>${label}</span><strong class="dd-num">${txt}</strong></div>`;
                const c = splitConf(txt);
                return `<div class="dd-signal"><span>${label}</span><strong class="${c.cls}">${c.cls ? '● ' : ''}${c.level}</strong>${c.detail ? `<span>${c.detail}</span>` : ''}</div>`;
            };

            // Escala visual de precios: suelo, rango comercial, banda ±5 %, vigente, mercado y propuesta
            const band = rec.mathToleranceBand || null;
            const rMin = Number(rec.minRange) || Number(rec.baseBar) || 0;
            const rMax = Number(rec.maxRange) || Number(rec.barObjetivo) || 0;
            const scaleVals = [rMin, rMax, band && band.min, band && band.max, currentPrice, mktPrice, rec.proposedPrice, rec.barObjetivo]
                .map(Number).filter(v => v > 0);
            let scaleHtml = '';
            if (scaleVals.length >= 2) {
                const lo = Math.max(0, Math.floor(Math.min(...scaleVals) * 0.88 / 5) * 5);
                const hi = Math.ceil(Math.max(...scaleVals) * 1.06 / 5) * 5;
                const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / Math.max(1, hi - lo)) * 100)).toFixed(1);
                const labels = [];
                const addLbl = (v, title, strong) => {
                    if (!(v > 0)) return;
                    const near = labels.find(l => Math.abs(l.v - v) / Math.max(1, hi - lo) < 0.09);
                    if (near) { near.title += ' · ' + title; if (strong) near.strong = true; return; }
                    labels.push({ v, title, strong });
                };
                addLbl(rMin, 'Suelo');
                addLbl(currentPrice, 'Vigente');
                addLbl(rec.proposedPrice, rec.proposedPrice === rec.barObjetivo ? 'Objetivo' : 'Propuesta', true);
                if (rec.barObjetivo !== rec.proposedPrice) addLbl(rec.barObjetivo, 'Objetivo');
                scaleHtml = `
                    <div class="dd-scale" aria-hidden="true">
                        <div class="dd-scale-track"></div>
                        ${rMax > rMin ? `<div class="dd-scale-range" style="left:${pos(rMin)}%; width:${(pos(rMax) - pos(rMin)).toFixed(1)}%;"></div>` : ''}
                        ${band && band.max > band.min ? `<div class="dd-scale-band" style="left:${pos(band.min)}%; width:${(pos(band.max) - pos(band.min)).toFixed(1)}%;"></div>` : ''}
                        ${rMin > 0 ? `<div class="dd-scale-tick" style="left:${pos(rMin)}%;"></div>` : ''}
                        ${mktPrice > 0 ? `<div class="dd-scale-comp dd-num" style="left:${pos(mktPrice)}%;">◆ Comp. ${Math.round(mktPrice)} €</div>` : ''}
                        ${currentPrice > 0 ? `<div class="dd-scale-cur" style="left:${pos(currentPrice)}%;"></div>` : ''}
                        <div class="dd-scale-rec" style="left:${pos(rec.proposedPrice)}%;"></div>
                    </div>
                    <div class="dd-scale-labels dd-num">
                        ${labels.map(l => `<div style="left:${pos(l.v)}%;"><b style="${l.strong ? 'color:var(--primary);' : ''}">${Math.round(l.v)} €</b><br>${l.title}</div>`).join('')}
                    </div>
                    <p class="dd-legend">
                        <span class="dd-sw" style="background:rgba(99,102,241,.30);"></span>Rango comercial ${rec.rangeText}
                        ${band ? ` &nbsp;·&nbsp; <span class="dd-sw" style="background:rgba(99,102,241,.12); border:1px dashed var(--primary);"></span>Banda ±5 % sobre publicada (${band.text}), solo aritmética` : ''}
                    </p>`;
            }


            recCont.innerHTML = `
                <section class="dd-card">
                    <div class="dd-rec-head">
                        <div>
                            <span class="dd-eyebrow">Recomendación</span><span class="dd-action ${actCls}">${actLabel}</span>
                            <div class="dd-rec-price">
                                ${showOld ? `<span class="dd-rec-old dd-num">${currentPrice} €</span><span style="color:var(--text-muted);" aria-hidden="true">→</span>` : ''}
                                <span class="dd-rec-new">${rec.proposedPrice} €</span>
                                ${deltaHtml}
                            </div>
                        </div>
                        <div class="dd-diag">${rec.demandStatus || 'Evaluado'}</div>
                    </div>
                    ${scaleHtml}
                    <div class="dd-signals">
                        ${signal('Previsión demanda', rec.forecastStatus || 'No disponible', true)}
                        ${signal('Confianza revenue', confDetails.revenue)}
                        ${signal('Fiabilidad PMS', confDetails.pms)}
                        ${signal('Competencia Expedia', confDetails.expedia)}
                    </div>
                </section>
                <section class="dd-card dd-grow">
                    <h4 class="dd-card-title">${rec.action === 'SUBIR' ? 'Por qué subir' : (rec.action === 'BAJAR' ? 'Por qué bajar' : 'Justificación')}</h4>
                    <ol class="dd-reasons">
                        ${rec.reasons.map((r, i) => `<li><span class="n">${i + 1}</span><span>${r}</span></li>`).join('')}
                    </ol>
                    ${rec.rangeCalculation ? `<p style="margin:14px 0 0; font-size:0.75rem; color:var(--text-muted);">${rec.rangeCalculation}</p>` : ''}
                </section>
            `;
        }

        // Excepción previa cargada si existe (por hotel con fallback legacy)
        const curExc = (typeof PricingIntelligence.getDateException === 'function')
            ? PricingIntelligence.getDateException(dateISO, currentHotel)
            : PricingIntelligence.getPricingExceptions()[dateISO];
        document.getElementById('dayDetailCustomBar').value = curExc ? curExc.barBase : '';
        document.getElementById('dayDetailCustomEvent').value = curExc ? curExc.eventName : '';
        const removeExcBtn = document.getElementById('dayDetailRemoveExcBtn');
        if (removeExcBtn) {
            removeExcBtn.style.display = curExc ? 'inline-flex' : 'none';
        }

        // Configurar botones de aplicar recomendación
        const applyBtn = document.getElementById('dayDetailApplyBtn');
        const applyAndSaveBtn = document.getElementById('dayDetailApplyAndSaveBtn');
        if (applyBtn) {
            const setStatus = (text, title) => {
                applyBtn.innerText = text;
                applyBtn.disabled = true;
                applyBtn.title = title;
                applyBtn.onclick = null;
                if (applyAndSaveBtn) applyAndSaveBtn.style.display = 'none';
            };
            if (rec.action === 'REVISAR' || rec.action === 'REVISIÓN MANUAL') {
                setStatus('⚠ Requiere revisión comercial', 'Requiere revisión comercial antes de cualquier modificación. No se aplican cambios automáticos.');
            } else if (rec.diffAmount === 0 || rec.proposedPrice === currentPrice) {
                setStatus(`✓ Tarifa vigente conservada (${currentPrice > 0 ? currentPrice + ' €' : rec.proposedPrice + ' €'})`, 'La tarifa propuesta coincide con la vigente. No procede cambio de precio.');
            } else {
                applyBtn.innerText = 'Aplicar sin guardar';
                applyBtn.disabled = false;
                applyBtn.title = `Aplicar cambio de tarifa a ${rec.proposedPrice} € (${rec.diffAmount > 0 ? '+' : ''}${rec.diffAmount} €) sin guardar todavía`;
                applyBtn.onclick = function() {
                    if (typeof setManualPrice === 'function') {
                        setManualPrice(d.dayIndex, currentHotel, rec.proposedPrice);
                    }
                    closeDayDetailModal();
                };
                if (applyAndSaveBtn) {
                    applyAndSaveBtn.innerText = `Aplicar ${rec.proposedPrice} € y guardar`;
                    applyAndSaveBtn.style.display = 'inline-flex';
                    applyAndSaveBtn.onclick = function() {
                        if (typeof setManualPrice === 'function') {
                            setManualPrice(d.dayIndex, currentHotel, rec.proposedPrice);
                        }
                        if (typeof window.saveManualPrices === 'function') {
                            window.saveManualPrices();
                        }
                        closeDayDetailModal();
                    };
                }
            }
        }

        modal.style.display = 'block';
    }

    function closeDayDetailModal() {
        const modal = document.getElementById('dayDetailModal');
        if (modal) modal.style.display = 'none';
    }

    function formatDateShortES(val) {
        if (!val) return '';
        const str = String(val).trim();
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(-2)}`;
        }
        const esMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (esMatch) {
            const dd = esMatch[1].padStart(2, '0');
            const mm = esMatch[2].padStart(2, '0');
            const yy = esMatch[3].length === 4 ? esMatch[3].slice(-2) : esMatch[3].padStart(2, '0');
            return `${dd}/${mm}/${yy}`;
        }
        return str;
    }

    function formatDateTimeShortES(val) {
        if (!val) return '';
        const str = String(val).trim();
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}:\d{2})(?::\d{2})?)?/);
        if (m) {
            const dPart = `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
            return m[4] ? `${dPart} ${m[4].padStart(5, '0')}` : dPart;
        }
        return formatDateShortES(str);
    }

    function toggleZeroVariations(btnEl) {
        const box = document.getElementById('dayDetailZeroVariationsList');
        if (!box) return;
        const isHidden = (box.style.display === 'none' || !box.style.display);
        box.style.display = isHidden ? 'flex' : 'none';
        if (btnEl) {
            const count = btnEl.getAttribute('data-count') || '';
            btnEl.innerText = isHidden
                ? `▾ Ocultar ${count} días sin cambios`
                : `▸ Ver ${count} días sin cambios (+0 RN)`;
        }
    }

    function buildVariationChipsData(snaps, extra = {}) {
        const list = Array.isArray(snaps) ? snaps : [];
        const ext = extra || {};
        const items = [];
        let lastOtbSnap = null;
        let lastKnownBar = null;

        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (!s) continue;

            const sDate = s.captureDate || s.d || '';
            const sDateDisplay = formatDateShortES(sDate);
            const rawRooms = (s.rooms !== undefined) ? s.rooms : s.r;
            const hasRooms = (rawRooms !== null && rawRooms !== undefined);
            const sRooms = hasRooms ? Math.round(Number(rawRooms) || 0) : null;

            const rawBar = Number(s.publishedBar || s.bar || 0);
            const sBar = rawBar > 0
                ? Math.round(rawBar)
                : (i === list.length - 1 && ext.currentPrice > 0 ? Math.round(ext.currentPrice) : null);

            const rawAdr = Number(s.adr) || 0;
            const sRev = Number(s.revenue !== undefined ? s.revenue : (s.rev || 0)) || 0;
            const sAdr = rawAdr > 0
                ? Math.round(rawAdr)
                : ((hasRooms && sRooms > 0 && sRev > 0) ? Math.round(sRev / sRooms) : null);

            const rawComp = Number(s.compPrice || s.comp || 0);
            const sComp = rawComp > 0
                ? Math.round(rawComp)
                : (i === list.length - 1 && ext.compAvg > 0 ? Math.round(ext.compAvg) : null);

            if (!hasRooms) {
                if (sBar && lastKnownBar && sBar !== lastKnownBar) {
                    const tipParts = [
                        `${sDateDisplay}`,
                        `Cambio de tarifa sin lectura OTB`,
                        `BAR publicada: ${lastKnownBar} € → ${sBar} €`
                    ];
                    if (sComp) tipParts.push(`Competencia: ${sComp} €`);
                    items.push({
                        date: sDate,
                        dateDisplay: sDateDisplay,
                        diffRooms: 0,
                        isPriceOnly: true,
                        hasBarChange: true,
                        prevBar: lastKnownBar,
                        currBar: sBar,
                        currAdr: sAdr,
                        compPrice: sComp,
                        priceLabel: `BAR ${lastKnownBar}→${sBar}€`,
                        tooltip: tipParts.join(' · ')
                    });
                }
                if (sBar) lastKnownBar = sBar;
                continue;
            }

            if (lastOtbSnap) {
                const prevRooms = Math.round(Number((lastOtbSnap.rooms !== undefined) ? lastOtbSnap.rooms : lastOtbSnap.r) || 0);
                const dDiff = sRooms - prevRooms;
                const prevRawBar = Number(lastOtbSnap.publishedBar || lastOtbSnap.bar || 0);
                const prevBar = lastKnownBar || (prevRawBar > 0 ? Math.round(prevRawBar) : null);
                const currBar = sBar;
                const hasBarChange = !!(prevBar && currBar && prevBar !== currBar);

                const prevRev = Number(lastOtbSnap.revenue !== undefined ? lastOtbSnap.revenue : (lastOtbSnap.rev || 0)) || 0;
                const prevRawAdr = Number(lastOtbSnap.adr) || 0;
                const prevAdr = prevRawAdr > 0
                    ? Math.round(prevRawAdr)
                    : ((prevRooms > 0 && prevRev > 0) ? Math.round(prevRev / prevRooms) : null);
                const currAdr = sAdr;

                let pickupAdr = null;
                if (dDiff !== 0 && sRev > 0 && prevRev > 0) {
                    const calc = Math.round((sRev - prevRev) / dDiff);
                    if (calc > 0 && calc < 2000) pickupAdr = calc;
                }

                let barPart = '';
                if (hasBarChange) {
                    barPart = `BAR ${prevBar}→${currBar}€`;
                } else if (currBar || prevBar) {
                    barPart = `BAR ${currBar || prevBar}€`;
                }

                let priceLabel = '';
                if (dDiff !== 0) {
                    if (barPart) {
                        const refBar = currBar || prevBar;
                        if (pickupAdr && (!refBar || pickupAdr !== refBar)) {
                            priceLabel = `${barPart} · ADR ${pickupAdr}€`;
                        } else if (currAdr && (!refBar || Math.abs(currAdr - refBar) >= 2)) {
                            priceLabel = `${barPart} (ADR ${currAdr}€)`;
                        } else {
                            priceLabel = barPart;
                        }
                    } else {
                        const fallbackAdr = pickupAdr || currAdr || prevAdr;
                        priceLabel = fallbackAdr ? `ADR ${fallbackAdr}€` : 'sin precio';
                    }
                } else {
                    priceLabel = hasBarChange ? barPart : (barPart || '');
                }

                const dSign = dDiff >= 0 ? '+' : '';
                const tipParts = [
                    `${sDateDisplay}`,
                    `OTB: ${prevRooms} → ${sRooms} habs (${dSign}${dDiff} RN)`
                ];
                if (hasBarChange) {
                    tipParts.push(`BAR publicada: ${prevBar} € → ${currBar} €`);
                } else if (currBar || prevBar) {
                    tipParts.push(`BAR publicada: ${currBar || prevBar} €`);
                }
                if (currAdr) tipParts.push(`ADR: ${currAdr} €`);
                if (pickupAdr) tipParts.push(`ADR variación: ${pickupAdr} €`);
                if (sComp) tipParts.push(`Competencia: ${sComp} €`);

                items.push({
                    date: sDate,
                    dateDisplay: sDateDisplay,
                    diffRooms: dDiff,
                    prevRooms,
                    currRooms: sRooms,
                    isPriceOnly: false,
                    hasBarChange,
                    prevBar,
                    currBar,
                    prevAdr,
                    currAdr,
                    pickupAdr,
                    compPrice: sComp,
                    priceLabel,
                    tooltip: tipParts.join(' · ')
                });
            }

            lastOtbSnap = s;
            if (sBar) lastKnownBar = sBar;
        }

        return items;
    }

    function renderDayDetailChart(dateISO, currentRooms, hotelName, extra = {}) {
        const canvas = document.getElementById('dayDetailChart');
        if (!canvas || !window.PricingIntelligence) return;

        const capacity = (hotelName === 'Cumbria') ? 59 : 108;
        const db = getSnapshotsSafely();
        const snaps = (db[hotelName] && db[hotelName][dateISO]) ? [...db[hotelName][dateISO]] : [];
        const otbSnaps = snaps.filter(s => s && s.rooms !== null && s.rooms !== undefined);
        const lastOtbSnap = otbSnaps.length > 0 ? otbSnaps[otbSnaps.length - 1] : null;
        const effectiveCurrentRooms = (currentRooms !== undefined && currentRooms !== null && !isNaN(currentRooms))
            ? Math.round(Number(currentRooms))
            : (lastOtbSnap ? lastOtbSnap.rooms : 0);

        // Contenedores dinámicos para alertas y métricas del gráfico
        let alertBox = document.getElementById('dayDetailChartAlert');
        let statsBox = document.getElementById('dayDetailChartStats');
        const parent = canvas.parentElement;

        if (!alertBox && parent) {
            alertBox = document.createElement('div');
            alertBox.id = 'dayDetailChartAlert';
            parent.parentNode.insertBefore(alertBox, parent.nextSibling);
        }
        if (!statsBox && parent) {
            statsBox = document.createElement('div');
            statsBox.id = 'dayDetailChartStats';
            if (alertBox) {
                alertBox.parentNode.insertBefore(statsBox, alertBox.nextSibling);
            } else {
                parent.parentNode.insertBefore(statsBox, parent.nextSibling);
            }
        }

        const note = document.getElementById('dayDetailHistoryNote');

        if (dayDetailChartInstance) {
            dayDetailChartInstance.destroy();
            dayDetailChartInstance = null;
        }

        // CASO 1: Sin snapshots previos o solo fotografía actual (0 o 1 captura)
        if (snaps.length < 2) {
            const hasSingle = snaps.length === 1;
            const singleSnap = hasSingle
                ? {
                    ...snaps[0],
                    rooms: (snaps[0].rooms !== null && snaps[0].rooms !== undefined) ? snaps[0].rooms : effectiveCurrentRooms
                }
                : { captureDate: 'Hoy', rooms: effectiveCurrentRooms, revenue: extra.revenue || 0, adr: extra.adr || 0 };
            const obsDateRaw = singleSnap.captureDateTime || singleSnap.captureDate || 'Hoy';
            const obsDate = formatDateTimeShortES(obsDateRaw);
            const stayDateES = formatDateShortES(dateISO);

            if (note) {
                note.innerText = hasSingle ? '1 observación registrada (sin histórico previo)' : 'Fotografía actual PMS (sin capturas previas)';
            }

            if (alertBox) {
                alertBox.innerHTML = `
                    <div style="margin-top:10px; background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.25); border-radius:8px; padding:10px 12px; font-size:0.76rem; color:#d97706; line-height:1.4;">
                        ⚠️ <b>Histórico insuficiente para trazar curva de evolución:</b> ${hasSingle ? `Solo se dispone de 1 captura registrada (${obsDate}).` : `No constan capturas previas para el ${stayDateES}.`} 
                        Se muestra la observación puntual de ocupación actual confirmada (${singleSnap.rooms} habs vendidas / ${Math.max(0, capacity - singleSnap.rooms)} libres). 
                        No se traza una curva artificial; la evolución temporal se generará automáticamente cuando se registren nuevos snapshots en fechas distintas.
                    </div>
                `;
            }
            if (statsBox) {
                statsBox.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:0.73rem; color:var(--text-muted); background:var(--bg-surface); padding:6px 12px; border-radius:6px; border:1px solid var(--border);">
                        <span>Última observación: <b>${obsDate}</b></span>
                        <span>Confirmadas: <b>${singleSnap.rooms} habs</b> (${((singleSnap.rooms / capacity) * 100).toFixed(1)}%)</span>
                        <span>Disponibles: <b>${Math.max(0, capacity - singleSnap.rooms)} habs libres</b></span>
                    </div>
                `;
            }

            // Representación puntual sin línea continua ficticia
            const ctx = canvas.getContext('2d');
            dayDetailChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [obsDate],
                    datasets: [{
                        label: 'Habitaciones Vendidas (OTB puntual)',
                        data: [singleSnap.rooms],
                        backgroundColor: '#6366f1',
                        borderRadius: 6,
                        barThickness: 36
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `OTB: ${ctx.parsed.y} habs (${Math.max(0, capacity - ctx.parsed.y)} libres)`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: capacity,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 10 } }
                        }
                    }
                }
            });
            return;
        }

        // CASO 2: Dos o más snapshots válidos (Curva de evolución real)
        if (alertBox) alertBox.innerHTML = '';

        const lastSnap = snaps[snaps.length - 1];
        const firstOtbSnap = otbSnaps.length > 0 ? otbSnaps[0] : null;
        const netGrowth = firstOtbSnap ? (effectiveCurrentRooms - firstOtbSnap.rooms) : 0;
        const lastUpdateRaw = lastSnap.captureDateTime || `${lastSnap.captureDate} ${lastSnap.captureTime || ''}`;
        const lastUpdateStr = formatDateTimeShortES(lastUpdateRaw);
        const firstDateES = firstOtbSnap ? formatDateShortES(firstOtbSnap.captureDate) : '';

        if (note) {
            note.innerText = `${snaps.length} capturas · Última: ${lastUpdateStr}`;
        }

        // Comprobar si hay datos económicos disponibles en los snapshots
        const hasEconomicData = snaps.some(s => (s.revenue && s.revenue > 0) || (s.adr && s.adr > 0));

        // Calcular deltas entre observaciones consecutivas con precio de venta (separando cambios reales vs días sin cambios)
        const chipsData = buildVariationChipsData(snaps, extra);
        const activeItems = chipsData.filter(item => item.diffRooms !== 0 || item.hasBarChange);
        const zeroItems = chipsData.filter(item => item.diffRooms === 0 && !item.hasBarChange);

        let movementsHtml = '';
        if (activeItems.length > 0) {
            const rowsHtml = activeItems.map(item => {
                const safeTip = String(item.tooltip || '').replace(/"/g, '&quot;');
                const dLabel = item.dateDisplay || formatDateShortES(item.date);
                let moveCellHtml = '';
                if (item.diffRooms !== 0) {
                    const isPos = item.diffRooms > 0;
                    const dSign = isPos ? '+' : '';
                    const dColor = isPos ? '#059669' : '#dc2626';
                    const bg = isPos ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                    const bd = isPos ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
                    const roomsRange = (item.prevRooms !== undefined && item.currRooms !== undefined)
                        ? `<span style="color:var(--text-muted); font-size:0.75rem; margin-left:6px;">(${item.prevRooms}→${item.currRooms} habs)</span>`
                        : '';
                    moveCellHtml = `<span style="font-weight:700; color:${dColor};">${dSign}${item.diffRooms} RN</span>${roomsRange}`;
                } else {
                    moveCellHtml = `<span style="font-weight:600; color:var(--primary);">Cambio de tarifa</span>`;
                }
                const priceColor = item.priceLabel === 'sin precio' ? 'var(--text-muted)' : 'var(--text-main)';
                return `
                    <tr title="${safeTip}" style="border-bottom:1px solid rgba(148,163,184,0.16);">
                        <td style="padding:9px 8px 9px 2px; font-weight:600; color:var(--text-main); white-space:nowrap; width:74px;">${dLabel}</td>
                        <td style="padding:9px 8px; white-space:nowrap;">${moveCellHtml}</td>
                        <td style="padding:9px 2px 9px 8px; text-align:right; font-weight:500; color:${priceColor}; white-space:nowrap;">${item.priceLabel || '—'}</td>
                    </tr>
                `;
            }).join('');

            movementsHtml = `
                <div class="dd-moves" style="max-height:230px; overflow-y:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem; font-variant-numeric:tabular-nums;">
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            `;
        } else {
            movementsHtml = `<div style="font-size:0.71rem; color:var(--text-muted); padding:4px 2px;">Sin variaciones de habitaciones ni de tarifa BAR registradas.</div>`;
        }

        let zeroSummaryHtml = '';
        if (zeroItems.length > 0) {
            const zeroPills = zeroItems.map(z => {
                const safeTip = String(z.tooltip || '').replace(/"/g, '&quot;');
                const dLabel = z.dateDisplay || formatDateShortES(z.date);
                return `<span title="${safeTip}" style="font-size:0.68rem; background:var(--bg-deep); padding:1px 6px; border-radius:4px; border:1px solid var(--border); color:var(--text-muted);">${dLabel}: <b>0 RN</b></span>`;
            }).join('');
            zeroSummaryHtml = `
                <div style="margin-top:6px;">
                    <button type="button" onclick="CompetenciaIntelUI.toggleZeroVariations(this)" data-count="${zeroItems.length}" style="background:transparent; border:none; padding:6px 0; font-size:0.78rem; font-weight:600; color:var(--primary); cursor:pointer;">
                        ▸ Ver ${zeroItems.length} día${zeroItems.length !== 1 ? 's' : ''} sin cambios (+0 RN)
                    </button>
                    <div id="dayDetailZeroVariationsList" style="display:none; flex-wrap:wrap; gap:4px; margin-top:5px;">
                        ${zeroPills}
                    </div>
                </div>
            `;
        }

        if (statsBox) {
            const availDisplay = Math.max(0, capacity - effectiveCurrentRooms);
            statsBox.innerHTML = `
                <div style="margin-top:14px; font-size:0.78rem; font-variant-numeric:tabular-nums;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px; padding:12px 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
                        <span>Evolución${firstDateES ? ` (${firstDateES} → Hoy)` : ''}: <b style="color:${netGrowth >= 0 ? '#10b981' : '#ef4444'}; font-size:0.84rem;">${netGrowth >= 0 ? '+' : ''}${netGrowth} RN</b>${firstOtbSnap ? ` <span style="color:var(--text-muted); font-size:0.7rem;">(${firstOtbSnap.rooms}→${effectiveCurrentRooms} habs)</span>` : ''}</span>
                        <span>Disponibles: <b>${availDisplay} libres</b> <span style="color:var(--text-muted); font-size:0.7rem;">(${effectiveCurrentRooms}/${capacity})</span></span>
                        <span>Última captura: <b>${lastUpdateStr}</b></span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="color:var(--text-main); font-size:0.82rem; font-weight:700;">Movimientos de reservas y tarifa</span>
                        <span style="font-size:0.68rem; color:var(--text-muted);">${activeItems.length} cambio${activeItems.length !== 1 ? 's' : ''} detectado${activeItems.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${movementsHtml}
                    ${zeroSummaryHtml}
                    ${!hasEconomicData ? `
                        <div style="margin-top:6px; font-size:0.7rem; color:var(--text-muted); border-top:1px dashed var(--border); padding-top:4px;">
                            ℹ️ <b>Métricas de Tarifas:</b> Se muestra la evolución del <b>Precio Medio de la Competencia</b> y de <b>Tu Tarifa BAR</b> registrada. El <b>ADR propio</b> requiere informe PMS con desglose de facturación (Revenue); en fechas con 0 habs vendidas no existe ADR.
                        </div>
                    ` : ''}
                </div>
            `;
        }

        const labels = snaps.map(s => formatDateShortES(s.captureDate) + (s.captureTime ? ' ' + s.captureTime.slice(0, 5) : ''));
        const dataRooms = snaps.map(s => (s.rooms !== null && s.rooms !== undefined) ? s.rooms : null);

        const datasets = [{
            label: 'Habitaciones vendidas',
            data: dataRooms,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            fill: true,
            tension: 0.15,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointBackgroundColor: '#6366f1',
            spanGaps: true,
            yAxisID: 'y'
        }];

        // Series complementarias de precios (Competencia, BAR Propia, ADR)
        const hasCompData = snaps.some(s => (s.comp && s.comp > 0) || (s.compPrice && s.compPrice > 0)) || (extra.compAvg && extra.compAvg > 0);
        const hasBarData = snaps.some(s => (s.bar && s.bar > 0) || (s.publishedBar && s.publishedBar > 0)) || (extra.currentPrice && extra.currentPrice > 0);

        if (hasCompData) {
            const dataComp = snaps.map((s, idx) => {
                const c = s.compPrice || s.comp;
                if (c && c > 0) return Math.round(c);
                if (idx === snaps.length - 1 && extra.compAvg > 0) return Math.round(extra.compAvg);
                return null;
            });
            datasets.push({
                label: 'Competencia',
                data: dataComp,
                borderColor: '#d97706',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 4],
                tension: 0.15,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#d97706',
                spanGaps: true,
                yAxisID: 'y1'
            });
        }

        if (hasBarData) {
            const dataBar = snaps.map((s, idx) => {
                const b = s.publishedBar || s.bar;
                if (b && b > 0) return Math.round(b);
                if (idx === snaps.length - 1 && extra.currentPrice > 0) return Math.round(extra.currentPrice);
                return null;
            });
            datasets.push({
                label: 'Tu BAR',
                data: dataBar,
                borderColor: '#0ea5e9',
                backgroundColor: 'transparent',
                borderWidth: 2,
                stepped: 'before',
                pointRadius: 0,
                pointHoverRadius: 5,
                pointBackgroundColor: '#0ea5e9',
                spanGaps: true,
                yAxisID: 'y1'
            });
        }

        if (hasEconomicData) {
            const dataAdr = snaps.map(s => s.adr || (s.revenue && s.rooms !== null && s.rooms > 0 ? Math.round(s.revenue / s.rooms) : null));
            datasets.push({
                label: 'ADR (€)',
                data: dataAdr,
                borderColor: '#10b981',
                backgroundColor: 'transparent',
                borderDash: [2, 3],
                borderWidth: 1.5,
                fill: false,
                tension: 0.15,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#10b981',
                spanGaps: true,
                yAxisID: 'y1'
            });
        }

        const ctx = canvas.getContext('2d');
        dayDetailChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: (hasEconomicData || hasCompData || hasBarData),
                        position: 'top',
                        align: 'start',
                        labels: { font: { size: 11 }, usePointStyle: true, pointStyle: 'line', boxWidth: 18, padding: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const lbl = ctx.dataset.label || '';
                                if (lbl.includes('Habitaciones') || lbl.includes('OTB')) {
                                    const val = ctx.parsed.y;
                                    if (val === null || val === undefined) return null;
                                    const dsData = ctx.dataset.data || [];
                                    let prevVal = null;
                                    for (let k = ctx.dataIndex - 1; k >= 0; k--) {
                                        if (dsData[k] !== null && dsData[k] !== undefined) {
                                            prevVal = dsData[k];
                                            break;
                                        }
                                    }
                                    if (prevVal !== null) {
                                        const delta = val - prevVal;
                                        if (delta !== 0) {
                                            const sign = delta > 0 ? '+' : '';
                                            return `OTB: ${val} habs (${sign}${delta} RN) · ${Math.max(0, capacity - val)} libres`;
                                        }
                                    }
                                    return `OTB: ${val} habs (${Math.max(0, capacity - val)} libres)`;
                                }
                                if (lbl.includes('Competencia')) {
                                    return `Competencia: ${ctx.parsed.y} €`;
                                }
                                if (lbl.includes('BAR')) {
                                    return `Tu BAR: ${ctx.parsed.y} €`;
                                }
                                if (lbl.includes('ADR')) {
                                    return `ADR: ${ctx.parsed.y} €`;
                                }
                                return `${lbl}: ${ctx.parsed.y} €`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        max: capacity,
                        grid: { color: 'rgba(148, 163, 184, 0.15)' },
                        border: { display: false },
                        ticks: { font: { size: 10 }, maxTicksLimit: 4 },
                        title: { display: false }
                    },
                    y1: {
                        type: 'linear',
                        display: (hasEconomicData || hasCompData || hasBarData),
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        border: { display: false },
                        ticks: { font: { size: 10 }, maxTicksLimit: 4, callback: (v) => v + ' €' },
                        title: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6, callback: function (v) { const l = this.getLabelForValue(v) || ''; return l.slice(0, 5); } }
                    }
                }
            }
        });
    }

    function invalidateYieldCachesAfterException() {
        if (typeof window !== 'undefined' && typeof window.invalidateLocalYieldCache === 'function') {
            window.invalidateLocalYieldCache();
        } else {
            if (typeof processedData !== 'undefined' && Array.isArray(processedData)) {
                processedData.forEach(item => { if (item) delete item._yieldInfo; });
            }
            if (window.PricingIntelligence && typeof window.PricingIntelligence.invalidatePricingCache === 'function') {
                window.PricingIntelligence.invalidatePricingCache();
            }
        }
    }

    function refreshAllViewsAfterException() {
        if (typeof refreshActiveView === 'function') refreshActiveView();
        if (activeIntelTab === 'month_dow' || activeIntelTab === 'comparison') {
            switchIntelTab(activeIntelTab);
        }
    }

    function saveDayCustomException() {
        if (!currentDetailDateISO || !window.PricingIntelligence) return;
        const currentHotel = window.activeHotel || (window.CapaState && window.CapaState.activeHotel) || 'Guadiana';
        let barVal = parseFloat(document.getElementById('dayDetailCustomBar')?.value);
        const eventVal = String(document.getElementById('dayDetailCustomEvent')?.value || '').trim();

        const prevExc = (typeof PricingIntelligence.getDateException === 'function')
            ? PricingIntelligence.getDateException(currentDetailDateISO, currentHotel)
            : PricingIntelligence.getPricingExceptions()[currentDetailDateISO];

        if ((!barVal || barVal <= 0) && eventVal && !prevExc) {
            const datesList = (typeof processedData !== 'undefined' && Array.isArray(processedData)) ? processedData : [];
            const d = datesList.find(item => item.dateISO === currentDetailDateISO);
            const my = d && d.hotels ? d.hotels[currentHotel] : null;
            const currentPrice = (my && !my.sold && my.price > 0) ? Math.round(my.price) : 0;
            if (currentPrice > 0) {
                barVal = currentPrice;
            }
        }

        if (barVal && barVal > 0) {
            PricingIntelligence.setDateException(currentDetailDateISO, {
                barBase: barVal,
                eventName: eventVal,
                notes: 'Excepción fijada manualmente'
            }, currentHotel);
            alert(`✅ Excepción guardada para ${currentHotel} (${currentDetailDateISO}): BAR ${barVal} €`);
        } else {
            PricingIntelligence.setDateException(currentDetailDateISO, null, currentHotel);
            alert(`✅ Excepción eliminada para ${currentHotel} (${currentDetailDateISO})`);
        }
        invalidateYieldCachesAfterException();
        closeDayDetailModal();
        refreshAllViewsAfterException();
    }

    function removeDayCustomException() {
        if (!currentDetailDateISO || !window.PricingIntelligence) return;
        const currentHotel = window.activeHotel || (window.CapaState && window.CapaState.activeHotel) || 'Guadiana';
        PricingIntelligence.setDateException(currentDetailDateISO, null, currentHotel);
        invalidateYieldCachesAfterException();
        closeDayDetailModal();
        refreshAllViewsAfterException();
        alert(`✅ Excepción eliminada para ${currentHotel} (${currentDetailDateISO})`);
    }

    // =========================================================================
    // =========================================================================
    // GESTOR INTEGRAL DE TARIFAS BASE Y ESTRATEGIA YIELD (MULTI-HOTEL, MULTI-AÑO, MULTI-MES)
    // =========================================================================
    let matrixModalActiveHotel = 'Guadiana';
    let matrixModalActiveYear = 2027;
    let matrixModalActiveMonth = 'all';

    function selectMonthFromStrip(monthNum) {
        if (!window.PricingIntelligence) return;
        const mName = PricingIntelligence.MONTH_NAMES_ES[monthNum - 1];
        
        const sel = document.getElementById('monthSelector');
        if (sel) {
            const matchOpt = Array.from(sel.options).find(o => o.value.toLowerCase().includes(mName.toLowerCase()) || mName.toLowerCase().includes(o.value.toLowerCase()));
            if (matchOpt) sel.value = matchOpt.value;
        }

        let data = (typeof processedData !== 'undefined' && Array.isArray(processedData)) ? [...processedData] : [];
        renderMonthAndDowView(data, mName);
    }

    function openBarMatrixModal(optHotel, optYear, optMonth) {
        const modal = document.getElementById('barMatrixModal');
        if (!modal || !window.PricingIntelligence) return;

        matrixModalActiveHotel = optHotel || window.activeHotel || (window.CapaState && window.CapaState.activeHotel) || 'Guadiana';
        matrixModalActiveYear = optYear || 2027;
        matrixModalActiveMonth = optMonth || 'all';

        renderMatrixModalControls();
        renderMatrixModalGrid();
        renderMatrixModalTiers();

        modal.style.display = 'block';
    }

    function closeBarMatrixModal() {
        const modal = document.getElementById('barMatrixModal');
        if (modal) modal.style.display = 'none';
    }

    function renderMatrixModalControls() {
        const btnG = document.getElementById('matrixHotelBtnGuadiana');
        const btnC = document.getElementById('matrixHotelBtnCumbria');
        const isG = matrixModalActiveHotel.toLowerCase().includes('guadiana');
        if (btnG) {
            btnG.style.background = isG ? 'var(--primary)' : 'transparent';
            btnG.style.color = isG ? '#fff' : 'var(--text-muted)';
        }
        if (btnC) {
            btnC.style.background = !isG ? 'var(--primary)' : 'transparent';
            btnC.style.color = !isG ? '#fff' : 'var(--text-muted)';
        }

        const lblH = document.getElementById('matrixActiveHotelLabel');
        if (lblH) lblH.innerText = isG ? 'Sercotel Guadiana' : 'Hotel Cumbria';

        const yrContainer = document.getElementById('matrixYearSelectorGroup');
        if (yrContainer) {
            const years = [2026, 2027, 2028, 2029];
            yrContainer.innerHTML = years.map(y => {
                const isAct = (y === matrixModalActiveYear);
                return `<button type="button" class="btn btn-sm" onclick="CompetenciaIntelUI.switchMatrixYear(${y})" style="height:28px; padding:0 10px; font-size:0.78rem; font-weight:700; border-radius:8px; border:1px solid ${isAct ? 'var(--primary)' : 'var(--border)'}; background:${isAct ? 'var(--primary)' : 'transparent'}; color:${isAct ? '#fff' : 'var(--text-main)'}; cursor:pointer;">${y}</button>`;
            }).join('');
        }

        const lblY = document.getElementById('matrixActiveYearLabel');
        if (lblY) lblY.innerText = matrixModalActiveYear;

        const mSel = document.getElementById('matrixMonthSelector');
        if (mSel) mSel.value = matrixModalActiveMonth;
    }

    function switchMatrixHotel(hotel) {
        matrixModalActiveHotel = hotel;
        renderMatrixModalControls();
        renderMatrixModalGrid();
        renderMatrixModalTiers();
    }

    function switchMatrixYear(year) {
        matrixModalActiveYear = parseInt(year, 10);
        renderMatrixModalControls();
        renderMatrixModalGrid();
        renderMatrixModalTiers();
    }

    function switchMatrixMonth(month) {
        matrixModalActiveMonth = month;
        renderMatrixModalControls();
        renderMatrixModalGrid();
        renderMatrixModalTiers();
    }

    function renderMatrixModalGrid() {
        const matrix = PricingIntelligence.getBarMatrix(matrixModalActiveHotel, matrixModalActiveYear);
        const tbody = document.getElementById('barMatrixEditorBody');
        if (!tbody) return;

        let rowsHtml = '';
        const filterM = (matrixModalActiveMonth !== 'all') ? parseInt(matrixModalActiveMonth, 10) : null;

        for (let m = 1; m <= 12; m++) {
            const rowData = matrix[m] || {};
            const mName = PricingIntelligence.MONTH_NAMES_ES[m - 1];
            const isHighlighted = (filterM === m);
            const isDimmed = (filterM !== null && !isHighlighted);

            const v1 = rowData[1] || 62;
            const v2 = rowData[2] || 64;
            const v3 = rowData[3] || 64;
            const v4 = rowData[4] || 62;
            const v5 = rowData[5] || 70;
            const v6 = rowData[6] || 75;
            const v7 = rowData[7] || 58;
            const avg = Math.round((v1 + v2 + v3 + v4 + v5 + v6 + v7) / 7);

            rowsHtml += `
                <tr id="mat_row_${m}" style="${isHighlighted ? 'background:rgba(99,102,241,0.08); font-weight:bold;' : (isDimmed ? 'opacity:0.4;' : '')}">
                    <td style="font-weight:800; text-align:left;">
                        ${isHighlighted ? '👉 ' : ''}${mName}
                    </td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_1" value="${v1}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_2" value="${v2}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_3" value="${v3}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_4" value="${v4}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_5" value="${v5}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_6" value="${v6}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td><input type="number" class="matrix-input" id="mat_${m}_7" value="${v7}" oninput="CompetenciaIntelUI.calcMatrixRowAvg(${m})"></td>
                    <td style="font-weight:800; color:var(--primary); background:rgba(99,102,241,0.04);" id="mat_avg_${m}">
                        ${avg} €
                    </td>
                </tr>
            `;
        }
        tbody.innerHTML = rowsHtml;
    }

    function calcMatrixRowAvg(m) {
        const v1 = parseFloat(document.getElementById(`mat_${m}_1`)?.value) || 0;
        const v2 = parseFloat(document.getElementById(`mat_${m}_2`)?.value) || 0;
        const v3 = parseFloat(document.getElementById(`mat_${m}_3`)?.value) || 0;
        const v4 = parseFloat(document.getElementById(`mat_${m}_4`)?.value) || 0;
        const v5 = parseFloat(document.getElementById(`mat_${m}_5`)?.value) || 0;
        const v6 = parseFloat(document.getElementById(`mat_${m}_6`)?.value) || 0;
        const v7 = parseFloat(document.getElementById(`mat_${m}_7`)?.value) || 0;
        const avg = Math.round((v1 + v2 + v3 + v4 + v5 + v6 + v7) / 7);
        const cell = document.getElementById(`mat_avg_${m}`);
        if (cell) cell.innerText = `${avg} €`;
    }

    function renderMatrixModalTiers() {
        const tiers = PricingIntelligence.getOccTiers(matrixModalActiveHotel, matrixModalActiveYear, matrixModalActiveMonth);
        const tiersCont = document.getElementById('occTiersEditorContainer');
        const contextLbl = document.getElementById('occTiersContextLabel');

        if (contextLbl) {
            const hStr = matrixModalActiveHotel.toLowerCase().includes('guadiana') ? 'Sercotel Guadiana' : 'Hotel Cumbria';
            let mStr = 'Todos los meses';
            if (matrixModalActiveMonth !== 'all') {
                const mIdx = parseInt(matrixModalActiveMonth, 10) - 1;
                mStr = PricingIntelligence.MONTH_NAMES_ES[mIdx] || matrixModalActiveMonth;
            }
            contextLbl.innerText = `${hStr} · ${matrixModalActiveYear} · ${mStr}`;
        }

        if (tiersCont) {
            tiersCont.innerHTML = tiers.map((t, idx) => `
                <div style="background:var(--bg-card); padding:8px 10px; border-radius:10px; border:1px solid var(--border); text-align:center;">
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">${t.minOcc} - ${t.maxOcc}%</div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-top:4px;">
                        <input type="number" id="tier_input_${idx}" value="${t.incPct}" min="0" step="0.01" aria-label="Incremento porcentual sobre la base" class="matrix-input" style="width:52px; font-weight:800; font-size:0.85rem;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">%</span>
                    </div>
                </div>
            `).join('');
        }
    }

    function saveBarMatrixFromModal() {
        if (!window.PricingIntelligence) return;
        const matrix = {};
        for (let m = 1; m <= 12; m++) {
            matrix[m] = {
                name: PricingIntelligence.MONTH_NAMES_ES[m - 1],
                1: parseFloat(document.getElementById(`mat_${m}_1`)?.value) || 62,
                2: parseFloat(document.getElementById(`mat_${m}_2`)?.value) || 64,
                3: parseFloat(document.getElementById(`mat_${m}_3`)?.value) || 64,
                4: parseFloat(document.getElementById(`mat_${m}_4`)?.value) || 62,
                5: parseFloat(document.getElementById(`mat_${m}_5`)?.value) || 70,
                6: parseFloat(document.getElementById(`mat_${m}_6`)?.value) || 75,
                7: parseFloat(document.getElementById(`mat_${m}_7`)?.value) || 58
            };
        }

        PricingIntelligence.saveBarMatrix(matrixModalActiveHotel, matrixModalActiveYear, matrix);

        // Escalados
        const currentTiers = PricingIntelligence.getOccTiers(matrixModalActiveHotel, matrixModalActiveYear, matrixModalActiveMonth);
        const updatedTiers = currentTiers.map((t, idx) => {
            const inp = document.getElementById(`tier_input_${idx}`);
            return {
                ...t,
                incPct: inp && Number.isFinite(parseFloat(inp.value)) ? Math.max(0, parseFloat(inp.value)) : t.incPct
            };
        });
        PricingIntelligence.saveOccTiers(matrixModalActiveHotel, matrixModalActiveYear, matrixModalActiveMonth, updatedTiers);

        closeBarMatrixModal();
        if (typeof refreshActiveView === 'function') refreshActiveView();
        alert(`✅ Estrategia y tarifas base guardadas para ${matrixModalActiveHotel} (${matrixModalActiveYear}).`);
    }

    function toggleCopyMatrixPanel() {
        const p = document.getElementById('copyMatrixSubPanel');
        if (!p) return;
        p.style.display = (p.style.display === 'none' || p.style.display === '') ? 'block' : 'none';
    }

    function applyCopyMatrix() {
        if (!window.PricingIntelligence) return;
        const fromH = document.getElementById('copyFromHotel')?.value || 'Guadiana';
        const fromY = parseInt(document.getElementById('copyFromYear')?.value, 10) || 2027;
        const toH = document.getElementById('copyToHotel')?.value || 'Cumbria';
        const toY = parseInt(document.getElementById('copyToYear')?.value, 10) || 2027;
        const pct = parseFloat(document.getElementById('copyPctAdjust')?.value) || 0;

        PricingIntelligence.copyBarMatrix(fromH, fromY, toH, toY, pct);

        matrixModalActiveHotel = toH;
        matrixModalActiveYear = toY;
        renderMatrixModalControls();
        renderMatrixModalGrid();
        renderMatrixModalTiers();

        toggleCopyMatrixPanel();
        alert(`✓ Tarifas copiadas con éxito de ${fromH} ${fromY} a ${toH} ${toY}${pct !== 0 ? ` (Ajuste: ${pct > 0 ? '+' : ''}${pct}%)` : ''}.`);
    }

    function resetActiveMatrixToDefaults() {
        if (!confirm(`¿Deseas restablecer las tarifas base a los valores recomendados predeterminados para ${matrixModalActiveHotel} ${matrixModalActiveYear}?`)) return;
        if (window.PricingIntelligence) {
            PricingIntelligence.resetBarMatrixToDefault(matrixModalActiveHotel, matrixModalActiveYear);
            renderMatrixModalGrid();
            renderMatrixModalTiers();
            if (typeof refreshActiveView === 'function') refreshActiveView();
            alert(`✓ Tarifas de partida restablecidas para ${matrixModalActiveHotel} ${matrixModalActiveYear}.`);
        }
    }

    function copyTiersToAllMonths() {
        if (!window.PricingIntelligence) return;
        const currentTiers = PricingIntelligence.getOccTiers(matrixModalActiveHotel, matrixModalActiveYear, matrixModalActiveMonth);
        const updatedTiers = currentTiers.map((t, idx) => {
            const inp = document.getElementById(`tier_input_${idx}`);
            return {
                ...t,
                incPct: inp && Number.isFinite(parseFloat(inp.value)) ? Math.max(0, parseFloat(inp.value)) : t.incPct
            };
        });

        PricingIntelligence.saveOccTiers(matrixModalActiveHotel, matrixModalActiveYear, 'all', updatedTiers);
        for (let m = 1; m <= 12; m++) {
            PricingIntelligence.saveOccTiers(matrixModalActiveHotel, matrixModalActiveYear, String(m), updatedTiers);
        }
        renderMatrixModalTiers();
        alert(`✓ Escalados de ocupación aplicados a todos los meses de ${matrixModalActiveHotel} ${matrixModalActiveYear}.`);
    }

    // Exportación pública
    const api = {
        get activeIntelTab() { return activeIntelTab; },
        get tableColumnConfig() { return tableColumnConfig; },
        switchIntelTab,
        toggleColumnConfigModal,
        closeColumnConfigModal,
        saveColumnConfigFromModal,
        renderMonthAndDowView,
        selectMonthFromStrip,
        toggleDowSubrow,
        runComparisonAnalysis,
        openDayDetailModal,
        closeDayDetailModal,
        saveDayCustomException,
        removeDayCustomException,
        toggleZeroVariations,
        _buildVariationChipsData: buildVariationChipsData,
        _renderDayDetailChart: renderDayDetailChart,
        _formatDateShortES: formatDateShortES,
        _formatDateTimeShortES: formatDateTimeShortES,
        openBarMatrixModal,
        closeBarMatrixModal,
        switchMatrixHotel,
        switchMatrixYear,
        switchMatrixMonth,
        calcMatrixRowAvg,
        saveBarMatrixFromModal,
        toggleCopyMatrixPanel,
        applyCopyMatrix,
        resetActiveMatrixToDefaults,
        copyTiersToAllMonths
    };

    root.CompetenciaIntelUI = api;
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    // Conectar helpers globales para compatibilidad directa con onclicks del HTML
    root.switchIntelTab = switchIntelTab;
    root.toggleColumnConfigModal = toggleColumnConfigModal;
    root.closeColumnConfigModal = closeColumnConfigModal;
    root.saveColumnConfigFromModal = saveColumnConfigFromModal;
    root.toggleDowSubrow = toggleDowSubrow;
    root.runComparisonAnalysis = runComparisonAnalysis;
    root.openDayDetailModal = openDayDetailModal;
    root.closeDayDetailModal = closeDayDetailModal;
    root.saveDayCustomException = saveDayCustomException;
    root.removeDayCustomException = removeDayCustomException;
    root.openBarMatrixModal = openBarMatrixModal;
    root.closeBarMatrixModal = closeBarMatrixModal;
    root.saveBarMatrixFromModal = saveBarMatrixFromModal;
    root.resetBarMatrixToOriginals = resetActiveMatrixToDefaults;

})(typeof window === 'object' ? window : globalThis);
