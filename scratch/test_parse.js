const fs = require('fs');
const path = require('path');

// Load SheetJS from the project
const xlsxPath = path.resolve('C:/Users/comun/Documents/GitHub/CapaSuite/js/xlsx.full.min.js');
const XLSX = require(xlsxPath);

// Load the workbook
const excelFilePath = "C:\\Users\\comun\\OneDrive\\1.Conm Oficina\\Ficheros\\expedia_revenue_management_1109797_2026_05_20.xlsx";
const fileBuffer = fs.readFileSync(excelFilePath);
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];

let rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

function parseVal(val) {
    if (val === undefined || val === null) return { price: 0, sold: false, status: 'noData' };
    const S = String(val).trim().toUpperCase();
    
    // S = Completo (Sold out / Cerrado / Estancia mínima)
    if (S === 'S' || S === 'SOLD OUT' || S === 'SOLD_OUT' || S === 'COMPLETO' || S === 'COMPLETADO' || S === 'CERRADO' || S === 'C' || S.startsWith('MIN') || S.includes('NIGHT')) {
        return { price: 0, sold: true, status: 'sold' };
    }
    
    // M = Estancia mínima requerida
    if (S === 'M') return { price: 0, sold: false, status: 'minStay' };
    
    // - = Sin datos disponibles
    if (S === '-' || S === '') return { price: 0, sold: false, status: 'noData' };

    const p = parseFloat(val);
    return { price: isNaN(p) ? 0 : p, sold: false, status: 'available' };
}

// Find rows
let cumbriaRow = -1;
let guadianaRow = -1;
for (let i = 0; i < Math.min(100, rawData.length); i++) {
    const row = rawData[i];
    if (!row || !row[0]) continue;
    const cell0 = String(row[0]).toLowerCase();
    if (cell0.includes("cumbria")) {
        cumbriaRow = i;
    } else if (cell0.includes("guadiana") || cell0.includes("your property")) {
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
        nLow.includes("min") || nLow.includes("max") || nLow.includes("var") || nLow.includes("cv ") ||
        nLow.includes("spain") || nLow.includes("rest of") || nLow.includes("montes") || nLow.includes("castilla") || nLow.includes("la mancha") ||
        nLow.includes("competitive") || nLow.includes("average")) {
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

console.log("Competitors found:", competitorsList.map(c => c.name));
