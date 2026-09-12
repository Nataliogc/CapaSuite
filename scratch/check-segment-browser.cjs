const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/comun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
    const server = http.createServer((req, res) => {
        const name = path.join(process.cwd(), decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!name.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(name, (err, data) => { if (err) res.writeHead(404).end(); else { res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream'); res.end(data); } });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        // Isolated browser: no user storage, authentication or cloud writes.
        await page.route('**/*', route => {
            const url = route.request().url();
            if (url.endsWith('/js/firebase-auth.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.auth = { onAuthStateChanged: cb => cb({email:"Prueba local"}) };' });
            if (!url.startsWith('http://127.0.0.1:')) return route.abort();
            return route.continue();
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
        await page.goto(origin + '/AnalisisSegmentos.html');
        assert.equal(await page.locator('#dashboard').isVisible(), false);
        await page.locator('#fileInput').setInputFiles(process.argv[2]);
        await page.waitForFunction(() => document.getElementById('kpi-rooms').textContent === '1100');
        assert.equal(await page.locator('#compareSelector').inputValue(), '2025');
        assert.match(await page.locator('#kpi-prod').innerText(), /74[.\s]?814/);
        assert.match(await page.locator('#kpi-adr').innerText(), /61,84/);
        assert.match(await page.locator('#kpi-revpar').innerText(), /20,32/);
        assert.equal(await page.locator('#yearSelector option').count(), 3);
        await page.locator('#compareSelector').selectOption('2024');
        assert.match(await page.locator('#kpi-rooms-diff').innerText(), /59,4/);
        await page.locator('#btn-adr').click();
        assert.ok(Math.abs(await page.evaluate(() => charts.top.data.datasets[0].data[0]) - 61.8449636364) < 1e-5);
        assert.equal(await page.evaluate(() => charts.dist.config.type), 'bar');
        await page.locator('#btn-rooms').click();
        await page.locator('#monthSelector').selectOption('0');
        assert.equal(await page.evaluate(() => charts.top.data.datasets[0].data[0]), 1100);
        await page.locator('#segment-search').fill('CORPORATIVO');
        assert.equal(await page.locator('#tableBody tr').count(), 1);
        assert.match(await page.locator('#tableFoot').innerText(), /1100/);
        await page.locator('#segment-search').fill('');
        await page.locator('#btn-revenue').click();
        await page.evaluate(() => scrollTo(0, 0));
        assert.equal(await page.evaluate(() => charts.dist.scales.x.type), 'linear');
        assert.ok(await page.evaluate(() => charts.dist.getDatasetMeta(0).data[0].width > 0));
        await page.screenshot({ path: 'scratch/segments-desktop.png', fullPage: true });
        await page.locator('#themeToggleBtn').click();
        await page.screenshot({ path: 'scratch/segments-light.png', fullPage: true });
        await page.reload();
        await page.waitForFunction(() => document.getElementById('kpi-rooms').textContent === '1100');
        assert.ok(await page.evaluate(() => Boolean(segmentDB.Guadiana['2025'].segment.AGENCIAS)));
        await page.locator('#hotelSelector').selectOption('Cumbria');
        assert.equal(await page.locator('#dashboard').isVisible(), false);
        await page.locator('#hotelSelector').selectOption('Guadiana');
        assert.equal(await page.locator('#dashboard').isVisible(), true);
        const persisted = await page.evaluate(() => JSON.stringify(segmentDB));
        await page.locator('#fileInput').setInputFiles({ name: 'invalid.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('Not a report') });
        await page.waitForFunction(() => document.getElementById('import-status').classList.contains('error'));
        assert.equal(await page.evaluate(() => JSON.stringify(segmentDB)), persisted);
        assert.equal(await page.locator('#loader').isVisible(), false);
        await page.reload();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'scratch/segments-mobile.png', fullPage: true });
        const overflow = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth }));
        assert.ok(overflow.body <= overflow.width + 1, JSON.stringify(overflow));
        assert.deepEqual(errors, []);
        console.log('Browser: import, comparison, weighted ADR, filters, themes, persistence, hotel switching and mobile passed.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
