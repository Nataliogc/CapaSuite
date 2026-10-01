/**
 * CapaSuite Global State Manager
 * Centraliza el estado de la aplicación.
 * Todos los módulos deben leer/escribir el hotel activo a través de aquí.
 */

(function () {
    'use strict';

    window.CapaState = {
        // Hotel activo: "Guadiana" | "Cumbria"
        hotel: null,

        // Datos por hotel y módulo: { guadiana: { produccion: {...}, segmentos: {...} }, ... }
        data: {},

        // Datos de mercado / competencia
        competencia: {},

        // Snapshots pick-up
        history: {},

        // ── Hotel ──────────────────────────────────────────────────
        get activeHotel() {
            if (!this.hotel) {
                try { this.hotel = localStorage.getItem('active_hotel_suite') || 'Guadiana'; } catch (e) { this.hotel = 'Guadiana'; }
            }
            return this.hotel;
        },

        setActiveHotel: function (hotel) {
            if (!['Guadiana', 'Cumbria'].includes(hotel)) return;
            this.hotel = hotel;
            try { localStorage.setItem('active_hotel_suite', hotel); } catch (e) { }

            // Sincronizar el selector del nav si ya está en el DOM
            const sel = document.getElementById('hotelSelectorNav')
                     || document.getElementById('hotelSelector');
            if (sel) sel.value = hotel;

            // Notificar a todos los módulos que escuchen
            window.dispatchEvent(new CustomEvent('hotel-changed', { detail: hotel }));
        },

        // ── Datos por módulo ────────────────────────────────────────
        setHotelData: function (hotelId, moduleName, payload) {
            if (!this.data[hotelId]) this.data[hotelId] = {};
            this.data[hotelId][moduleName] = payload;
        },

        getHotelData: function (hotelId, moduleName) {
            return this.data[hotelId] ? this.data[hotelId][moduleName] : null;
        },

        // ── Helpers ─────────────────────────────────────────────────
        /** Devuelve los datos del hotel activo para un módulo dado */
        current: function (moduleName) {
            return this.getHotelData(this.activeHotel, moduleName);
        },
    };

})();
