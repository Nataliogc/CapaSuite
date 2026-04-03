
        function openChartModal() {
            document.getElementById('chartModal').style.display = 'block';

            // Sync Options & Value from Main Selector
            const mainSel = document.getElementById('monthSelector');
            const modalSel = document.getElementById('modalMonthSelect');
            if (mainSel && modalSel) {
                modalSel.innerHTML = mainSel.innerHTML;
                modalSel.value = mainSel.value;
            }

            if (chartInstance) chartInstance.resize();
        }

        function filterChartFromModal() {
            const val = document.getElementById('modalMonthSelect').value;
            const mainSel = document.getElementById('monthSelector');
            if (mainSel) {
                mainSel.value = val;
                renderAll(); // Updates Table & Chart
            }
        }
        function closeChartModal() {
            document.getElementById('chartModal').style.display = 'none';
        }
        // Close on click outside
        window.onclick = function (event) {
            const m = document.getElementById('chartModal');
            if (event.target == m) {
                m.style.display = "none";
            }
            // Keep existing modal logic if any (like the previous budget modal)
            const m2 = document.getElementById('realDataModal'); // Example if mixed context
            if (m2 && event.target == m2) m2.style.display = "none";
        }

        function diagnoseAllData() {
            const pDbRaw = CapaStorage.getItem('hotel_manager_db_v2');
            const data = processedData;
            console.log("🔍 DIAGNÓSTICO DE DATOS INICIADO");
            
            if (!pDbRaw) {
                alert("❌ No hay base de datos de producción (hotel_manager_db_v2) en este navegador.");
                return;
            }
            
            const pDb = (typeof pDbRaw === 'string') ? JSON.parse(pDbRaw) : pDbRaw;
            const dbKeys = Object.keys(pDb);
            const activeClean = activeHotel.toLowerCase().replace(/hotel|sercotel|villa|spa|resort/g, '').replace(/\s+/g, ' ').trim();
            const dbActiveKey = dbKeys.find(k => k.toLowerCase().includes(activeClean) || activeClean.includes(k.toLowerCase()));

            let report = `REPORTE DE DIAGNÓSTICO:\n`;
            report += `- Hotel Activo (UI): ${activeHotel}\n`;
            report += `- Limpieza para búsqueda: "${activeClean}"\n`;
            report += `- Clave encontrada en DB: ${dbActiveKey || 'NINGUNA'}\n`;
            report += `- Total Hoteles en DB: ${dbKeys.length} (${dbKeys.join(', ')})\n`;
            
            if (dbActiveKey && pDb[dbActiveKey]) {
                const years = Object.keys(pDb[dbActiveKey]).filter(y => y.match(/^\d{4}$/));
                report += `- Años con datos en DB: ${years.join(', ') || 'NINGUNO'}\n`;
                
                const sampleDay = data && data.length > 0 ? data[0].dateISO : 'N/A';
                report += `- Buscando día de ejemplo: ${sampleDay}\n`;
                
                if (sampleDay !== 'N/A') {
                    const yr = sampleDay.split('-')[0];
                    const otb = pDb[dbActiveKey][yr]?.daily_otb?.[sampleDay];
                    const prod = pDb[dbActiveKey][yr]?.daily?.[sampleDay];
                    report += `- Datos hallados en ese día: ${otb ? 'SI (Previsión)' : 'NO (Previsión)'}, ${prod ? 'SI (Producción)' : 'NO (Producción)'}\n`;
                }
            } else {
                report += `\n⚠️ NO SE HA ENCONTRADO EL HOTEL "${activeHotel}" EN LA BASE DE DATOS.\nPrueba a cargar de nuevo los Excel de Previsiones o Producción.`;
            }
            
            console.log(report);
            if (dbActiveKey) console.log("Contenido DB para activeHotel:", pDb[dbActiveKey]);
            alert(report + "\n\n(Previsión = Datos futuros / Producción = Datos reales pasados)\n\nRevisa la CONSOLA (F12) para más detalles técnicos.");
        }
    