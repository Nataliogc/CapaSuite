const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const S = require('../js/segment-analysis.js');

function storageContext(local, session, fail = false) {
    const context = { console: { error() {}, info() {} }, window: null,
        localStorage: { getItem: k => local[k] ?? null, removeItem: k => delete local[k],
            setItem(k, v) { if (fail && k.startsWith('v3_')) throw Error('quota'); local[k] = v; } },
        sessionStorage: { getItem: k => session[k] ?? null, setItem: (k, v) => session[k] = v, removeItem: k => delete session[k] }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/storage.js', 'utf8'), context);
    return context;
}

test('quota fallback survives reads and navigation, and successful persistence clears it', () => {
    const local = { v3_sample: 'old' }, session = {};
    const first = storageContext(local, session, true);
    assert.equal(first.CapaStorage.setItem('sample', 'new').persistent, false);
    assert.equal(first.CapaStorage.getItem('sample'), 'new');
    const next = storageContext(local, session);
    assert.equal(next.CapaStorage.getItem('sample'), 'new');
    next.CapaStorage.setItem('sample', 'saved');
    local.v3_sample = 'external';
    assert.equal(next.CapaStorage.getItem('sample'), 'external');
});

test('reading an unmarked database preserves valid dates and never writes a migration', () => {
    const source = JSON.stringify({ Guadiana: { 2026: { daily: { '2026-12-31': { rooms: 1 } } } } });
    const local = { v3_hotel_manager_db_v2: source };
    const c = storageContext(local, {});
    c._capasuite_local_mode = true;
    assert.equal(c.CapaStorage.getItem('hotel_manager_db_v2'), source);
    assert.equal(local.v3_hotel_manager_db_v2, source);
});

test('forecast zeros clear prior bookings and disappeared segments only inside covered dates', () => {
    const db = { Guadiana: { segment: {
        GRUPOS: { days: { '2026-01-01': { rooms: 5, revenue: 500 }, '2026-02-01': { rooms: 2 } } },
        OTROS: { days: { '2026-01-01': { rooms: 3 }, '2026-02-01': { rooms: 1 } } }
    } } };
    const report = S.parseForecast([['Seg.', '', '01/01'], ['GRUPOS', 'Hab', 0], ['', 'SUITE', 0]], '2026.xlsx');
    S.mergeForecast(db, 'Guadiana', report);
    assert.equal(db.Guadiana.segment.GRUPOS.days['2026-01-01'].rooms, 0);
    assert.equal(db.Guadiana.segment.OTROS.days['2026-01-01'], undefined);
    assert.equal(db.Guadiana.segment.GRUPOS.days['2026-02-01'].rooms, 2);
    assert.equal(db.Guadiana.segment_prev.GRUPOS.days['2026-01-01'].rooms, 5);
});

test('forecast rejects invalid and duplicate dates before replacing stored data', () => {
    assert.throws(() => S.parseForecast([['Seg.', '', '31/02'], ['GRUPOS', 'Hab', 1]], '2026.xlsx'), /Fecha no válida/);
    assert.throws(() => S.parseForecast([['Seg.', '', '01/01', '01/01'], ['GRUPOS', 'Hab', 1, 2]], '2026.xlsx'), /duplicada/);
});

test('reimporting a summary cannot inherit verified accommodation from an older breakdown', () => {
    const db = {};
    S.merge(db, 'Guadiana', S.parse([['Seg.', '', 'Ene.26'], ['GRUPOS', 'Hab', 2], ['', 'SUITE', 100]]));
    assert.equal(S.aggregate(db.Guadiana[2026], [0]).adr, 50);
    S.merge(db, 'Guadiana', S.parse([['Seg.', '', 'Ene.26'], ['GRUPOS', 'Hab', 2], ['', 'Pro', 120]]));
    assert.equal(S.aggregate(db.Guadiana[2026], [0]).adr, null);
    assert.equal(S.aggregate(db.Guadiana[2026], [0]).revenue, 120);
});

test('all inline scripts and local scripts parse', () => {
    for (const name of fs.readdirSync('.').filter(n => n.endsWith('.html'))) {
        for (const match of fs.readFileSync(name, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (/\bsrc\s*=|application\/ld\+json|application\/json/i.test(match[1])) continue;
            assert.doesNotThrow(() => new vm.Script(match[2], { filename: name }));
        }
    }
    for (const name of fs.readdirSync('js').filter(n => n.endsWith('.js'))) {
        assert.doesNotThrow(() => new vm.Script(fs.readFileSync('js/' + name, 'utf8'), { filename: name }));
    }
});

test('AI chat awaits a response and escapes user and model markup', async () => {
    const html = fs.readFileSync('AnalisisIA.html', 'utf8');
    const extract = name => {
        const start = html.indexOf('        ' + name);
        const end = html.indexOf('\n        function ', start + 1);
        return html.slice(start, end < 0 ? html.indexOf('</script>', start) : end);
    };
    const messages = [], input = { value: '<img src=x onerror=alert(1)>' }, indicator = { style: {} };
    const c = vm.createContext({ document: {
        getElementById: id => id === 'chatInput' ? input : id === 'typingIndicator' ? indicator : { appendChild: n => messages.push(n), scrollHeight: 1 },
        createElement: () => ({ classList: { add() {} } })
    }, auth: { onAuthStateChanged() {} }, setTimeout: fn => fn(), generateAIResponse: async () => '**Correcto** <script>bad</script>' });
    vm.runInContext(extract('function addMessage('), c);
    vm.runInContext(html.slice(html.indexOf('        async function sendMessage()'), html.indexOf('        // --- GEMINI INTEGRATION ---')), c);
    await c.sendMessage();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.length, 2);
    assert.match(messages[0].innerHTML, /&lt;img/);
    assert.match(messages[1].innerHTML, /<strong>Correcto<\/strong>/);
    assert.match(messages[1].innerHTML, /&lt;script&gt;/);
});

test('navigation reuses existing bars and restores hotel through the page change handler', async () => {
    const events = {}, documentEvents = {}, changes = [];
    const selector = { id: 'hotelSelector', value: 'Guadiana', dispatchEvent: e => changes.push(e.type) };
    const nav = { children: [{}], querySelectorAll: () => [], querySelector: () => null };
    let fetches = 0;
    const c = vm.createContext({ window: { location: { pathname: '/AnalisisProduccion.html' }, addEventListener: (n, f) => events[n] = f },
        document: { getElementById: id => id === 'mainNav' ? null : selector,
            querySelector: () => nav, querySelectorAll: () => [selector], addEventListener: (n, f) => documentEvents[n] = f },
        localStorage: { getItem: () => 'Cumbria', setItem() {} },
        fetch: () => { fetches++; throw Error('duplicate'); }, console,
        Event: function(type) { this.type = type; }, setTimeout: fn => fn()
    });
    vm.runInContext(fs.readFileSync('js/nav.js', 'utf8'), c);
    documentEvents.DOMContentLoaded(); await c.window.CapaNavReady;
    assert.equal(selector.value, 'Cumbria', 'hotel restored before page load handlers run');
    await events.load();
    assert.equal(fetches, 0);
    assert.equal(nav.id, 'mainNav');
    assert.equal(selector.value, 'Cumbria');
    assert.deepEqual(changes, ['change']);
});

test('empty home navigation is filled without replacing its visibility state', async () => {
    const events = {}, documentEvents = {};
    const existing = { children: [], innerHTML: '', style: { display: 'none' }, querySelectorAll: () => [], querySelector: () => null };
    const c = vm.createContext({ window: { location: { pathname: '/index.html' }, addEventListener: (n, f) => events[n] = f },
        document: { getElementById: id => id === 'mainNav' ? existing : null,
            addEventListener: (n, f) => documentEvents[n] = f,
            createElement: () => ({ content: { querySelector: () => ({ innerHTML: '<a>Inicio</a>' }) } }) },
        fetch: async () => ({ ok: true, text: async () => '<nav></nav>' }), console, setTimeout: fn => fn()
    });
    vm.runInContext(fs.readFileSync('js/nav.js', 'utf8'), c);
    documentEvents.DOMContentLoaded(); await events.load();
    assert.equal(existing.innerHTML, '<a>Inicio</a>');
    assert.equal(existing.style.display, 'none');
});
