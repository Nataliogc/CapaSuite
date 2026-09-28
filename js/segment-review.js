/* Shared import review. Edits affect the pending import, never the source workbook. */
(function () {
    let active = false;
    window.SegmentReview = {
        async read(rows, fileName, period, forceType, hotel) {
            if (active) throw new Error('Termina primero la revisión de segmentos abierta.');
            const detectedHotel = hotel || (String(fileName || '').toLowerCase().includes('cumbria') ? 'Cumbria' : 'Guadiana');
            const isForecast = forceType ? (forceType === 'forecast' || forceType === 'Otb' || forceType === 'Prevision') : (fileName.toLowerCase().includes('prevision') || fileName.toLowerCase().includes('otb') || fileName.toLowerCase().includes('valorada'));
            
            const blocks = SegmentAnalysis.reviewRows(rows, {}, detectedHotel);
            if (!blocks.length) {
                if (isForecast) {
                    throw new Error('No se detectó estructura de segmentos en el archivo de previsión.');
                }
                throw new Error('El informe no contiene bloques de segmentos con fila de habitaciones.');
            }
            const issues = blocks.filter(b => b.reason);
            
            active = true;
            return new Promise(resolve => {
                const dialog = document.createElement('dialog');
                dialog.setAttribute('aria-labelledby', 'segment-review-title');
                dialog.style.cssText = 'width:min(960px,95vw);max-height:90vh;box-sizing:border-box;overflow:auto;border:2px solid #6366f1;border-radius:18px;padding:26px;background:var(--bg-surface,#ffffff);color:var(--text-main,#1e293b);font:14px "Inter",system-ui,sans-serif;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);z-index:999999;';
                
                const topBar = document.createElement('div');
                topBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px';
                
                const hotelBadge = document.createElement('div');
                hotelBadge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.12);color:#4f46e5;padding:6px 14px;border-radius:20px;font-weight:700;font-size:0.85rem;border:1px solid rgba(99,102,241,0.3)';
                hotelBadge.innerHTML = `🏨 Hotel: <strong>${detectedHotel}</strong> · ${isForecast ? 'Previsión OTB' : 'Producción Real'}`;

                const statusBadge = document.createElement('div');
                if (issues.length === 0) {
                    statusBadge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.12);color:#047857;padding:6px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;border:1px solid rgba(16,185,129,0.3)';
                    statusBadge.innerHTML = `✅ ${blocks.length} segmentos reconocidos`;
                } else {
                    statusBadge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.12);color:#b91c1c;padding:6px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;border:1px solid rgba(239,68,68,0.3)';
                    statusBadge.innerHTML = `⚠️ ${issues.length} por validar`;
                }
                topBar.append(hotelBadge, statusBadge);

                const title = document.createElement('h2'); 
                title.id = 'segment-review-title'; 
                title.textContent = 'Revisar y verificar correspondencia de segmentos';
                title.style.cssText = 'margin:0 0 6px 0;font-size:1.35rem;color:var(--text-main,#1e293b);font-weight:700';
                
                const description = document.createElement('p');
                description.style.cssText = 'margin:4px 0 12px 0;color:var(--text-muted,#64748b);font-size:0.9rem';
                description.textContent = `Archivo: ${fileName}. Puedes comprobar y ajustar cómo se asigna cada segmento de este archivo antes de procesarlo.`;
                
                const note = document.createElement('div');
                note.style.cssText = 'background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:10px 14px;color:var(--text-main,#334155);font-size:0.84rem;margin-bottom:18px;line-height:1.4';
                note.innerHTML = `💡 <strong>Memoria por hotel:</strong> Las equivalencias mostradas se guardan para el hotel <strong>${detectedHotel}</strong>. Si modificas algún desplegable, el sistema recordará tu nueva preferencia en los próximos archivos.`;

                const form = document.createElement('form');
                const inputs = [];
                for (const block of blocks) {
                    const hasIssue = Boolean(block.reason);
                    const item = document.createElement('div');
                    item.style.cssText = `padding:12px 16px;margin:8px 0;border:1px solid ${hasIssue ? '#ef4444' : 'rgba(99,102,241,0.25)'};background:${hasIssue ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)'};border-radius:10px;display:flex;gap:14px;flex-wrap:wrap;align-items:center`;
                    
                    const label = document.createElement('label');
                    label.htmlFor = 'segment-' + block.cell;
                    label.innerHTML = `<strong>${block.cell}</strong> · <code>${block.original || '(vacía)'}</code> ${hasIssue ? '<span style="color:#ef4444;font-size:0.8rem;margin-left:8px;">⚠️ ' + block.reason + '</span>' : '<span style="color:#10b981;font-size:0.8rem;margin-left:8px;">✓ Asignado</span>'}`;
                    label.style.cssText = `flex:1;min-width:200px;line-height:1.5;color:var(--text-main,#1e293b);`;
                    
                    const select = document.createElement('select'); 
                    select.id = label.htmlFor; 
                    select.required = true;
                    select.style.cssText = 'padding:10px 14px;max-width:100%;min-width:220px;background:var(--bg-surface,#fff);color:inherit;border:1px solid #94a3b8;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.9rem';
                    
                    for (const [value, text] of [['', 'Selecciona el segmento correcto'], ...SegmentAnalysis.validSegments.map(s => [s, s]), ['TOTAL GENERAL', 'Total general (resumen, no segmento)']]) {
                        const option = document.createElement('option'); 
                        option.value = value; 
                        option.textContent = text; 
                        select.append(option);
                    }
                    
                    select.value = hasIssue ? '' : (SegmentAnalysis.validSegments.includes(block.name) ? block.name : 'TOTAL GENERAL');
                    inputs.push([block.cell, select, block.original]); 
                    item.append(label, select); 
                    form.append(item);
                }
                
                const status = document.createElement('p'); 
                status.setAttribute('role', 'alert'); 
                status.style.color = '#ef4444';
                status.style.fontWeight = '600';
                
                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display:flex;gap:12px;align-items:center;margin-top:24px;position:sticky;bottom:0;background:var(--bg-surface,#fff);padding-top:10px';

                const save = document.createElement('button'); 
                save.type = 'submit'; 
                save.textContent = issues.length > 0 ? 'Guardar correcciones e importar' : 'Confirmar e Importar'; 
                save.style.cssText = 'padding:12px 26px;background:#4f46e5;color:white;border:0;border-radius:8px;font-weight:700;font-size:0.95rem;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,0.35);transition:all 0.2s ease';
                
                const cancel = document.createElement('button'); 
                cancel.type = 'button'; 
                cancel.textContent = 'Cancelar'; 
                cancel.style.cssText = 'padding:12px 20px;background:transparent;border:1px solid #94a3b8;color:inherit;border-radius:8px;cursor:pointer;font-size:0.9rem';
                
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
                            showToast(`Segmentos importados correctamente para ${detectedHotel}`, 'success');
                        }
                        close(parsedReport); 
                    }
                    catch (error) { status.textContent = error.message; }
                };
                
                btnContainer.append(save, cancel);
                form.append(status, btnContainer); 
                dialog.append(topBar, title, description, note, form); 
                document.body.append(dialog); 
                dialog.showModal();
                inputs.find(([, input]) => !input.value)?.[1].focus();
            });
        }
    };
})();
