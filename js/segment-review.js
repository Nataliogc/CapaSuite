/* Shared import review. Edits affect the pending import, never the source workbook. */
(function () {
    let active = false;
    window.SegmentReview = {
        async read(rows, fileName, period, forceType, hotel) {
            if (active) throw new Error('Termina primero la revisión de segmentos abierta.');
            const detectedHotel = hotel || (String(fileName || '').toLowerCase().includes('cumbria') ? 'Cumbria' : 'Guadiana');
            let initial;
            const isForecast = forceType ? (forceType === 'forecast' || forceType === 'Otb' || forceType === 'Prevision') : (fileName.toLowerCase().includes('prevision') || fileName.toLowerCase().includes('otb') || fileName.toLowerCase().includes('valorada'));
            try { 
                return isForecast 
                    ? SegmentAnalysis.parseForecast(rows, fileName, {}, period, detectedHotel)
                    : SegmentAnalysis.parse(rows, fileName, period, {}, detectedHotel); 
            }
            catch (error) { 
                if (error.code !== 'SEGMENT_REVIEW') throw error; 
                initial = error; 
            }
            active = true;
            return new Promise(resolve => {
                const dialog = document.createElement('dialog');
                dialog.setAttribute('aria-labelledby', 'segment-review-title');
                dialog.style.cssText = 'width:min(950px,94vw);max-height:90vh;box-sizing:border-box;overflow:auto;border:2px solid #6366f1;border-radius:16px;padding:26px;background:var(--bg-surface,#fff);color:var(--text-main,#172033);font:14px "Inter",Arial,sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.35)';
                
                const hotelBadge = document.createElement('div');
                hotelBadge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.12);color:#6366f1;padding:5px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;margin-bottom:12px;border:1px solid rgba(99,102,241,0.3)';
                hotelBadge.innerHTML = `🏨 Hotel: <strong>${detectedHotel}</strong>`;

                const title = document.createElement('h2'); 
                title.id = 'segment-review-title'; 
                title.textContent = 'Revisar y corregir segmentos';
                title.style.cssText = 'margin:0 0 6px 0;font-size:1.35rem;color:var(--text-main,#1e293b);font-weight:700';
                
                const description = document.createElement('p');
                description.style.cssText = 'margin:4px 0 10px 0;color:var(--text-muted,#64748b);font-size:0.9rem';
                description.textContent = `${fileName}. Hay ${initial.issues?.length || 0} segmentos por verificar. El segmento debe figurar a la izquierda de cada Hab.`;
                
                const note = document.createElement('div');
                note.style.cssText = 'background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:10px 14px;color:#047857;font-size:0.84rem;margin-bottom:16px;line-height:1.4';
                note.innerHTML = `💡 <strong>Memoria por hotel:</strong> Las correcciones que selecciones se guardarán automáticamente para el hotel <strong>${detectedHotel}</strong> y se aplicarán en futuras importaciones sin tener que volver a corregirlas.`;

                const form = document.createElement('form');
                const inputs = [];
                for (const block of initial.blocks) {
                    const item = document.createElement('div');
                    item.style.cssText = `padding:12px;margin:8px 0;border:1px solid ${block.reason ? '#dc2626' : '#94a3b8'};border-radius:8px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;background:var(--bg-surface,#fff)`;
                    const label = document.createElement('label');
                    label.htmlFor = 'segment-' + block.cell;
                    label.textContent = `${block.cell} · ${block.original || '(vacía)'}${block.reason ? ' — ' + block.reason : ''}`;
                    label.style.cssText = `flex:1;min-width:180px;line-height:1.5;font-weight:${block.reason ? '700' : '500'};color:${block.reason ? '#dc2626' : 'inherit'}`;
                    const select = document.createElement('select'); 
                    select.id = label.htmlFor; 
                    select.required = true;
                    select.style.cssText = 'padding:10px;max-width:100%;background:var(--bg-surface,#fff);color:inherit;border:1px solid #94a3b8;border-radius:6px;cursor:pointer;font-weight:600';
                    for (const [value, text] of [['', 'Selecciona el segmento correcto'], ...SegmentAnalysis.validSegments.map(s => [s, s]), ['TOTAL GENERAL', 'Total general (resumen, no segmento)']]) {
                        const option = document.createElement('option'); 
                        option.value = value; 
                        option.textContent = text; 
                        select.append(option);
                    }
                    select.value = block.reason ? '' : (SegmentAnalysis.validSegments.includes(block.name) ? block.name : 'TOTAL GENERAL');
                    inputs.push([block.cell, select, block.original]); 
                    item.append(label, select); 
                    form.append(item);
                }
                const status = document.createElement('p'); 
                status.setAttribute('role', 'alert'); 
                status.style.color = '#dc2626';
                
                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display:flex;gap:12px;align-items:center;margin-top:20px';

                const save = document.createElement('button'); 
                save.type = 'submit'; 
                save.textContent = 'Guardar correcciones e importar'; 
                save.style.cssText = 'padding:12px 24px;background:#4f46e5;color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
                
                const cancel = document.createElement('button'); 
                cancel.type = 'button'; 
                cancel.textContent = 'Cancelar importación'; 
                cancel.style.cssText = 'padding:12px 20px;background:transparent;border:1px solid #94a3b8;color:inherit;border-radius:8px;cursor:pointer';
                
                const close = result => { active = false; dialog.close(); dialog.remove(); resolve(result); };
                cancel.onclick = () => close(null);
                dialog.addEventListener('cancel', event => { event.preventDefault(); close(null); });
                form.onsubmit = event => {
                    event.preventDefault();
                    try { 
                        const correctionsMap = Object.fromEntries(inputs.map(([cell, input]) => [cell, input.value]));
                        
                        // Guardar asignaciones aprendidas para el hotel
                        const newHotelMappings = {};
                        inputs.forEach(([cell, input, original]) => {
                            if (input.value && input.value !== 'TOTAL GENERAL') {
                                if (original && original.trim()) {
                                    const normOrig = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.]/g, '').trim();
                                    newHotelMappings[normOrig] = input.value;
                                }
                                newHotelMappings[cell] = input.value;
                            }
                        });
                        SegmentAnalysis.saveHotelMappings(detectedHotel, newHotelMappings);

                        const parsedReport = isForecast 
                            ? SegmentAnalysis.parseForecast(rows, fileName, correctionsMap, period, detectedHotel)
                            : SegmentAnalysis.parse(rows, fileName, period, correctionsMap, detectedHotel);
                        
                        if (typeof showToast === 'function') {
                            showToast(`Correcciones de segmento guardadas para ${detectedHotel}`, 'success');
                        }
                        close(parsedReport); 
                    }
                    catch (error) { status.textContent = error.message; }
                };
                btnContainer.append(save, cancel);
                form.append(status, btnContainer); 
                dialog.append(hotelBadge, title, description, note, form); 
                document.body.append(dialog); 
                dialog.showModal();
                inputs.find(([, input]) => !input.value)?.[1].focus();
            });
        }
    };
})();
