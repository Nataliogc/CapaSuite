const fs = require('fs');
const path = require('path');

// Load SheetJS from the project
const xlsxPath = path.resolve('C:/Users/comun/Documents/GitHub/CapaSuite/js/xlsx.full.min.js');
const XLSX = require(xlsxPath);

// Load the workbook
const excelFilePath = "C:\\Users\\comun\\OneDrive\\1.Conm Oficina\\Ficheros\\expedia_revenue_management_1109797_2026_05_20 (2).xlsx";
const fileBuffer = fs.readFileSync(excelFilePath);
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];

let rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

function parseVal(val) {
    if (val === undefined || val === null) return { price: 0, sold: false, status: 'noData' };
    const S = String(val).trim();
    const SU = S.toUpperCase();
    
    // Estancia mínima check
    if (SU === 'M' || SU.includes('MIN') || SU.includes('NIGHT') || SU.includes('ESTANCIA M')) {
        const match = S.match(/(\d+)/);
        const nightsNum = match ? parseInt(match[1]) : null;
        return {
            price: 0,
            sold: false,
            status: 'minStay',
            minStayDays: nightsNum,
            raw: S
        };
    }

    // S = Completo (Sold out / Cerrado / C / Completo)
    if (SU === 'S' || SU === 'SOLD OUT' || SU === 'SOLD_OUT' || SU === 'COMPLETO' || SU === 'COMPLETADO' || SU === 'CERRADO' || SU === 'C') {
        return { price: 0, sold: true, status: 'sold' };
    }
    
    // - = Sin datos disponibles
    if (SU === '-' || SU === '') return { price: 0, sold: false, status: 'noData' };

    const p = parseFloat(val);
    return { price: isNaN(p) ? 0 : p, sold: false, status: 'available' };
}

// Unit Tests for parseVal
console.log("TEST - Min. 2 nights:", parseVal("Min. 2 nights"));
console.log("TEST - Min. 3 nights:", parseVal("Min. 3 nights"));
console.log("TEST - Minimum stay:", parseVal("Minimum stay"));
console.log("TEST - Min stay:", parseVal("Min stay"));
console.log("TEST - M:", parseVal("M"));
console.log("TEST - Estancia mínima:", parseVal("Estancia mínima"));
console.log("TEST - Sold out:", parseVal("Sold out"));
console.log("TEST - 120:", parseVal("120"));
console.log("--------------------------------------------------");

// Find rows
let cumbriaRow = -1;
let guadianaRow = -1;
for (let i = 0; i < Math.min(100, rawData.length); i++) {
    const row = rawData[i];
    const name = row && row[0] ? String(row[0]) : "";
    console.log(`Row ${i}: "${name}" (cols: ${row ? row.length : 0})`);
    const cell0 = name.toLowerCase();
    if (cell0.includes("cumbria")) {
        cumbriaRow = i;
    } else if ((cell0.includes("guadiana") || cell0.includes("your property")) && !cell0.includes("montes")) {
        guadianaRow = i;
    }
}

console.log("Cumbria Row:", cumbriaRow);
console.log("Guadiana Row:", guadianaRow);

// Detect startCol and dateNumRow
let dateNumRow = -1;
let monthRow = -1;
let startCol = -1;
for (let r = 0; r < Math.min(20, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    for (let c = 1; c < Math.min(15, row.length); c++) {
        const val = parseInt(row[c]);
        if (val === 1) {
            // Find next cols to confirm sequence
            if (parseInt(row[c+1]) === 2 && parseInt(row[c+2]) === 3) {
                dateNumRow = r;
                startCol = c;
                break;
            }
        }
    }
    if (dateNumRow !== -1) break;
}

if (dateNumRow !== -1) {
    // Search monthRow
    for (let r = dateNumRow - 1; r >= 0; r--) {
        const val = String(rawData[r] ? rawData[r][startCol] : "");
        if (val && (val.includes("/") || val.match(/[a-zA-Z]/))) {
            monthRow = r;
            break;
        }
    }
}

console.log("dateNumRow:", dateNumRow);
console.log("monthRow:", monthRow);
console.log("startCol:", startCol);

// Scan competitors
let competitorsList = [];
const scanStart = (cumbriaRow !== -1 ? cumbriaRow : guadianaRow) + 1;
const totalCols = rawData[guadianaRow] ? rawData[guadianaRow].length : 0;
console.log("scanStart:", scanStart, "totalCols:", totalCols);

for (let r = scanStart; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) {
        console.log(`Row ${r} is null/undefined`);
        continue;
    }
    const name = row[0] ? String(row[0]).trim() : "";
    if (!name) {
        console.log(`Row ${r} has empty name`);
        continue;
    }
    const nLow = name.toLowerCase();
    
    // Check Data Density
    let validPoints = 0;
    let samplePoints = [];
    for (let checkC = startCol; checkC < Math.min(startCol + 30, totalCols); checkC++) {
        const cell = row[checkC];
        if (cell !== undefined && cell !== null && cell !== '') {
            const cellStr = String(cell).trim().toUpperCase();
            if (!isNaN(parseFloat(cell)) || 
                cellStr === 'S' || 
                cellStr === 'M' || 
                cellStr === 'SOLD OUT' || 
                cellStr === 'COMPLETO' || 
                cellStr === 'CERRADO' || 
                cellStr === 'MINIMUM STAY' || 
                cellStr === 'MIN STAY' || 
                cellStr === 'ESTANCIA MÍNIMA' || 
                cellStr === 'ESTANCIA MINIMA') {
                validPoints++;
                samplePoints.push(cell);
            }
        }
    }
    console.log(`Row ${r}: "${name}" | nLow: "${nLow}" | validPoints: ${validPoints} (sample: ${samplePoints.slice(0, 5).join(',')})`);

    if (name === "Hotel Santa Cecilia") {
        console.log("Hotel Santa Cecilia cells (first 50):", row.slice(0, 50));
    }

    // Blacklist check
    let blacklisted = false;
    if (name.length < 3) {
        console.log(`  -> Skipped: length < 3`);
        blacklisted = true;
    } else if (nLow.includes("tarifas medias") || nLow.includes("interés") || nLow.includes("interes") ||
        nLow.includes("año anterior") || nLow.includes("rank") || nLow.includes("clasificación") ||
        nLow.includes("promedio") || nLow.includes("media") || nLow.includes("total") ||
        nLow.includes("min") || nLow.includes("max") || nLow.includes("var") || nLow.includes("cv ") ||
        nLow.includes("spain") || nLow.includes("rest of") || nLow.includes("montes") || nLow.includes("castilla") || nLow.includes("la mancha") ||
        nLow.includes("competitive") || nLow.includes("average") ||
        nLow.includes("search demand") || nLow.includes("previous year")) {
        console.log(`  -> Skipped: blacklisted`);
        blacklisted = true;
    }
    
    if (!blacklisted && validPoints >= 5) {
        competitorsList.push({ name: name, rowIdx: r });
    }
}

console.log("Competitors found:", competitorsList.map(c => c.name));
