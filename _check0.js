
        // --- LOGIC & STATE ---
        const HOTEL_CAPACITY = { "Guadiana": 108, "Cumbria": 59 };
        let rawData = [];
        let processedData = [];
        let competitorsList = [];
        let ignoredCompetitors = new Set();
        let activeHotel = "Cumbria";
        let chartInstance = null;
        let distinctMonths = [];

        // Load ignored competitors from memory
        try {
            const savedIgnored = localStorage.getItem('ignored_competitors');
            if (savedIgnored) {
                ignoredCompetitors = new Set(JSON.parse(savedIgnored));
            }
        } catch (e) {
            console.warn("Failed to load ignored competitors from local storage", e);
        }

        // --- UPDATE HOTEL LOGO (DEPRECATED: Use switchHotel) ---
        function updateHotelLogo() {
            const hotel = document.getElementById('hotelSelector').value;
            const logoImg = document.getElementById('hotelLogo');
            if (hotel === 'Guadiana') logoImg.src = 'Imagen/logo-guadiana.svg';
            else logoImg.src = 'Imagen/logo-cumbria.svg';
            activeHotel = hotel;
        }

        // Global function for top-nav unification
        function switchHotel(h) {
            document.getElementById('hotelSelector').value = h;
            updateHotelLogo();
            renderAll();
        }

        // --- UI TOGGLES ---
        function toggleSidebar() {
            const grid = document.getElementById('view-dashboard');
            const icon = document.getElementById('sidebar-toggle-icon');
            const isCollapsed = grid.classList.toggle('sidebar-collapsed');

            if (isCollapsed) {
                icon.innerText = '▶';
                document.getElementById('sidebarToggle').title = "Expandir Panel";
            } else {
                icon.innerText = '◀ Contraer';
                document.getElementById('sidebarToggle').title = "Contraer Panel";
            }
        }

        function toggleExpertAnalysis() {
            const card = document.getElementById('expertAnalysisCard');
            card.classList.toggle('collapsed');
        }

        // --- ACTIONS ---
        function focusRow(idx) {
            const row = document.getElementById(`row-${idx}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.remove('highlight-row');
                void row.offsetWidth; // trigger reflow
                row.classList.add('highlight-row');
            }
        }

        function filterTable(type) {
            const activeMonth = document.getElementById('monthSelector').value;
            let baseData = processedData;
            if (activeMonth !== 'all') baseData = baseData.filter(d => d.month === activeMonth);

            let filtered = [];
            const globalAvg = processedData.reduce((a, b) => a + b.compAvg, 0) / processedData.length;

            if (type === 'opp') {
                filtered = baseData.filter(d => {
                    const my = d.hotels[activeHotel];
                    return my && !my.sold && my.price > 0 && my.price < d.compAvg * 0.85;
                });
            } else if (type === 'risk') {
                filtered = baseData.filter(d => {
                    const my = d.hotels[activeHotel];
                    return my && !my.sold && my.price > 0 && my.price > d.compAvg * 1.25;
                });
            } else if (type === 'compression') {
                filtered = baseData.filter(d => d.compAvg > globalAvg * 1.4);
            }

            renderTable(filtered);
            document.getElementById('record-count').innerText = `${filtered.length} fechas filtradas (${type})`;
            document.getElementById('record-count').style.color = 'var(--primary)';
        }

        // Month Dictionary - Full Spanish names
        const MONTH_MAP = {
            "january": "Enero", "enero": "Enero", "jan": "Enero", "ene": "Enero",
            "february": "Febrero", "febrero": "Febrero", "feb": "Febrero",
            "march": "Marzo", "marzo": "Marzo", "mar": "Marzo",
            "april": "Abril", "abril": "Abril", "apr": "Abril", "abr": "Abril",
            "may": "Mayo", "mayo": "Mayo",
            "june": "Junio", "junio": "Junio", "jun": "Junio",
            "july": "Julio", "julio": "Julio", "jul": "Julio",
            "august": "Agosto", "agosto": "Agosto", "aug": "Agosto", "ago": "Agosto",
            "september": "Septiembre", "septiembre": "Septiembre", "sep": "Septiembre", "set": "Septiembre",
            "october": "Octubre", "octubre": "Octubre", "oct": "Octubre",
            "november": "Noviembre", "noviembre": "Noviembre", "nov": "Noviembre",
            "december": "Diciembre", "diciembre": "Diciembre", "dec": "Diciembre", "dic": "Diciembre"
        };

        // --- PERSISTENCE ---
        // Month conversion for old data
        const MONTH_CONVERT = {
            "Jan": "Enero 2025", "Feb": "Febrero 2025", "Mar": "Marzo 2025", "Apr": "Abril 2025",
            "May": "Mayo 2025", "Jun": "Junio 2025", "Jul": "Julio 2025", "Aug": "Agosto 2025",
            "Sep": "Septiembre 2025", "Oct": "Octubre 2025", "Nov": "Noviembre 2025", "Dec": "Diciembre 2025",
            "Ene": "Enero 2025", "Abr": "Abril 2025", "Ago": "Agosto 2025", "Dic": "Diciembre 2025"
        };

        function migrateMonths(months) {
            return months.map(m => {
                // If already has year, return as is
                if (/\d{4}$/.test(m)) return m;
                // Convert old format
                return MONTH_CONVERT[m] || m + " 2025";
            });
        }

        window.addEventListener('load', initView);

        function initView() {
            // Check if user requested a new upload (preserving history for comparison)
            if (sessionStorage.getItem('coming_from_new_upload')) {
                sessionStorage.removeItem('coming_from_new_upload');
                console.log("⚠️ Force Upload Mode: Skipping auto-restore to allow new file upload.");
                return;
            }

            const saved = CapaStorage.getItem('revenue_data_v2');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    processedData = parsed.data;
                    competitorsList = parsed.competitors;

                    // Migrate old month format to Spanish with year
                    distinctMonths = migrateMonths(parsed.months || []);
                    activeHotel = parsed.activeHotel || "Cumbria";

                    // Restore View
                    populateMonths();
                    document.getElementById('view-upload').style.display = 'none';
                    document.getElementById('view-dashboard').style.display = 'grid';
                    document.getElementById('dashboard-controls').style.display = 'flex';

                    // Set selectors
                    const hSel = document.getElementById('hotelSelector');
                    if (hSel) hSel.value = activeHotel;
                    updateHotelLogo();

                    renderAll();
                    updateOutdatedStatus();
                } catch (e) {
                    console.error("Error loading saved data", e);
                    CapaStorage.removeItem('revenue_data_v2');
                }
            }
        }

        function clearData() {
            if (confirm('¿Subir nuevo archivo? Los datos actuales se usarán para calcular las diferencias (flechas de precio).')) {
                // Do NOT delete localStorage. We want to compare against it.
                sessionStorage.setItem('coming_from_new_upload', 'true');
                location.reload();
            }
        }

        function saveData() {
            const payload = {
                data: processedData,
                competitors: competitorsList,
                months: distinctMonths,
                activeHotel: activeHotel,
                lastUpdate: new Date().toISOString()
            };
            try {
                // 1. Try Main Save
                CapaStorage.setItem('revenue_data_v2', JSON.stringify(payload));

                // 2. Save Lite History (Critical for comparison functionality)
                const lite = getLiteData(processedData);
                CapaStorage.setItem('revenue_history_lite', JSON.stringify(lite));

                updateOutdatedStatus();
            } catch (e) {
                console.warn("Quota exceeded, cannot save state");
            }
        }

        function getLiteData(data) {
            const lite = {};
            data.forEach(d => {
                if (d.dateISO && d.hotels) {
                    lite[d.dateISO] = {};
                    Object.keys(d.hotels).forEach(h => {
                        const hotelData = d.hotels[h];
                        lite[d.dateISO][h] = {
                            price: hotelData.price,
                            sold: hotelData.sold
                        };
                    });
                    // Save Day-level OTB for pick-up tracking
                    lite[d.dateISO]._otb = d.otbRooms || 0;
                }
            });
            return lite;
        }

        function updateOutdatedStatus() {
            const saved = CapaStorage.getItem('revenue_data_v2');
            const btn = document.getElementById('updateBtn');
            if (!btn) return;

            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.lastUpdate) {
                        const lastDate = new Date(parsed.lastUpdate);
                        const today = new Date();
                        // Reset hours to compare just dates
                        today.setHours(0, 0, 0, 0);
                        const compareDate = new Date(lastDate);
                        compareDate.setHours(0, 0, 0, 0);
                        const diffTime = today - compareDate;
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays <= 0) {
                            btn.innerHTML = '✅ Actualizado hoy';
                            btn.style.background = '#10b981';
                        } else if (diffDays === 1) {
                            btn.innerHTML = '⚠️ Desactualizado 1 día';
                            btn.style.background = '#f59e0b';
                        } else {
                            btn.innerHTML = `⚠️ Desactualizado ${diffDays} días`;
                            btn.style.background = '#ef4444';
                        }
                    } else {
                        // No lastUpdate saved - data from old format, needs re-upload
                        btn.innerHTML = '⚠️ Fecha desconocida - Subir nuevo';
                        btn.style.background = '#ef4444';
                    }
                } catch (e) { }
            }
        }

        // --- INIT ---
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.onclick = () => fileInput.click();
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.background = '#eef2ff'; dropZone.style.borderColor = '#4f46e5'; };
        dropZone.ondragleave = (e) => { e.preventDefault(); dropZone.style.background = '#ffffff'; dropZone.style.borderColor = '#cbd5e1'; };
        dropZone.ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]); };
        fileInput.onchange = (e) => { if (e.target.files.length) processFile(e.target.files[0]); };

        function processFile(file) {
            sessionStorage.removeItem('force_reset_pending');
            const reader = new FileReader();
            reader.onload = (e) => {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];

                // FIX: Force read enough columns if range is truncated
                if (sheet['!ref']) {
                    const range = XLSX.utils.decode_range(sheet['!ref']);
                    if (range.e.c < 35) {
                        range.e.c = 40; // Force at least ~40 columns
                        sheet['!ref'] = XLSX.utils.encode_range(range);
                    }
                }

                rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // RECONSTRUCTION FALLBACK
                let maxLen = 0;
                rawData.forEach(r => maxLen = Math.max(maxLen, r.length));

                if (maxLen < 20) {
                    logD(`⚠️ Formato columnas dañado (maxLen=${maxLen}). Reconstruyendo celda a celda...`);
                    // Manual read
                    const newRaw = [];
                    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : { e: { r: 100 } };
                    const limitR = range.e.r + 5;

                    for (let R = 0; R <= limitR; ++R) {
                        const row = [];
                        // Force read 40 columns
                        for (let C = 0; C < 40; ++C) {
                            const ref = XLSX.utils.encode_cell({ c: C, r: R });
                            const cell = sheet[ref];
                            row.push(cell ? cell.v : "");
                        }
                        newRaw.push(row);
                    }
                    rawData = newRaw;
                    console.log("⚠️ File repair applied automatically.");
                }

                // RAW DATA INSPECTOR REMOVED
                analyze();
            };
            reader.readAsArrayBuffer(file);
        }

        // --- PARSING ---
        function analyze() {
            // 1. CAPTURE PREVIOUS DATA FOR COMPARISON
            let prevMap = {};
            let historySource = "none";

            // A. Try Lite History (Best for performance & reliability)
            try {
                const liteJson = CapaStorage.getItem('revenue_history_lite');
                if (liteJson) {
                    prevMap = JSON.parse(liteJson);
                    historySource = "lite";
                }
            } catch (e) { }

            // B. Fallback to Full Data
            if (Object.keys(prevMap).length === 0) {
                try {
                    const savedJson = CapaStorage.getItem('revenue_data_v2');
                    if (savedJson) {
                        const saved = JSON.parse(savedJson);
                        if (saved.data && Array.isArray(saved.data)) {
                            saved.data.forEach(d => {
                                if (d.dateISO && d.hotels) {
                                    prevMap[d.dateISO] = d.hotels;
                                }
                            });
                            historySource = "full";
                        }
                    }
                } catch (e) { console.warn("Could not load previous data for comparison", e); }
            }

            console.log("History loaded via:", historySource, "Keys:", Object.keys(prevMap).length);

            processedData = []; // RESET DATA

            let guadianaRow = -1;
            let cumbriaRow = -1;

            // Find Anchors - FIRST VALID MATCH STRATEGY
            // We search for the first occurrence that looks like the main header row
            for (let r = 0; r < Math.min(rawData.length, 100); r++) {
                const row = rawData[r] || [];
                const rowStr = row.join(" ").toLowerCase();

                // Find Guadiana
                if (guadianaRow === -1 && rowStr.includes("guadiana") && !rowStr.includes("tarifas")) {
                    // Check if this row actually has data columns? 
                    // The main row usually has values to the right.
                    if (row.length > 2) {
                        guadianaRow = r;
                    }
                }

                // Find Cumbria
                if (cumbriaRow === -1 && rowStr.includes("cumbria")) {
                    cumbriaRow = r;
                }

                if (guadianaRow !== -1 && cumbriaRow !== -1) break;
            }

            // Fallback: If we found Guadiana but it was short (length <=2), maybe it was the only one?
            if (guadianaRow === -1) {
                for (let r = 0; r < Math.min(rawData.length, 100); r++) {
                    const rowStr = (rawData[r] || []).join(" ").toLowerCase();
                    if (rowStr.includes("guadiana") && !rowStr.includes("tarifas")) { guadianaRow = r; break; }
                }
            }

            if (guadianaRow === -1) { logD("❌ ERROR FATAL: 'Guadiana' no encontrado en el Excel."); alert("Error: No se encontró 'Sercotel Guadiana' en las primeras 100 filas."); return; }
            logD(`✅ Guadiana encontrado en fila ${guadianaRow}. Analizando fechas...`);

            // Metadata Rows - Dynamic Search for Date Row (1..31)
            let dateNumRow = -1;

            // Scan upwards from Guadiana to find the row with day numbers (e.g "lun. 26" or just "26")
            for (let r = guadianaRow - 1; r >= Math.max(0, guadianaRow - 10); r--) {
                const row = rawData[r] || [];
                let validDayNums = 0;

                for (let c = 1; c < Math.min(row.length, 50); c++) {
                    // Extract number from string like "lun. 26" -> 26
                    const cellStr = String(row[c]);

                    // Ignore cells with "%" to avoid confusions with "+10%" or similar
                    if (cellStr.includes('%')) continue;

                    const match = cellStr.match(/(\d+)/);
                    if (match) {
                        const val = parseInt(match[1]);
                        if (val >= 1 && val <= 31) validDayNums++;
                    }
                }

                // Heuristic: If we found > 3 valid days in a row, this is it
                if (validDayNums > 3) {
                    dateNumRow = r;
                    break;
                }
            }

            // Fallback
            if (dateNumRow === -1) {
                logD("⚠️ No se encontró fila de fechas (1..31). Usando fila anterior a Guadiana por defecto.");
                dateNumRow = guadianaRow - 1;
            } else {
                logD(`✅ Fila de fechas detectada en índice ${dateNumRow}`);
            }

            const dayNameRow = dateNumRow; // Sometimes day name and number are in the SAME cell
            let monthRow = -1;

            // Scan for month row above Date Row
            const scanFrom = Math.max(0, dateNumRow - 15);
            for (let r = scanFrom; r < dateNumRow; r++) {
                const str = JSON.stringify(rawData[r] || []).toLowerCase();
                if (str.includes("january") || str.includes("february") || str.includes("enero") || str.includes("marzo") || str.includes("abril") || str.includes("mayo") || str.includes("junio") || str.includes("julio") || str.includes("agosto") || str.includes("septiembre") || str.includes("octubre") || str.includes("noviembre") || str.includes("diciembre")) {
                    monthRow = r; break;
                }
            }

            // Start Column Logic
            let startCol = 1;
            let gRowData = rawData[guadianaRow];
            if (gRowData) {
                for (let c = 1; c < gRowData.length; c++) {
                    const val = gRowData[c];
                    // Look for valid price or 'S' (Closed)
                    if (!isNaN(parseFloat(val)) || String(val).toUpperCase() === 'S') {
                        startCol = c; break;
                    }
                }
                // Double check with Date Row - Logic: Find first column with a valid date number that ISN'T a percentage
                if (startCol === 1 && rawData[dateNumRow]) {
                    for (let c = 1; c < rawData[dateNumRow].length; c++) {
                        const cellStr = String(rawData[dateNumRow][c]);
                        if (cellStr.includes('%')) continue;

                        const match = cellStr.match(/(\d+)/);
                        if (match) {
                            const val = parseInt(match[1]);
                            if (val >= 1 && val <= 31) {
                                startCol = c; break;
                            }
                        }
                    }
                }
            }
            logD(`StartCol FINAL: ${startCol} | MonthRow: ${monthRow}`);

            // Competitors List
            competitorsList = [];
            const scanStart = (cumbriaRow !== -1 ? cumbriaRow : guadianaRow) + 1;
            const totalCols = gRowData ? gRowData.length : 0;
            let consecutiveInvalid = 0;

            for (let r = scanStart; r < rawData.length; r++) {
                if (consecutiveInvalid > 20) break;

                const row = rawData[r];
                if (!row || !row[0]) {
                    consecutiveInvalid++;
                    continue;
                }

                const name = String(row[0]).trim();
                const nLow = name.toLowerCase();

                // Blacklist
                if (name.length < 3) { consecutiveInvalid++; continue; }
                if (nLow.includes("tarifas medias") || nLow.includes("interés") || nLow.includes("interes") ||
                    nLow.includes("año anterior") || nLow.includes("rank") || nLow.includes("clasificación") ||
                    nLow.includes("promedio") || nLow.includes("media") || nLow.includes("total") ||
                    nLow.includes("min") || nLow.includes("max") || nLow.includes("var") || nLow.includes("cv ")) {
                    consecutiveInvalid++; continue;
                }

                // Check Data Density
                let validPoints = 0;
                for (let checkC = startCol; checkC < Math.min(startCol + 30, totalCols); checkC++) {
                    const cell = row[checkC];
                    if (!isNaN(parseFloat(cell)) || String(cell).toUpperCase() === 'S') validPoints++;
                }

                if (validPoints >= 5) {
                    competitorsList.push({ name: name, rowIdx: r });
                    consecutiveInvalid = 0;
                } else {
                    consecutiveInvalid++;
                }
            }

            // Find occupancy row & determine its owner
            let occupancyRow = -1;
            let occupancyOwner = null;

            for (let r = 0; r < rawData.length; r++) {
                const rowStr = (String(rawData[r][0] || "") + " " + String(rawData[r][1] || "") + " " + String(rawData[r][2] || "")).toLowerCase();
                if (rowStr.includes("competencia") || rowStr.includes("mercado") || rowStr.includes("rank") || rowStr.includes("share")) continue;

                if (rowStr.includes("ocupaci") || rowStr.includes("occupancy") ||
                    (rowStr.includes("habitaciones") && !rowStr.includes("ingresos") && !rowStr.includes("precio")) ||
                    rowStr.includes("vendidas") || rowStr.includes("unidades") || rowStr.includes("estancias")) {

                    let hasNums = 0;
                    for (let k = startCol; k < Math.min(startCol + 10, rawData[r].length); k++) {
                        if (!isNaN(parseFloat(rawData[r][k]))) hasNums++;
                    }
                    if (hasNums > 3) {
                        occupancyRow = r;
                        // Determine owner by proximity
                        const distG = Math.abs(r - guadianaRow);
                        const distC = (cumbriaRow !== -1) ? Math.abs(r - cumbriaRow) : 9999;
                        occupancyOwner = (distG < distC) ? "Guadiana" : "Cumbria";
                        break;
                    }
                }
            }
            logD(`Occupancy Row detected at index: ${occupancyRow} (Owner: ${occupancyOwner})`);

            // Build Data
            processedData = [];
            distinctMonths = [];
            let currentMonth = "";
            const maxCols = gRowData ? gRowData.length : 0;

            for (let c = startCol; c < maxCols; c++) {
                // Month Update
                if (monthRow !== -1 && rawData[monthRow] && rawData[monthRow][c]) {
                    currentMonth = String(rawData[monthRow][c]).trim();
                } else if (currentMonth === "") {
                    // Fallback Search
                    for (let r = 0; r < 20; r++) {
                        const cell = String(rawData[r] ? rawData[r][c] : "").toLowerCase();
                        for (const mKey in MONTH_MAP) {
                            if (cell.includes(mKey)) { currentMonth = cell; break; }
                        }
                        if (currentMonth) break;
                    }
                }

                // Extract Day Number Properly using Regex
                let dNum = "";
                if (dateNumRow !== -1 && rawData[dateNumRow]) {
                    const cellVal = String(rawData[dateNumRow][c] || "");
                    if (!cellVal.includes('%')) { // Skip percentages
                        const match = cellVal.match(/(\d+)/);
                        if (match) dNum = match[1];
                    }
                }

                if (!dNum) continue;

                // Day Name is often in the same cell now "lun. 26"
                let dName = "";
                if (dateNumRow !== -1 && rawData[dateNumRow]) {
                    const cellVal = String(rawData[dateNumRow][c] || "");
                    // remove digits to get name
                    dName = cellVal.replace(/\d+/g, '').replace(/\./g, '').trim();
                }

                // Format Date & Occupancy
                let occ = 0;
                if (occupancyRow !== -1) {
                    // Handle Spanish decimals (comma) just in case
                    let rawVal = String(rawData[occupancyRow][c] || "").replace(',', '.');
                    occ = parseFloat(rawVal) || 0;
                }

                const dateInfo = parseDate(currentMonth, dNum, dName);
                const iso = dateInfo.iso;
                const yr = iso ? iso.split('-')[0] : "2026";

                // Fallback Occupancy Sync
                let hasOtbData = false;
                let hasProdData = false;
                let prevRooms = 0;

                if (iso && iso !== "INV-DATE") {
                    try {
                        const pDbRaw = CapaStorage.getItem('hotel_manager_db_v2');
                        if (pDbRaw) {
                            const pDb = (typeof pDbRaw === 'string') ? JSON.parse(pDbRaw) : pDbRaw;
                            const dbKeys = Object.keys(pDb);
                            const cleanActive = activeHotel.toLowerCase().replace(/hotel|sercotel|villa|spa|resort/g, '').trim();
                            const dbActiveKey = dbKeys.find(k => k.toLowerCase().includes(cleanActive) || cleanActive.includes(k.toLowerCase()));

                            if (dbActiveKey && pDb[dbActiveKey] && pDb[dbActiveKey][yr]) {
                                const dbYear = pDb[dbActiveKey][yr];
                                if (dbYear.daily_otb && dbYear.daily_otb[iso]) {
                                    hasOtbData = true;
                                    let dVal = dbYear.daily_otb[iso];
                                    let otbVal = (typeof dVal === 'object') ? (dVal.rooms || 0) : dVal;
                                    // CHANGE: Always prioritize internal OTB over market occupancy for our hotel
                                    if (otbVal > 0) occ = otbVal;
                                }
                                if (dbYear.daily && dbYear.daily[iso] !== undefined && occ === 0) {
                                    hasProdData = true;
                                    let pVal = dbYear.daily[iso];
                                    occ = (typeof pVal === 'object') ? (pVal.rooms || 0) : pVal;
                                }
                                
                                // Fetch Previous Rooms for Instant Pick-up
                                // Comparing current daily_otb vs saved daily_otb in otb_prev
                                if (dbYear.otb_prev && dbYear.otb_prev.daily_otb && dbYear.otb_prev.daily_otb[iso]) {
                                    const oldData = dbYear.otb_prev.daily_otb[iso];
                                    prevRooms = (typeof oldData === 'object') ? (oldData.rooms || 0) : oldData;
                                }
                            }
                        }
                    } catch (e) { }
                }

                if (dateInfo.month && !distinctMonths.includes(dateInfo.month)) distinctMonths.push(dateInfo.month);

                const dayObj = {
                    dayIndex: c,
                    label: `${dNum} ${dateInfo.month}`,
                    month: dateInfo.month,
                    hotels: {},
                    compAvg: 0,
                    dateISO: iso,
                    occupancy: occ,
                    occOwner: occupancyOwner, 
                    otbRooms: occ, 
                    prevRooms: prevRooms, // Store comparison base
                    hasOtbData: hasOtbData,
                    hasProdData: hasProdData,
                    dateMeta: {
                        dNum,
                        dShort: dateInfo.dShort,
                        mShort: dateInfo.mShort
                    }
                };

                let compPrices = [];
                competitorsList.forEach(comp => {
                    const val = parseVal(rawData[comp.rowIdx][c]);

                    // SEARCH PREVIOUS PRICE
                    let changeInfo = null;
                    if (prevMap[dayObj.dateISO]) {
                        let prevEntry = prevMap[dayObj.dateISO][comp.name];

                        // Fuzzy fallback if strict match fails (Robust against name variations like "Sercotel Guadiana" vs "Guadiana")
                        if (!prevEntry) {
                            const fuzzyKey = Object.keys(prevMap[dayObj.dateISO]).find(k =>
                                k.toLowerCase().trim() === comp.name.toLowerCase().trim() ||
                                k.toLowerCase().includes(comp.name.toLowerCase()) ||
                                comp.name.toLowerCase().includes(k.toLowerCase())
                            );
                            if (fuzzyKey) prevEntry = prevMap[dayObj.dateISO][fuzzyKey];
                        }

                        if (prevEntry && prevEntry.price > 0 && val.price > 0 && !val.sold && !prevEntry.sold) {
                            if (val.price > prevEntry.price) {
                                changeInfo = { dir: 'up', prev: prevEntry.price };
                            } else if (val.price < prevEntry.price) {
                                changeInfo = { dir: 'down', prev: prevEntry.price };
                            }
                        }
                    }
                    val.change = changeInfo;

                    dayObj.hotels[comp.name] = val;

                    // DYNAMIC COMP SET LOGIC
                    const nLow = comp.name.toLowerCase();
                    const activeLow = activeHotel.toLowerCase();

                    // 1. Exclude explicitly blacklisted competitors (e.g. Libere)
                    // Fix: Exclude ONLY Libere, do not exclude NH Ciudad Real
                    const isLibere = nLow.includes("líbere") || nLow.includes("libere");

                    // 2. Exclude "My Hotel" (the one currently being analyzed)
                    const isMyHotel = nLow.includes(activeLow);

                    // 3. Logic: If I am Cumbria, I want Guadiana in the average. If I am Guadiana, I want Cumbria in the average.
                    //    The loop iterates through ALL detected hotels in the excel.
                    //    So we only exclude "My Hotel" and "Blacklisted". Everything else (including the sibling hotel) goes into the average.

                    if (!isLibere && !isMyHotel) {
                        if (val.price > 0 && !val.sold) compPrices.push(val.price);
                    }
                });

                // Force include the sibling hotel if it wasn't in the competitors list (rare, but possibly explicitly rows found earlier)
                // Note: The original code manually added Cumbria/Guadiana to 'dayObj.hotels' at the end. 
                // We should check if the sibling hotel is NOT in competitorsList but IS available via rawData lookups, we might want to add it to average?
                // However, the original logic suggests competitorsList is derived from scanning the file. 
                // If Cumbria/Guadiana are in the file, they are in competitorsList or handled separately.
                // Let's stick to the list primarily.

                // IMPORTANT: The original code parsed Cumbria/Guadiana explicitly at the end.
                // We need to make sure we don't double count if they are also in competitorsList.
                // Usually `competitorsList` contains everything found.

                // Fix: Check if already exists to preserve 'change' info from loop
                // Fix: Check if already exists to preserve 'change' info from loop
                if (cumbriaRow !== -1 && !dayObj.hotels["Cumbria"]) dayObj.hotels["Cumbria"] = parseVal(rawData[cumbriaRow][c]);
                if (guadianaRow !== -1 && !dayObj.hotels["Guadiana"]) dayObj.hotels["Guadiana"] = parseVal(rawData[guadianaRow][c]);

                // FORCE CHANGE DETECTION FOR SIBLINGS (if not caught in loop)
                ["Cumbria", "Guadiana"].forEach(hName => {
                    const hVal = dayObj.hotels[hName];
                    if (hVal && !hVal.change) {
                        let chInfo = null;

                        // Smart Lookup in History
                        let prevEntry = null;
                        if (prevMap[dayObj.dateISO]) {
                            // 1. Exact Match
                            if (prevMap[dayObj.dateISO][hName]) {
                                prevEntry = prevMap[dayObj.dateISO][hName];
                            }
                            // 2. Fuzzy Match (e.g. "Sercotel Guadiana" matches "Guadiana")
                            else {
                                const fuzzyKey = Object.keys(prevMap[dayObj.dateISO]).find(k =>
                                    k.toLowerCase().includes(hName.toLowerCase()) ||
                                    hName.toLowerCase().includes(k.toLowerCase())
                                );
                                if (fuzzyKey) prevEntry = prevMap[dayObj.dateISO][fuzzyKey];
                            }
                        }

                        if (prevEntry && prevEntry.price > 0 && hVal.price > 0 && !hVal.sold && !prevEntry.sold) {
                            if (Math.abs(hVal.price - prevEntry.price) > 0.5) { // Ignore tiny float diffs
                                if (hVal.price > prevEntry.price) chInfo = { dir: 'up', prev: prevEntry.price };
                                else if (hVal.price < prevEntry.price) chInfo = { dir: 'down', prev: prevEntry.price };
                            }
                        }
                        hVal.change = chInfo;
                    }
                });

                // RE-CALCULATE AVERAGE to ensure Sibling is included even if not in competitorsList (e.g. fixed row search)
                // If active is Cumbria, we want Guadiana's price in average
                if (activeHotel === "Cumbria" && guadianaRow !== -1) {
                    const gVal = dayObj.hotels["Guadiana"];
                    // Check if already included via loop (avoid double count)
                    const alreadyIn = competitorsList.some(comp => comp.name.toLowerCase().includes("guadiana"));
                    if (!alreadyIn && gVal.price > 0 && !gVal.sold) {
                        compPrices.push(gVal.price);
                    }
                }
                // If active is Guadiana, we want Cumbria's price in average
                if (activeHotel === "Guadiana" && cumbriaRow !== -1) {
                    const cVal = dayObj.hotels["Cumbria"];
                    const alreadyIn = competitorsList.some(comp => comp.name.toLowerCase().includes("cumbria"));
                    if (!alreadyIn && cVal.price > 0 && !cVal.sold) {
                        compPrices.push(cVal.price);
                    }
                }

                if (compPrices.length) {
                    dayObj.compAvg = compPrices.reduce((a, b) => a + b, 0) / compPrices.length;
                }

                // OTB PICK-UP DETECTION (Instant Pick-up vs last Forecast File)
                const currRooms = dayObj.otbRooms || 0;
                const oldRooms = dayObj.prevRooms || 0;
                
                if (currRooms !== oldRooms) {
                    dayObj.otbChange = currRooms - oldRooms;
                }

                processedData.push(dayObj);
            }

            // DIAGNOSTIC LOG (Console)
            const changeCount = processedData.reduce((acc, d) => {
                return acc + Object.values(d.hotels).filter(h => h.change).length;
            }, 0);

            // Check if we actually had previous data to compare against
            const hadPrevData = Object.keys(prevMap).length > 0;

            console.log(`✅ Loaded ${processedData.length} days. First ISO: ${processedData[0]?.dateISO}`);
            logD(`✅ FIN: ${processedData.length} días cargados.`);

            if (processedData.length > 0) {
                logD(`Muestra [0]: ISO=${processedData[0].dateISO}, Ocupación=${processedData[0].occupancy}, OTB=${processedData[0].otbRooms}`);

                populateMonths();
                document.getElementById('view-upload').style.display = 'none';
                document.getElementById('view-dashboard').style.display = 'grid';
                document.getElementById('dashboard-controls').style.display = 'flex';

                saveData();
                renderAll();

                // USER FEEDBACK
                if (changeCount > 0) {
                    alert(`✅ Análisis Completo: Se han detectado ${changeCount} cambios de precio respecto a la última carga.`);
                } else if (hadPrevData) {
                    alert("ℹ️ Análisis Completo: Comparado con datos anteriores, pero NO se han detectado cambios de precio (Precios idénticos).");
                } else {
                    const stStatus = CapaStorage.isAvailable ? "OK" : "Limitado";
                    alert(`✨ Primera Carga (o Historial no disponible).\n\nA partir de ahora se guardará un historial ligero para asegurar la comparación futura.\nEstado Memoria: ${stStatus}`);
                }

            } else {
                const debugInfo = `
Guadiana Row: ${guadianaRow}
Date Num Row: ${dateNumRow}
Start Col: ${startCol}
Max Cols: ${maxCols}
Sample Date Cell: "${rawData[dateNumRow] ? rawData[dateNumRow][startCol] : 'Undefined'}"
Sample Guad Cell: "${gRowData ? gRowData[startCol] : 'Undefined'}"
`;
                logD("❌ ERROR CRÍTICO: " + debugInfo);
                alert("Error de Formato. Por favor envía una captura de esta alerta:\n" + debugInfo);
                location.reload(); // Allow retry
            }
        }

        function parseVal(val) {
            const S = String(val).trim().toUpperCase();
            // S = Completo (Sold out)
            if (S === 'S') return { price: 0, sold: true, status: 'sold' };
            // M = Estancia mínima requerida
            if (S === 'M') return { price: 0, sold: false, status: 'minStay' };
            // - = Sin datos disponibles
            if (S === '-' || S === '') return { price: 0, sold: false, status: 'noData' };

            const p = parseFloat(val);
            return { price: isNaN(p) ? 0 : p, sold: false, status: 'available' };
        }

        function parseDate(monthRaw, dNum, dayNameRaw) {
            if (!dNum) return { month: "", iso: "INV-DATE", dShort: "", mShort: "" };

            let mStr = String(monthRaw || "").trim();
            let yearFromData = null;
            const yearMatch = mStr.match(/(\d{4})/);
            if (yearMatch) yearFromData = parseInt(yearMatch[1]);

            let mLower = mStr.toLowerCase();
            let mShort = "";
            for (const key in MONTH_MAP) {
                if (mLower.includes(key)) { mShort = MONTH_MAP[key]; break; }
            }
            if (!mShort) mShort = mStr.split(" ")[0];
            if (mShort) mShort = mShort.charAt(0).toUpperCase() + mShort.slice(1).toLowerCase();

            let year = yearFromData || 2026;
            if (year < 100) year += 2000; // Safeguard for 2-digit years
            const monthWithYear = `${mShort} ${year}`;

            let d = String(dayNameRaw || "").toLowerCase().trim().replace(".", "");
            let dShort = d.length > 2 ? d.substring(0, 2) : d;
            dShort = dShort.charAt(0).toUpperCase() + dShort.slice(1);
            if (dShort.length === 0) dShort = "Dia";

            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const mIdx = monthNames.indexOf(mShort);
            const iso = `${year}-${String((mIdx === -1 ? 0 : mIdx) + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;

            return { month: monthWithYear, iso: iso, dShort: dShort, mShort: mShort };
        }

        // === PUNTO 4: Validación estructural obligatoria ===
        function ensureHotelStructure(d, hotel) {
            if (!d.hotels) d.hotels = {};
            if (!d.hotels[hotel] || typeof d.hotels[hotel] !== 'object') {
                d.hotels[hotel] = { price: 0, sold: false, status: 'noData' };
            }
        }

        function getDynamicDateHtml(d, hotel) {
            const meta = d.dateMeta;
            ensureHotelStructure(d, hotel);
            
            // === PUNTO 2: Distinguir null (sin dato) de 0 (dato real) ===
            const hData = d.hotels[hotel];
            let occ = (hData.occupancy !== undefined) ? hData.occupancy : null;
            let otb = (hData.otbRooms !== undefined) ? hData.otbRooms : null;
            let otbChange = (hData.otbChange !== undefined) ? hData.otbChange : null;

            // Date Formatting Logic
            let dayNum = meta.dNum;
            let dayName = meta.dShort;
            let monthName = "";

            if (d.dateISO && d.dateISO !== 'INV-DATE') {
                const parts = d.dateISO.split('-');
                if (parts.length === 3) {
                    const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    dayName = days[dt.getDay()];
                    monthName = months[dt.getMonth()];
                }
            }
            if (!monthName) monthName = meta.mShort || "";

            // Compact side-by-side display for OTB and Variation (Pick-up)
            let metricsHtml = '';
            if (otb !== null && (otb > 0 || otbChange)) {
                const changePill = (otbChange !== null && otbChange !== 0) ? `
                    <span title="Variación de habitaciones (Pick-up) respecto a la última carga" style="font-size:0.6rem; font-weight:800; color:${otbChange > 0 ? '#10b981' : '#ef4444'}; background:${otbChange > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border:1px solid ${otbChange > 0 ? '#10b981' : '#f87171'}; padding:0px 3px; border-radius:3px; line-height:1; cursor:help;">
                        ${otbChange > 0 ? '+' : ''}${otbChange}
                    </span>
                ` : '';
                
                metricsHtml = `
                    <div style="display:flex; align-items:center; gap:4px; margin-top:3px;">
                        <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); padding: 1px 4px; border-radius: 4px; display: flex; align-items: center; gap: 3px;">
                            <span style="font-size:0.55rem; font-weight:800; color:#8b5cf6; opacity:0.8;">Hab.</span>
                            <span style="font-size: 0.7rem; color: #8b5cf6; font-weight: 800;">${otb}</span>
                        </div>
                        ${changePill}
                    </div>
                `;
            }

            // === PUNTO 2: UI muestra "-" si dato inexistente, no "0" ===
            const occDisplay = (occ !== null) ? occ : '-';
            const occValFix = (occ !== null && occ > 0 && otb !== null && Number(occ) !== Number(otb)) ? `<div style="font-size: 0.65rem; color: var(--primary); font-weight: 700; margin-top: 2px;">Hab: ${occDisplay}</div>` : '';

            const html = `
                <div style="text-align:left; padding-left:4px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:1px;">
                        <span style="font-size:1.3rem; font-weight:800; color:var(--text-main); line-height:1;">${dayNum}</span>
                        <div style="display:flex; flex-direction:column; line-height:1.1;">
                            <span style="font-size:0.75rem; font-weight:600; color:var(--text-main);">${dayName}</span>
                            <span style="font-size:0.6rem; color:var(--text-muted);">${monthName}</span>
                        </div>
                    </div>
                    ${occValFix}
                    ${metricsHtml}
                </div>
            `;

            return { html: html, occ: occ, otb: otb };
        }

        function populateMonths() {
            const sel = document.getElementById('monthSelector');
            sel.innerHTML = '<option value="all">📅 Todo el Año</option>';
            distinctMonths.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
        }

        // --- RENDER ---
        function renderAll() {
            activeHotel = document.getElementById('hotelSelector').value;
            const selectedMonth = document.getElementById('monthSelector').value;

            let data = processedData;

            // Load Previous Snapshot for Pick-up comparison (if not already done in analyze)
            let prevMapLite = {};
            try {
                const liteJson = CapaStorage.getItem('revenue_history_lite');
                if (liteJson) prevMapLite = JSON.parse(liteJson);
            } catch(e) {}

            // NEW: Robust & Optimized Occupancy Sync
            try {
                const dbRaw = CapaStorage.getItem('hotel_manager_db_v2');
                if (!dbRaw) return;
                const pDb = (typeof dbRaw === 'string') ? JSON.parse(dbRaw) : dbRaw;
                const dbKeys = Object.keys(pDb);
                
                // 1. Fuzzy match active hotel
                const activeClean = activeHotel.toLowerCase().replace(/hotel|sercotel|villa|spa/g, '').replace(/\s+/g, ' ').trim();
                const dbActiveKey = dbKeys.find(k => {
                    const kLow = k.toLowerCase();
                    return kLow.includes(activeClean) || activeClean.includes(kLow);
                });

                // 2. Pre-calculate Competitor Mappings (Efficiency)
                const hotelKeyMap = {};
                const compNames = (data.length > 0 && data[0].hotels) ? Object.keys(data[0].hotels) : [];
                compNames.forEach(hN => {
                    if (hN === activeHotel) return;
                const tN = hN.toLowerCase().replace(/hotel|sercotel|villa|spa/g, '').replace(/\s+/g, ' ').trim();
                    const kFound = dbKeys.find(k => k === hN) || dbKeys.find(k => {
                        const kl = k.toLowerCase();
                        return kl.includes(tN) || tN.includes(kl);
                    });
                    if (kFound) hotelKeyMap[hN] = kFound;
                });

                // 3. Process All Days
                data.forEach(d => {
                    if (!d.dateISO) return;
                    const iso = d.dateISO;
                    const yrStr = iso.split('-')[0];
                    const yrShort = yrStr.slice(-2);
                    const yearsToTry = [yrStr, yrShort, "2025", "25", "2026", "26", "2027", "27"];

                    // === PUNTO 4: Validación estructural + limpieza global ===
                    delete d.occupancy;
                    delete d.otbRooms;
                    delete d.otbChange;
                    ensureHotelStructure(d, activeHotel);

                    // Sync Active Hotel
                    const dbActiveKey = dbKeys.find(k => {
                        const kLow = k.toLowerCase().replace(/hotel|sercotel|villa|spa/g, '').trim();
                        const aLow = activeHotel.toLowerCase().replace(/hotel|sercotel|villa|spa/g, '').trim();
                        return kLow.includes(aLow) || aLow.includes(kLow);
                    });

                    if (dbActiveKey && pDb[dbActiveKey]) {
                        const hD = pDb[dbActiveKey];
                        let otb = null, prod = null;
                        for (const y of yearsToTry) {
                            if (hD[y]) {
                                if (hD[y].daily_otb?.[iso] !== undefined) { otb = hD[y].daily_otb[iso]; break; }
                            }
                        }
                        for (const y of yearsToTry) {
                            if (hD[y] && hD[y].daily?.[iso] !== undefined) { prod = hD[y].daily[iso]; break; }
                        }
                        
                        // === PUNTO 3: Separar métricas OTB (forecast) vs Occupancy (real) ===
                        // OTB = reservas en mano (previsión)
                        if (otb !== null) {
                            const otbVal = (typeof otb === 'number') ? otb : (otb.rooms || 0);
                            d.hotels[activeHotel].otbRooms = otbVal; // Siempre escribir, incluso 0
                        }

                        // Producción = dato real histórico (distinta métrica)
                        if (prod !== null) {
                            const prodVal = (typeof prod === 'number') ? prod : (prod.rooms || 0);
                            d.hotels[activeHotel].occupancy = prodVal; // Siempre escribir, incluso 0
                        } else if (otb !== null) {
                            // Sin producción real → copiar OTB como estimación, NUNCA al revés
                            d.hotels[activeHotel].occupancy = d.hotels[activeHotel].otbRooms;
                        }

                        // --- Historial de cambios (Pick-up) ---
                        let prevRooms = null;
                        d.hotels[activeHotel].otbChange = 0;
                        
                        for (const y of yearsToTry) {
                            if (hD[y]?.otb_prev?.daily_otb?.[iso] !== undefined) {
                                const prevVal = hD[y].otb_prev.daily_otb[iso];
                                prevRooms = (typeof prevVal === 'object') ? (prevVal.rooms || 0) : prevVal;
                                break;
                            }
                        }
                        
                        if (prevRooms !== null && d.hotels[activeHotel].otbRooms !== undefined) {
                            d.hotels[activeHotel].otbChange = d.hotels[activeHotel].otbRooms - prevRooms;
                        }
                        
                        // Debug log para el primer día del mes para ver si estamos emparejando bien
                        if (iso.endsWith("-01")) {
                            console.log(`[Sync] ${iso} | Hotel: ${dbActiveKey} | OTB: ${d.hotels[activeHotel].otbRooms} | Occ: ${d.hotels[activeHotel].occupancy} | Diff: ${d.hotels[activeHotel].otbChange}`);
                        }
                    }

                    // === PUNTO 1: Deep copy para competidores (evitar contaminación por referencia) ===
                    Object.keys(hotelKeyMap || {}).forEach(hN => {
                        const dbK = hotelKeyMap[hN];
                        if (dbK && pDb[dbK]) {
                            const hD = pDb[dbK];
                            const iso = d.dateISO;
                            ensureHotelStructure(d, hN);
                            
                            // 1. Production (Occ) — dato real
                            for (const y of yearsToTry) {
                                if (hD[y] && hD[y].daily?.[iso] !== undefined) {
                                    const p = hD[y].daily[iso];
                                    const val = (typeof p === 'number') ? p : (p.rooms || 0);
                                    d.hotels[hN].occupancy = val;
                                    break;
                                }
                            }
                            // 2. Forecast (OTB) — previsión
                            for (const y of yearsToTry) {
                                if (hD[y] && hD[y].daily_otb?.[iso] !== undefined) {
                                    const otb = hD[y].daily_otb[iso];
                                    const val = (typeof otb === 'number') ? otb : (otb.rooms || 0);
                                    d.hotels[hN].otbRooms = val;
                                    break;
                                }
                            }
                        }
                    });
                });

                // RE-CALC KPIs
                recalcMarketAverages(data);
                renderKPIs(data);
                renderChart(data);
                renderTable(data);
                
                // DIAGNOSTIC BAR
                const otbCount = data.filter(d => d.hasOtbData).length;
                let statusHtml = `<span>${data.length} días analizados</span>`;
                statusHtml += `<span onclick="diagnoseAllData()" style="font-size:0.6rem; color:#94a3b8; cursor:pointer; margin-left:10px; text-decoration:underline;">[Debug]</span>`;
                document.getElementById('record-count').innerHTML = statusHtml;

            } catch (e) {
                console.error("renderAll Error:", e);
                renderTable(processedData);
            }
        }






        function renderKPIs(data) {
            const container = document.getElementById('insights-container');
            container.innerHTML = '';

            if (data.length === 0) return;

            let mySum = 0, compSum = 0, count = 0;
            let opps = 0, risks = 0, pickupAlerts = [];

            const globalAvg = data.reduce((a, b) => a + b.compAvg, 0) / data.length;

            data.forEach(d => {
                ensureHotelStructure(d, activeHotel);
                const my = d.hotels[activeHotel];
                const myChange = (my.otbChange !== undefined) ? my.otbChange : 0;
                
                // Pick-up Alert (+/- 10 habs)
                if (Math.abs(myChange) >= 10) {
                    pickupAlerts.push({...d, otbChange: myChange});
                }
                if (!my || my.sold || my.price === 0) return;

                count++;
                mySum += my.price;
                compSum += d.compAvg;

                if (my.price < d.compAvg * 0.85) opps++;
                if (my.price > d.compAvg * 1.25) risks++;
            });

            // 1. Pick-up Alerts first (New priority)
            if (pickupAlerts.length > 0) {
                const totalChange = pickupAlerts.reduce((a, b) => a + (b.otbChange || 0), 0);
                const exampleDates = pickupAlerts.slice(0, 3).map(d => 
                    `<span class="action-link" onclick="focusRow(${d.dayIndex})">${d.label}</span>`
                ).join(", ");
                
                const type = totalChange >= 0 ? 'opp' : 'high';
                const icon = totalChange >= 0 ? '📈' : '📉';
                addInsight(type, `${icon} <strong>Variación Ocurrencia:</strong> ${pickupAlerts.length} fechas con cambios > 10 hab (${exampleDates}).`);
            }

            // 2. Compression
            const compression = data.filter(d => d.compAvg > globalAvg * 1.4);
            if (compression.length > 0) {
                const links = compression.slice(0, 3).map(d =>
                    `<span class="action-link" onclick="focusRow(${d.dayIndex})">${d.label}</span>`
                ).join(", ");

                addInsight('high', `🔥 <strong>Demanda Pico:</strong> Fechas calientes (${links}) detectadas. <span class="action-link" onclick="filterTable('compression')">Ver todas (${compression.length})</span>`);
            }

            if (opps > 0) {
                addInsight('opp', `💰 <strong>Oportunidad:</strong> ${opps} fechas con tarifa muy baja. <span class="action-link" onclick="filterTable('opp')">Ver listado</span>`);
            }
            if (risks > 0) {
                addInsight('high', `⚠️ <strong>Riesgo Tarifa:</strong> ${risks} fechas muy por encima del market. <span class="action-link" onclick="filterTable('risk')">Ver listado</span>`);
            }


            if (count === 0) {
                document.getElementById('kpi-avg').innerText = "N/A";
                return;
            }

            const avg = mySum / count;
            const mkt = compSum / count;
            const gap = ((avg - mkt) / mkt) * 100;

            document.getElementById('kpi-avg').innerText = avg.toFixed(0) + '€';
            document.getElementById('kpi-market').innerText = mkt.toFixed(0) + '€';

            const posEl = document.getElementById('kpi-pos');
            posEl.innerText = (gap > 0 ? '+' : '') + gap.toFixed(1) + '%';

            const cardPos = document.getElementById('kpi-card-pos');
            const txtPos = document.getElementById('kpi-pos-text');

            // Remove old classes
            cardPos.style.borderLeft = gap > 10 ? '4px solid var(--danger)' : (gap < -10 ? '4px solid var(--warning)' : '4px solid var(--success)');

            if (gap > 10) {
                posEl.className = 'kpi-value kpi-trend-neg';
                txtPos.innerText = "Por encima del mercado";
            } else if (gap < -10) {
                posEl.className = 'kpi-value kpi-trend-pos'; // Positive trend because cheaper = opportunity? Or warning? Usually Revenue Managers want to be slightly above or matched.
                txtPos.innerText = "Por debajo del mercado";
                // Let's make "Too Cheap" a warning color in text
                posEl.style.color = 'var(--warning)';
            } else {
                posEl.className = 'kpi-value kpi-trend-pos';
                posEl.style.color = 'var(--success)';
                txtPos.innerText = "Competitivo";
            }
        }

        function addInsight(type, html) {
            const div = document.createElement('div');
            div.className = `insight-box ${type}`;
            div.innerHTML = html;
            document.getElementById('insights-container').appendChild(div);
        }

        function renderTable(data) {
            const thead = document.getElementById('tableHeader');
            thead.innerHTML = '';

            // 1. Identify Sibling Hotel (Cross-reference)
            // If I am Guadiana, I want to see Cumbria. If Cumbria, Guadiana.
            let siblingName = "";
            if (data.length > 0) {
                const sample = data[0].hotels;
                if (activeHotel === "Guadiana" && sample["Cumbria"]) siblingName = "Cumbria";
                else if (activeHotel === "Cumbria" && sample["Guadiana"]) siblingName = "Guadiana";
            }

            // Build Headers
            let h = `<th>Fecha</th><th>${activeHotel}</th><th>Mercado</th><th>Gap</th><th>Acción</th>`;

            // Add Sibling Header
            if (siblingName) {
                const isIgnored = ignoredCompetitors.has(siblingName);
                const opacityStyle = isIgnored ? "opacity: 0.35; filter: grayscale(100%); background:#f8fafc;" : "";
                h += `<th title="${siblingName}" style="color:#4f46e5; font-weight:800; border-left:2px solid #e2e8f0; ${opacityStyle}">${siblingName}</th>`;
            }

            competitorsList.forEach(c => {
                // Allow longer names since we now wrap text
                const short = c.name.length > 25 ? c.name.substring(0, 25) + '..' : c.name;
                const isIgnored = ignoredCompetitors.has(c.name);
                const opacityStyle = isIgnored ? "opacity: 0.35; filter: grayscale(100%); background:#f8fafc;" : "";
                h += `<th title="${c.name}" style="${opacityStyle}">${short}</th>`;
            });
            thead.innerHTML = h;

            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';

            const rowsHTML = data.map(d => {
                const my = d.hotels[activeHotel];
                const myP = (my && !my.sold) ? my.price : 0;
                const sold = my && my.sold;

                // Gap Badge
                let gapHtml = '-';
                let actionHtml = '<span style="color:#cbd5e1">-</span>';

                if (!sold && myP > 0 && d.compAvg > 0) {
                    const diff = ((myP - d.compAvg) / d.compAvg) * 100;
                    let cls = 'gap-ok';
                    let actionText = "Mantener";
                    let actionColor = "#94a3b8";

                    // === PUNTO 3: Smart Yield — métricas separadas, sin mezcla ===
                    const cap = (activeHotel === 'Cumbria') ? 59 : 108;
                    let rooms;
                    if (my.otbRooms !== undefined) {
                        rooms = my.otbRooms;  // OTB = reservas reales en mano
                    } else if (my.occupancy !== undefined) {
                        rooms = my.occupancy; // Producción real histórica
                    } else {
                        rooms = null;         // Sin dato → no tomar decisiones
                    }
                    const occPct = (rooms !== null) ? (rooms / cap) * 100 : 0;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const targetDate = new Date(d.dateISO);
                    const daysOut = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

                    let soldComps = d.activeSoldComps || 0;
                    let compPricesArr = d.activeCompPrices || [];

                    const mktPrice = d.compAvg;
                    const lowestCompPrice = compPricesArr.length > 0 ? Math.min(...compPricesArr) : mktPrice;
                    const highestCompPrice = compPricesArr.length > 0 ? Math.max(...compPricesArr) : mktPrice;

                    let targetPrice = myP;

                    // 1. CRITICAL / OVERBOOKING (>90%)
                    if (occPct >= 90) {
                        if (activeHotel === 'Guadiana') {
                            // Ignoramos el más barato. Apuntamos por encima del más caro o un +30% del mercado
                            targetPrice = Math.max(highestCompPrice * 1.05, mktPrice * 1.3);
                        } else {
                            // Cumbria (3 estrellas): Tope razonable para no irse a precios de 4 estrellas super premium
                            targetPrice = Math.max(mktPrice * 1.2, lowestCompPrice + 30);
                            if (targetPrice > highestCompPrice * 0.8) targetPrice = highestCompPrice * 0.8;
                        }

                        if (myP < targetPrice * 0.95) {
                            actionText = `▲▲ ${targetPrice.toFixed(0)}€ (Últimas)`;
                            actionColor = "#b91c1c"; // Dark Red intent
                            cls = 'gap-low';
                        } else {
                            actionText = "Mantener (Max)";
                            actionColor = "#991b1b";
                        }
                    }
                    // 2. HIGH OCCUPANCY (70-90%) OR COMPETITORS SOLD OUT
                    else if (occPct >= 70 || soldComps >= 2) {
                        // Posición fuerte.
                        if (activeHotel === 'Guadiana') {
                            targetPrice = Math.max(mktPrice * 1.15, highestCompPrice * 0.95);
                        } else {
                            // Cumbria: Mantenemos competitividad pero nos beneficiamos de la compresión, sin apuntar al highest (que será un 4 estrellas caro)
                            targetPrice = Math.max(mktPrice * 1.05, lowestCompPrice * 1.15);
                            if (targetPrice > 115) targetPrice = 115; // Un cap de seguridad general o dinámico a mktPrice * 1.2
                            if (targetPrice > mktPrice * 1.25) targetPrice = mktPrice * 1.25;
                        }

                        let reasonText = occPct >= 70 ? ">70%" : "Comp. Llenos";
                        if (myP < targetPrice * 0.95) {
                            actionText = `▲ ${targetPrice.toFixed(0)}€ (${reasonText})`;
                            actionColor = "#16a34a"; // Green
                            cls = 'gap-low';
                        } else if (myP > targetPrice * 1.1) {
                            actionText = `▼ ${targetPrice.toFixed(0)}€ (Alta)`;
                            actionColor = "#dc2626";
                            cls = 'gap-high';
                        } else {
                            actionText = "Bien (Alta)";
                            actionColor = "#15803d";
                        }
                    }
                    // 3. LOW OCCUPANCY & LAST MINUTE (<40%, <7 days)
                    else if (occPct < 40 && daysOut < 7) {
                        // Urgencia -> Competimos agresivamente contra el PRECIO MÁS BAJO de la competencia
                        targetPrice = (activeHotel === 'Guadiana') ? lowestCompPrice * 1.05 : lowestCompPrice * 0.95;
                        const floor = (activeHotel === 'Guadiana') ? 50 : 40; // Suelo de precio
                        if (targetPrice < floor) targetPrice = floor;

                        if (myP > targetPrice * 1.05) {
                            actionText = `▼▼ ${targetPrice.toFixed(0)}€ (Liq.)`;
                            actionColor = "#dc2626"; // Red warning
                            cls = 'gap-high';
                        } else if (myP < targetPrice * 0.9) {
                            actionText = `▲ ${targetPrice.toFixed(0)}€ (Subir)`;
                            actionColor = "#16a34a";
                            cls = 'gap-low';
                        } else {
                            actionText = "Mantener (Bajo)";
                            actionColor = "#ca8a04";
                        }
                    }
                    // 4. MEDIUM/STANDARD POSITIONING
                    else {
                        // Mezcla inteligente entre el PRECIO MÁS BAJO y la MEDIA DE MERCADO según Ocupación
                        // Ej: Si Occ=20%, pesamos más (80%) el precio bajo para ganar tracción.
                        // Si Occ=60%, pesamos más (60%) la media para estabilizar.
                        let weightLowest = 1 - (occPct / 100);
                        targetPrice = (lowestCompPrice * weightLowest) + (mktPrice * (1 - weightLowest));

                        // Perfil de marca
                        if (activeHotel === 'Guadiana') {
                            targetPrice *= 1.1; // Guadiana tiene +10% de prima
                        } else {
                            targetPrice *= 0.95; // Cumbria se sitúa ligeramente por debajo del pool estándar
                        }

                        if (myP > targetPrice * 1.1) {
                            actionText = `▼ ${targetPrice.toFixed(0)}€ (Estabilizar)`;
                            actionColor = "#ea580c";
                            cls = 'gap-high';
                        } else if (myP < targetPrice * 0.9) {
                            actionText = `▲ ${targetPrice.toFixed(0)}€ (Ajustar)`;
                            actionColor = "#16a34a";
                            cls = 'gap-low';
                        } else {
                            actionText = "En Rango";
                            actionColor = "#64748b";
                        }
                    }
                    actionHtml = `<span style="color:${actionColor}; font-weight:700; font-size:0.8rem;">${actionText}</span>`;
                    gapHtml = `<span class="gap-badge ${cls}">${diff > 0 ? '+' : ''}${diff.toFixed(0)}%</span>`;
                }

                // Row Content
                const dynamic = getDynamicDateHtml(d, activeHotel);
                const currentOcc = (dynamic.occ > 0) ? dynamic.occ : dynamic.otb;
                let alertHtml = '';
                const capacityVal = (activeHotel === 'Cumbria' ? 59 : 108); // Manual fallback
                const occPct2 = (currentOcc / capacityVal) * 100;

                // Logic for High Occupancy / Open Rows
                const isOpen = (my && !my.sold && my.price > 0 && my.status !== 'sold');

                if (currentOcc > capacityVal) {
                    alertHtml = `<div style="margin-top:2px; background:#450a0a; border:1px solid #b91c1c; color:#fca5a5; font-size:0.65rem; font-weight:800; padding:1px 3px; border-radius:4px; text-align:center; box-shadow: 0 0 5px rgba(239, 68, 68, 0.4);">🚨 OVERBOOKING</div>`;
                } else if (occPct2 >= 95) {
                    if (occPct2 >= 100 && isOpen) {
                        alertHtml = `<div style="margin-top:2px; background:#fee2e2; border:1px solid #ef4444; color:#b91c1c; font-size:0.65rem; font-weight:800; padding:1px 3px; border-radius:4px; text-align:center;">⚠️ CERRAR?</div>`;
                    } else {
                        alertHtml = `<div style="margin-top:2px; color:#ea580c; font-size:0.65rem; font-weight:800; text-align:center;">🔥 ${occPct2.toFixed(0)}%</div>`;
                    }
                }

                let cellContent = dynamic.html;
                if (alertHtml) {
                    const lastDivIndex = cellContent.lastIndexOf('</div>');
                    if (lastDivIndex > -1) {
                        cellContent = cellContent.substring(0, lastDivIndex) + alertHtml + cellContent.substring(lastDivIndex);
                    } else {
                        cellContent += alertHtml;
                    }
                }

                let html = `<tr id="row-${d.dayIndex}">`;
                html += `<td>${cellContent}</td>`;

                // My Price
                const myStatus = my?.status || 'available';
                let falseClosedAlert = "";
                if ((sold || myStatus === 'sold') && currentOcc > 0 && currentOcc < capacityVal) {
                    const roomGap = capacityVal - currentOcc;
                    if (roomGap >= 1) falseClosedAlert = `<div title="¡HAY SITIO!" style="margin-top:4px; font-size:0.6rem; background:#fee2e2; color:#b91c1c; border:1px solid #ef4444; padding:2px 4px; border-radius:4px; font-weight:800;">🔔 ¡HAY SITIO!</div>`;
                }

                if (sold || myStatus === 'sold') {
                    html += `<td><span class="price-sold">CERRADO</span>${falseClosedAlert}</td>`;
                } else if (myStatus === 'minStay') {
                    html += `<td><span class="price-minstay">M</span></td>`;
                } else if (!myP || myP === 0 || myStatus === 'noData') {
                    if (d.otbADR && d.otbADR > 0) html += `<td class="price-val" style="color:#4f46e5;">${d.otbADR.toFixed(0)}€</td>`;
                    else html += `<td><span style="color:#cbd5e1">-</span></td>`;
                } else {
                    let content = `${myP.toFixed(0)}€`;
                    if (my.change) {
                        const dir = my.change.dir;
                        const color = dir === 'up' ? 'var(--success)' : 'var(--danger)';
                        const arrow = dir === 'up' ? '▲' : '▼';
                        content += `<span style="display:inline-block; font-size:0.65rem; color:${color}; background:#fff; border:1px solid ${color}; padding:0px 2px; border-radius:3px; margin-left:3px; line-height:1.2; vertical-align:middle; font-weight:700;">${arrow}${my.change.prev}</span>`;
                    }
                    html += `<td class="price-val" style="font-size:1.1rem;">${content}</td>`;
                }


                html += `<td style="color:var(--primary); font-weight:600;">${d.compAvg.toFixed(0)}€</td>`;
                html += `<td>${gapHtml}</td>`;
                html += `<td>${actionHtml}</td>`;

                // SIBLING
                if (siblingName) {
                    const hData = d.hotels[siblingName];
                    const isIgnored = ignoredCompetitors.has(siblingName);
                    const opacityStyle = isIgnored ? "opacity: 0.35; filter: grayscale(100%);" : "";

                    if (!hData || hData.status === 'noData') {
                        html += `<td style="border-left:2px solid #e2e8f0; background:#f8fafc; ${opacityStyle}">-</td>`;
                    } else if (hData.sold || hData.status === 'sold') {
                        html += `<td style="border-left:2px solid #e2e8f0; background:#f8fafc; ${opacityStyle}"><span class="price-sold">S</span></td>`;
                    } else if (hData.status === 'minStay') {
                        html += `<td style="border-left:2px solid #e2e8f0; background:#f8fafc; ${opacityStyle}"><span class="price-minstay">M</span></td>`;
                    } else {
                        const style = (!sold && hData.price < myP) ? "color:#ef4444; font-weight:800;" : "color:var(--text-main); font-weight:700;";
                        let sContent = `${hData.price.toFixed(0)}€`;
                        if (hData.change) {
                            const dir = hData.change.dir;
                            const color = dir === 'up' ? 'var(--success)' : 'var(--danger)';
                            const arrow = dir === 'up' ? '▲' : '▼';
                            sContent += `<span style="display:inline-block; font-size:0.65rem; color:${color}; background:#fff; border:1px solid ${color}; padding:0px 2px; border-radius:3px; margin-left:3px; line-height:1.2; vertical-align:middle; font-weight:700;">${arrow}${hData.change.prev}</span>`;
                        }
                        
                        // NEW: Show OTB/Occ also for Sibling
                        if (hData.otbRooms > 0) {
                            sContent += `<div style="font-size:0.6rem; color:#8b5cf6; font-weight:800; margin-top:1px;">Hab: ${hData.otbRooms}</div>`;
                        } else if (hData.occupancy > 0) {
                            sContent += `<div style="font-size:0.6rem; color:#4f46e5; font-weight:700; margin-top:1px;">Hab: ${hData.occupancy}</div>`;
                        }

                        html += `<td style="border-left:2px solid #e2e8f0; background:#f8fafc; font-size:1rem; ${style} ${opacityStyle}">${sContent}</td>`;
                    }
                }

                // Competitors Loop
                const compCols = competitorsList.map(c => {
                    const hData = d.hotels[c.name];
                    const isIgnored = ignoredCompetitors.has(c.name);
                    const opacityStyle = isIgnored ? "opacity: 0.35; filter: grayscale(100%); background:#f8fafc;" : "";

                    if (!hData || hData.status === 'noData') return `<td style="${opacityStyle}">-</td>`;
                    if (hData.sold || hData.status === 'sold') return `<td style="${opacityStyle}"><span class="price-sold">S</span></td>`;
                    if (hData.status === 'minStay') return `<td style="${opacityStyle}"><span class="price-minstay" title="Estancia mínima">M</span></td>`;

                    const style = (!sold && hData.price < myP) ? "color:#ef4444; font-weight:600;" : "color:var(--text-light);";
                        let priceContent = `${hData.price.toFixed(0)}€`;
                        if (hData.change) {
                            const dir = hData.change.dir;
                            const color = dir === 'up' ? 'var(--success)' : 'var(--danger)';
                            const arrow = dir === 'up' ? '▲' : '▼';
                            priceContent += `<span style="display:inline-block; font-size:0.65rem; color:${color}; background:#fff; border:1px solid ${color}; padding:0px 2px; border-radius:3px; margin-left:3px; line-height:1.2; vertical-align:middle; font-weight:700;">${arrow}${hData.change.prev}</span>`;
                        }

                        // NEW: Show OTB/Occ for all managed hotels in competition list
                        if (hData.otbRooms > 0) {
                            priceContent += `<div style="font-size:0.6rem; color:#8b5cf6; font-weight:800; margin-top:1px;">Hab: ${hData.otbRooms}</div>`;
                        } else if (hData.occupancy > 0) {
                            priceContent += `<div style="font-size:0.6rem; color:#4f46e5; font-weight:700; margin-top:1px;">Hab: ${hData.occupancy}</div>`;
                        }

                        return `<td style="${style} ${opacityStyle}">${priceContent}</td>`;
                    }).join('');

                html += compCols;
                html += `</tr>`;
                return html;
            }).join('');

            tbody.innerHTML = rowsHTML;
        }


        function renderChart(data) {
            const ctx = document.getElementById('mainChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();

            const labels = data.map(d => d.label);
            const myData = data.map(d => {
                const h = d.hotels[activeHotel];
                return (h && h.sold) ? null : h.price;
            });
            const mktData = data.map(d => d.compAvg);

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: activeHotel,
                            data: myData,
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.1)',
                            borderWidth: 3,
                            pointRadius: 2,
                            pointHoverRadius: 6,
                            tension: 0.3,
                            fill: true,
                            spanGaps: true
                        },
                        {
                            label: 'Mercado',
                            data: mktData,
                            borderColor: '#94a3b8',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleFont: { size: 13 },
                            bodyFont: { size: 13 },
                            padding: 10,
                            cornerRadius: 8,
                            displayColors: true
                        }
                    },
                    scales: {
                        y: { grid: { color: '#f1f5f9' }, beginAtZero: false },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        auth.onAuthStateChanged(user => {
            if (user) document.getElementById('userEmailNav').innerText = user.email;
        });

        // --- APP INITIALIZATION & SYNC ---
        function initApp() {
            // STOP auto-load if user requested a reset
            if (sessionStorage.getItem('force_reset_pending') === 'true') {
                console.log("🛑 Auto-load blocked by force_reset_pending. Waiting for manual file upload.");
                return;
            }

            // Try to load saved competitor data from Storage (Local or Firebase populated)
            try {
                const saved = CapaStorage.getItem('revenue_data_v2');
                if (saved) {
                    // FIX: Handle Object (Memory) vs String (LocalStorage)
                    const parsed = (typeof saved === 'string') ? JSON.parse(saved) : saved;

                    if (parsed && parsed.data) {
                        processedData = parsed.data;
                        competitorsList = parsed.competitors || [];
                        distinctMonths = parsed.months || [];
                        // activeHotel = parsed.activeHotel || "Guadiana"; // Keep default or last

                        populateMonths();
                        renderAll();
                        updateOutdatedStatus();
                        console.log("✅ Loaded competitor data from storage");
                    }
                }
            } catch (e) { console.warn("No cached data available yet", e); }
        }

        // Exposed for firebase-auth.js to call after cloud download
        window.updateAll = function () {
            console.log("🔄 Cloud Data Received -> Refreshing View...");
            initApp();
        };

        window.clearData = function () {
            if (confirm("¿Borrar datos actuales y subir nuevo archivo?\n(Pulsa ACEPTAR y espera en la pantalla de carga)")) {
                try { CapaStorage.removeItem('revenue_data_v2'); } catch (e) { }
                sessionStorage.setItem('force_reset_pending', 'true'); // Flag to block auto-load from cloud
                location.reload();
            }
        };

        window.diagnoseOTB = function () {
            const raw = CapaStorage.getItem('hotel_manager_db_v2');
            if (!raw) return alert("❌ Base de Datos (Producción/OTB) está VACÍA.\nPor favor ve a 'Config' y sube los archivos Excel.");

            try {
                let db = (typeof raw === 'string') ? JSON.parse(raw) : raw;
                const keys = Object.keys(db);
                let msg = `🔎 DIAGNÓSTICO DE PREVISIÓN (OTB):\n\n`;
                msg += `1. Hoteles en BD: ${keys.join(', ')}\n`;
                msg += `2. Hotel Seleccionado: "${activeHotel}"\n`;

                if (keys.includes(activeHotel)) {
                    const yData = db[activeHotel];
                    const years = Object.keys(yData);
                    const lastYear = years.sort().reverse()[0] || "2026";

                    msg += `3. Años en BD: ${years.join(', ')}\n`;

                    if (processedData.length > 0) {
                        const targetISO = processedData[0].dateISO;
                        msg += `4. Buscando fecha: "${targetISO}"\n`;

                        let found = false;
                        if (yData[lastYear]) {
                            // Check both old and new format for legacy support during transition
                            const hasDailyOTB = yData[lastYear].daily_otb && Object.keys(yData[lastYear].daily_otb).length > 0;
                            const hasDailyLegacy = yData[lastYear].daily && Object.keys(yData[lastYear].daily).length > 0;

                            if (hasDailyOTB) msg += `✅ Se detectan datos en 'daily_otb' (${lastYear}).\n`;
                            else if (hasDailyLegacy) msg += `⚠️ Datos detectados en formato antiguo (daily). Se recomienda re-subir el archivo de Previsión.\n`;
                            else msg += `❌ No hay datos diarios de previsión para ${lastYear}.\n`;

                            // Final check
                            years.forEach(y => {
                                if ((yData[y].daily_otb && yData[y].daily_otb[targetISO]) || (yData[y].daily && yData[y].daily[targetISO])) found = true;
                            });
                        }

                        if (!found) {
                            msg += `\n❌ CONCLUSIÓN: No hay datos de OTB para la fecha específica "${targetISO}".\n\n💡 SOLUCIÓN:\n1. Ve a 'Config' y sube el archivo 'Prevision.xlsx'.\n2. Asegúrate de que el año del archivo coincida con el de esta tabla.`;
                        } else {
                            msg += `\n✅ CONCLUSIÓN: Los datos existen. Si no los ves, refresca la página (F5).`;
                        }
                    }
                } else {
                    msg += `\n⚠️ ERROR: El hotel "${activeHotel}" no existe en la base de datos.\nSube un archivo para este hotel en la sección 'Config'.`;
                }
                alert(msg);
            } catch (e) { alert("Error en diagnóstico: " + e.message); }
        };

        // DEBUG PANEL
        const dPanel = document.createElement('div');
        dPanel.id = 'debug-panel';
        dPanel.style.cssText = "display:none; position:fixed; bottom:10px; right:10px; width:350px; height:250px; background:rgba(0,0,0,0.9); color:#4ade80; overflow:auto; padding:10px; font-family:monospace; font-size:11px; z-index:10000; border:2px solid #4ade80; border-radius:8px; box-shadow:0 0 10px rgba(0,255,0,0.2);";
        document.body.appendChild(dPanel);

        function logD(msg) {
            console.log(msg);
            const line = document.createElement('div');
            line.style.borderBottom = "1px solid #333";
            line.style.padding = "2px 0";
            line.innerText = "> " + msg;
            dPanel.appendChild(line);
            dPanel.scrollTop = dPanel.scrollHeight;
        }

        // --- COMPETENCIA CONFIG LOGIC ---
        function openCompConfig() {
            const container = document.getElementById('compListContainer');
            container.innerHTML = '';

            const allComps = new Set();

            // Add sibling explicitly
            let siblingName = activeHotel === "Guadiana" ? "Cumbria" : (activeHotel === "Cumbria" ? "Guadiana" : "");
            if (siblingName) allComps.add(siblingName);

            competitorsList.forEach(c => allComps.add(c.name));

            Array.from(allComps).forEach(comp => {
                const isChecked = !ignoredCompetitors.has(comp);
                container.innerHTML += `
                    <label style="display:flex; align-items:center; gap:10px; padding:10px; border:1px solid var(--border); border-radius:6px; cursor:pointer; background:var(--bg-body); transition:all 0.2s;">
                        <input type="checkbox" style="width:18px; height:18px; accent-color:var(--primary);" 
                               value="${comp}" ${isChecked ? 'checked' : ''} 
                               onchange="toggleComp('${comp.replace(/'/g, "\\'")}', this.checked)">
                        <span style="font-weight:600; font-size:14px; color:var(--text-main);">${comp}</span>
                    </label>
                `;
            });

            document.getElementById('compConfigModal').style.display = 'flex';
        }

        function toggleComp(compName, isChecked) {
            if (isChecked) {
                ignoredCompetitors.delete(compName);
            } else {
                ignoredCompetitors.add(compName);
            }
            localStorage.setItem('ignored_competitors', JSON.stringify(Array.from(ignoredCompetitors)));
        }

        function closeCompConfig() {
            document.getElementById('compConfigModal').style.display = 'none';
            renderAll();
        }

        function recalcMarketAverages(data) {
            data.forEach(d => {
                let compPrices = [];
                let siblingName = activeHotel === "Guadiana" ? "Cumbria" : (activeHotel === "Cumbria" ? "Guadiana" : "");

                const activeComps = [];
                if (siblingName && !ignoredCompetitors.has(siblingName)) {
                    activeComps.push(siblingName);
                }

                competitorsList.forEach(c => {
                    const isMyHotel = c.name.toLowerCase().includes(activeHotel.toLowerCase());
                    const isLibere = c.name.toLowerCase().includes("líbere") || c.name.toLowerCase().includes("libere");

                    if (!isMyHotel && !isLibere && c.name !== siblingName && !ignoredCompetitors.has(c.name)) {
                        activeComps.push(c.name);
                    }
                });

                let soldComps = 0;

                activeComps.forEach(compName => {
                    const hData = d.hotels[compName];
                    if (hData) {
                        if (hData.sold) soldComps++;
                        if (hData.price > 0 && !hData.sold) {
                            compPrices.push(hData.price);
                        }
                    }
                });

                d.activeCompPrices = compPrices;
                d.activeSoldComps = soldComps;

                if (compPrices.length > 0) {
                    d.compAvg = compPrices.reduce((a, b) => a + b, 0) / compPrices.length;
                } else {
                    d.compAvg = 0;
                }
            });
        }

        // Run on load
        window.addEventListener('DOMContentLoaded', () => {
            logD("Sistema iniciado. Esperando archivo...");
            initApp();
        });
    