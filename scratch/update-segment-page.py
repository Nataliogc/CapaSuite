from pathlib import Path
p=Path('AnalisisSegmentos.html')
s=p.read_text(encoding='utf-8')
start=s.index('    <script>\n        // Repost of core logic')
end=s.index('    </script>',start)+len('    </script>')
s=s[:start]+'    <script src="js/segment-analysis.js"></script>\n    <script src="js/segment-dashboard.js"></script>'+s[end:]
s=s.replace('<select id="yearSelector"', '<select aria-label="Año del análisis" id="yearSelector"')
s=s.replace('<select id="monthSelector"', '<select aria-label="Periodo del análisis" id="monthSelector"')
s=s.replace('<img id="hotelLogo"', '<label class="compare-control">Comparar con <select id="compareSelector" class="form-select" onchange="updateView()" aria-label="Año de comparación"></select></label>\n                <button id="import-button" class="btn" onclick="document.getElementById(\'fileInput\').click()">Importar Excel</button>\n                <img id="hotelLogo"')
s=s.replace('<input type="file" id="fileInput" multiple accept=".xlsx,.xls" hidden onchange="handleFiles(this.files)">','')
s=s.replace('<div id="loader" class="loader"></div>', '<input type="file" id="fileInput" multiple accept=".xlsx,.xls" hidden onchange="handleFiles(this.files)">\n        <p id="import-status" role="status" aria-live="polite"></p>\n        <div id="loader" class="loader" role="status" aria-label="Importando"></div>')
s=s.replace('Selecciona archivos Excel de segmentación mensual o anual','Selecciona un informe con fechas o meses y filas Hab. Los años se detectan en la cabecera. Cada carga sustituye los meses incluidos.')
s=s.replace('<div class="kpi-grid">','<p id="period-note" class="analysis-note"></p>\n            <div class="kpi-grid">')
s=s.replace('Producción Total</div>', 'Alojamiento + desayunos</div>')
s=s.replace('Habitaciones (RN)</div>', 'Habitaciones-noche (RN)</div>')
s=s.replace('ADR Medio</div>', 'ADR · solo alojamiento</div>')
s=s.replace('RevPAR</div>', 'RevPAR · solo alojamiento</div>')
s=s.replace('<div class="metric-indicator"', '<section id="insights" class="card insights" aria-label="Claves del periodo"></section>\n            <div class="metric-indicator"')
s=s.replace('Comparativa Anual</div>', 'Comparativa del periodo</div>')
s=s.replace('Distribución Segmentos</div>', 'Ranking de segmentos</div>')
s=s.replace('<h3 id="table-title">Detalle por Segmentación</h3>', '<h3 id="table-title">Detalle por segmentación</h3>\n                    <div class="table-tools"><label>Buscar segmento <input id="segment-search" type="search" placeholder="Nombre del segmento" oninput="renderDashboard()"></label><label>Ordenar <select id="segment-sort" onchange="renderDashboard()"><option value="value">Mayor valor</option><option value="change">Mayor diferencia</option><option value="name">Nombre</option></select></label></div>')
s=s.replace('<tbody id="tableBody"></tbody>', '<tbody id="tableBody"></tbody><tfoot id="tableFoot"></tfoot>')
s=s.replace('                    </table>','                    </table>\n                    <p id="table-note" class="analysis-note"></p>')
s=s.replace('    </style>', '''        .header { flex-wrap: wrap; gap: 18px; }
        .header > div { flex-wrap: wrap; }
        .compare-control, .table-tools label { display: flex; align-items: center; gap: 8px; font-size: .85rem; }
        select, input[type="search"] { background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 8px; padding: 10px; font: inherit; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
        .toggle-btn { background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; cursor: pointer; font: inherit; }
        .toggle-btn.active { background: var(--primary); color: white; }
        .metric-toggles, .table-tools { display: flex; gap: 10px; flex-wrap: wrap; }
        .table-tools { margin-top: 14px; justify-content: space-between; }
        .metric-indicator { flex-wrap: wrap; }
        .analysis-note, #import-status { color: var(--text-muted); font-size: .85rem; line-height: 1.6; }
        #import-status { white-space: pre-line; overflow-wrap: anywhere; }
        #import-status.error, .negative { color: var(--danger); }
        .positive { color: var(--secondary); }
        .insights { border-left: 3px solid var(--primary); padding: 12px 24px; }
        .insights p { margin: 10px 0; line-height: 1.5; }
        .card:hover { transform: none; }
        .kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .kpi-value { font-size: clamp(1.35rem, 2.2vw, 1.8rem); }
        .kpi-diff { font-size: .8rem; margin-top: 8px; }
        .charts-row { grid-template-columns: 1.15fr .85fr 1.4fr; height: 390px; }
        td, tfoot td { padding: 14px 16px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        th { text-align: right; background: var(--bg-surface); }
        td:first-child, th:first-child { text-align: left; background: var(--bg-surface); }
        tr:hover td { background: var(--bg-glass); }
        tfoot { font-weight: 700; background: var(--bg-surface); }
        #table-note { padding: 0 16px; }
        @media (max-width: 1100px) { .top-nav { height: auto; flex-wrap: wrap; padding: 10px 15px; gap: 12px; } .nav-links { overflow-x: auto; max-width: 100%; } .charts-row { grid-template-columns: 1fr; height: auto; } .charts-row .card { height: 360px; } }
        @media (max-width: 640px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .card { padding: 16px; } .title h1 { font-size: 1.4rem; } .nav-user, .user-chip { max-width: 100%; flex-wrap: wrap; } .metric-years { font-size: .8rem; } .container { width: 100%; } }
    </style>''')
p.write_text(s,encoding='utf-8')
p=Path('js/storage.js'); s=p.read_text(encoding='utf-8'); start=s.index('            // --- CAPASUITE SEGMENT PURGE FIX'); end=s.index('            // --- CAPASUITE DATE SHIFT',start); s=s[:start]+'            // Segment names belong to the source report. Reading storage must not delete them.\n\n'+s[end:]; p.write_text(s,encoding='utf-8')
