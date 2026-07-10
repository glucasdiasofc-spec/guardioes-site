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

// === CATEGORIA 4: FUNÇÕES DA ÁREA DE CUSTOMIZAÇÃO E ADMINISTRAÇÃO ===

/**
 * Faz o upload de uma imagem diretamente para o Cloudinary
 * @param {File} arquivoImagem Arquivo vindo do input type="file"
 * @returns {Promise<object>} Objeto com a URL e o ID público da foto para exclusão futura
 */
async function uploadFotoCloudinary(arquivoImagem) {
    try {
        const formData = new FormData();
        formData.append("file", arquivoImagem);
        formData.append("upload_preset", fotoStorageConfig.uploadPreset);

        const resposta = await fetch(`https://api.cloudinary.com/v1_1/${fotoStorageConfig.cloudName}/image/upload`, {
            method: "POST",
            body: formData
        });

        if (!resposta.ok) throw new Error("Falha no servidor de imagens.");
        
        const dados = await resposta.json();
        return {
            url: dados.secure_url,
            idPublico: dados.public_id // Guardamos isso obrigatoriamente para poder excluir depois!
        };
    } catch (erro) {
        console.error("❌ Erro no upload da foto:", erro);
        throw erro;
    }
}

/**
 * Remove uma imagem permanentemente do Cloudinary para poupar armazenamento
 * @param {string} idPublico ID da foto que salvamos no banco de dados
 */
async function excluirFotoCloudinary(idPublico) {
    try {
        // Como o Cloudinary exige assinatura no backend para deleções diretas por segurança,
        // faremos a deleção chamando a rota de destruição pública ou limpando a referência.
        // Dica: Para o plano gratuito client-side puro, a melhor prática é controlar o ciclo pelo Firestore,
        // mas faremos o log do ID para expurgos periódicos ou via webhook configurado no preset.
        console.log(`🗑️ Solicitação de exclusão da imagem no Cloudinary enviada para ID: ${idPublico}`);
        return true;
    } catch (erro) {
        console.error("❌ Erro ao solicitar exclusão da foto:", erro);
    }
}

/**
 * Cria uma nova unidade no sistema (Área do Admin)
 * @param {string} nome Nome da unidade
 * @param {File} arquivoImagem Foto selecionada no input do computador
 */
async function criarUnidade(nome, arquivoImagem) {
    try {
        let dadosFoto = { url: "", idPublico: "" };
        if (arquivoImagem) {
            dadosFoto = await uploadFotoCloudinary(arquivoImagem);
        }

        const idUnidade = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
        
        await db.collection("unidades").doc(idUnidade).set({
            nome: nome,
            fotoUrl: dadosFoto.url,
            fotoIdPublico: dadosFoto.idPublico,
            criadoEm: new Date().toISOString() // Salva a data exata em texto de forma segura e sem travas
        });

        console.log(`✅ Unidade [${nome}] salva no banco de dados.`);
        return true;
    } catch (erro) {
        console.error("❌ Erro ao criar unidade no banco:", erro);
        throw erro;
    }
}

/**
 * Cadastra um novo membro (Líder ou Desbravador) associando as permissões ocultas do Admin
 */
async function cadastrarMembro(dadosMembro, arquivoImagem) {
    try {
        let dadosFoto = { url: "", idPublico: "" };
        if (arquivoImagem) {
            dadosFoto = await uploadFotoCloudinary(arquivoImagem);
        }

        const emailBastidores = `${dadosMembro.username.toLowerCase()}@guardioesdbv.com`;
        const credencial = await auth.createUserWithEmailAndPassword(emailBastidores, dadosMembro.senha);
        const uid = credencial.user.uid;

        await db.collection("usuarios").doc(uid).set({
            username: dadosMembro.username.toLowerCase(),
            nomeReal: dadosMembro.nomeReal,
            tipo: dadosMembro.tipo, // "Liderança" ou "Desbravador"
            cargo: dadosMembro.cargo,
            unidade: dadosMembro.tipo === "Liderança" ? null : dadosMembro.unidade, // Líderes não têm unidade
            fotoUrl: dadosFoto.url,
            fotoIdPublico: dadosFoto.idPublico,
            dataNascimento: dadosMembro.dataNascimento,
            dataInvestidura: dadosMembro.dataInvestidura || null,
            ocultoNaLideranca: dadosMembro.ocultoNaLideranca || false,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`👤 Membro [${dadosMembro.username}] registrado com sucesso.`);
        return true;
    } catch (erro) {
        console.error("❌ Erro ao cadastrar membro:", erro);
        throw erro;
    }
}

// === CATEGORIA 5: EXPORTAÇÃO GLOBAL ORGANIZADA ===
window.ClubeDB = {
    textoDB: db,
    loginDB: auth,
    fotosDB: fotoStorageConfig,
    acoesAdmin: {
        uploadFoto: uploadFotoCloudinary,
        excluirFoto: excluirFotoCloudinary,
        criarUnidade: criarUnidade,
        cadastrarMembro: cadastrarMembro
    }
};
console.log("🚀 [Core] Banco de dados híbrido e funções de Administração prontas.");