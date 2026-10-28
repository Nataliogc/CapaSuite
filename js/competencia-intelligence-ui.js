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
        if (selectedMonth && selectedMonth !== 'all') {
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
                                                } else if (r.action === 'REVISAR BAJADA') {
                                                    actCls = 'bajar';
                                                    actLabel = 'Revisar Bajada';
                                                    actIcon = '▼';
                                                } else if (r.action === 'REVISIÓN MANUAL') {
                                                    actCls = 'manual';
                                                    actLabel = 'Revisión Manual';
                                                    actIcon = '⚙️';
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
                                                        <td style="font-weight:700; padding:9px 10px; white-space:nowrap;">${dItem.price} €</td>
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
    function openDayDetailModal(dateISO) {
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

        // Título
        const dtParts = dateISO.split('-');
        const dtObj = new Date(parseInt(dtParts[0], 10), parseInt(dtParts[1], 10) - 1, parseInt(dtParts[2], 10));
        const dowName = PricingIntelligence.DOW_NAMES_ES[dtObj.getDay()];

        document.getElementById('dayDetailTitle').innerText = `Ficha de Análisis: ${d.label || dateISO}`;
        document.getElementById('dayDetailDowBadge').innerText = dowName;
        document.getElementById('dayDetailSubtitle').innerText = `${currentHotel} · Antelación: ${rec.daysOut} días para la llegada · BAR Base Excel: ${rec.baseBar} €`;

        // Status badge
        const statusBadge = document.getElementById('dayDetailStatusBadge');
        if (my && my.sold) {
            statusBadge.innerText = 'Ventas Cerradas';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
            statusBadge.style.color = '#ef4444';
        } else {
            statusBadge.innerText = 'Ventas Abiertas';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#10b981';
        }

        // 1. Grid de Situación Actual
        const kpiGrid = document.getElementById('dayDetailKpiGrid');
        if (kpiGrid) {
            const p24 = pData.h24h.available ? `${pData.h24h.diffRooms >= 0 ? '+' : ''}${pData.h24h.diffRooms} RN` : 'Sin histórico';
            const p7  = pData.d7.available ? `${pData.d7.diffRooms >= 0 ? '+' : ''}${pData.d7.diffRooms} RN` : 'Sin histórico';
            const p14 = pData.d14.available ? `${pData.d14.diffRooms >= 0 ? '+' : ''}${pData.d14.diffRooms} RN` : 'Sin histórico';

            kpiGrid.innerHTML = `
                <div class="day-detail-box">
                    <div class="box-lbl">Tarifa BAR Base 2027</div>
                    <div class="box-val">${rec.baseBar} €</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                        Publicado actual: <b>${currentPrice > 0 ? currentPrice + ' €' : 'Sin tarifa'}</b>
                    </div>
                </div>
                <div class="day-detail-box">
                    <div class="box-lbl">Ocupación / Disponibilidad</div>
                    <div class="box-val">${occPct.toFixed(1)}%</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                        <b>${rooms}</b> vendidas / <b>${availableRooms}</b> libres
                    </div>
                </div>
                <div class="day-detail-box">
                    <div class="box-lbl">Pick-up Dinámico</div>
                    <div class="box-val" style="font-size:1.1rem; color:#10b981;">${p7} (7d)</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                        24h: ${p24} | 14d: ${p14}
                    </div>
                </div>
                <div class="day-detail-box">
                    <div class="box-lbl">Mercado y Competencia</div>
                    <div class="box-val">${mktPrice > 0 ? mktPrice.toFixed(0) + ' €' : '-'}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                        Gap: <b>${currentPrice > 0 && mktPrice > 0 ? (((currentPrice - mktPrice) / mktPrice) * 100).toFixed(0) + '%' : '-'}</b>
                    </div>
                </div>
            `;
        }

        // 2. Gráfico de Evolución de 30 Días
        renderDayDetailChart(dateISO, rooms, currentHotel);

        // 3. Recomendación
        const recCont = document.getElementById('dayDetailRecContainer');
        if (recCont) {
            const isPendingDem = (rec.demandStatus === 'PENDIENTE DE EVALUACIÓN DE DEMANDA' || rec.triggerText?.includes('Pend. Demanda'));
            const actCls = isPendingDem ? 'alerta' : (rec.action === 'SUBIR' ? 'subir' : (rec.action === 'REVISAR BAJADA' ? 'bajar' : (rec.action === 'REVISIÓN MANUAL' ? 'manual' : 'mantener')));
            const actLabel = isPendingDem ? '⚠️ PENDIENTE DE EVALUACIÓN DE DEMANDA' : rec.action;
            const diffBadge = (rec.diffAmount !== 0) 
                ? `<span style="font-size:0.95rem; font-weight:700; color:${rec.diffAmount > 0 ? '#10b981' : '#f59e0b'};">(${rec.diffAmount > 0 ? '+' : ''}${rec.diffAmount} € / ${rec.diffPct.toFixed(1)}%)</span>` 
                : '';

            recCont.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="action-pill ${actCls}" style="font-size:0.82rem; padding:4px 10px; font-weight:800;">${actLabel}</span>
                        <span style="font-size:1.3rem; font-weight:800; color:var(--text-main);">
                            ${rec.proposedPrice} € ${diffBadge}
                        </span>
                    </div>
                    <div style="display:flex; gap:8px; font-size:0.75rem;">
                        <span style="background:var(--bg-deep); padding:3px 8px; border-radius:6px; border:1px solid var(--border);">Confianza: <b>${rec.confidenceScore}</b></span>
                        <span style="background:var(--bg-deep); padding:3px 8px; border-radius:6px; border:1px solid var(--border);">Diagnóstico: <b>${rec.demandStatus || 'Evaluado'}</b></span>
                    </div>
                </div>

                <!-- DESGLOSE: RANGO COMERCIAL vs BANDA MATEMÁTICA -->
                <div style="background:var(--bg-deep); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-weight:800; font-size:0.75rem; color:var(--primary); text-transform:uppercase;">📐 Cálculo y Justificación del Rango de Precios</span>
                        <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Diferenciación entre Banda Matemática y Rango Comercial</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
                        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border-left:4px solid #10b981;">
                            <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">RANGO COMERCIAL RECOMENDADO</div>
                            <div style="font-size:1.1rem; font-weight:800; color:#10b981; margin:2px 0;">${rec.rangeText}</div>
                            <div style="font-size:0.72rem; color:var(--text-main); line-height:1.3;">
                                ${rec.rangeCalculation || 'Basado en BAR base y set competitivo.'}
                            </div>
                        </div>
                        <div style="background:var(--bg-surface); padding:10px; border-radius:8px; border-left:4px solid #94a3b8;">
                            <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">BANDA MATEMÁTICA DE TOLERANCIA (±5%)</div>
                            <div style="font-size:1.1rem; font-weight:800; color:var(--text-muted); margin:2px 0;">${rec.mathToleranceBand ? rec.mathToleranceBand.text : '-'}</div>
                            <div style="font-size:0.72rem; color:var(--text-muted); line-height:1.3;">
                                Rango meramente aritmético sobre tarifa publicada; no convalida idoneidad comercial.
                            </div>
                        </div>
                    </div>
                </div>

                <div style="font-size:0.83rem; line-height:1.5; color:var(--text-main); margin-bottom:10px;">
                    <b>Justificación de la recomendación:</b>
                    <ul style="margin:6px 0 0 18px; padding:0;">
                        ${rec.reasons.map(r => `<li style="margin-bottom:3px;">${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Excepción previa cargada si existe
        const exceptions = PricingIntelligence.getPricingExceptions();
        const curExc = exceptions[dateISO];
        document.getElementById('dayDetailCustomBar').value = curExc ? curExc.barBase : '';
        document.getElementById('dayDetailCustomEvent').value = curExc ? curExc.eventName : '';

        // Configurar botón de aplicar recomendación
        const applyBtn = document.getElementById('dayDetailApplyBtn');
        if (applyBtn) {
            applyBtn.onclick = function() {
                if (typeof setManualPrice === 'function') {
                    setManualPrice(d.dayIndex, currentHotel, rec.proposedPrice);
                }
                closeDayDetailModal();
            };
        }

        modal.style.display = 'block';
    }

    function closeDayDetailModal() {
        const modal = document.getElementById('dayDetailModal');
        if (modal) modal.style.display = 'none';
    }

    function renderDayDetailChart(dateISO, currentRooms, hotelName) {
        const canvas = document.getElementById('dayDetailChart');
        if (!canvas || !window.PricingIntelligence) return;

        const db = getSnapshotsSafely();
        const snaps = (db[hotelName] && db[hotelName][dateISO]) ? [...db[hotelName][dateISO]] : [];

        if (snaps.length === 0) {
            snaps.push({
                captureDate: 'Hoy',
                rooms: currentRooms,
                revenue: 0
            });
            document.getElementById('dayDetailHistoryNote').innerText = 'Sin histórico previo suficiente (mostrando fotografía actual)';
        } else {
            document.getElementById('dayDetailHistoryNote').innerText = `${snaps.length} capturas inmutables registradas`;
        }

        const labels = snaps.map(s => s.captureDate);
        const dataRooms = snaps.map(s => s.rooms);

        if (dayDetailChartInstance) {
            dayDetailChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        dayDetailChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Habitaciones Vendidas (OTB)',
                    data: dataRooms,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 4,
                    pointBackgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
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
    }

    function saveDayCustomException() {
        if (!currentDetailDateISO || !window.PricingIntelligence) return;
        const barVal = parseFloat(document.getElementById('dayDetailCustomBar')?.value);
        const eventVal = document.getElementById('dayDetailCustomEvent')?.value || '';

        if (barVal && barVal > 0) {
            PricingIntelligence.setDateException(currentDetailDateISO, {
                barBase: barVal,
                eventName: eventVal,
                notes: 'Excepción fijada manualmente'
            });
            alert(`✅ Excepción guardada para ${currentDetailDateISO}: BAR ${barVal} €`);
        } else {
            PricingIntelligence.setDateException(currentDetailDateISO, null);
            alert(`✅ Excepción eliminada para ${currentDetailDateISO}`);
        }
        closeDayDetailModal();
        if (typeof refreshActiveView === 'function') refreshActiveView();
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
                        <input type="number" id="tier_input_${idx}" value="${t.price}" class="matrix-input" style="width:52px; font-weight:800; font-size:0.85rem;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">€</span>
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
                price: inp ? (parseFloat(inp.value) || t.price) : t.price
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
                price: inp ? (parseFloat(inp.value) || t.price) : t.price
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
    root.openBarMatrixModal = openBarMatrixModal;
    root.closeBarMatrixModal = closeBarMatrixModal;
    root.saveBarMatrixFromModal = saveBarMatrixFromModal;
    root.resetBarMatrixToOriginals = resetActiveMatrixToDefaults;

})(typeof window === 'object' ? window : globalThis);
