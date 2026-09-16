// Shared category rules for production and segment detail.
        const PRODUCTION_GROUPS = {
            "HABITACION": { name: "1. Habitación", keys: ["HABITACIÓN", "HABITACION", "ALOJAMIENTO", "ESTANCIA", "DUI", "DOBLE", "SUPERIOR", "SUITE", "CUADRUPLE", "TRIPLE", "FAMILIAR", "LATE CHECK OUT", "AMPLIACION", "CAMA SUPLETORIA", "REGARGO GDS", "HABITACIÓ"] },
            "DESAYUNOS": { name: "2. Desayunos", keys: ["DESAYUNO BUFFET", "DESAYUNO GRUPO", "DESAYUNO", "BUFFET"] },
            "RESTAURANTE": { name: "3. Restaurante", keys: ["RESTAURANTE", "CENA", "ALMUERZO", "CENA GRUPO", "ALMUERZO GRUPO", "CATERING", "RESTAURANTE CATERING"] },
            "OFICINAS": { name: "9. Alquileres", keys: ["ALQUILER RETENCIONES", "OFICINA", "RETENCIONES", "FIANZA", "DOMICILIACION EMPRESAS", "LIMPIEZA"] },
            "EVENTOS": { name: "4. Eventos", keys: ["COFFEE BREAK", "SALONES/ALQUILER", "AUDIOVISUALES", "SALON", "ALQUILER", "EVENTO"] },
            "CAFETERIA": { name: "5. Cafetería", keys: ["CAFETERÍA", "CAFETERIA", "BAR"] },
            "MINIBAR": { name: "6. Minibar", keys: ["MINIBAR"] },
            "SPA": { name: "7. Spa", keys: ["SPA", "BALNEARIO", "MASAJE", "TRATAMIENTO"] },
            "VARIOS": { name: "10. Varios", keys: ["LAVANDERÍA", "ARTESANÍA", "FAX", "TELÉFONO", "VARIOS", "LAVANDERIA", "ARTESANIA", "TELEFONO", "SUPLEMENTO", "MASCOTA", "CUNA", "UPGRADE", "MENSAJERIA", "GARAJE", "PARKING", "ALQUILER PLAZAS GARAJE"] }
        };
        function normalizeStr(str) { return String(str || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }

        function getGroupID(name) {
            const norm = normalizeStr(name);
            // Omisiones de totales maestros
            if (norm === "PRODUCCION TOTAL" || norm === "TOTAL PRODUCCION" || norm === "TOTAL MASTER" || norm === "TOTAL") return "OMIT";

            // Si la fila es una métrica pura (HAB, PAX, PRO), la marcamos para el procesador
            if (norm === "HAB" || norm === "RMS" || norm === "RN") return "METRIC_RMS";
            if (norm === "PAX" || norm === "PERS" || norm === "PERSONAS") return "METRIC_PAX";
            if (norm === "PRO" || norm === "REV" || norm === "PROD" || norm === "VTA") return "METRIC_REV";

            const eventKeywords = ["COFFEE", "SALA", "SALON", "EVENTO", "ALQUILER", "AUDIOVISUAL", "OFICINA"];
            for (const [id, g] of Object.entries(PRODUCTION_GROUPS)) {
                if (id === "RESTAURANTE" && eventKeywords.some(k => norm.includes(k))) continue;
                if (g.keys.some(k => norm.includes(normalizeStr(k)))) return id;
            }
            return "VARIOS";
        }
