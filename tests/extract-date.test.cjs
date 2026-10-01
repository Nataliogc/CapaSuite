const test = require('node:test');
const assert = require('node:assert/strict');

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

test('extractDateFromFilename handles full-year month ranges with 2-digit years', () => {
    const res25 = extractDateFromFilename('Guadiana Segmentos  ENERO - 25  Hasta DICIEMBRE - 25.xlsx');
    assert.equal(res25.full, 'Año 2025');
    assert.equal(res25.year, '2025');

    const res24 = extractDateFromFilename('Cumbria Segmentos  ENERO - 24  Hasta DICIEMBRE - 24.xlsx');
    assert.equal(res24.full, 'Año 2024');
    assert.equal(res24.year, '2024');

    const res23 = extractDateFromFilename('Guadiana Segmentos  ENERO - 23  Hasta DICIEMBRE - 23.xlsx');
    assert.equal(res23.full, 'Año 2023');
    assert.equal(res23.year, '2023');
});

test('extractDateFromFilename handles explicit DD-MM-YYYY ranges and singles', () => {
    const range = extractDateFromFilename('Cumbria Segmentacion Previsiones Valoradas del 01-10-2026 al 30-09-2027.xlsx');
    assert.equal(range.full, '01-10-2026 al 30-09-2027');
    assert.equal(range.year, '2026');
    assert.equal(range.endYear, '2027');

    const single = extractDateFromFilename('Guadiana 15-05-2025.xlsx');
    assert.equal(single.full, '15-05-2025');
    assert.equal(single.year, '2025');
});

test('extractDateFromFilename handles single month names with 2-digit or 4-digit years', () => {
    const single25 = extractDateFromFilename('Guadiana Segmentos DICIEMBRE - 25.xlsx');
    assert.equal(single25.full, 'DICIEMBRE 2025');
    assert.equal(single25.year, '2025');

    const single26 = extractDateFromFilename('Guadiana Segmentos Septiembre 2026.xlsx');
    assert.equal(single26.full, 'SEPTIEMBRE 2026');
    assert.equal(single26.year, '2026');
});

test('extractDateFromFilename handles partial month ranges', () => {
    const partial = extractDateFromFilename('Guadiana Segmentos ENERO a JUNIO 2025.xlsx');
    assert.equal(partial.full, 'ENERO 2025 al JUNIO 2025');
    assert.equal(partial.year, '2025');
    assert.equal(partial.isRange, true);
});

module.exports = { extractDateFromFilename };
