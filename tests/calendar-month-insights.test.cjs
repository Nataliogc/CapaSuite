const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('AnalisisCalendario.html has month-level interactive selection and insights calculation', () => {
    const html = fs.readFileSync('AnalisisCalendario.html', 'utf8');

    // 1. Verify CSS styles for month interaction
    assert.match(html, /\.month-card\.is-selected/);
    assert.match(html, /\.month-select-pill/);
    assert.match(html, /\.insights-filter-banner/);

    // 2. Verify script logic for month selection and toggle
    assert.match(html, /let selectedMonth\s*=\s*null;/);
    assert.match(html, /function toggleMonthSelection\(m\)/);
    assert.match(html, /card\.onclick\s*=\s*\(\)\s*=>\s*toggleMonthSelection\(m\)/);

    // 3. Verify hotelSelector labels are branded
    assert.match(html, /<option value="Guadiana">Sercotel Guadiana<\/option>/);
    assert.match(html, /<option value="Cumbria">Cumbria Spa&Hotel<\/option>/);

    // 4. Test toggleMonthSelection logic
    const context = {
        selectedMonth: null,
        renderInsightsCalled: false,
        renderCalendarCalled: false,
        renderEventListCalled: false,
        renderInsights: () => { context.renderInsightsCalled = true; },
        renderCalendar: () => { context.renderCalendarCalled = true; },
        renderEventList: () => { context.renderEventListCalled = true; }
    };

    const toggleMatch = html.match(/function toggleMonthSelection\(m\)\s*\{([\s\S]*?)\n        \}/);
    assert.ok(toggleMatch, 'toggleMonthSelection found');
    vm.runInNewContext(`
        var selectedMonth = null;
        function toggleMonthSelection(m) {
            ${toggleMatch[1]}
        }
    `, context);

    // Click October (month 9)
    context.toggleMonthSelection(9);
    assert.equal(context.selectedMonth, 9);
    assert.equal(context.renderInsightsCalled, true);

    // Click October again -> toggles back to null (all year)
    context.renderInsightsCalled = false;
    context.toggleMonthSelection(9);
    assert.equal(context.selectedMonth, null);
    assert.equal(context.renderInsightsCalled, true);
});

test('AnalisisCalendario renders 5 KPI cards in a single row and uses accommodation-only pickup', () => {
    const html = fs.readFileSync('AnalisisCalendario.html', 'utf8');

    // 1. Grid of 5 columns on single row
    assert.match(html, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(html, /insightsContainer\.className\s*=\s*['"]insights-cards-grid['"]/);

    // 2. Room revenue only (alojamiento)
    assert.match(html, /PICK-UP ALOJAMIENTO/);
    assert.match(html, /Solo Alojamiento/);
    assert.match(html, /hotelData\.otb\.breakdown\?\.habitacion/);
});

test('CalculadoraPresupuesto modal is widened to prevent horizontal scroll', () => {
    const html = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');

    // Budget Pacing modal width
    assert.match(html, /id="budgetPacingModalContent"[^>]*width:\s*96vw;\s*max-width:\s*1480px/);
});

test('CalculadoraPresupuesto defaults to PANEL tab', () => {
    const html = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');

    // Verify PANEL tab button has active class and DETALLE does not
    assert.match(html, /<button class="tab-btn active" onclick="switchTab\('tab-dashboard'\)">📊 Panel<\/button>/);
    assert.match(html, /<button class="tab-btn" onclick="switchTab\('tab-detail'\)">📑 Detalle<\/button>/);

    // Verify tab-dashboard section has active class and tab-detail does not
    assert.match(html, /<div id="tab-dashboard" class="section active">/);
    assert.match(html, /<div id="tab-detail" class="section">/);

    // Verify init() calls switchTab('tab-dashboard')
    assert.match(html, /function init\(\)\s*\{[\s\S]*?switchTab\('tab-dashboard'\);/);
});

test('AnalisisSegmentos layout adapts to full screen width without 1300px limitation', () => {
    const html = fs.readFileSync('AnalisisSegmentos.html', 'utf8');

    // .container must use 100% width and not constrain to 1300px
    assert.match(html, /\.container\s*\{[^}]*width:\s*100%;/);
    assert.match(html, /\.container\s*\{[^}]*max-width:\s*100%;/);
    assert.doesNotMatch(html, /\.container\s*\{[^}]*max-width:\s*1300px;/);
});

test('Analisis360 layout adapts to full screen width without 1600px limitation', () => {
    const html = fs.readFileSync('Analisis360.html', 'utf8');

    // .main-container and .header-360 must use 100% width and not constrain to 1600px
    assert.match(html, /\.main-container\s*\{[^}]*width:\s*100%;/);
    assert.match(html, /\.main-container\s*\{[^}]*max-width:\s*100%;/);
    assert.doesNotMatch(html, /\.main-container\s*\{[^}]*max-width:\s*1600px;/);
    assert.match(html, /\.header-360\s*\{[^}]*width:\s*100%;/);
});

test('AnalisisIA layout adapts to full screen width without 1200px limitation', () => {
    const html = fs.readFileSync('AnalisisIA.html', 'utf8');

    // .container must use 100% width and not constrain to 1200px
    assert.match(html, /\.container\s*\{[^}]*width:\s*100%;/);
    assert.match(html, /\.container\s*\{[^}]*max-width:\s*100%;/);
    assert.doesNotMatch(html, /\.container\s*\{[^}]*max-width:\s*1200px;/);
});

test('SeguimientoRevenue layout adapts to full screen width without 1380px limitation', () => {
    const css = fs.readFileSync('css/revenue-dashboard.css', 'utf8');

    // main must use 100% width and not constrain to 1380px
    assert.match(css, /main\s*\{[^}]*width:\s*100%;/);
    assert.match(css, /main\s*\{[^}]*max-width:\s*100%;/);
    assert.doesNotMatch(css, /main\s*\{[^}]*max-width:\s*1380px;/);
});

test('AnalisisProduccion layout adapts to full screen width without 1600px limitation', () => {
    const html = fs.readFileSync('AnalisisProduccion.html', 'utf8');

    // .container must use 100% width and not constrain to 1600px
    assert.match(html, /\.container\s*\{[^}]*width:\s*100%;/);
    assert.match(html, /\.container\s*\{[^}]*max-width:\s*100%;/);
    assert.doesNotMatch(html, /\.container\s*\{[^}]*max-width:\s*1600px;/);
});

test('CalculadoraPresupuesto distinguishes closed, in-progress, and future months', () => {
    const html = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');

    // 1. Verify getMonthTiming function exists
    assert.match(html, /function getMonthTiming\(mIdx,\s*yearStr,\s*hotel\)/);

    // 2. Verify editorSubtitle exists in HTML
    assert.match(html, /id="editorSubtitle"/);

    // 3. Verify status badges are rendered (Cerrado, En curso, Futuro)
    assert.match(html, /month-status-pill closed/);
    assert.match(html, /month-status-pill current/);
    assert.match(html, /month-status-pill future/);

    // 4. Verify subtext in % Cumplimiento (Real Cerrado, Real \+ OTB, Cartera OTB)
    assert.match(html, /Real Cerrado/);
    assert.match(html, /Real \+ OTB/);
    assert.match(html, /Cartera OTB/);
});

test('CalculadoraPresupuesto shows minimum required price per day to achieve budget in pacing modal', () => {
    const html = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');

    // 1. Verify "Precio Mín. Requerido" column header exists
    assert.match(html, /Precio Mín\. Requerido/);

    // 2. Verify minPrice calculation logic and floor price
    assert.match(html, /d\.minPrice\s*=/);
    assert.match(html, /targetTotalPickupRev/);
    assert.match(html, /sumWeightedPickup/);

    // 3. Verify average minimum price in table footer and top badge
    assert.match(html, /Precio Mín\. Medio/);
    assert.match(html, /avgMinPrice/);

    // 4. Verify tactical revenue suggestions include minimum price
    assert.match(html, /Tarifa Premium ≥ <b>\$\{d\.minPrice\} €<\/b>/);
    assert.match(html, /Tarifa mín\. <b>\$\{d\.minPrice\} €<\/b>/);
    assert.match(html, /Captar volumen a ≥ <b>\$\{d\.minPrice\} €<\/b>/);
});

test('AnalisisCalendario renders pick-up and average price (ADR) badges next to each month title', () => {
    const html = fs.readFileSync('AnalisisCalendario.html', 'utf8');

    // 1. Verify CSS styles for month metric badges
    assert.match(html, /\.month-header-badges/);
    assert.match(html, /\.month-metric-badge/);
    assert.match(html, /\.month-metric-badge\.price/);

    // 2. Verify month header renders badges with pickup and ADR
    assert.match(html, /mPickupRooms/);
    assert.match(html, /mAdr/);
    assert.match(html, /\$\{mAdr\}\s*€/);
    assert.match(html, /habs/);
});

test('CalculadoraPresupuesto scenarioDetailModal and allScenariosMatrixModal are widened to 1400px for full table visibility', () => {
    const html = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');

    // 1. Verify scenarioDetailModal has 96vw width and max-width 1400px
    const scModalMatch = html.match(/id="scenarioDetailModal"[\s\S]*?<div style="([^"]*max-width:\s*1400px[^"]*)"/);
    assert.ok(scModalMatch, 'scenarioDetailModal content container has max-width: 1400px');
    assert.ok(!html.includes('id="scenarioDetailModal"\n        style="display:none; position:fixed; z-index:9998; left:0; top:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); align-items:center; justify-content:center; padding: 20px;">\n        <div style="background:#fff; border-radius:20px; padding:24px; width:100%; max-width:920px;'));

    // 2. Verify allScenariosMatrixModal has 96vw width and max-width 1400px
    const matrixModalMatch = html.match(/id="allScenariosMatrixModal"[\s\S]*?<div style="([^"]*max-width:\s*1400px[^"]*)"/);
    assert.ok(matrixModalMatch, 'allScenariosMatrixModal content container has max-width: 1400px');
});

test('CalculadoraPresupuesto Estado de Incentivos shows closed and in-course month status badges and breakdown', () => {
    const html = fs.readFileSync('CalculadoraPresupuesto.html', 'utf8');

    // 1. Verify bonusSubtitle element exists
    assert.match(html, /id="bonusSubtitle"/);

    // 2. Verify renderBonusTable computes timing and displays closed / in-course badges
    assert.match(html, /function renderBonusTable\(\)/);
    assert.match(html, /const timing = getMonthTiming\(i, currentYear, currentHotel\);/);
    assert.match(html, /timing\.isClosed/);
    assert.match(html, /timing\.isCurrent/);
    assert.match(html, /🔒<\/span> Cerrado/);
    assert.match(html, /⚡<\/span> En curso/);
    assert.match(html, /Real Cerrado/);
    assert.match(html, /Real \+ OTB/);
    assert.match(html, /Cartera OTB/);

    // 3. Verify table header MES has adequate width for pills
    assert.match(html, /<th class="text-left" style="min-width:\s*200px;/);
});

test('AnalisisCalendario showTooltip renders comprehensive daily pick-up details and metrics', () => {
    const html = fs.readFileSync('AnalisisCalendario.html', 'utf8');

    // 1. Verify showTooltip calculates pick-up differences
    assert.match(html, /function showTooltip\(e, iso, hData, dData, dayEvents\)/);
    assert.match(html, /const diffRooms = hasPickup \? Math\.round\(otbCurrent - otbPrevious\) : 0;/);
    assert.match(html, /const diffRev = hasPickup \? \(currentRev - prevRev\) : 0;/);
    assert.match(html, /const diffAdr = \(hasPickup && prevAdr > 0 && curAdr > 0\) \? \(curAdr - prevAdr\) : null;/);

    // 2. Verify tooltip renders DETALLE PICK-UP (DIARIO) section and badges
    assert.match(html, /DETALLE PICK-UP \(DIARIO\):/);
    assert.match(html, /Habitaciones/);
    assert.match(html, /Ingresos OTB/);
    assert.match(html, /PMP \/ ADR/);
    assert.match(html, /headerPickupBadge/);

    // 3. Verify enrichRevenueData saves snapshot pickup metrics
    assert.match(html, /rev_prev:/);
    assert.match(html, /adr_prev:/);
    assert.match(html, /snapshotDate:/);

    // 4. Verify tooltip is bounded to viewport height and adapts position to prevent cutoff
    assert.match(html, /max-height:\s*calc\(100vh\s*-\s*28px\);/);
    assert.match(html, /overflow-y:\s*auto;/);
    assert.match(html, /y \+ tipH > viewH - pad/);
    assert.match(html, /y = viewH - tipH - pad/);
});

test('AnalisisProduccion charts-row adapts to laptop screens without horizontal cutoff', () => {
    const html = fs.readFileSync('AnalisisProduccion.html', 'utf8');

    // 1. Verify no rigid inline style forcing 3 columns on small laptop screens
    assert.ok(!html.includes('<div class="charts-row" style="grid-template-columns: 1.5fr 1fr 1fr;">'));
    assert.match(html, /<div class="charts-row">/);

    // 2. Verify CSS media query for laptop screens (<= 1380px)
    assert.match(html, /@media\s*\(max-width:\s*1380px\)\s*\{/);
    assert.match(html, /\.charts-row > \.chart-card:first-child\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);

    // 3. Verify min-width: 0 on grid children to allow Chart.js canvases to shrink
    assert.match(html, /\.charts-row > \*\s*\{\s*min-width:\s*0;/);
});





