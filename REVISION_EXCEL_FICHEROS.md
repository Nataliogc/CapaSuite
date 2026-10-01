# Revisión de los Excel de Ficheros — 1 octubre 2026

Se han leído los ocho archivos de `C:\Users\comun\OneDrive\1.Conm Oficina\Ficheros`. Los originales no se han modificado. La revisión no acredita que coincidan con el PMS: contrasta los archivos entre sí y con los lectores de CapaSuite.

## Qué aporta cada formato

| Formato, por hotel | Contenido observado | Uso actual | ¿Se puede retirar hoy? |
| --- | --- | --- | --- |
| Producción | 30 días de septiembre de 2026; habitaciones, personas, ingresos y conceptos de servicios | Producción diaria, histórico y departamentos | No. La importación segmentada no reemplaza actualmente todas estas salidas. |
| Segmentación Producción | Los mismos días; bloques por segmento y control total por concepto al final | Canales/segmentos y conciliación | No. El general no contiene el reparto por segmento. |
| Previsiones Valoradas | Fechas de estancia de octubre de 2026 a octubre de 2027; habitaciones e ingresos de alojamiento y otros servicios; Cumbria incluye personas | OTB diario y departamentos | No todavía. Hay diferencias y defectos en los segmentados. |
| Segmentación Previsiones | Fechas, habitaciones e ingresos por segmento, servicios y bloque de control total | OTB por segmento y pick-up | No. El general no contiene el reparto por segmento. |

## Hallazgos

- Producción de Guadiana: los 30 días coinciden en habitaciones (2.210), personas (3.821) e ingresos totales (201.273,57 €).
- Producción de Cumbria: los 30 días coinciden en habitaciones (1.356), personas (2.304) e ingresos totales (143.087,79 €).
- Los controles finales de los informes segmentados contienen los conceptos del informe general de producción. Permiten diseñar una importación conjunta, pero no justifican eliminar el general del flujo actual.
- Se contrastaron además 750 valores diarios de conceptos de servicio por hotel con esos controles: todos coinciden exactamente.
- Las cuatro exportaciones segmentadas contienen bloques de habitaciones con el nombre del segmento vacío, incluido el control final. CapaSuite exige revisión; no debe asignar un nombre ni sumar el control como otro segmento.
- Las dos previsiones segmentadas tienen referencias XML de celda no válidas: 102 en Guadiana y 49 en Cumbria, por ejemplo `B@3`. El lector puede omitir esas columnas. Se bloquea ahora la importación y se pide volver a exportar desde el PMS.
- Solo hay 352 encabezados de fecha interpretables compartidos para contrastar las previsiones; no equivalen a comprobar el periodo completo.
- En Guadiana, en esas fechas compartidas, hay cuatro discrepancias de habitaciones: 01/10 (1 en general, 83 en segmentos), 18/11 (95 y 0), 20/11 (0 y 95), 25/04 (0 y 60). También difieren los ingresos. No se puede determinar qué versión es correcta solo con estos archivos.
- En Cumbria, las habitaciones y personas coinciden en las 352 fechas comparables; las diferencias diarias de ingresos revisadas no superan 0,05 €. Esto no valida las columnas con referencias inválidas.
- El reconocimiento por nombre no contemplaba correctamente «Segmentacion»: se buscaba «SEGMENTO». Se corrige para que estos archivos lleguen al lector de segmentos y no al lector general.

## Recomendación

Mantener los ocho informes por ahora. Volver a exportar las previsiones segmentadas, identificar los bloques sin nombre y conciliar las cuatro fechas de Guadiana en el PMS. No borrar archivos.

Después puede desarrollarse una importación conjunta desde los dos informes segmentados por hotel: separar el control total de los segmentos, comprobar reconciliación y alimentar producción/OTB diario, servicios y segmentos en una sola operación. Solo entonces se podría pasar de ocho archivos a cuatro, condicionado a que cada futura exportación contenga y concilie todo el detalle requerido. Los informes generales serían controles opcionales, no una fuente que se sume a los segmentos.

## Protección de versiones implementada

- Comprobación del archivo y de los valores de todas las hojas, por cuenta y hotel.
- Los mismos bytes o los mismos valores ya registrados en una carga completada bloquean la nueva importación antes de crear copias o modificar datos.
- El mismo nombre con contenido diferente se presenta como versión distinta. Una carga fallida puede reintentarse.
- Se vuelve a comprobar al confirmar la importación, en Cargar Datos y Segmentos.
- Cambiar solo el nombre, la fecha de modificación o el formato no acredita una nueva versión.
- Los registros antiguos sin huella verificable no permiten demostrar un duplicado retrospectivamente. La primera carga verificada establecerá la referencia para las siguientes.
- El histórico sigue siendo local al navegador y cuenta. Cambiar de equipo requiere recuperar su copia completa para conservar esta comprobación.

La huella de valores compara el contenido leído del libro, no garantiza que dos informes con distinta estructura representen las mismas reservas. La conciliación entre formatos es una comprobación diferente.

## Verificación de la protección

90 pruebas automatizadas correctas. En un navegador local aislado y sin sesión de nube se importó el general de producción de Guadiana y se bloqueó su segunda selección; las cifras se mantuvieron. También se comprobó el bloqueo de la previsión segmentada con referencias inválidas. No se publicaron cambios ni se sobrescribieron los Excel originales.
