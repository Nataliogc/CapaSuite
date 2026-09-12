/* Shared import review. Edits affect the pending import, never the source workbook. */
(function () {
    let active = false;
    window.SegmentReview = {
        async read(rows, fileName, period) {
            if (active) throw new Error('Termina primero la revisión de segmentos abierta.');
            let initial;
            try { return SegmentAnalysis.parse(rows, fileName, period); }
            catch (error) { if (error.code !== 'SEGMENT_REVIEW') throw error; initial = error; }
            active = true;
            return new Promise(resolve => {
                const dialog = document.createElement('dialog');
                dialog.setAttribute('aria-labelledby', 'segment-review-title');
                dialog.style.cssText = 'width:min(950px,94vw);max-height:90vh;box-sizing:border-box;overflow:auto;border:2px solid #6366f1;border-radius:16px;padding:24px;background:var(--bg-surface,#fff);color:var(--text-main,#172033);font:14px Arial,sans-serif';
                const title = document.createElement('h2'); title.id = 'segment-review-title'; title.textContent = 'Revisar y corregir segmentos';
                const description = document.createElement('p');
                description.textContent = `${fileName}. Hay ${initial.issues.length} errores. El segmento debe figurar a la izquierda de cada Hab. Corrige cada bloque antes de guardar.`;
                const note = document.createElement('p');
                note.textContent = 'La corrección se aplica al bloque completo (Hab, Pax, Pro y servicios) y a todos sus años. El Excel original no se modifica. Selecciona «Total general» únicamente para el resumen final; se comprobará que cuadre.';
                const form = document.createElement('form');
                const inputs = [];
                for (const block of initial.blocks) {
                    const item = document.createElement('div');
                    item.style.cssText = `padding:12px;margin:8px 0;border:1px solid ${block.reason ? '#dc2626' : '#94a3b8'};border-radius:8px;display:flex;gap:12px;flex-wrap:wrap;align-items:center`;
                    const label = document.createElement('label');
                    label.htmlFor = 'segment-' + block.cell;
                    label.textContent = `${block.cell} · ${block.original || '(vacía)'}${block.reason ? ' — ' + block.reason : ''}`;
                    label.style.cssText = 'flex:1;min-width:180px;line-height:1.5';
                    const select = document.createElement('select'); select.id = label.htmlFor; select.required = true;
                    select.style.cssText = 'padding:10px;max-width:100%;background:var(--bg-surface,#fff);color:inherit;border:1px solid #94a3b8;border-radius:6px';
                    for (const [value, text] of [['', 'Selecciona el segmento correcto'], ...SegmentAnalysis.validSegments.map(s => [s, s]), ['TOTAL GENERAL', 'Total general (resumen, no segmento)']]) {
                        const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
                    }
                    select.value = block.reason ? '' : (SegmentAnalysis.validSegments.includes(block.name) ? block.name : 'TOTAL GENERAL');
                    inputs.push([block.cell, select]); item.append(label, select); form.append(item);
                }
                const status = document.createElement('p'); status.setAttribute('role', 'alert'); status.style.color = '#dc2626';
                const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Aplicar correcciones e importar'; save.style.cssText = 'padding:12px;background:#4f46e5;color:white;border:0;border-radius:8px;cursor:pointer';
                const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar importación'; cancel.style.cssText = 'padding:12px;margin:8px;cursor:pointer';
                const close = result => { active = false; dialog.close(); dialog.remove(); resolve(result); };
                cancel.onclick = () => close(null);
                dialog.addEventListener('cancel', event => { event.preventDefault(); close(null); });
                form.onsubmit = event => {
                    event.preventDefault();
                    try { close(SegmentAnalysis.parse(rows, fileName, period, Object.fromEntries(inputs.map(([cell, input]) => [cell, input.value])))); }
                    catch (error) { status.textContent = error.message; }
                };
                form.append(status, save, cancel); dialog.append(title, description, note, form); document.body.append(dialog); dialog.showModal();
                inputs.find(([, input]) => !input.value)?.[1].focus();
            });
        }
    };
})();
