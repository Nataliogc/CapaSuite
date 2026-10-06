(function () {
    'use strict';
    const history = window.CapaRevenueHistory;
    const el = id => document.getElementById(id);
    const formatDate = iso => new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    const numeric = n => n == null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n);
    const money = n => n == null ? 'No verificable' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    let records = [], busy = false, activeComparison = { available: false };
    function status(text, error = false) { el('status').textContent = text; el('status').classList.toggle('error', error); }
    function confirmRecovery(message) {
        const dialog = el('restoreDialog'); el('restoreDescription').textContent = message;
        return new Promise(resolve => {
            dialog.returnValue = 'cancel'; dialog.onclose = () => resolve(dialog.returnValue === 'confirm');
            el('cancelRestore').onclick = () => dialog.close('cancel');
            el('confirmRestore').onclick = () => dialog.close('confirm');
            dialog.showModal();
        });
    }
    function textCell(row, value, detail) {
        const cell = document.createElement('td'); cell.textContent = value;
        if (detail) { const small = document.createElement('small'); small.textContent = detail; cell.append(small); }
        row.append(cell); return cell;
    }
    function empty(body, message, columns) { const row = document.createElement('tr'), cell = textCell(row, message); cell.colSpan = columns; cell.className = 'empty'; body.replaceChildren(row); }
    async function operation(task) {
        if (busy) return;
        busy = true; document.querySelectorAll('main button').forEach(b => b.disabled = true);
        try { await task(); } catch (error) { console.error(error); status(error.message, true); }
        finally { busy = false; document.querySelectorAll('main button').forEach(b => b.disabled = false); el('exportComparison').disabled = !activeComparison.available; }
    }
    async function refresh() {
        records = await history.list(el('historyHotel').value);
        // Synced segment versions are usable even when this browser has no local checkpoints.
        if (el('historyMode').value === 'forecast' && records.filter(r => r.status === 'committed' && r.mode === 'forecast' && r.observation).length < 2) {
            const hotel = el('historyHotel').value;
            const saved = JSON.parse(window.CapaStorage.getItem('segment_forecast_v2') || '{}')[hotel];
            if (saved?.segment_prev && saved.segment && Number.isFinite(Date.parse(saved.prevUpdatedAt)) && Number.isFinite(Date.parse(saved.updatedAt))) {
                for (const [version, segment, date, source] of [
                    ['current', saved.segment, saved.updatedAt, saved.source],
                    ['previous', saved.segment_prev, saved.prevUpdatedAt, saved.prevSource]
                ]) {
                    const observation = history.observe({ segment_forecast_v2: JSON.stringify({ [hotel]: { segment } }) }, hotel, 'forecast');
                    records.push({ id: 'synced-' + version, hotel, mode: 'forecast', status: 'committed', capturedAt: date,
                        source: { name: source || 'Previsión de segmentos sincronizada' }, observation, syncedOnly: true });
                }
                el('currentCapture').value = ''; el('previousCapture').value = '';
            }
        }
        const captures = records.filter(r => r.status === 'committed' && r.mode === el('historyMode').value && r.observation).sort((a, b) => Number(!!b.syncedOnly) - Number(!!a.syncedOnly) || b.capturedAt.localeCompare(a.capturedAt));
        const current = el('currentCapture').value, previous = el('previousCapture').value;
        for (const key of ['currentCapture', 'previousCapture']) {
            el(key).replaceChildren(...captures.map(r => new Option(formatDate(r.capturedAt) + ' · ' + r.source.name, r.id)));
        }
        el('currentCapture').value = captures.some(r => r.id === current) ? current : captures[0]?.id || '';
        const currentCapture = captures.find(r => r.id === el('currentCapture').value);
        const sameDay = currentCapture && captures.filter(r => formatDate(r.capturedAt).split(',')[0] === formatDate(currentCapture.capturedAt).split(',')[0] && r.capturedAt <= currentCapture.capturedAt).at(-1);
        el('previousCapture').value = captures.some(r => r.id === previous) ? previous : sameDay?.id || captures[1]?.id || '';
        renderComparison(); renderImports();
    }
    function renderComparison() {
        const current = records.find(r => r.id === el('currentCapture').value), previous = records.find(r => r.id === el('previousCapture').value);
        const comparison = !current || !previous ? { available: false, reason: 'Importa dos capturas para comparar su evolución.' } : current.id === previous.id ? { available: false, reason: 'Necesitas dos capturas distintas para medir cambios.' } : history.compare(previous, current, el('stayMonth').value);
        activeComparison = comparison;
        el('exportComparison').disabled = !comparison.available;
        el('attentionList').replaceChildren();
        el('visibleDays').textContent = '';
        el('matchedDays').textContent = comparison.available ? numeric(comparison.matchedDays) : '—';
        el('roomsDelta').textContent = comparison.available ? (comparison.roomsDelta > 0 ? '+' : '') + numeric(comparison.roomsDelta) : '—';
        el('incomeDelta').textContent = comparison.available ? money(comparison.accommodationDelta) : '—';
        const body = el('pickupBody'); body.replaceChildren();
        if (!comparison.available) {
            el('coverageNote').textContent = comparison.reason || 'Importa previsiones en dos momentos distintos para empezar a comparar.';
            el('attentionNote').textContent = 'Necesitas dos capturas comparables para identificar fechas con descensos.';
            empty(body, 'Todavía no hay una comparación disponible.', 5); return;
        }
        const issues = previous.observation.issues.length + current.observation.issues.length;
        el('coverageNote').textContent = `${comparison.matchedDays} fechas compartidas. ${comparison.fullCoverage ? 'Las capturas cubren las mismas fechas.' : `${comparison.missing.length} fechas están fuera de la comparación porque faltan en una captura; no se interpretan como cancelaciones.`} ${issues ? `Hay ${issues} incidencias de calidad en las capturas.` : ''} Cambio neto: las reservas nuevas y las cancelaciones no se pueden separar con estos informes.`;
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
        const attention = window.CapaRevenueReview.attention(comparison, el('historyMode').value, today);
        el('attentionNote').textContent = el('historyMode').value === 'forecast'
            ? attention.length ? `${attention.length} ${attention.length === 1 ? 'fecha desde hoy con descenso' : 'fechas desde hoy con descenso'} de habitaciones o alojamiento; por orden de cercanía. Revisa reservas y modificaciones antes de decidir una tarifa. Se muestran hasta 8 fechas.` : 'No hay descensos en las próximas fechas comparables del periodo seleccionado. Las fechas sin cobertura no se evalúan.'
            : 'La producción registrada muestra correcciones del histórico; este panel revisa únicamente previsiones futuras.';
        for (const item of attention.slice(0, 8)) {
            const entry = document.createElement('li');
            const reasons = [];
            if (item.roomsDelta < 0) reasons.push(`${numeric(item.roomsDelta)} habitaciones`);
            if (item.accommodationDelta != null && item.accommodationDelta < 0) reasons.push(`${money(item.accommodationDelta)} de alojamiento`);
            entry.textContent = `${new Date(item.iso + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}: ${reasons.join(' · ')}. Cambio neto; no acredita cancelaciones.`;
            el('attentionList').append(entry);
        }
        const visible = comparison.rows.filter(item => !el('changesOnly').checked || item.roomsDelta !== 0 || item.accommodationDelta != null && item.accommodationDelta !== 0);
        el('visibleDays').textContent = `${visible.length} de ${comparison.rows.length} fechas comparables en la tabla. Los totales superiores incluyen todas las fechas comparables del periodo.`;
        if (!visible.length) empty(body, 'No hay días con cambios verificables en este periodo.', 5);
        for (const item of visible) {
            const row = document.createElement('tr');
            textCell(row, new Date(item.iso + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }));
            textCell(row, numeric(item.previousRooms)); textCell(row, numeric(item.rooms));
            const delta = textCell(row, (item.roomsDelta > 0 ? '+' : '') + numeric(item.roomsDelta)); delta.className = item.roomsDelta > 0 ? 'positive' : item.roomsDelta < 0 ? 'negative' : '';
            textCell(row, money(item.accommodationDelta)); body.append(row);
        }
    }
    function renderImports() {
        const body = el('importsBody'); body.replaceChildren();
        if (!records.length) { empty(body, 'Las próximas cargas aparecerán aquí. También puedes guardar una captura de los datos actuales.', 4); return; }
        for (const record of records) {
            const row = document.createElement('tr');
            textCell(row, formatDate(record.capturedAt), record.mode === 'forecast' ? 'Previsión' : 'Producción');
            const source = textCell(row, record.source.name, record.period || 'Periodo no indicado');
            if (record.source.sha256) { const detail = document.createElement('small'); detail.textContent = 'Huella SHA-256: ' + record.source.sha256; source.append(detail); }
            const labels = { prepared: 'Carga sin terminar', committed: 'Captura guardada', failed: 'Carga fallida o cancelada' };
            const dates = record.observation?.coverage || [];
            const details = [dates.length ? `${dates.length} fechas: ${dates[0]} a ${dates.at(-1)}` : 'Sin detalle diario comparable', record.error || '', record.persistence === false ? 'Datos activos guardados temporalmente; descarga una copia.' : '', ...(record.observation?.issues || [])];
            textCell(row, labels[record.status] || record.status, details.filter(Boolean).join(' · '));
            const actions = textCell(row, '');
            if (record.syncedOnly) { actions.textContent = 'Versión sincronizada · sin copia de restauración local'; body.append(row); continue; }
            const restore = document.createElement('button'); restore.textContent = 'Recuperar copia anterior';
            restore.onclick = () => operation(async () => {
                if (!await confirmRecovery(`Se recuperará la copia completa anterior a ${record.source.name} (${formatDate(record.capturedAt)}), incluidos los datos de ambos hoteles. Se guardará una copia del estado actual antes de restaurar.`)) return;
                await history.restore(record.id); el('currentCapture').value = ''; window.dispatchEvent(new CustomEvent('capasuite-data-synced')); await refresh(); status('Copia anterior recuperada. Los cambios de los datos sincronizados se enviarán a la nube si estás conectado.');
            });
            actions.append(restore); body.append(row);
        }
    }
    function download(bundle) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'CapaSuite-copia-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    el('historyHotel').onchange = () => operation(refresh);
    el('historyMode').onchange = () => operation(refresh);
    ['previousCapture', 'currentCapture', 'stayMonth'].forEach(key => el(key).onchange = renderComparison);
    el('allMonths').onclick = () => { el('stayMonth').value = ''; renderComparison(); };
    el('changesOnly').onchange = renderComparison;
    el('exportComparison').onclick = () => {
        if (!activeComparison.available || busy) return;
        const current = records.find(r => r.id === el('currentCapture').value), previous = records.find(r => r.id === el('previousCapture').value);
        const content = window.CapaRevenueReview.csv(activeComparison, previous, current, el('changesOnly').checked);
        const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `CapaSuite-comparacion-${current.hotel}-${el('stayMonth').value || 'todas-las-fechas'}.csv`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        status('Comparación descargada. El CSV contiene las fechas mostradas, las horas de las capturas y deja en blanco los ingresos no verificables.');
    };
    el('captureNow').onclick = () => operation(async () => {
        const id = await history.begin(null, { hotel: el('historyHotel').value, mode: el('historyMode').value, type: 'Captura manual' });
        await history.commit(id); await refresh(); status('Captura guardada con la fecha y hora actuales.');
    });
    el('exportBackup').onclick = () => operation(async () => { download(await history.exportBackup()); status('Copia completa descargada con los datos actuales y el histórico de esta cuenta.'); });
    el('importBackup').onclick = () => el('backupFile').click();
    el('backupFile').onchange = () => operation(async () => {
        const file = el('backupFile').files[0]; if (!file) return;
        try {
            const bundle = JSON.parse(await file.text()); history.validateBackup(bundle);
            if (!await confirmRecovery(`La copia ${file.name} sustituirá los datos actuales de ambos hoteles e incorporará su histórico. Se guardará una copia previa antes de recuperar.`)) return;
            await history.restoreBackup(bundle, el('historyHotel').value, el('historyMode').value); el('currentCapture').value = ''; window.dispatchEvent(new CustomEvent('capasuite-data-synced')); await refresh(); status('Copia recuperada.');
        } finally { el('backupFile').value = ''; }
    });
    window.addEventListener('capasuite-data-synced', () => { if (!busy) operation(refresh); });
    window.addEventListener('hotel-changed', event => { el('historyHotel').value = event.detail; if (!busy) operation(refresh); });
    window.addEventListener('load', () => operation(async () => {
        await window.CapaNavReady;
        el('historyHotel').value = window.CapaState?.activeHotel || 'Guadiana'; await refresh();
    }));
})();
