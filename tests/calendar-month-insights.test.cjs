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


