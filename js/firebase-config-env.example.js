
// Ejemplo de configuración de Firebase para CapaSuite
// Copia este archivo a 'firebase-config-env.js' y rellena tus datos
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    databaseURL: "TU_DATABASE_URL",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Exportar para que firebase-auth.js lo use
window.capasuite_firebase_config = firebaseConfig;
