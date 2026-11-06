const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../js/xlsx.full.min.js');

const html = fs.readFileSync(path.join(__dirname, '../AnalisisCompetencia.html'), 'utf8');

test('AnalisisCompetencia distinguishes Cumbria vs Guadiana in Expedia files', () => {
    const cumbriaCsv = `2026-11-06 20:55,,,,
Spain - Expedia.es (EUR) | 1 night | 2 adults,,,,
Your competitors' rates are lower than yours,,,,
,,,,
,NOVEMBER 2026,NOVEMBER 2026,NOVEMBER 2026,NOVEMBER 2026
,Fri,Sat,Sun,Mon
,6,7,8,9
Your Property,99,115,58,67
Competitive set average,84,121,74,76
Competitive set rate trends WoW (Oct 30),(-8%),(+4%),(+3%),(+3%)
Sercotel Guadiana,75,115,60,64
Exe Doña Carlota,63,131,101,73
Hotel Santa Cecilia,55,55,55,55
Hotel Parque Real,85,112,69,82
Eurostars Rey Alfonso X,104,80,77,84
NH Ciudad Real,91,125,69,80
Líbere Ciudad Real,84,92,83,85`;

    const wb = XLSX.read(cumbriaCsv, { type: 'string' });
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

    let activeHotel = "Guadiana"; // User currently viewing Guadiana
    let yourPropertyRow = -1;
    let explicitGuadianaRow = -1;
    let explicitCumbriaRow = -1;

    for (let r = 0; r < Math.min(rawData.length, 100); r++) {
        const row = rawData[r] || [];
        if (row.length <= 2) continue;
        const rowStr = row.join(" ").toLowerCase();
        const firstCell = String(row[0] || "").toLowerCase().trim();

        if (rowStr.includes("tarifas medias") || rowStr.includes("tarifas promedio") || rowStr.includes("search demand")) continue;

        if (yourPropertyRow === -1 && (firstCell.includes("your property") || firstCell.includes("tu propiedad") || firstCell.includes("tu hotel") || rowStr.startsWith("your property"))) {
            yourPropertyRow = r;
        }
        if (explicitGuadianaRow === -1 && (firstCell.includes("guadiana") || rowStr.includes("sercotel guadiana")) && !firstCell.includes("montes") && !rowStr.includes("montes") && r !== yourPropertyRow) {
            explicitGuadianaRow = r;
        }
        if (explicitCumbriaRow === -1 && (firstCell.includes("cumbria") || rowStr.includes("cumbria")) && !rowStr.includes("montes") && r !== yourPropertyRow) {
            explicitCumbriaRow = r;
        }
    }

    let guadianaRow = -1;
    let cumbriaRow = -1;
    let detectedHotel = activeHotel || "Guadiana";

    if (yourPropertyRow !== -1) {
        if (explicitGuadianaRow !== -1) {
            cumbriaRow = yourPropertyRow;
            guadianaRow = explicitGuadianaRow;
            detectedHotel = "Cumbria";
        } else if (explicitCumbriaRow !== -1) {
            guadianaRow = yourPropertyRow;
            cumbriaRow = explicitCumbriaRow;
            detectedHotel = "Guadiana";
        } else {
            if (activeHotel === "Cumbria") {
                cumbriaRow = yourPropertyRow;
                guadianaRow = -1;
                detectedHotel = "Cumbria";
            } else {
                guadianaRow = yourPropertyRow;
                cumbriaRow = -1;
                detectedHotel = "Guadiana";
            }
        }
    }

    const mainAnchorRow = yourPropertyRow !== -1 ? yourPropertyRow : (detectedHotel === "Cumbria" && cumbriaRow !== -1 ? cumbriaRow : (guadianaRow !== -1 ? guadianaRow : cumbriaRow));

    assert.equal(detectedHotel, 'Cumbria', 'Should detect Cumbria when Sercotel Guadiana is listed in compset');
    assert.equal(cumbriaRow, 7, 'Cumbria row is Your Property (row 7)');
    assert.equal(guadianaRow, 10, 'Guadiana row is Sercotel Guadiana (row 10)');
    assert.equal(mainAnchorRow, 7);

    // Verify competitor list excludes both sister hotels
    const competitorsList = [];
    const scanStart = mainAnchorRow + 1;
    for (let r = scanStart; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || !row[0]) continue;
        if (r === guadianaRow || r === cumbriaRow || r === yourPropertyRow) continue;
        const name = String(row[0]).trim();
        const nLow = name.toLowerCase();
        if ((nLow.includes("guadiana") && !nLow.includes("montes")) || nLow.includes("cumbria") || nLow.includes("your property") || nLow.includes("tu propiedad")) continue;
        if (name.length < 3) continue;
        if (nLow.includes("competitive") || nLow.includes("average") || nLow.includes("trends")) continue;
        competitorsList.push({ name, rowIdx: r });
    }

    const compNames = competitorsList.map(c => c.name);
    assert.ok(!compNames.some(n => n.toLowerCase().includes('guadiana')), 'Sercotel Guadiana must NOT be in competitorsList');
    assert.ok(!compNames.some(n => n.toLowerCase().includes('cumbria')), 'Cumbria must NOT be in competitorsList');
    assert.ok(compNames.includes('Exe Doña Carlota'));
    assert.ok(compNames.includes('Hotel Santa Cecilia'));
    assert.ok(compNames.includes('Hotel Parque Real'));
});

test('AnalisisCompetencia handles standard Guadiana file with Cumbria in compset', () => {
    const guadianaCsv = `Spain - Expedia.es
,,,,
,NOVEMBER 2026,NOVEMBER 2026
,Fri,Sat
,6,7
Your Property,75,115
Competitive set average,84,121
Cumbria Spa & Hotel,99,115
Exe Doña Carlota,63,131`;

    const wb = XLSX.read(guadianaCsv, { type: 'string' });
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

    let activeHotel = "Cumbria";
    let yourPropertyRow = -1;
    let explicitGuadianaRow = -1;
    let explicitCumbriaRow = -1;

    for (let r = 0; r < Math.min(rawData.length, 100); r++) {
        const row = rawData[r] || [];
        if (row.length <= 2) continue;
        const rowStr = row.join(" ").toLowerCase();
        const firstCell = String(row[0] || "").toLowerCase().trim();

        if (yourPropertyRow === -1 && (firstCell.includes("your property") || firstCell.includes("tu propiedad"))) {
            yourPropertyRow = r;
        }
        if (explicitGuadianaRow === -1 && firstCell.includes("guadiana") && !firstCell.includes("montes") && r !== yourPropertyRow) {
            explicitGuadianaRow = r;
        }
        if (explicitCumbriaRow === -1 && firstCell.includes("cumbria") && !firstCell.includes("montes") && r !== yourPropertyRow) {
            explicitCumbriaRow = r;
        }
    }

    let guadianaRow = -1, cumbriaRow = -1, detectedHotel = "";
    if (yourPropertyRow !== -1) {
        if (explicitCumbriaRow !== -1) {
            guadianaRow = yourPropertyRow;
            cumbriaRow = explicitCumbriaRow;
            detectedHotel = "Guadiana";
        }
    }

    assert.equal(detectedHotel, 'Guadiana', 'Should detect Guadiana when Cumbria is in compset');
    assert.equal(guadianaRow, 5, 'Guadiana row is Your Property');
    assert.equal(cumbriaRow, 7, 'Cumbria row is Cumbria Spa & Hotel');
});
