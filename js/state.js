/**
 * CapaSuite Global State Manager (Fase 1 Refactor)
 * Centraliza el estado para evitar duplicidad y lecturas directas indiscriminadas
 */

(function () {
    'use strict';

    window.CapaState = {
        hotel: null, // "Guadiana" o "Cumbria"
        data: {},    // Producción por hotel: { guadiana: {...}, cumbria: {...} }
        competencia: {}, // Datos de mercado
        history: {}, // Snapshots y pick-up
        
        // Setter controlado
        setHotel: function(hotelId) {
            this.hotel = hotelId;
        },
        
        setHotelData: function(hotelId, moduleName, payload) {
            if (!this.data[hotelId]) this.data[hotelId] = {};
            this.data[hotelId][moduleName] = payload;
        },
        
        getHotelData: function(hotelId, moduleName) {
            return this.data[hotelId] ? this.data[hotelId][moduleName] : null;
        }
    };
})();
