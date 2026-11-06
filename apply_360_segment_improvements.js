const fs = require('fs');

const replacementJs = `        function escapeHTML(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        const OFFICIAL_SEGMENTS_BY_HOTEL = {
            Guadiana: [
                'DIRECTO ONLINE',
                'DIRECTO OFFLINE',
                'OTA/AAVV',
                'CORPORATIVO LINEAL',
                'CORPORATIVO DINAMICO',
                'TTOO DINAMICA',
                'GRUPOS',
                'GRTANTEO',
                'OTROS'
            ],
            Cumbria: [
                'DIRECTO ONLINE',
                'DIRECTO OFFLINE',
                'OTA/AAVV',
                'CORPORATIVO LINEAL',
                'CORPORATIVO DINAMICO',
                'TTOO DINAMICA',
                'GRUPOS',
                'GRTANTEO',
                'BONO ONLINE',
                'BONO SPA',
                'EMPRESAS'
            ]
        };

        function getHotelOfficialSegments(hotel = currentHotel) {
            const isCumbria = String(hotel || '').toLowerCase().includes('cumbria');
            return isCumbria ? OFFICIAL_SEGMENTS_BY_HOTEL.Cumbria : OFFICIAL_SEGMENTS_BY_HOTEL.Guadiana;
        }

        function getHotelCustomSegmentMapping(hotel = currentHotel) {
            let mapping = {};
            try {
                const stored = (typeof CapaStorage !== 'undefined' ? CapaStorage.getItem('custom_segment_mapping_v2') : localStorage.getItem('custom_segment_mapping_v2'));
                if (stored) {
                    mapping = JSON.parse(stored) || {};
                }
            } catch(e) {}
            const hotelKey = String(hotel || '').toLowerCase().includes('cumbria') ? 'Cumbria' : 'Guadiana';
            return mapping[hotelKey] || {};
        }

        function saveHotelCustomSegmentMapping(hotel, srcSeg, targetSeg) {
            let mapping = {};
            try {
                const stored = (typeof CapaStorage !== 'undefined' ? CapaStorage.getItem('custom_segment_mapping_v2') : localStorage.getItem('custom_segment_mapping_v2'));
                if (stored) {
                    mapping = JSON.parse(stored) || {};
                }
            } catch(e) {}
            const hotelKey = String(hotel || '').toLowerCase().includes('cumbria') ? 'Cumbria' : 'Guadiana';
            if (!mapping[hotelKey]) mapping[hotelKey] = {};
            const cleanKey = String(srcSeg || '').toUpperCase().trim();
            if (targetSeg) {
                mapping[hotelKey][cleanKey] = targetSeg;
            } else {
                delete mapping[hotelKey][cleanKey];
            }
            const serialized = JSON.stringify(mapping);
            if (typeof CapaStorage !== 'undefined') CapaStorage.setItem('custom_segment_mapping_v2', serialized);
            localStorage.setItem('custom_segment_mapping_v2', serialized);
        }

        function normalizeSegmentDisplayName(name, hotel = currentHotel) {
            if (!name) return '';
            const clean = String(name).trim();
            const upper = clean.toUpperCase();

            // 1. Mapeo personalizado del usuario para este hotel (ej. PARTICULARES -> DIRECTO OFFLINE)
            const customMap = getHotelCustomSegmentMapping(hotel);
            if (customMap && (customMap[upper] || customMap[clean])) {
                return customMap[upper] || customMap[clean];
            }

            // 2. Variaciones directas
            if (upper === 'DIRONLINE' || upper === 'DIR ONLINE' || upper === 'DIR_ONLINE' || upper === 'D ON LINE' || upper === 'DIRECTO ONLINE' || upper === 'DIRECTO ON') {
                return 'DIRECTO ONLINE';
            }
            if (upper === 'DIROFFLINE' || upper === 'DIR OFFLINE' || upper === 'DIR_OFFLINE' || upper === 'D OFF LINE' || upper === 'DIRECTO OFFLINE' || upper === 'DIRECTO OFF') {
                return 'DIRECTO OFFLINE';
            }

            // 3. Fallback a segment-analysis si existe
            if (typeof SegmentAnalysis !== 'undefined' && SegmentAnalysis.canonical) {
                const can = SegmentAnalysis.canonical(name, hotel);
                if (can) return can;
            }
            return clean;
        }

        let currentCorrectionSegment = null;

        function openSegmentCorrectionModal(segName) {
            currentCorrectionSegment = segName;
            const hotel = currentHotel;
            const isCumbria = String(hotel || '').toLowerCase().includes('cumbria');
            const hotelTitle = isCumbria ? 'Hotel Cumbria' : 'Sercotel Guadiana';

            const srcEl = document.getElementById('segCorrectionSrcName');
            if (srcEl) srcEl.innerText = segName;
            const hEl = document.getElementById('segCorrectionHotelName');
            if (hEl) hEl.innerText = hotelTitle;

            const select = document.getElementById('segCorrectionTargetSelect');
            if (select) {
                select.innerHTML = '';
                const official = getHotelOfficialSegments(hotel);
                official.forEach(offSeg => {
                    const opt = document.createElement('option');
                    opt.value = offSeg;
                    opt.textContent = offSeg;
                    if (segName.toUpperCase().includes('PARTIC') && (offSeg === 'DIRECTO OFFLINE' || offSeg === 'DIRECTO ONLINE')) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });
            }

            const modal = document.getElementById('segmentCorrectionModal');
            if (modal) modal.style.display = 'flex';
        }

        function closeSegmentCorrectionModal() {
            const modal = document.getElementById('segmentCorrectionModal');
            if (modal) modal.style.display = 'none';
            currentCorrectionSegment = null;
        }

        function saveSegmentCorrection() {
            if (!currentCorrectionSegment) return;
            const select = document.getElementById('segCorrectionTargetSelect');
            const targetSeg = select ? select.value : '';
            if (!targetSeg) return;

            saveHotelCustomSegmentMapping(currentHotel, currentCorrectionSegment, targetSeg);
            closeSegmentCorrectionModal();

            const activeM = (typeof window.__seg360SelectedMonth !== 'undefined' && window.__seg360SelectedMonth !== null) ? window.__seg360SelectedMonth : (typeof currentMonthIdx !== 'undefined' ? currentMonthIdx : -1);
            renderSegmentPickupAnalysis(currentHotel, currentYear, activeM);
        }

        function openManageOfficialSegmentsModal() {
            const hotel = currentHotel;
            const isCumbria = String(hotel || '').toLowerCase().includes('cumbria');
            const hotelTitle = isCumbria ? 'Hotel Cumbria' : 'Sercotel Guadiana';
            const hTitle = document.getElementById('segManageHotelTitle');
            if (hTitle) hTitle.innerText = hotelTitle;

            const offListContainer = document.getElementById('segOfficialListContainer');
            if (offListContainer) {
                const official = getHotelOfficialSegments(hotel);
                offListContainer.innerHTML = official.map(s => \`
                    <span style="display:inline-block; background:rgba(99,102,241,0.12); color:#818cf8; border:1px solid rgba(99,102,241,0.25); border-radius:6px; padding:3px 8px; margin:3px 4px; font-size:0.75rem; font-weight:700;">
                        ✓ \${escapeHTML(s)}
                    </span>
                \`).join('');
            }

            const mapContainer = document.getElementById('segCustomMappingContainer');
            if (mapContainer) {
                const customMap = getHotelCustomSegmentMapping(hotel);
                const entries = Object.entries(customMap);
                if (entries.length === 0) {
                    mapContainer.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No hay reasignaciones manuales activas para este hotel. Todos los segmentos se procesan por la regla estándar.</span>';
                } else {
                    mapContainer.innerHTML = entries.map(([src, trg]) => \`
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:6px; padding:6px 10px; margin-bottom:6px;">
                            <div>
                                <strong style="color:#ef4444;">\${escapeHTML(src)}</strong>
                                <span style="color:var(--text-muted); margin:0 6px;">➔ reasignado a:</span>
                                <strong style="color:#10b981;">\${escapeHTML(trg)}</strong>
                            </div>
                            <button type="button" onclick="resetSegmentMapping('\${escapeHTML(src)}')" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:4px; padding:2px 6px; font-size:0.7rem; cursor:pointer;">
                                Eliminar
                            </button>
                        </div>
                    \`).join('');
                }
            }

            const modal = document.getElementById('segmentManageModal');
            if (modal) modal.style.display = 'flex';
        }

        function closeManageOfficialSegmentsModal() {
            const modal = document.getElementById('segmentManageModal');
            if (modal) modal.style.display = 'none';
        }

        function resetSegmentMapping(srcSeg) {
            saveHotelCustomSegmentMapping(currentHotel, srcSeg, null);
            openManageOfficialSegmentsModal();
            const activeM = (typeof window.__seg360SelectedMonth !== 'undefined' && window.__seg360SelectedMonth !== null) ? window.__seg360SelectedMonth : (typeof currentMonthIdx !== 'undefined' ? currentMonthIdx : -1);
            renderSegmentPickupAnalysis(currentHotel, currentYear, activeM);
        }

        const SEG_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        function set360SegmentMonth(m) {
            window.__seg360SelectedMonth = m;
            renderSegmentPickupAnalysis(currentHotel, currentYear, m);
        }

        function set360SegmentViewMode(mode) {
            window.__seg360ViewMode = mode;
            const btnSummary = document.getElementById('btnSegViewSummary');
            const btnMatrix = document.getElementById('btnSegViewMatrix');
            const sumWrapper = document.getElementById('segSummaryWrapper');
            const matWrapper = document.getElementById('segMatrixWrapper');
            const sumControls = document.getElementById('segSummaryMonthControls');
            const matControls = document.getElementById('segMatrixControls');

            if (mode === 'matrix') {
                if (btnSummary) { btnSummary.style.background = 'transparent'; btnSummary.style.color = 'var(--text-muted)'; }
                if (btnMatrix) { btnMatrix.style.background = 'var(--primary)'; btnMatrix.style.color = '#fff'; }
                if (sumWrapper) sumWrapper.style.display = 'none';
                if (matWrapper) matWrapper.style.display = 'block';
                if (sumControls) sumControls.style.display = 'none';
                if (matControls) matControls.style.display = 'flex';
                render360SegmentMatrix();
            } else {
                if (btnSummary) { btnSummary.style.background = 'var(--primary)'; btnSummary.style.color = '#fff'; }
                if (btnMatrix) { btnMatrix.style.background = 'transparent'; btnMatrix.style.color = 'var(--text-muted)'; }
                if (sumWrapper) sumWrapper.style.display = 'block';
                if (matWrapper) matWrapper.style.display = 'none';
                if (sumControls) sumControls.style.display = 'flex';
                if (matControls) matControls.style.display = 'none';
            }
        }

        function set360SegMatrixMetric(metric) {
            window.__seg360MatrixMetric = metric;
            ['btnSegMetricRev', 'btnSegMetricRms', 'btnSegMetricAdr'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.style.background = 'transparent';
                    btn.style.color = 'var(--text-muted)';
                }
            });
            const activeBtn = document.getElementById(metric === 'rev' ? 'btnSegMetricRev' : (metric === 'rms' ? 'btnSegMetricRms' : 'btnSegMetricAdr'));
            if (activeBtn) {
                activeBtn.style.background = 'var(--primary)';
                activeBtn.style.color = '#fff';
            }
            render360SegmentMatrix();
        }

        function set360SegMatrixComp(comp) {
            window.__seg360MatrixComp = comp;
            const btnTY = document.getElementById('btnSegMatrixCompTY');
            const btnBoth = document.getElementById('btnSegMatrixCompBoth');
            if (btnTY) {
                btnTY.style.background = comp === 'TY' ? 'rgba(99,102,241,0.25)' : 'transparent';
                btnTY.style.color = comp === 'TY' ? '#818cf8' : 'var(--text-muted)';
                btnTY.style.borderColor = comp === 'TY' ? 'rgba(99,102,241,0.4)' : 'transparent';
            }
            if (btnBoth) {
                btnBoth.style.background = comp === 'BOTH' ? 'rgba(99,102,241,0.25)' : 'transparent';
                btnBoth.style.color = comp === 'BOTH' ? '#818cf8' : 'var(--text-muted)';
                btnBoth.style.borderColor = comp === 'BOTH' ? 'rgba(99,102,241,0.4)' : 'transparent';
            }
            render360SegmentMatrix();
        }

        function toggle360SegmentMonthlyRow(segName) {
            window.__seg360ExpandedMonthlyRows = window.__seg360ExpandedMonthlyRows || new Set();
            if (window.__seg360ExpandedMonthlyRows.has(segName)) {
                window.__seg360ExpandedMonthlyRows.delete(segName);
            } else {
                window.__seg360ExpandedMonthlyRows.add(segName);
            }
            const activeM = (typeof window.__seg360SelectedMonth !== 'undefined' && window.__seg360SelectedMonth !== null) ? window.__seg360SelectedMonth : (typeof currentMonthIdx !== 'undefined' ? currentMonthIdx : -1);
            renderSegmentPickupAnalysis(currentHotel, currentYear, activeM);
        }

        /* ==========================================================================
           PICK-UP Y RENDIMIENTO POR SEGMENTO (VS AÑO ANTERIOR)
           ========================================================================== */
        function renderSegmentPickupAnalysis(hotel, year, midx) {
            const effectiveMonth = (typeof window.__seg360SelectedMonth !== 'undefined' && window.__seg360SelectedMonth !== null) ? window.__seg360SelectedMonth : midx;
            window.__seg360SelectedMonth = effectiveMonth;

            const lyYear = String(Number(year) - 1);
            const lyLabel = document.getElementById('yield-ly-label');
            if (lyLabel) {
                const monthSuffix = (effectiveMonth >= 0 && effectiveMonth < 12) ? \` · \${SEG_MONTHS[effectiveMonth]}\` : ' · Todo el Año';
                lyLabel.innerText = \`\${lyYear} (Año Anterior)\${monthSuffix}\`;
            }

            // Renderizar Month Pills de Filtro Rápido
            const pillsContainer = document.getElementById('segMonthPillsContainer');
            if (pillsContainer) {
                let pillsHtml = \`
                    <button type=\"button\" onclick=\"set360SegmentMonth(-1)\" style=\"background:\${effectiveMonth === -1 ? 'var(--primary)' : 'transparent'}; color:\${effectiveMonth === -1 ? '#fff' : 'var(--text-muted)'}; border:none; padding:3px 8px; border-radius:6px; font-size:0.68rem; font-weight:700; cursor:pointer;\">
                        🌐 Todo
                    </button>
                \`;
                SEG_MONTHS.forEach((mName, mIdx) => {
                    const isAct = (effectiveMonth === mIdx);
                    pillsHtml += \`
                        <button type=\"button\" onclick=\"set360SegmentMonth(\${mIdx})\" style=\"background:\${isAct ? 'var(--primary)' : 'transparent'}; color:\${isAct ? '#fff' : 'var(--text-muted)'}; border:none; padding:3px 7px; border-radius:6px; font-size:0.68rem; font-weight:700; cursor:pointer;\">
                            \${mName}
                        </button>
                    \`;
                });
                pillsContainer.innerHTML = pillsHtml;
            }

            const segTbody = document.getElementById('segmentPickupBody');
            if (!segTbody) return;
            segTbody.innerHTML = '';

            // Intentar leer de upload_segment_db_v2, y fallback a hotel_manager_db_v2
            let segDataTY = {};
            let segDataLY = {};
            let segPrevTY = {};

            try {
                const segRaw = CapaStorage.getItem('upload_segment_db_v2');
                if (segRaw) {
                    const parsed = JSON.parse(segRaw);
                    if (parsed && parsed[hotel]) {
                        segDataTY = parsed[hotel][year]?.segment || {};
                        segDataLY = parsed[hotel][lyYear]?.segment || {};
                        segPrevTY = parsed[hotel][year]?.segment_prev || {};
                    }
                }
            } catch(e) { console.warn("Error leyendo upload_segment_db_v2:", e); }

            if (Object.keys(segDataTY).length === 0 && db[hotel]) {
                segDataTY = db[hotel][year]?.segment || {};
                segDataLY = db[hotel][lyYear]?.segment || {};
                segPrevTY = db[hotel][year]?.segment_prev || {};
            }

            let forecastDB = {};
            try {
                forecastDB = JSON.parse(CapaStorage.getItem('segment_forecast_v2') || '{}') || {};
            } catch(e) { console.warn("Error leyendo segment_forecast_v2:", e); }

            const hotelForecast = forecastDB[hotel] || {};
            const curForecastSeg = hotelForecast.segment || {};
            const prevForecastSeg = hotelForecast.segment_prev || {};
            const segOtbTY = db[hotel]?.[year]?.segment_otb || {};
            const segOtbPrevTY = db[hotel]?.[year]?.segment_otb_prev || {};

            const getSegmentValues = (segObj) => {
                if (!segObj) return { rooms: 0, rev: 0 };
                const mStart = effectiveMonth === -1 ? 0 : effectiveMonth;
                const mEnd = effectiveMonth === -1 ? 11 : effectiveMonth;
                let rooms = 0, rev = 0;

                const roomRevArr = (typeof segmentRoomRevenue === 'function') ? segmentRoomRevenue(segObj) : null;

                for (let m = mStart; m <= mEnd; m++) {
                    rooms += (Number(segObj.rooms?.[m]) || 0);
                    if (roomRevArr) {
                        rev += (Number(roomRevArr[m]) || 0);
                    } else if (segObj.accommodation) {
                        rev += (Number(segObj.accommodation[m]) || 0);
                    } else if (segObj.revenue) {
                        rev += (Number(segObj.revenue[m]) || 0);
                    }
                }
                return { rooms, rev };
            };

            const getForecastValues = (segMap) => {
                const res = {};
                if (!segMap) return res;
                const mStart = effectiveMonth === -1 ? 0 : effectiveMonth;
                const mEnd = effectiveMonth === -1 ? 11 : effectiveMonth;
                Object.entries(segMap).forEach(([rawName, segObj]) => {
                    const canonical = normalizeSegmentDisplayName(rawName, hotel);
                    if (!res[canonical]) res[canonical] = { rooms: 0, rev: 0 };
                    if (segObj && segObj.days) {
                        Object.entries(segObj.days).forEach(([iso, dt]) => {
                            const [yStr, mStr] = iso.split('-');
                            if (yStr === String(year)) {
                                const m = parseInt(mStr, 10) - 1;
                                if (m >= mStart && m <= mEnd) {
                                    res[canonical].rooms += (Number(dt.rooms) || 0);
                                    res[canonical].rev += (Number(dt.accommodation) || Number(dt.revenue) || 0);
                                }
                            }
                        });
                    }
                });
                return res;
            };

            const curForecastVals = getForecastValues(curForecastSeg);
            const prevForecastVals = getForecastValues(prevForecastSeg);
            const hasForecastPrev = prevForecastSeg && Object.keys(prevForecastSeg).length > 0;
            const hasMonthlyOtbPrev = segOtbPrevTY && Object.keys(segOtbPrevTY).length > 0;
            const hasSegmentPrev = segPrevTY && Object.keys(segPrevTY).length > 0;

            const groupedMap = {};

            const addToGroup = (srcObj, key) => {
                if (!srcObj) return;
                Object.keys(srcObj).forEach(rawName => {
                    const canonical = normalizeSegmentDisplayName(rawName, hotel);
                    if (!groupedMap[canonical]) {
                        groupedMap[canonical] = { 
                            cur: { rooms: 0, rev: 0 }, 
                            ly: { rooms: 0, rev: 0 }, 
                            prev: { rooms: 0, rev: 0 },
                            monthlyCur: { rooms: new Array(12).fill(0), rev: new Array(12).fill(0) },
                            monthlyLy: { rooms: new Array(12).fill(0), rev: new Array(12).fill(0) }
                        };
                    }
                    const vals = getSegmentValues(srcObj[rawName]);
                    groupedMap[canonical][key].rooms += vals.rooms;
                    groupedMap[canonical][key].rev += vals.rev;

                    // Captura mensual completa para la matriz
                    if (key === 'cur' || key === 'ly') {
                        const mTarget = key === 'cur' ? groupedMap[canonical].monthlyCur : groupedMap[canonical].monthlyLy;
                        const sObj = srcObj[rawName];
                        const roomRevArr = (typeof segmentRoomRevenue === 'function') ? segmentRoomRevenue(sObj) : null;
                        for (let m = 0; m < 12; m++) {
                            mTarget.rooms[m] += (Number(sObj.rooms?.[m]) || 0);
                            if (roomRevArr) {
                                mTarget.rev[m] += (Number(roomRevArr[m]) || 0);
                            } else if (sObj.accommodation) {
                                mTarget.rev[m] += (Number(sObj.accommodation[m]) || 0);
                            } else if (sObj.revenue) {
                                mTarget.rev[m] += (Number(sObj.revenue[m]) || 0);
                            }
                        }
                    }
                });
            };

            addToGroup(segDataTY, 'cur');
            addToGroup(segDataLY, 'ly');
            addToGroup(segPrevTY, 'prev');

            // Asegurar que forecast también alimente monthlyCur
            Object.entries(curForecastSeg).forEach(([rawName, segObj]) => {
                const canonical = normalizeSegmentDisplayName(rawName, hotel);
                if (!groupedMap[canonical]) {
                    groupedMap[canonical] = { 
                        cur: { rooms: 0, rev: 0 }, 
                        ly: { rooms: 0, rev: 0 }, 
                        prev: { rooms: 0, rev: 0 },
                        monthlyCur: { rooms: new Array(12).fill(0), rev: new Array(12).fill(0) },
                        monthlyLy: { rooms: new Array(12).fill(0), rev: new Array(12).fill(0) }
                    };
                }
                if (segObj && segObj.days) {
                    Object.entries(segObj.days).forEach(([iso, dt]) => {
                        const [yStr, mStr] = iso.split('-');
                        if (yStr === String(year)) {
                            const m = parseInt(mStr, 10) - 1;
                            if (m >= 0 && m < 12) {
                                if (groupedMap[canonical].monthlyCur.rooms[m] === 0) {
                                    groupedMap[canonical].monthlyCur.rooms[m] += (Number(dt.rooms) || 0);
                                    groupedMap[canonical].monthlyCur.rev[m] += (Number(dt.accommodation) || Number(dt.revenue) || 0);
                                }
                            }
                        }
                    });
                }
            });

            // Si un segmento no tiene producción real en este periodo pero sí OTB de forecast, usar forecast
            Object.keys(groupedMap).forEach(segName => {
                const fData = curForecastVals[segName];
                if (fData && fData.rooms > 0 && groupedMap[segName].cur.rooms === 0) {
                    groupedMap[segName].cur.rooms = fData.rooms;
                    groupedMap[segName].cur.rev = fData.rev;
                }
            });

            window.__seg360GroupedMap = groupedMap;
            window.__seg360Hotel = hotel;
            window.__seg360Year = year;

            const allCanonicalKeys = Object.keys(groupedMap);
            if (allCanonicalKeys.length === 0) {
                segTbody.innerHTML = '<tr><td colspan=\"11\" style=\"text-align:center; padding:24px; color:var(--text-muted);\">No hay informes de segmentos cargados para este hotel y año</td></tr>';
                render360SegmentMatrix();
                return;
            }

            const rows = [];
            let totRmsTY = 0, totRevTY = 0;
            let totRmsLY = 0, totRevLY = 0;
            let totPickupRms = 0, totPickupRev = 0;

            const officialList = getHotelOfficialSegments(hotel);

            allCanonicalKeys.forEach(segName => {
                const cur = groupedMap[segName].cur;
                const ly = groupedMap[segName].ly;
                const prev = groupedMap[segName].prev;

                let pickupRms = 0;
                let pickupRev = 0;

                if (hasForecastPrev && curForecastVals[segName] && prevForecastVals[segName]) {
                    pickupRms = curForecastVals[segName].rooms - prevForecastVals[segName].rooms;
                    pickupRev = curForecastVals[segName].rev - prevForecastVals[segName].rev;
                } else if (hasMonthlyOtbPrev && segOtbTY[segName] && segOtbPrevTY[segName]) {
                    const cO = getSegmentValues(segOtbTY[segName]);
                    const pO = getSegmentValues(segOtbPrevTY[segName]);
                    pickupRms = cO.rooms - pO.rooms;
                    pickupRev = cO.rev - pO.rev;
                } else if (hasSegmentPrev && prev && (prev.rooms !== 0 || prev.rev !== 0)) {
                    pickupRms = cur.rooms - prev.rooms;
                    pickupRev = cur.rev - prev.rev;
                }

                if (cur.rev === 0 && ly.rev === 0 && cur.rooms === 0 && ly.rooms === 0 && pickupRms === 0 && pickupRev === 0) return;

                const adrTY = cur.rooms > 0 ? (cur.rev / cur.rooms) : 0;
                const adrLY = ly.rooms > 0 ? (ly.rev / ly.rooms) : 0;

                const deltaRev = cur.rev - ly.rev;
                const deltaRevPct = ly.rev > 0 ? (deltaRev / ly.rev * 100) : (cur.rev > 0 ? 100 : 0);

                const deltaRms = cur.rooms - ly.rooms;
                const deltaRmsPct = ly.rooms > 0 ? (deltaRms / ly.rooms * 100) : (cur.rooms > 0 ? 100 : 0);

                const deltaAdr = adrTY - adrLY;
                const deltaAdrPct = adrLY > 0 ? (deltaAdr / adrLY * 100) : 0;

                let channels = [];
                let segCommissionsTY = 0;
                let segCommissionsLY = 0;

                const segRawObjTY = segDataTY[segName] || segDataTY[Object.keys(segDataTY).find(k => normalizeSegmentDisplayName(k, hotel) === segName)];
                const segRawObjLY = segDataLY[segName] || segDataLY[Object.keys(segDataLY).find(k => normalizeSegmentDisplayName(k, hotel) === segName)];

                if (typeof SegmentAnalysis !== 'undefined') {
                    if (segRawObjTY) {
                        try {
                            const mList = effectiveMonth === -1 ? [] : [effectiveMonth];
                            const chList = SegmentAnalysis.getSegmentChannels(segRawObjTY, mList, hotel);
                            channels = chList.map(ch => {
                                const oldCh = segRawObjLY?.channels?.[ch.name];
                                const oldChRooms = oldCh ? (effectiveMonth === -1 ? SegmentAnalysis.sum(oldCh, 'rooms') : (Number(oldCh.rooms?.[effectiveMonth]) || 0)) : 0;
                                const oldChAcc = oldCh ? (effectiveMonth === -1 ? SegmentAnalysis.sum(oldCh, 'accommodation') : (Number(oldCh.accommodation?.[effectiveMonth]) || 0)) : 0;
                                const oldChAdr = oldChRooms > 0 && oldChAcc > 0 ? oldChAcc / oldChRooms : 0;
                                const oldNet = SegmentAnalysis.calculateNetMetrics(oldChAcc, oldChRooms, ch.name, hotel);

                                return {
                                    name: ch.name,
                                    roomsTY: ch.rooms,
                                    revTY: ch.accommodation,
                                    adrTY: ch.adr,
                                    commissionPct: ch.commissionPct,
                                    commissionAmount: ch.commissionAmount,
                                    netRevTY: ch.netAccommodation,
                                    netAdrTY: ch.netAdr,
                                    roomsLY: oldChRooms,
                                    revLY: oldChAcc,
                                    adrLY: oldChAdr,
                                    netRevLY: oldNet.netAccommodation,
                                    netAdrLY: oldNet.netAdr
                                };
                            });
                            segCommissionsTY = channels.reduce((sum, c) => sum + c.commissionAmount, 0);
                        } catch(e) {}
                    }
                    if (segCommissionsTY === 0 && cur.rev > 0) {
                        const netRes = SegmentAnalysis.calculateNetMetrics(cur.rev, cur.rooms, segName, hotel);
                        segCommissionsTY = netRes.commissionAmount;
                    }
                    if (ly.rev > 0) {
                        const netResLY = SegmentAnalysis.calculateNetMetrics(ly.rev, ly.rooms, segName, hotel);
                        segCommissionsLY = netResLY.commissionAmount;
                    }
                }

                const netRevTY = Math.max(0, cur.rev - segCommissionsTY);
                const netAdrTY = cur.rooms > 0 ? (netRevTY / cur.rooms) : 0;
                const netRevLY = Math.max(0, ly.rev - segCommissionsLY);
                const netAdrLY = ly.rooms > 0 ? (netRevLY / ly.rooms) : 0;

                totRmsTY += cur.rooms;
                totRevTY += cur.rev;
                totRmsLY += ly.rooms;
                totRevLY += ly.rev;
                totPickupRms += pickupRms;
                totPickupRev += pickupRev;

                const isOfficial = officialList.includes(segName);

                rows.push({
                    name: segName,
                    isOfficial: isOfficial,
                    roomsTY: cur.rooms,
                    revTY: cur.rev,
                    adrTY: adrTY,
                    netRevTY: netRevTY,
                    netAdrTY: netAdrTY,
                    commissionAmountTY: segCommissionsTY,
                    roomsLY: ly.rooms,
                    revLY: ly.rev,
                    adrLY: adrLY,
                    netRevLY: netRevLY,
                    netAdrLY: netAdrLY,
                    commissionAmountLY: segCommissionsLY,
                    channels,
                    deltaRev,
                    deltaRevPct,
                    deltaRms,
                    deltaRmsPct,
                    deltaAdr,
                    deltaAdrPct,
                    pickupRms,
                    pickupRev
                });
            });

            const isNetView = !!window.__seg360NetMode;
            const expandedSegs = window.__seg360ExpandedSegs || new Set();
            const expandedMonthlyRows = window.__seg360ExpandedMonthlyRows || new Set();
            const totalCommissions = rows.reduce((sum, r) => sum + r.commissionAmountTY, 0);
            const totalNetRevTY = rows.reduce((sum, r) => sum + r.netRevTY, 0);
            const totalNetRevLY = rows.reduce((sum, r) => sum + r.netRevLY, 0);

            const commBadge = document.getElementById('yield360CommissionBadge');
            if (commBadge) {
                const totalMarginPct = totRevTY > 0 ? ((totRevTY - totalCommissions) / totRevTY * 100) : 100;
                commBadge.innerHTML = \`💰 Comis: <strong style=\"color:#ef4444;\">-\${fmt(totalCommissions)}</strong> · Margen: <strong style=\"color:#10b981;\">\${totalMarginPct.toFixed(1)}%</strong>\`;
            }
            const btnGross = document.getElementById('btn360SegGross');
            const btnNet = document.getElementById('btn360SegNet');
            if (btnGross) {
                btnGross.style.background = !isNetView ? 'var(--primary)' : 'transparent';
                btnGross.style.color = !isNetView ? '#fff' : 'var(--text-muted)';
            }
            if (btnNet) {
                btnNet.style.background = isNetView ? '#10b981' : 'transparent';
                btnNet.style.color = isNetView ? '#fff' : 'var(--text-muted)';
            }

            rows.sort((a, b) => (isNetView ? b.netRevTY - a.netRevTY : b.revTY - a.revTY));

            const formatVar = (diffVal, pctVal, isCurrency = false) => {
                if (pctVal === 0 && diffVal === 0) return '<span style=\"color:var(--text-muted); font-size:0.7rem;\">= 0%</span>';
                const isPos = diffVal > 0;
                const col = isPos ? '#10b981' : '#ef4444';
                const sign = isPos ? '+' : '';
                const pctFormatted = isFinite(pctVal) ? \`\${sign}\${pctVal.toFixed(1).replace('.', ',')}%\` : 'N/A';
                return \`<span style=\"color:\${col}; font-weight:700; font-size:0.72rem;\">\${pctFormatted}</span>\`;
            };

            rows.forEach(r => {
                const pRmsTag = r.pickupRms > 0 
                    ? \`<span style=\"color:#10b981; font-weight:700;\">+\${r.pickupRms} RN</span>\`
                    : (r.pickupRms < 0 ? \`<span style=\"color:#ef4444; font-weight:700;\">\${r.pickupRms} RN</span>\` : '<span style=\"color:var(--text-muted);\">● 0</span>');

                const pRevTag = r.pickupRev > 0
                    ? \`<span style=\"color:#10b981; font-weight:700;\">+\${fmt(r.pickupRev)}</span>\`
                    : (r.pickupRev < 0 ? \`<span style=\"color:#ef4444; font-weight:700;\">\${fmt(r.pickupRev)}</span>\` : '<span style=\"color:var(--text-muted);\">● 0 €</span>');

                const dispRevTY = isNetView ? r.netRevTY : r.revTY;
                const dispRevLY = isNetView ? r.netRevLY : r.revLY;
                const dispAdrTY = isNetView ? r.netAdrTY : r.adrTY;
                const dispAdrLY = isNetView ? r.netAdrLY : r.adrLY;

                const dispDeltaRev = dispRevTY - dispRevLY;
                const dispDeltaRevPct = dispRevLY > 0 ? (dispDeltaRev / dispRevLY * 100) : (dispRevTY > 0 ? 100 : 0);
                const dispDeltaAdr = dispAdrTY - dispAdrLY;
                const dispDeltaAdrPct = dispAdrLY > 0 ? (dispDeltaAdr / dispAdrLY * 100) : 0;

                const hasChannels = r.channels && r.channels.length > 1;
                const isExpanded = expandedSegs.has(r.name);
                const expandBtn = hasChannels 
                    ? \`<button type=\"button\" onclick=\"toggle360SegmentChannels('\${escapeHTML(r.name)}')\" style=\"background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); color: var(--primary); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; line-height: 1; margin-right: 6px;\" title=\"Ver canales del segmento\">\${isExpanded ? '▼' : '▶'}</button>\` 
                    : '';

                const isMonthlyOpen = expandedMonthlyRows.has(r.name);
                const month12Btn = \`<button type=\"button\" onclick=\"toggle360SegmentMonthlyRow('\${escapeHTML(r.name)}')\" style=\"background: \${isMonthlyOpen ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}; border: 1px solid \${isMonthlyOpen ? '#10b981' : 'var(--border)'}; color: \${isMonthlyOpen ? '#10b981' : 'var(--text-muted)'}; padding: 1px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700; cursor: pointer; line-height: 1.2; margin-right: 6px;\" title=\"Ver desglose 12 meses\">📅 12M</button>\`;

                const unOfficialBadge = !r.isOfficial 
                    ? \`<span style=\"background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; padding:1px 5px; font-size:0.65rem; font-weight:700; margin-left:6px;\">No oficial</span>\`
                    : '';

                const corrBtn = !r.isOfficial || r.name.toUpperCase().includes('PARTIC')
                    ? \`<button type=\"button\" onclick=\"openSegmentCorrectionModal('\${escapeHTML(r.name)}')\" title=\"Reasignar a segmento oficial de \${escapeHTML(hotel)}\" style=\"background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); color:#f59e0b; padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700; cursor:pointer; line-height:1.2; margin-left:6px;\">✏️ Corregir</button>\`
                    : '';

                const commissionNote = r.commissionAmountTY > 0 ? \` <span style=\"font-size:0.65rem; color:#ef4444; display:block; font-weight:normal;\">(-\${fmt(r.commissionAmountTY)})</span>\` : '';

                let tanteoAlertBadge = '';
                if (typeof SegmentAnalysis !== 'undefined' && SegmentAnalysis.canonical && SegmentAnalysis.canonical(r.name, hotel) === 'GRTANTEO' && SegmentAnalysis.detectGrtanteoAlerts) {
                    try {
                        const tAlert = SegmentAnalysis.detectGrtanteoAlerts({ forecastDB, hotel, year });
                        if (tAlert && tAlert.hasAlert) {
                            tanteoAlertBadge = \` <span style=\"background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; padding:1px 6px; font-size:0.68rem; font-weight:700; margin-left:6px;\" title=\"No se permiten reservas en tanteo a menos de 15 días de la llegada\">⚠️ < 15d (\${tAlert.totalRooms} RN)</span>\`;
                        }
                    } catch (e) {}
                }

                let mainRow = \`
                    <tr style=\"border-bottom: 1px solid var(--border);\">
                        <td style=\"font-weight:700; color:var(--text-main); white-space:nowrap;\">
                            <div style=\"display:flex; align-items:center;\">
                                \${expandBtn}
                                \${month12Btn}
                                <span>\${escapeHTML(r.name)}</span>
                                \${hasChannels ? \`<span style=\"font-size:0.68rem; color:var(--text-muted); font-weight:normal; margin-left:4px;\">(\${r.channels.length} can.)</span>\` : ''}
                                \${unOfficialBadge}
                                \${corrBtn}
                                \${tanteoAlertBadge}
                            </div>
                        </td>
                        <td style=\"font-weight:700; color:\${isNetView ? '#10b981' : 'var(--text-main)'};\">
                            \${fmt(dispRevTY)}
                            \${commissionNote}
                        </td>
                        <td style=\"color:var(--text-muted);\">\${fmt(dispRevLY)}</td>
                        <td style=\"border-right: 1px solid var(--border);\">\${formatVar(dispDeltaRev, dispDeltaRevPct, true)}</td>
                        <td style=\"font-weight:700;\">\${fmtNum(r.roomsTY)} RN</td>
                        <td style=\"color:var(--text-muted);\">\${fmtNum(r.roomsLY)} RN</td>
                        <td style=\"border-right: 1px solid var(--border);\">\${formatVar(r.deltaRms, r.deltaRmsPct)}</td>
                        <td style=\"font-weight:700; color:\${isNetView ? '#10b981' : 'var(--primary)'};\">\${fmt(dispAdrTY)}</td>
                        <td style=\"color:var(--text-muted);\">\${fmt(dispAdrLY)}</td>
                        <td style=\"border-right: 1px solid var(--border);\">\${formatVar(dispDeltaAdr, dispDeltaAdrPct, true)}</td>
                        <td>\${pRmsTag}</td>
                        <td>\${pRevTag}</td>
                    </tr>
                \`;

                let subrows = '';
                if (isExpanded && hasChannels) {
                    subrows = r.channels.map(ch => {
                        const chRevTY = isNetView ? ch.netRevTY : ch.revTY;
                        const chRevLY = isNetView ? ch.netRevLY : ch.revLY;
                        const chAdrTY = isNetView ? ch.netAdrTY : ch.adrTY;
                        const chAdrLY = isNetView ? ch.netAdrLY : ch.adrLY;
                        const chDeltaRev = chRevTY - chRevLY;
                        const chDeltaRevPct = chRevLY > 0 ? (chDeltaRev / chRevLY * 100) : (chRevTY > 0 ? 100 : 0);
                        const chDeltaRms = ch.roomsTY - ch.roomsLY;
                        const chDeltaRmsPct = ch.roomsLY > 0 ? (chDeltaRms / ch.roomsLY * 100) : (ch.roomsTY > 0 ? 100 : 0);
                        const chDeltaAdr = chAdrTY - chAdrLY;
                        const chDeltaAdrPct = chAdrLY > 0 ? (chDeltaAdr / chAdrLY * 100) : 0;

                        return \`
                            <tr style=\"background: rgba(99, 102, 241, 0.03); font-size: 0.78rem; border-bottom: 1px dashed var(--border);\">
                                <td style=\"padding-left: 32px; border-left: 3px solid var(--primary); font-weight: 600; color: var(--text-main);\">
                                    <span style=\"color: var(--primary); margin-right: 4px;\">↳</span>
                                    <span>\${escapeHTML(ch.name)}</span>
                                    <span style=\"font-size: 0.65rem; color: var(--text-muted); margin-left: 4px;\">(\${ch.commissionPct}% com.)</span>
                                </td>
                                <td style=\"font-weight: 600; color: \${isNetView ? '#10b981' : 'var(--text-main)'};\">
                                    \${fmt(chRevTY)}
                                    \${ch.commissionAmount > 0 ? \`<span style=\"font-size:0.62rem; color:#ef4444; display:block;\">(-\${fmt(ch.commissionAmount)})</span>\` : ''}
                                </td>
                                <td style=\"color: var(--text-muted);\">\${fmt(chRevLY)}</td>
                                <td style=\"border-right: 1px solid var(--border);\">\${formatVar(chDeltaRev, chDeltaRevPct, true)}</td>
                                <td>\${fmtNum(ch.roomsTY)} RN</td>
                                <td style=\"color: var(--text-muted);\">\${fmtNum(ch.roomsLY)} RN</td>
                                <td style=\"border-right: 1px solid var(--border);\">\${formatVar(chDeltaRms, chDeltaRmsPct)}</td>
                                <td style=\"font-weight: 600; color: \${isNetView ? '#10b981' : 'var(--primary)'};\">\${fmt(chAdrTY)}</td>
                                <td style=\"color: var(--text-muted);\">\${fmt(chAdrLY)}</td>
                                <td style=\"border-right: 1px solid var(--border);\">\${formatVar(chDeltaAdr, chDeltaAdrPct, true)}</td>
                                <td>—</td>
                                <td>—</td>
                            </tr>
                        \`;
                    }).join('');
                }

                let monthlyRow = '';
                if (isMonthlyOpen && groupedMap[r.name]) {
                    const sMap = groupedMap[r.name];
                    let monthCards = '';
                    for (let m = 0; m < 12; m++) {
                        let cRev = sMap.monthlyCur.rev[m] || 0;
                        let cRms = sMap.monthlyCur.rooms[m] || 0;
                        let lRev = sMap.monthlyLy.rev[m] || 0;
                        let lRms = sMap.monthlyLy.rooms[m] || 0;

                        if (isNetView && typeof SegmentAnalysis !== 'undefined') {
                            const cNet = SegmentAnalysis.calculateNetMetrics(cRev, cRms, r.name, hotel);
                            cRev = Math.max(0, cRev - cNet.commissionAmount);
                            const lNet = SegmentAnalysis.calculateNetMetrics(lRev, lRms, r.name, hotel);
                            lRev = Math.max(0, lRev - lNet.commissionAmount);
                        }

                        const cAdr = cRms > 0 ? (cRev / cRms) : 0;
                        const dRevPct = lRev > 0 ? ((cRev - lRev) / lRev * 100) : 0;

                        monthCards += \`
                            <div style=\"flex:1; min-width:68px; background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:6px; padding:5px 6px; text-align:center;\">
                                <div style=\"font-size:0.65rem; font-weight:800; color:#818cf8; text-transform:uppercase;\">\${SEG_MONTHS[m]}</div>
                                <div style=\"font-size:0.72rem; font-weight:700; color:var(--text-main); margin-top:2px;\">\${fmt(cRev)}</div>
                                <div style=\"font-size:0.62rem; color:var(--text-muted);\">\${fmtNum(cRms)} RN · \${fmt(cAdr)}</div>
                                \${cRev > 0 && lRev > 0 ? \`<div style=\"font-size:0.6rem; font-weight:700; color:\${dRevPct >= 0 ? '#10b981' : '#ef4444'}; margin-top:1px;\">\${dRevPct >= 0 ? '+' : ''}\${dRevPct.toFixed(1).replace('.', ',')}%</div>\` : ''}
                            </div>
                        \`;
                    }

                    monthlyRow = \`
                        <tr style=\"background:rgba(16,185,129,0.03); border-bottom:1px dashed var(--border);\">
                            <td colspan=\"11\" style=\"padding:8px 14px 10px 32px; border-left:3px solid #10b981;\">
                                <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;\">
                                    <span style=\"font-size:0.72rem; font-weight:800; color:#10b981; text-transform:uppercase; display:flex; align-items:center; gap:6px;\">
                                        <span>📅</span> Desglose 12 Meses: \${escapeHTML(r.name)} (\${isNetView ? 'NETO' : 'BRUTO'})
                                    </span>
                                    <span style=\"font-size:0.68rem; color:var(--text-muted);\">Producción, RN, ADR y Var % vs Año Anterior mes a mes</span>
                                </div>
                                <div style=\"display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;\">
                                    \${monthCards}
                                </div>
                            </td>
                        </tr>
                    \`;
                }

                segTbody.innerHTML += mainRow + subrows + monthlyRow;
            });

            // Fila Total
            const finalTotRevTY = isNetView ? totalNetRevTY : totRevTY;
            const finalTotRevLY = isNetView ? totalNetRevLY : totRevLY;
            const totAdrTY = totRmsTY > 0 ? (finalTotRevTY / totRmsTY) : 0;
            const totAdrLY = totRmsLY > 0 ? (finalTotRevLY / totRmsLY) : 0;
            const totDeltaRev = finalTotRevTY - finalTotRevLY;
            const totDeltaRevPct = finalTotRevLY > 0 ? (totDeltaRev / finalTotRevLY * 100) : 0;
            const totDeltaRms = totRmsTY - totRmsLY;
            const totDeltaRmsPct = totRmsLY > 0 ? (totDeltaRms / totRmsLY * 100) : 0;
            const totDeltaAdr = totAdrTY - totAdrLY;
            const totDeltaAdrPct = totAdrLY > 0 ? (totDeltaAdr / totAdrLY * 100) : 0;

            segTbody.innerHTML += \`
                <tr style=\"background: rgba(99, 102, 241, 0.12); font-weight:800; border-top: 2px solid var(--border);\">
                    <td style=\"color: #a78bfa;\">TOTAL TODOS LOS CANALES (\${isNetView ? '💎 NETO' : 'BRUTO'}\${effectiveMonth >= 0 ? \` · \${SEG_MONTHS[effectiveMonth]}\` : ''})</td>
                    <td style=\"color:\${isNetView ? '#10b981' : 'inherit'};\尋\${fmt(finalTotRevTY)}</td>
                    <td style=\"color:var(--text-muted);\">\${fmt(finalTotRevLY)}</td>
                    <td style=\"border-right: 1px solid var(--border);\">\${formatVar(totDeltaRev, totDeltaRevPct, true)}</td>
                    <td>\${fmtNum(totRmsTY)} RN</td>
                    <td style=\"color:var(--text-muted);\">\${fmtNum(totRmsLY)} RN</td>
                    <td style=\"border-right: 1px solid var(--border);\">\${formatVar(totDeltaRms, totDeltaRmsPct)}</td>
                    <td style=\"color:\${isNetView ? '#10b981' : 'var(--primary)'}; font-size:0.85rem;\">\${fmt(totAdrTY)}</td>
                    <td style=\"color:var(--text-muted);\">\${fmt(totAdrLY)}</td>
                    <td style=\"border-right: 1px solid var(--border);\">\${formatVar(totDeltaAdr, totDeltaAdrPct, true)}</td>
                    <td>\${totPickupRms > 0 ? \`<span style=\"color:#10b981;\">+\${totPickupRms} RN</span>\` : (totPickupRms < 0 ? \`<span style=\"color:#ef4444;\">\${totPickupRms} RN</span>\` : '● 0')}</td>
                    <td>\${totPickupRev > 0 ? \`<span style=\"color:#10b981;\">+\${fmt(totPickupRev)}</span>\` : (totPickupRev < 0 ? \`<span style=\"color:#ef4444;\">\${fmt(totPickupRev)}</span>\` : '● 0 €')}</td>
                </tr>
            \`.replace(';\尋', ';');

            render360SegmentMatrix();
        }

        function render360SegmentMatrix() {
            const tbody = document.getElementById('segMatrixBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            const groupedMap = window.__seg360GroupedMap;
            if (!groupedMap || Object.keys(groupedMap).length === 0) {
                tbody.innerHTML = '<tr><td colspan=\"14\" style=\"text-align:center; padding:20px; color:var(--text-muted);\">No hay datos mensuales cargados</td></tr>';
                return;
            }

            const hotel = window.__seg360Hotel || currentHotel;
            const isNetView = !!window.__seg360NetMode;
            const metric = window.__seg360MatrixMetric || 'rev';
            const compMode = window.__seg360MatrixComp || 'TY';

            const officialList = getHotelOfficialSegments(hotel);
            const sortedKeys = Object.keys(groupedMap).sort((a, b) => {
                const revA = groupedMap[a].monthlyCur.rev.reduce((sum, v) => sum + v, 0);
                const revB = groupedMap[b].monthlyCur.rev.reduce((sum, v) => sum + v, 0);
                return revB - revA;
            });

            const colTotalsCur = new Array(12).fill(0);
            const colTotalsLY = new Array(12).fill(0);
            const colTotalsRmsCur = new Array(12).fill(0);
            const colTotalsRmsLY = new Array(12).fill(0);

            sortedKeys.forEach(segName => {
                const seg = groupedMap[segName];
                const isOfficial = officialList.includes(segName);

                let rowTotalCur = 0;
                let rowTotalLY = 0;
                let rowTotalRmsCur = 0;
                let rowTotalRmsLY = 0;

                let cellsHtml = '';

                for (let m = 0; m < 12; m++) {
                    let curRev = seg.monthlyCur.rev[m] || 0;
                    let curRms = seg.monthlyCur.rooms[m] || 0;
                    let lyRev = seg.monthlyLy.rev[m] || 0;
                    let lyRms = seg.monthlyLy.rooms[m] || 0;

                    if (isNetView && typeof SegmentAnalysis !== 'undefined') {
                        const cNet = SegmentAnalysis.calculateNetMetrics(curRev, curRms, segName, hotel);
                        curRev = Math.max(0, curRev - cNet.commissionAmount);
                        const lNet = SegmentAnalysis.calculateNetMetrics(lyRev, lyRms, segName, hotel);
                        lyRev = Math.max(0, lyRev - lNet.commissionAmount);
                    }

                    rowTotalCur += curRev;
                    rowTotalLY += lyRev;
                    rowTotalRmsCur += curRms;
                    rowTotalRmsLY += lyRms;

                    colTotalsCur[m] += curRev;
                    colTotalsLY[m] += lyRev;
                    colTotalsRmsCur[m] += curRms;
                    colTotalsRmsLY[m] += lyRms;

                    let curVal = (metric === 'rev') ? curRev : ((metric === 'rms') ? curRms : (curRms > 0 ? curRev / curRms : 0));
                    let lyVal = (metric === 'rev') ? lyRev : ((metric === 'rms') ? lyRms : (lyRms > 0 ? lyRev / lyRms : 0));

                    let displayVal = '--';
                    if (curVal > 0) {
                        if (metric === 'rev') displayVal = fmt(curVal);
                        else if (metric === 'rms') displayVal = fmtNum(curVal);
                        else if (metric === 'adr') displayVal = fmt(curVal);
                    }

                    let subTag = '';
                    if (compMode === 'BOTH' && curVal > 0 && lyVal > 0) {
                        const diff = curVal - lyVal;
                        const diffPct = (diff / lyVal) * 100;
                        const isPos = diff >= 0;
                        const color = isPos ? '#10b981' : '#ef4444';
                        const sign = isPos ? '+' : '';
                        subTag = \`<span style=\"font-size:0.62rem; color:\${color}; font-weight:700; display:block; margin-top:2px;\">\${sign}\${diffPct.toFixed(1).replace('.', ',')}%\</span>\`;
                    } else if (compMode === 'BOTH' && lyVal > 0 && curVal === 0) {
                        subTag = \`<span style=\"font-size:0.62rem; color:#ef4444; font-weight:700; display:block; margin-top:2px;\">-100%</span>\`;
                    }

                    cellsHtml += \`
                        <td style=\"text-align:right; font-weight:\${curVal > 0 ? '700' : 'normal'}; color:\${curVal > 0 ? 'var(--text-main)' : 'var(--text-muted)'}; padding:6px 8px;\">
                            \${displayVal}
                            \${subTag}
                        </td>
                    \`;
                }

                let totCurVal = (metric === 'rev') ? rowTotalCur : ((metric === 'rms') ? rowTotalRmsCur : (rowTotalRmsCur > 0 ? rowTotalCur / rowTotalRmsCur : 0));
                let totLyVal = (metric === 'rev') ? rowTotalLY : ((metric === 'rms') ? rowTotalRmsLY : (rowTotalRmsLY > 0 ? rowTotalLY / rowTotalRmsLY : 0));

                let totDisplay = '--';
                if (totCurVal > 0) {
                    if (metric === 'rev') totDisplay = fmt(totCurVal);
                    else if (metric === 'rms') totDisplay = fmtNum(totCurVal) + ' RN';
                    else if (metric === 'adr') totDisplay = fmt(totCurVal);
                }

                let totSub = '';
                if (compMode === 'BOTH' && totCurVal > 0 && totLyVal > 0) {
                    const diff = totCurVal - totLyVal;
                    const diffPct = (diff / totLyVal) * 100;
                    const isPos = diff >= 0;
                    const color = isPos ? '#10b981' : '#ef4444';
                    const sign = isPos ? '+' : '';
                    totSub = \`<span style=\"font-size:0.65rem; color:\${color}; font-weight:700; display:block; margin-top:2px;\">\${sign}\${diffPct.toFixed(1).replace('.', ',')}%\</span>\`;
                }

                const unOfficialBadge = !isOfficial 
                    ? \`<span style=\"background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; padding:1px 4px; font-size:0.62rem; font-weight:700; margin-left:4px;\">No oficial</span>\`
                    : '';

                const corrBtn = !isOfficial || segName.toUpperCase().includes('PARTIC')
                    ? \`<button type=\"button\" onclick=\"openSegmentCorrectionModal('\${escapeHTML(segName)}')\" style=\"background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.4); color:#f59e0b; padding:1px 5px; border-radius:4px; font-size:0.65rem; font-weight:700; cursor:pointer; margin-left:4px;\" title=\"Reasignar a oficial\">✏️</button>\`
                    : '';

                tbody.innerHTML += \`
                    <tr style=\"border-bottom:1px solid var(--border);\">
                        <td style=\"font-weight:700; color:var(--text-main); white-space:nowrap; padding:6px 10px;\">
                            <span>\${escapeHTML(segName)}</span>
                            \${unOfficialBadge}
                            \${corrBtn}
                        </td>
                        \${cellsHtml}
                        <td style=\"text-align:right; font-weight:800; background:rgba(99,102,241,0.06); color:var(--primary); border-left:1px solid var(--border); padding:6px 10px;\">
                            \${totDisplay}
                            \${totSub}
                        </td>
                    </tr>
                \`;
            });

            // Fila Total Hotel
            let grandTotCur = 0;
            let grandTotLY = 0;
            let grandTotRmsCur = 0;
            let grandTotRmsLY = 0;
            let totalColsHtml = '';

            for (let m = 0; m < 12; m++) {
                grandTotCur += colTotalsCur[m];
                grandTotLY += colTotalsLY[m];
                grandTotRmsCur += colTotalsRmsCur[m];
                grandTotRmsLY += colTotalsRmsLY[m];

                let curVal = (metric === 'rev') ? colTotalsCur[m] : ((metric === 'rms') ? colTotalsRmsCur[m] : (colTotalsRmsCur[m] > 0 ? colTotalsCur[m] / colTotalsRmsCur[m] : 0));
                let lyVal = (metric === 'rev') ? colTotalsLY[m] : ((metric === 'rms') ? colTotalsRmsLY[m] : (colTotalsRmsLY[m] > 0 ? colTotalsLY[m] / colTotalsRmsLY[m] : 0));

                let displayVal = '--';
                if (curVal > 0) {
                    if (metric === 'rev') displayVal = fmt(curVal);
                    else if (metric === 'rms') displayVal = fmtNum(curVal);
                    else if (metric === 'adr') displayVal = fmt(curVal);
                }

                let subTag = '';
                if (compMode === 'BOTH' && curVal > 0 && lyVal > 0) {
                    const diff = curVal - lyVal;
                    const diffPct = (diff / lyVal) * 100;
                    const isPos = diff >= 0;
                    const color = isPos ? '#10b981' : '#ef4444';
                    const sign = isPos ? '+' : '';
                    subTag = \`<span style=\"font-size:0.62rem; color:\${color}; font-weight:700; display:block; margin-top:2px;\">\${sign}\${diffPct.toFixed(1).replace('.', ',')}%\</span>\`;
                }

                totalColsHtml += \`
                    <td style=\"text-align:right; font-weight:800; padding:8px 8px;\">
                        \${displayVal}
                        \${subTag}
                    </td>
                \`;
            }

            let grandVal = (metric === 'rev') ? grandTotCur : ((metric === 'rms') ? grandTotRmsCur : (grandTotRmsCur > 0 ? grandTotCur / grandTotRmsCur : 0));
            let grandLYVal = (metric === 'rev') ? grandTotLY : ((metric === 'rms') ? grandTotRmsLY : (grandTotRmsLY > 0 ? grandTotLY / grandTotRmsLY : 0));

            let grandDisplay = '--';
            if (grandVal > 0) {
                if (metric === 'rev') grandDisplay = fmt(grandVal);
                else if (metric === 'rms') grandDisplay = fmtNum(grandVal) + ' RN';
                else if (metric === 'adr') grandDisplay = fmt(grandVal);
            }

            let grandSub = '';
            if (compMode === 'BOTH' && grandVal > 0 && grandLYVal > 0) {
                const diff = grandVal - grandLYVal;
                const diffPct = (diff / grandLYVal) * 100;
                const isPos = diff >= 0;
                const color = isPos ? '#10b981' : '#ef4444';
                const sign = isPos ? '+' : '';
                grandSub = \`<span style=\"font-size:0.68rem; color:\${color}; font-weight:800; display:block; margin-top:2px;\">\${sign}\${diffPct.toFixed(1).replace('.', ',')}%\</span>\`;
            }

            tbody.innerHTML += \`
                <tr style=\"background:rgba(99,102,241,0.12); font-weight:800; border-top:2px solid var(--border);\">
                    <td style=\"color:#a78bfa; padding:8px 10px;\">TOTAL HOTEL (\${isNetView ? '💎 NETO' : 'BRUTO'})</td>
                    \${totalColsHtml}
                    <td style=\"text-align:right; font-weight:800; color:var(--primary); font-size:0.85rem; border-left:1px solid var(--border); padding:8px 10px;\">
                        \${grandDisplay}
                        \${grandSub}
                    </td>
                </tr>
            \`;
        }

        function toggle360SegmentChannels(segName) {
            window.__seg360ExpandedSegs = window.__seg360ExpandedSegs || new Set();
            if (window.__seg360ExpandedSegs.has(segName)) {
                window.__seg360ExpandedSegs.delete(segName);
            } else {
                window.__seg360ExpandedSegs.add(segName);
            }
            const activeM = (typeof window.__seg360SelectedMonth !== 'undefined' && window.__seg360SelectedMonth !== null) ? window.__seg360SelectedMonth : (typeof currentMonthIdx !== 'undefined' ? currentMonthIdx : -1);
            renderSegmentPickupAnalysis(currentHotel, currentYear, activeM);
        }

        function set360SegmentNetMode(enableNet) {
            window.__seg360NetMode = !!enableNet;
            const activeM = (typeof window.__seg360SelectedMonth !== 'undefined' && window.__seg360SelectedMonth !== null) ? window.__seg360SelectedMonth : (typeof currentMonthIdx !== 'undefined' ? currentMonthIdx : -1);
            renderSegmentPickupAnalysis(currentHotel, currentYear, activeM);
        }
`;

let content = fs.readFileSync('Analisis360.html', 'utf8');

// Find start of normalizeSegmentDisplayName
const startIdx = content.indexOf('function normalizeSegmentDisplayName(name)');
if (startIdx === -1) {
    console.error('Could not find start index');
    process.exit(1);
}

// Find switchHotel(h)
const endIdx = content.indexOf('function switchHotel(h) {');
if (endIdx === -1) {
    console.error('Could not find end index');
    process.exit(1);
}

const newContent = content.slice(0, startIdx) + replacementJs + '\n        ' + content.slice(endIdx);
fs.writeFileSync('Analisis360.html', newContent, 'utf8');
console.log('[OK] Successfully updated Analisis360.html');
