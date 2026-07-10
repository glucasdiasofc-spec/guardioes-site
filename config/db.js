// =================================================================
// ARQUIVO: src/config/db.js
// CORE: Conexão Híbrida (Firebase para Dados + Cloudinary para Fotos)
// =================================================================

// --- CATEGORIA 1: CREDENCIAIS DO FIREBASE (Textos e Membros) ---
const firebaseConfig = {
    apiKey: "AIzaSyClBlFwrHzom9tFIIuo3eORTn5xqy3wSKY",
    authDomain: "guardioesdbv-firebase.firebaseapp.com",
    projectId: "guardioesdbv-firebase",
    storageBucket: "guardioesdbv-firebase.firebasestorage.app",
    messagingSenderId: "362596177413",
    appId: "1:362596177413:web:8088eb72dc554c788a6e6c"
};

// --- CATEGORIA 2: CREDENCIAIS DO CLOUDINARY (Fotos - Plano Free) ---
const fotoStorageConfig = {
    cloudName: "dkozbm1ik",
    uploadPreset: "fotos-clube-new-site"
};

// --- CATEGORIA 3: INICIALIZAÇÃO DOS SERVIÇOS ---
let db = null;
let auth = null;

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();      // Banco de dados de texto
    auth = firebase.auth();        // Sistema de login de membros
    console.log("📊 [Core DB] Firebase Firestore e Auth inicializados.");
} else {
    console.warn("⚠️ [Aviso] Scripts do Firebase ainda não carregados.");
}

// --- CATEGORIA 4: EXPORTAÇÃO GLOBAL ORGANIZADA ---
window.ClubeDB = {
    textoDB: db,
    loginDB: auth,
    fotosDB: fotoStorageConfig
};
console.log("🚀 [Core] Banco de dados híbrido pronto para uso.");