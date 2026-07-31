/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

const VERSAO_ATUAL = "v0.72.0 - versão alpha";

// Função de compatibilidade global para resolver o erro de processamento de aprovação
function carregarPendenciasAprovacaoAdmin() {
    if (typeof carregarAprovacoesSite === 'function') {
        carregarAprovacoesSite();
    }
}

// Executa assim que a página termina de carregar no navegador
document.addEventListener("DOMContentLoaded", () => {
    const rodape = document.getElementById("versao-app-texto");
    if (rodape) {
        rodape.textContent = VERSAO_ATUAL;
    }
    
    // Carrega a logo personalizada do site
    carregarLogoClubeConfig();
    
    const loginSalvo = localStorage.getItem("sessaoAdminLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    if (loginSalvo === "true") {
        document.getElementById("tela-login").style.display = "none";
        
        if (tipoUsuario === "admin") {
            document.getElementById("tela-admin").style.display = "flex";
            carregarUnidadesCadastradas(); 
            carregarMembrosCadastrados();
            // carregarPendenciasAprovacaoAdmin(); // Agora carregado na aba de especialidades do site
        } else {

            irParaSite();
        }
    }
});

// Executa o login do administrador
async function executarLoginMembro() {    
    const usuarioInput = document.getElementById("login-username").value.trim();
    const senhaInput = document.getElementById("login-senha").value;
    const erroDisplay = document.getElementById("erro-login");

    if (erroDisplay) erroDisplay.textContent = "Validando...";

    // 1. Acesso do Admin
    if (usuarioInput === "admin" && senhaInput === "Alcopoes1") {
        localStorage.setItem("sessaoAdminLogado", "true");
        localStorage.setItem("usuarioLogado", "admin");
        localStorage.setItem("usernameLogado", "admin");
        
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";

        carregarUnidadesCadastradas();
        carregarMembrosCadastrados();
        if (typeof carregarAprovacoesSite === 'function') carregarAprovacoesSite();
        return;
    }

    // 2. Acesso via Firebase Auth para membros comuns
    try {
        const emailFirebase = `${usuarioInput.toLowerCase()}@guardioesdbv.com`;
        await window.ClubeDB.loginDB.signInWithEmailAndPassword(emailFirebase, senhaInput);
        
        localStorage.setItem("sessaoAdminLogado", "true");
        localStorage.setItem("usuarioLogado", "membro");
        localStorage.setItem("usernameLogado", usuarioInput.toLowerCase());
        
        document.getElementById("tela-login").style.display = "none";
        
        // Membros comuns vão direto para o site!
        irParaSite();
        
    } catch (erro) {
        console.error("Erro de login:", erro);
        if (erroDisplay) erroDisplay.textContent = "Usuário ou senha incorretos.";
    }
}

// Direciona o fluxo para a tela de visualização do site
function irParaSite() {
    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-site").style.display = "flex";
    
    const tipoUsuario = localStorage.getItem("usuarioLogado");
    const btnVoltar = document.getElementById("btn-voltar-painel");
    const btnAdd = document.getElementById("btn-admin-adicionar-item");
    if (tipoUsuario === "admin") {
        if (btnVoltar) btnVoltar.style.display = "inline-block";
        if (btnAdd) btnAdd.style.display = "flex";
    } else {
        if (btnVoltar) btnVoltar.style.display = "none";
        if (btnAdd) btnAdd.style.display = "none";
    }

    
    // Sempre abre na aba do Feed ao entrar
    mudarSubAbaSite('feed');
}

// Retorna para o Painel do Administrador
function irParaPainel() {
    document.getElementById("tela-site").style.display = "none";
    document.getElementById("tela-admin").style.display = "flex";
    
    carregarUnidadesCadastradas();
    carregarMembrosCadastrados();
    if (typeof carregarAprovacoesSite === 'function') carregarAprovacoesSite();
}

// Alterna entre o Feed e o Perfil no App do Usuário
function mudarSubAbaSite(abaAlvo) {
    const feedAba = document.getElementById("sub-aba-feed");
    const perfilAba = document.getElementById("sub-aba-perfil");
    const espAba = document.getElementById("sub-aba-especialidades");
    const msgAba = document.getElementById("sub-aba-mensagens"); // Aba de Chat

    // Elementos dos botões da Navbar
    const btnFeed = document.getElementById("btn-sub-feed");
    const btnEsp = document.getElementById("btn-sub-especialidades");
    const btnMsg = document.getElementById("btn-sub-mensagens");
    const btnPerfil = document.getElementById("btn-sub-perfil");

    // Reseta visibilidade de todas as abas
    if (feedAba) feedAba.style.display = "none";
    if (perfilAba) perfilAba.style.display = "none";
    if (espAba) espAba.style.display = "none";
    if (msgAba) msgAba.style.display = "none";

    // Configura eventos, transições de crescimento e efeito neon dourado
    const configurarBotaoNavbar = (btn, isAtivo) => {
        if (!btn) return;
        btn.style.transition = "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        
        if (isAtivo) {
            btn.style.opacity = "1";
            btn.style.transform = "scale(1.2)";
            btn.style.filter = "drop-shadow(0 0 12px rgba(255, 215, 0, 1))";
        } else {
            btn.style.opacity = "0.5";
            btn.style.transform = "scale(1)";
            btn.style.filter = "none";
        }

        // Efeito Hover (Mouse passar por cima) e Mobile
        btn.onmouseenter = () => {
            if (!isAtivo) {
                btn.style.transform = "scale(1.15)";
                btn.style.filter = "drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))";
            }
        };
        // Remove efeito quando o mouse sai
        btn.onmouseleave = () => {
            if (!isAtivo) {
                btn.style.transform = "scale(1)";
                btn.style.filter = "none";
            }
        };
    };

    // Aplica o comportamento dinâmico aos ícones das abas
    configurarBotaoNavbar(btnFeed, abaAlvo === "feed");
    configurarBotaoNavbar(btnEsp, abaAlvo === "especialidades");
    configurarBotaoNavbar(btnMsg, abaAlvo === "mensagens");
    configurarBotaoNavbar(btnPerfil, abaAlvo === "perfil");

    // Lógica de Animação da Logo do Cabeçalho
    const animarLogoParaEsquerda = (moverParaEsquerda) => {
        const logoImg = document.getElementById("site-logo-img");
        const logoTexto = document.getElementById("site-logo-texto");
        
        [logoImg, logoTexto].forEach(elemento => {
            if (elemento && elemento.style.display !== "none") {
                // Aplica a transição suave
                elemento.style.transition = "transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)";
                
                if (moverParaEsquerda) {
                    // Desloca de forma responsiva usando translate3d para ativar a GPU e evitar "pulos" de renderização
                    elemento.style.transform = "translate3d(-35vw, 0, 0) scale(0.9)";
                } else {
                    // Retorna a logo ao centro exato cravando as coordenadas na placa de vídeo
                    elemento.style.transform = "translate3d(0, 0, 0) scale(1)";
                }
            }
        });
    };

    // Executa a animação dinamicamente com base na aba clicada
    animarLogoParaEsquerda(abaAlvo === "perfil");

    // Mostra a aba selecionada (a opacidade já foi cuidada acima)
    if (abaAlvo === "feed") {
        if (feedAba) feedAba.style.display = "block";
    } else if (abaAlvo === "especialidades") {
        if (espAba) espAba.style.display = "block";
        carregarEspecialidades(); 
        if (typeof carregarAprovacoesSite === 'function') carregarAprovacoesSite(); 
    } else if (abaAlvo === "mensagens") {
        if (msgAba) msgAba.style.display = "flex";
        carregarListaDeContatosChat(); // Inicializa o chat
    } else if (abaAlvo === "perfil") {
        if (perfilAba) perfilAba.style.display = "block";
        carregarPerfilDoUsuario();
    }
}

// ==========================================
// LÓGICA DE MENSAGENS / CHAT DIRECT
// ==========================================
let unsubscribeChatAtivo = null;
let usuarioChatDestino = null;

async function carregarListaDeContatosChat() {
    const usernameLogado = localStorage.getItem("usernameLogado");
    const tipoUsuarioLogado = localStorage.getItem("usuarioLogado");
    
    if (!usernameLogado) return;

    const msgLoadingState = document.getElementById("msg-loading-state");
    const msgEmptyState = document.getElementById("msg-empty-state");
    const msgContatosContainer = document.getElementById("msg-contatos-container");

    if (msgLoadingState) msgLoadingState.style.display = "block";
    if (msgEmptyState) msgEmptyState.style.display = "none";
    if (msgContatosContainer) msgContatosContainer.style.display = "none";

    let minhaUnidade = "";
    
    // Descobre a unidade do usuário logado (se não for admin)
    if (tipoUsuarioLogado !== "admin") {
        try {
            const snapUser = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", usernameLogado).get();
            if (!snapUser.empty) {
                minhaUnidade = snapUser.docs[0].data().unidade || "";
            }
        } catch(e) { console.error("Erro ao buscar unidade", e); }
    }

    const divSuporte = document.getElementById("lista-msg-suporte");
    const divLideranca = document.getElementById("lista-msg-lideranca");
    const divMinhaUnidade = document.getElementById("lista-msg-unidade");
    const divOutras = document.getElementById("lista-msg-outras");

    // Limpa a tela antes de renderizar
    if(divSuporte) divSuporte.innerHTML = "";
    if(divLideranca) divLideranca.innerHTML = "";
    if(divMinhaUnidade) divMinhaUnidade.innerHTML = "";
    if(divOutras) divOutras.innerHTML = "";

    let contatosRenderizados = 0;

    // Fixa o Admin (Suporte) no topo para todos os membros comuns
    if (usernameLogado !== "admin" && divSuporte) {
        divSuporte.innerHTML += criarCardContatoChat("admin", "Central de Suporte", "Administração", "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png" );
        contatosRenderizados++;
    }

    try {
        const snap = await window.ClubeDB.textoDB.collection("usuarios").get();
        
        snap.forEach(doc => {
            const user = doc.data();
            const usernameUser = user.username ? user.username.toLowerCase() : "";
            
            if (!usernameUser || usernameUser === usernameLogado.toLowerCase()) return;

            const card = criarCardContatoChat(
                user.username,
                user.nomeReal || user.username,
                user.cargo || user.tipo || "Membro",
                user.fotoUrl
            );

            if (user.tipo === "Liderança") {
                if (divLideranca) divLideranca.innerHTML += card;
                contatosRenderizados++;
            } else if (minhaUnidade && user.unidade && user.unidade.trim().toLowerCase() === minhaUnidade.trim().toLowerCase()) {
                if (divMinhaUnidade) divMinhaUnidade.innerHTML += card;
                contatosRenderizados++;
            } else {
                if (divOutras) divOutras.innerHTML += card;
                contatosRenderizados++;
            }
        });

        const sessoes = [
            { div: divSuporte, titulo: document.getElementById("titulo-msg-suporte") },
            { div: divLideranca, titulo: document.getElementById("titulo-msg-lideranca") },
            { div: divMinhaUnidade, titulo: document.getElementById("titulo-msg-unidade") },
            { div: divOutras, titulo: document.getElementById("titulo-msg-outras") }
        ];

        sessoes.forEach(s => {
            if (s.div && s.titulo) {
                s.titulo.style.display = s.div.innerHTML.trim() !== "" ? "block" : "none";
            }
        });

        if (msgLoadingState) msgLoadingState.style.display = "none";
        if (contatosRenderizados === 0) {
            if (msgEmptyState) msgEmptyState.style.display = "block";
        } else {
            if (msgContatosContainer) msgContatosContainer.style.display = "block";
        }

    } catch (erro) {
        console.error("Erro ao carregar contatos:", erro);
        if (msgLoadingState) msgLoadingState.style.display = "none";
        if (msgEmptyState) msgEmptyState.style.display = "block";
    }
}


function criarCardContatoChat(username, nome, cargo, fotoUrl) {
    const img = fotoUrl || "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
    return `
        <div onclick="abrirSalaChat('${username}', '${nome}', '${cargo}', '${img}' )" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; transition: background-color 0.2s ease;">
            <img src="${img}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 1px solid #262626;">
            <div style="flex: 1;">
                <div style="color: #fff; font-size: 15px; font-weight: 600;">${nome}</div>
                <div style="color: #8e8e8e; font-size: 13px;">${cargo}</div>
            </div>
            <div style="color: #8e8e8e; font-size: 20px; padding-right: 5px;">&gt;</div>
        </div>
    `;
}


// Cria um Hash único para as mensagens independentemente de quem enviou primeiro (Garante o P2P da mesma sala)
function gerarIdChat(user1, user2) {
    return [user1, user2].sort().join("_");
}

function abrirSalaChat(usernameAlvo, nomeAlvo, cargoAlvo, fotoAlvo) {
    usuarioChatDestino = usernameAlvo;
    
    // Altera interface
    document.getElementById("tela-lista-mensagens").style.display = "none";
    
    // Bloqueia o scroll do corpo da página para evitar conflitos e frestas ao rolar no celular
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    const telaChat = document.getElementById("tela-sala-chat");
    if (telaChat) {
        telaChat.style.display = "flex";
        telaChat.style.flexDirection = "column";
        
        // ESTILO TELA CHEIA ABSOLUTA (Estilo Instagram Direct)
        telaChat.style.position = "fixed";
        telaChat.style.inset = "0";
        telaChat.style.width = "100%";
        telaChat.style.height = "100dvh"; // Prioriza viewports dinâmicas modernas
        if (!CSS.supports('height', '100dvh')) {
            telaChat.style.height = "100vh"; // Fallback caso 100dvh não funcione no navegador
        }
        telaChat.style.backgroundColor = "#000"; // Fundo idêntico ao Insta Dark mode
        telaChat.style.zIndex = "99999"; // Força sobreposição de todos os menus/abas nativas
        telaChat.style.boxSizing = "border-box";
        telaChat.style.overflow = "hidden";
    }

    document.getElementById("chat-nome-atual").textContent = nomeAlvo;
    document.getElementById("chat-cargo-atual").textContent = cargoAlvo;
    document.getElementById("chat-avatar-atual").src = fotoAlvo;

    // --- REORGANIZAÇÃO DE LAYOUT DO TOPO E BOTÕES VIA JS ---
const chatAvatar = document.getElementById("chat-avatar-atual");

if (chatAvatar && chatAvatar.parentElement) {
    const infoUsuario = chatAvatar.parentElement;

    if (infoUsuario.parentElement) {
        const cabecalhoChat = infoUsuario.parentElement;

        // Cabeçalho
        cabecalhoChat.style.display = "flex";
        cabecalhoChat.style.alignItems = "center";
        cabecalhoChat.style.justifyContent = "space-between";
        cabecalhoChat.style.width = "100%";
        cabecalhoChat.style.padding = "10px 16px";
        cabecalhoChat.style.boxSizing = "border-box";
        cabecalhoChat.style.gap = "12px";

        // Botão voltar
const btnVoltarChat =
    cabecalhoChat.querySelector("button") ||
    cabecalhoChat.querySelector("[onclick*='fecharSalaChat']");

if (btnVoltarChat) {
    btnVoltarChat.style.flex = "0 0 42px";
    btnVoltarChat.style.width = "42px";
    btnVoltarChat.style.height = "42px";
    btnVoltarChat.style.display = "flex";
    btnVoltarChat.style.alignItems = "center";
    btnVoltarChat.style.justifyContent = "flex-end";
    btnVoltarChat.style.padding = "0";
    btnVoltarChat.style.margin = "0";
    btnVoltarChat.style.order = "2";
}

// Perfil
infoUsuario.style.order = "1";
infoUsuario.style.display = "flex";
infoUsuario.style.alignItems = "center";
infoUsuario.style.justifyContent = "flex-start";
infoUsuario.style.flex = "1";
infoUsuario.style.minWidth = "0";
infoUsuario.style.gap = "10px";
infoUsuario.style.overflow = "hidden";

const textoContainer = infoUsuario.querySelector("div");
if (textoContainer) {
    textoContainer.style.order = "2";
    textoContainer.style.flex = "1";
    textoContainer.style.minWidth = "0";
    textoContainer.style.textAlign = "left";
    textoContainer.style.overflow = "hidden";
}

chatAvatar.style.order = "1";
chatAvatar.style.width = "38px";
chatAvatar.style.height = "38px";
chatAvatar.style.flex = "0 0 38px";
chatAvatar.style.borderRadius = "50%";
chatAvatar.style.objectFit = "cover";

const nomeEl = document.getElementById("chat-nome-atual");
if (nomeEl) {
    nomeEl.style.display = "block";
    nomeEl.style.whiteSpace = "nowrap";
    nomeEl.style.overflow = "hidden";
    nomeEl.style.textOverflow = "ellipsis";
    nomeEl.style.width = "100%";
    nomeEl.style.maxWidth = "none";
    nomeEl.style.textAlign = "left";
}

const cargoEl = document.getElementById("chat-cargo-atual");
if (cargoEl) {
    cargoEl.style.display = "block";
    cargoEl.style.whiteSpace = "nowrap";
    cargoEl.style.overflow = "hidden";
    cargoEl.style.textOverflow = "ellipsis";
    cargoEl.style.width = "100%";
    cargoEl.style.maxWidth = "none";
    cargoEl.style.textAlign = "left";
}
    }
}
// --- FIM DA REORGANIZAÇÃO ---

    // 2. Área de mensagens expandida
    const container = document.getElementById("chat-mensagens-container");
    if (container) {
        container.style.flex = "1"; // Ocupa todo o espaço e empurra a caixa de texto pra baixo
        container.style.overflowY = "auto";
        container.style.marginBottom = "5px";
        container.style.padding = "0 15px"; // Alinhamento lateral responsivo
    }

    // 3. Área de escrever mensagem o mais baixo possível e botão menor ao lado
    const inputMsg = document.getElementById("input-nova-mensagem");
    if (inputMsg && inputMsg.parentElement) {
        const areaDeEscrita = inputMsg.parentElement;
        areaDeEscrita.style.display = "flex";
        areaDeEscrita.style.alignItems = "center";
        areaDeEscrita.style.gap = "8px";
        areaDeEscrita.style.marginTop = "auto"; // Cola a caixa acima da borda inferior
        areaDeEscrita.style.padding = "10px 15px"; 
        areaDeEscrita.style.paddingBottom = "20px"; // Descola do extremo bottom da tela em celulares touch

        inputMsg.style.flex = "1"; // Input cresce tomando o máximo de espaço sem amassar o botão
        
        // Puxa o botão de enviar (seja ele uma tag button ou o próximo elemento irmão)
        const btnEnviar = areaDeEscrita.querySelector("button") || areaDeEscrita.nextElementSibling;
        if (btnEnviar) {
            btnEnviar.style.flexShrink = "0"; // Impede que o botão seja esmagado
            btnEnviar.style.width = "40px"; // Toma muito menos espaço
            btnEnviar.style.height = "40px";
            btnEnviar.style.padding = "0";
            btnEnviar.style.display = "flex";
            btnEnviar.style.justifyContent = "center";
            btnEnviar.style.alignItems = "center";
            btnEnviar.style.borderRadius = "50%"; // Formato mais discreto ao lado
        }
    }

    const meuUsername = localStorage.getItem("usernameLogado");
    const chatId = gerarIdChat(meuUsername, usernameAlvo);
    
    container.innerHTML = "<p style='color:#8e8e8e; text-align:center; margin-top:20px; font-size:12px;'>Conectando ao chat protegido...</p>";

    // Desativa o listener da sala antiga caso estivesse aberta
    if (unsubscribeChatAtivo) {
        unsubscribeChatAtivo();
    }

    // Listener Real-time
    unsubscribeChatAtivo = window.ClubeDB.textoDB.collection("chats")
        .doc(chatId).collection("mensagens")
        .orderBy("timestamp", "asc")
        .onSnapshot(snapshot => {
            container.innerHTML = ""; 
            if (snapshot.empty) {
                container.innerHTML = "<p style='color:#8e8e8e; text-align:center; margin-top:20px; font-size:12px;'>O histórico está vazio. Envie a primeira mensagem para " + nomeAlvo + ".</p>";
                return;
            }

            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMinha = msg.remetente === meuUsername;
                
                const div = document.createElement("div");
                div.style.display = "flex";
                div.style.width = "100%"; // Garante que a linha ocupe toda a largura
                div.style.marginBottom = "8px"; // Espaçamento entre os balões
                div.style.justifyContent = isMinha ? "flex-end" : "flex-start";
                
                const balao = document.createElement("div");
                balao.textContent = msg.texto;
                balao.style.maxWidth = "75%";
                balao.style.padding = "10px 14px";
                balao.style.borderRadius = "18px";
                balao.style.fontSize = "14px";
                balao.style.lineHeight = "1.4";
                balao.style.wordBreak = "break-word";
                balao.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.15)"; // Sombra sutil para destacar
                
                // Formatação dos balões baseado em Remetente (Estilo Insta Dark)
                if (isMinha) {
                    balao.style.background = "#0095f6";
                    balao.style.color = "#fff";
                    balao.style.borderBottomRightRadius = "4px";
                } else {
                    balao.style.background = "#262626";
                    balao.style.color = "#fff";
                    balao.style.borderBottomLeftRadius = "4px";
                }
                
                div.appendChild(balao);
                container.appendChild(div);
            });
            
            // Auto scroll para o final das mensagens sempre que houver novidades
            container.scrollTop = container.scrollHeight;
        });
}
function fecharSalaChat() {
    document.getElementById("tela-sala-chat").style.display = "none";
    document.getElementById("tela-lista-mensagens").style.display = "flex";
    
    // Restaura o scroll do corpo da página ao fechar o chat
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";

    usuarioChatDestino = null;
    if (unsubscribeChatAtivo) {
        unsubscribeChatAtivo();
        unsubscribeChatAtivo = null;
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById("input-nova-mensagem");
    const texto = input.value.trim();
    const meuUsername = localStorage.getItem("usernameLogado");
    
    if (!texto || !usuarioChatDestino || !meuUsername) return;

    input.value = ""; // Limpa Input Rápido
    const chatId = gerarIdChat(meuUsername, usuarioChatDestino);

    try {
        await window.ClubeDB.textoDB.collection("chats")
            .doc(chatId).collection("mensagens").add({
                remetente: meuUsername,
                texto: texto,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Mantém um documento base para poder listar "conversas recentes" no futuro
        await window.ClubeDB.textoDB.collection("chats").doc(chatId).set({
            ultimoEnvio: firebase.firestore.FieldValue.serverTimestamp(),
            usuarios: [meuUsername, usuarioChatDestino]
        }, { merge: true });
    } catch(e) {
        console.error("Erro ao enviar mensagem", e);
    }
}

// Carrega as informações dinâmicas do membro logado diretamente no perfil
async function carregarPerfilDoUsuario() {
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");
    
    const nomeEl = document.getElementById("perfil-usuario-nome");
    const cargoEl = document.getElementById("perfil-usuario-cargo");
    const unidadeEl = document.getElementById("perfil-usuario-unidade-status");
    const nascimentoEl = document.getElementById("perfil-usuario-nascimento");
    const avatarEl = document.getElementById("perfil-usuario-avatar");
    const classesEl = document.getElementById("perfil-conquistas-classes");
    const especialidadesEl = document.getElementById("perfil-conquistas-especialidades");
    const mestradosEl = document.getElementById("perfil-conquistas-mestrados");
    const contadorEl = document.getElementById("perfil-usuario-conquistas-status");

    const tClasses = document.getElementById("titulo-conquistas-classes");
    const tEspecialidades = document.getElementById("titulo-conquistas-especialidades");
    const tMestrados = document.getElementById("titulo-conquistas-mestrados");
    
    const gridEl = document.getElementById("perfil-usuario-grid");
    const vazioEl = document.getElementById("perfil-publicacoes-vazio");

    // Reset de sub-abas do perfil para iniciar na principal
    mudarSubTabPerfil('publicacoes');

    // Se for o admin visualizando o site
    if (tipoUsuario === "admin") {
        if (nomeEl) nomeEl.textContent = "Administrador";
        if (cargoEl) cargoEl.textContent = "Liderança Geral";
        if (unidadeEl) unidadeEl.textContent = "Geral";
        if (nascimentoEl) nascimentoEl.textContent = "Nascido em: --/--/----";
        if (avatarEl) avatarEl.src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        if (contadorEl) contadorEl.textContent = "∞";
        
        if (classesEl) classesEl.innerHTML = "• Classe: Administrador Geral";
        if (especialidadesEl) especialidadesEl.innerHTML = "<span style='color: #8e8e8e;'>Acesso Irrestrito</span>";
        if (mestradosEl) mestradosEl.innerHTML = "<span style='color: #8e8e8e;'>Acesso Irrestrito</span>";
        if (gridEl) gridEl.style.display = "none";
        if (vazioEl) vazioEl.style.display = "block";
        return;
    }

    if (!username) return;

    try {
        const snapshot = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", username).get();
        if (!snapshot.empty) {
            const dados = snapshot.docs[0].data();
            
            if (nomeEl) nomeEl.textContent = dados.nomeReal || dados.username;
            if (cargoEl) cargoEl.textContent = dados.cargo || "Membro";
            if (unidadeEl) unidadeEl.textContent = dados.unidade || "Sem Unidade";
            
            if (dados.dataNascimento) {
                const [ano, mes, dia] = dados.dataNascimento.split("-");
                if (nascimentoEl) nascimentoEl.textContent = `Nascido em: ${dia}/${mes}/${ano}`;
            } else {
                if (nascimentoEl) nascimentoEl.textContent = "Nascido em: --/--/----";
            }

            if (dados.fotoUrl && avatarEl) {
                avatarEl.src = dados.fotoUrl;
            } else if (avatarEl) {
                avatarEl.src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
            }

            // Cálculo dinâmico do contador centralizado de conquistas
            const qtdClasses = (dados.classesConcluidas || []).length;
            const qtdEspecialidades = (dados.especialidades || []).length;
            const qtdMestrados = (dados.mestrados || []).length;
            if (contadorEl) contadorEl.textContent = (qtdClasses + qtdEspecialidades + qtdMestrados);

            // Exibição condicional do Grid de Publicações
            if (dados.publicacoes && dados.publicacoes.length > 0) {
                if (gridEl) {
                    gridEl.style.display = "grid";
                    gridEl.innerHTML = dados.publicacoes.map(pubUrl => `
                        <div style="aspect-ratio: 1; background-color: #121212;">
                            <img src="${pubUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `).join("");
                }
                if (vazioEl) vazioEl.style.display = "none";
            } else {
                if (gridEl) gridEl.style.display = "none";
                if (vazioEl) vazioEl.style.display = "block";
            }

            // Renderização Detalhada: Classes Regulares
            if (tClasses) tClasses.textContent = `🎒 Classes Regulares (${qtdClasses})`;
            if (classesEl) {
                if (qtdClasses > 0) {
                    classesEl.innerHTML = dados.classesConcluidas.map(c => `• ${c}`).join("<br>");
                } else {
                    classesEl.innerHTML = `• Classe Vinculada: ${dados.tipo === 'Desbravador' ? 'Classe Regular' : 'Classe de Líder'}`;
                }
            }

            // Renderização Detalhada: Especialidades
            if (tEspecialidades) tEspecialidades.textContent = `🏅 Especialidades Adquiridas (${qtdEspecialidades})`;
            if (especialidadesEl) {
                if (qtdEspecialidades > 0) {
                    especialidadesEl.innerHTML = dados.especialidades.map(esp => `
                        <span style="background: #262626; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: normal; word-break: break-word;">
                            🎖️ ${esp}
                        </span>
                    `).join("");
                } else {
                    especialidadesEl.innerHTML = `
                        <span style="color: #8e8e8e; font-style: italic; font-size: 12px;">
                            Nenhuma especialidade validada. Envie itens para avaliação na aba de alvos!
                        </span>
                    `;
                }
            }

            // Renderização Detalhada: Mestrados
            if (tMestrados) tMestrados.textContent = `🏆 Mestrados Adquiridos (${qtdMestrados})`;
            if (mestradosEl) {
                if (qtdMestrados > 0) {
                    mestradosEl.innerHTML = dados.mestrados.map(mest => `
                        <span style="background: #1e3a1e; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: normal; word-break: break-word; border: 1px solid #2e5a2e;">
                            🏆 ${mest}
                        </span>
                    `).join("");
                } else {
                    mestradosEl.innerHTML = `
                        <span style="color: #8e8e8e; font-style: italic; font-size: 12px;">
                            Nenhum mestrado concluído ainda.
                        </span>
                    `;
                }
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar dados do perfil:", erro);
    }
}

// Alternar sub-abas do próprio perfil (Publicações vs Conquistas)
function mudarSubTabPerfil(subAba) {
    const abaPubs = document.getElementById("perfil-secao-publicacoes");
    const abaConq = document.getElementById("perfil-secao-conquistas");
    const tabPubsBtn = document.getElementById("tab-perfil-publicacoes");
    const tabConqBtn = document.getElementById("tab-perfil-conquistas");

    if (subAba === 'publicacoes') {
        if (abaPubs) abaPubs.style.display = "block";
        if (abaConq) abaConq.style.display = "none";
        if (tabPubsBtn) {
            tabPubsBtn.style.color = "#fff";
            tabPubsBtn.style.borderTop = "1.5px solid #fff";
        }
        if (tabConqBtn) {
            tabConqBtn.style.color = "#8e8e8e";
            tabConqBtn.style.borderTop = "1.5px solid transparent";
        }
    } else if (subAba === 'conquistas') {
        if (abaPubs) abaPubs.style.display = "none";
        if (abaConq) abaConq.style.display = "block";
        if (tabPubsBtn) {
            tabPubsBtn.style.color = "#8e8e8e";
            tabPubsBtn.style.borderTop = "1.5px solid transparent";
        }
        if (tabConqBtn) {
            tabConqBtn.style.color = "#fff";
            tabConqBtn.style.borderTop = "1.5px solid #fff";
        }
    }
}

// Controladores do Modal de Foto de Perfil
function abrirModalFoto() {
    const modal = document.getElementById("modal-foto-perfil");
    const modalImg = document.getElementById("modal-foto-img");
    const avatarImg = document.getElementById("perfil-usuario-avatar");

    if (modal && modalImg && avatarImg) {
        // Copia o caminho da foto que está no perfil para carregar em tamanho real
        modalImg.src = avatarImg.src;
        modal.style.display = "flex";
    }
}

function fecharModalFoto() {
    const modal = document.getElementById("modal-foto-perfil");
    if (modal) {
        modal.style.display = "none";
    }
}

// Redireciona a chamada antiga para o novo sistema modal elegante
function gerenciarFotoPerfilUsuario() {
    abrirModalFoto();
}

async function uploadFotoPerfilUsuario(input) {
    const arquivo = input.files[0];
    if (!arquivo) return;

    try {
        const username = localStorage.getItem("usernameLogado");
        if (!username) return;

        // Feedback visual de carregamento rápido
        const avatarEl = document.getElementById("perfil-usuario-avatar");
        if (avatarEl) avatarEl.style.opacity = "0.4";

        let novaUrl = "";
        let novoIdPublico = "";

        // 1. Envio dos arquivos para o Cloudinary (Tratando as respostas de forma ultra-segura)
        if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadFoto === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadFoto(arquivo);
            novaUrl = res.url || res.secure_url || res;
            novoIdPublico = res.public_id || res.publicId || "";
        } else if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadImagem === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadImagem(arquivo);
            novaUrl = res.url || res.secure_url || res;
            novoIdPublico = res.public_id || res.publicId || "";
        } else {
            const formData = new FormData();
            formData.append("file", arquivo);
            formData.append("upload_preset", "guardioes_preset");
            
            const response = await fetch("https://api.cloudinary.com/v1_1/dkozbm1ik/image/upload", {
                method: "POST",
                body: formData
            });
            if (response.ok) {
                const data = await response.json();
                novaUrl = data.secure_url || data.url;
                novoIdPublico = data.public_id || "";
            } else {
                throw new Error("Não foi possível conectar ao servidor de imagens Cloudinary.");
            }
        }

        // 2. Gravando no Firestore com travas anti-undefined
        if (novaUrl) {
            const snapshot = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", username).get();
            if (!snapshot.empty) {
                const docId = snapshot.docs[0].id;
                const dadosAntigos = snapshot.docs[0].data();

                // Remove imagem antiga se ela existir para economizar seu espaço no Cloudinary
                if (dadosAntigos.fotoIdPublico && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                    try {
                        await window.ClubeDB.acoesAdmin.excluirFoto(dadosAntigos.fotoIdPublico);
                    } catch (errExcluir) {
                        console.warn("Aviso ao limpar imagem anterior do Cloudinary:", errExcluir);
                    }
                }

                // Proteção Máxima contra undefined usando o operador || ""
                await window.ClubeDB.textoDB.collection("usuarios").doc(docId).update({
                    fotoUrl: novaUrl || "",
                    fotoIdPublico: novoIdPublico || ""
                });

                alert("Sua foto de perfil foi atualizada com sucesso! 🎉");
                await carregarPerfilDoUsuario();
                fecharModalFoto();
            } else {
                alert("Usuário não encontrado no banco de dados.");
            }
        } else {
            alert("Não recebemos um link válido da imagem. Tente novamente.");
        }
    } catch (e) {
        alert("Erro ao enviar imagem: " + e.message);
    } finally {
        // Restaura a opacidade e limpa o input para permitir selecionar a mesma imagem se quiser
        const avatarEl = document.getElementById("perfil-usuario-avatar");
        if (avatarEl) avatarEl.style.opacity = "1";
        if (input) input.value = "";
    }
}

async function removerFotoPerfilUsuario() {
    if (!confirm("Confirmar a remoção da sua foto de perfil?")) return;

    try {
        const username = localStorage.getItem("usernameLogado");
        if (!username) return;

        const avatarEl = document.getElementById("perfil-usuario-avatar");
        if (avatarEl) avatarEl.style.opacity = "0.5";

        const snapshot = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", username).get();
        if (!snapshot.empty) {
            const docId = snapshot.docs[0].id;
            const dadosAntigos = snapshot.docs[0].data();

            if (dadosAntigos.fotoIdPublico && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                await window.ClubeDB.acoesAdmin.excluirFoto(dadosAntigos.fotoIdPublico);
            }

            await window.ClubeDB.textoDB.collection("usuarios").doc(docId).update({
                fotoUrl: "",
                fotoIdPublico: ""
            });

            alert("Foto de perfil removida com sucesso.");
            carregarPerfilDoUsuario();
            fecharModalFoto();
        }
    } catch (e) {
        alert("Erro ao remover a foto: " + e.message);
    } finally {
        const avatarEl = document.getElementById("perfil-usuario-avatar");
        if (avatarEl) avatarEl.style.opacity = "1";
    }
}

// === LOGO DO CLUBE ===
async function carregarLogoClubeConfig() {
    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        const doc = await docRef.get();
        
        const logoImg = document.getElementById("site-logo-img");
        const logoTexto = document.getElementById("site-logo-texto");
        const sliderTamanho = document.getElementById("logo-tamanho-slider");
        
        // Elemento da logo do App
        const logoAppImg = document.getElementById("app-logo-img");

        if (doc.exists) {
            const dados = doc.data();
            
            // 1. Aplica a Imagem do Site
            if (dados.logoUrl) {
                if (logoImg) {
                    logoImg.src = dados.logoUrl;
                    logoImg.style.display = "inline-block";
                    logoImg.style.verticalAlign = "middle";
                    logoImg.style.objectFit = "contain";
                }
                if (logoTexto) logoTexto.style.display = "none";
                
                const previaAdmin = document.getElementById("previa-logo-site") || document.getElementById("previa-logo-clube");
                if (previaAdmin) previaAdmin.src = dados.logoUrl;
            } else {
                if (logoImg) logoImg.style.display = "none";
                if (logoTexto) logoTexto.style.display = "block";
                
                const previaAdmin = document.getElementById("previa-logo-site") || document.getElementById("previa-logo-clube");
                if (previaAdmin) previaAdmin.src = "";
            }

            // 1.1 Aplica a Imagem do App
            if (dados.logoAppUrl) {
                if (logoAppImg) {
                    logoAppImg.src = dados.logoAppUrl;
                    logoAppImg.style.display = "block";
                }
                const previaAppAdmin = document.getElementById("previa-logo-app");
                if (previaAppAdmin) previaAppAdmin.src = dados.logoAppUrl;
                
                let appleIcon = document.getElementById("app-touch-icon") || document.querySelector("link[rel='apple-touch-icon']");
                if (!appleIcon) {
                    appleIcon = document.createElement("link");
                    appleIcon.rel = "apple-touch-icon";
                    appleIcon.id = "app-touch-icon";
                    document.head.appendChild(appleIcon);
                }
                appleIcon.href = dados.logoAppUrl;
            } else {
                const previaAppAdmin = document.getElementById("previa-logo-app");
                if (previaAppAdmin) previaAppAdmin.src = "";
            }

            // 1.2 Aplica o Favicon (Miniatura da Aba)
            let faviconEl = document.getElementById("favicon-site");
            if (dados.faviconUrl) {
                if (faviconEl && faviconEl.tagName === 'LINK') faviconEl.remove();
                let novoFavicon = document.getElementById("favicon-site");
                if (!novoFavicon) {
                    novoFavicon = document.createElement("link");
                    novoFavicon.rel = "icon";
                    novoFavicon.id = "favicon-site";
                    document.head.appendChild(novoFavicon);
                }
                novoFavicon.href = dados.faviconUrl;

                const previaFaviconAdmin = document.getElementById("previa-favicon");
                if (previaFaviconAdmin) {
                    previaFaviconAdmin.src = dados.faviconUrl;
                }

                ['site-favicon', 'favicon-img', 'site-favicon-img', 'site-miniatura', 'miniatura-img'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.src = dados.faviconUrl;
                        el.style.display = "inline-block";
                    }
                });
            } else {
                if (faviconEl && faviconEl.tagName === 'LINK') faviconEl.href = "";
                const previaFaviconAdmin = document.getElementById("previa-favicon");
                if (previaFaviconAdmin) {
                    previaFaviconAdmin.src = "";
                }
                ['site-favicon', 'favicon-img', 'site-favicon-img', 'site-miniatura', 'miniatura-img'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.src = "";
                        el.style.display = "none";
                    }
                });
            }

            // 2. Aplica o Tamanho Responsivo da Logo (Se o admin tiver salvo)
            if (dados.logoTamanho) {
                if (logoImg) {
                    logoImg.style.maxHeight = dados.logoTamanho + "px";
                    logoImg.style.height = dados.logoTamanho + "px";
                    logoImg.style.maxWidth = "250px";
                    logoImg.style.width = "auto";
                }
                if (sliderTamanho) {
                    sliderTamanho.value = dados.logoTamanho;
                }
            } else {
                if (logoImg) {
                    logoImg.style.height = "50px";
                    logoImg.style.width = "auto";
                }
            }
        } else {
            if (logoImg) logoImg.style.display = "none";
        }
    } catch (erro) {
        console.error("Erro ao carregar logo do clube:", erro);
    }
}

// Função completa implementada para gerenciar a exclusão lógica via update, prevenindo o recriamento por arquivos de importação
async function excluirItemAdmin() {
    const id = document.getElementById("edit-item-id").value;
    const tipo = document.getElementById("edit-item-tipo").value; // 'especialidades', 'mestrados', 'classes'[cite: 5]
    
    if (!id) {
        alert("Nenhum item selecionado para exclusão.");
        return;
    }

    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    try {
        // Substituição crítica: em vez de .delete(), usamos .update({ excluida: true }) para manter no Firebase e barrar o recriamento
        await window.ClubeDB.textoDB.collection(tipo).doc(id).update({
            excluida: true
        });

        alert("Item excluído com sucesso!");
        fecharModalGerenciarItem();
        
        // Atualiza a listagem correspondente na interface
        if (tipo === "especialidades" && typeof carregarEspecialidades === "function") {
            carregarEspecialidades();
        } else if (tipo === "mestrados" && typeof carregarMestrados === "function") {
            carregarMestrados();
        } else if (tipo === "classes" && typeof carregarClasses === "function") {
            carregarClasses();
        }
    } catch (erro) {
        console.error("Erro ao excluir item:", erro);
        alert("Erro ao excluir item: " + erro.message);
    }
}


function usarTextoPadraoLogo(tipo = 'site') {
    if (tipo === 'site') {
        const siteLogoImg = document.getElementById("site-logo-img");
        const siteLogoTexto = document.getElementById("site-logo-texto");
        const previaLogo = document.getElementById("previa-logo-site") || document.getElementById("previa-logo-clube");

        if (siteLogoImg) siteLogoImg.style.display = "none";
        if (siteLogoTexto) siteLogoTexto.style.display = "block";
        if (previaLogo) previaLogo.src = "";
    } else if (tipo === 'app') {
        const appLogoImg = document.getElementById("app-logo-img");
        const previaLogoApp = document.getElementById("previa-logo-app");
        if (appLogoImg) appLogoImg.style.display = "none";
        if (previaLogoApp) previaLogoApp.src = "";
    } else if (tipo === 'favicon') {
        const faviconEl = document.getElementById("favicon-site");
        const previaFavicon = document.getElementById("previa-favicon");
        if (faviconEl && faviconEl.tagName === 'LINK') faviconEl.href = "";
        if (previaFavicon) previaFavicon.src = "";
        ['site-favicon', 'favicon-img', 'site-favicon-img', 'site-miniatura', 'miniatura-img'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.src = "";
        });
    }
}

async function salvarLogoClubeAdmin(tipo = 'site') {
    // Determina os IDs corretos baseados no tipo (Site, App ou Favicon)
    const inputId = tipo === 'site' ? "logo-site-file" : (tipo === 'app' ? "logo-app-file" : "favicon-file");
    let fileInput = document.getElementById(inputId);
    
    // Fallback de retrocompatibilidade para o ID antigo caso você ainda não tenha alterado no HTML
    if (!fileInput && tipo === 'site') fileInput = document.getElementById("logo-clube-file");
    
    const btnId = tipo === 'site' ? "btn-salvar-logo-site" : (tipo === 'app' ? "btn-salvar-logo-app" : "btn-salvar-favicon");
    let btn = document.getElementById(btnId);
    if (!btn && tipo === 'site') btn = document.getElementById("btn-salvar-logo");

    const arquivo = fileInput ? fileInput.files[0] : null;

    if (!arquivo) {
        alert(`Selecione um arquivo de imagem para ${tipo === 'favicon' ? 'a miniatura' : `a logo do ${tipo}`}!`);
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Enviando...";
        }

        let urlLogo = "";
        let idPublicoLogo = "";

        if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadFoto === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadFoto(arquivo);
            urlLogo = res.url || res.secure_url || res;
            idPublicoLogo = res.public_id || res.publicId || "";
        } else if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadImagem === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadImagem(arquivo);
            urlLogo = res.url || res.secure_url || res;
            idPublicoLogo = res.public_id || res.publicId || "";
        } else {
            const formData = new FormData();
            formData.append("file", arquivo);
            formData.append("upload_preset", "guardioes_preset");
            
            const response = await fetch("https://api.cloudinary.com/v1_1/dkozbm1ik/image/upload", {
                method: "POST",
                body: formData
            });
            if (response.ok) {
                const data = await response.json();
                urlLogo = data.secure_url || data.url;
                idPublicoLogo = data.public_id || "";
            } else {
                throw new Error("Erro de conexão com o Cloudinary.");
            }
        }

        if (urlLogo) {
            const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
            const doc = await docRef.get();
            
            // Define dinamicamente o campo do banco de dados que será salvo
            const campoUrl = tipo === 'site' ? "logoUrl" : (tipo === 'app' ? "logoAppUrl" : "faviconUrl");
            const campoId = tipo === 'site' ? "logoIdPublico" : (tipo === 'app' ? "logoAppIdPublico" : "faviconIdPublico");

            if (doc.exists) {
                const dados = doc.data();
                const idPublicoAntigo = dados[campoId]; // Apaga apenas a logo correta
                
                if (idPublicoAntigo && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                    try {
                        await window.ClubeDB.acoesAdmin.excluirFoto(idPublicoAntigo);
                    } catch (errExcluir) {
                        console.warn(`Aviso ao limpar imagem anterior do ${tipo}:`, errExcluir);
                    }
                }
            }

            // Atualiza apenas os campos pertencentes ao tipo modificado
            const atualizacao = {};
            atualizacao[campoUrl] = urlLogo || "";
            atualizacao[campoId] = idPublicoLogo || "";

            await docRef.set(atualizacao, { merge: true });

            alert(`${tipo === 'favicon' ? 'Miniatura' : `Logo do ${tipo.toUpperCase()}`} cadastrada com sucesso! 🛡️`);
            carregarLogoClubeConfig();
            if (fileInput) fileInput.value = "";
        }
    } catch (e) {
        alert(`Erro ao salvar ${tipo}: ` + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = tipo === 'favicon' ? "Salvar Miniatura" : `Salvar Logo ${tipo === 'site' ? 'Site' : 'App'}`;
        }
    }
}

function alterarTamanhoLogoEmTempoReal(tamanho) {
    const logoImg = document.getElementById("site-logo-img");
    if (logoImg) {
        logoImg.style.maxHeight = tamanho + "px";
        logoImg.style.height = tamanho + "px";
        logoImg.style.maxWidth = "300px";
        logoImg.style.width = "auto";
    }
}

async function salvarTamanhoLogoBD() {
    const slider = document.getElementById("logo-tamanho-slider");
    if (!slider) return;
    const tamanho = slider.value;

    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        await docRef.set({
            logoTamanho: Number(tamanho)
        }, { merge: true });
        alert("Tamanho da logo salvo com sucesso! 💾");
    } catch (e) {
        alert("Erro ao salvar tamanho da logo: " + e.message);
    }
}

async function removerLogoClubeAdmin(tipo = 'site') {
    if (!confirm(`Tem certeza que deseja remover ${tipo === 'favicon' ? 'a miniatura' : `a logo do ${tipo}`}?`)) return;

    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        const doc = await docRef.get();
        
        const campoUrl = tipo === 'site' ? "logoUrl" : (tipo === 'app' ? "logoAppUrl" : "faviconUrl");
        const campoId = tipo === 'site' ? "logoIdPublico" : (tipo === 'app' ? "logoAppIdPublico" : "faviconIdPublico");

        if (doc.exists) {
            const dados = doc.data();
            const idPublicoAntigo = dados[campoId];
            if (idPublicoAntigo && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                await window.ClubeDB.acoesAdmin.excluirFoto(idPublicoAntigo);
            }
        }

        const atualizacao = {};
        atualizacao[campoUrl] = "";
        atualizacao[campoId] = "";

        await docRef.set(atualizacao, { merge: true });

        alert(`${tipo === 'favicon' ? 'Miniatura' : `Logo do ${tipo}`} removida.`);
        usarTextoPadraoLogo(tipo);
    } catch (e) {
        alert(`Erro ao remover ${tipo}: ` + e.message);
    }
}

// Limpa a sessão
function fazerLogoutSessao() {
    localStorage.removeItem("sessaoAdminLogado");
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("usernameLogado");
    
    if (window.ClubeDB && window.ClubeDB.loginDB) {
        window.ClubeDB.loginDB.signOut().catch(err => console.log("Signout efetuado: ", err));
    }

    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-site").style.display = "none";
    document.getElementById("tela-login").style.display = "flex";
}

// Controle das abas do menu
function mudarAbaAdmin(idAbaDestino) {
    const conteudos = document.querySelectorAll(".conteudo-aba");
    conteudos.forEach(aba => aba.style.display = "none");

    const botoes = document.querySelectorAll(".aba-item");
    botoes.forEach(btn => btn.classList.remove("ativa"));

    const alvo = document.getElementById(idAbaDestino);
    if (alvo) {
        alvo.style.display = "flex";
        alvo.style.flexDirection = "column";
    }
    
    const botaoClicado = Array.from(botoes).find(btn => btn.getAttribute("onclick").includes(idAbaDestino));
    if (botaoClicado) botaoClicado.classList.add("ativa");

    // Gatilho para carregar a gestão de conquistas
    if (idAbaDestino === 'aba-conquistas-gestao') {
        carregarUsuariosParaGestaoConquistas();
    }
}


function controlarExibicaoSelecaoUnidade() {
    const tipoSelecionado = document.getElementById("membro-tipo").value;
    const campoUnidade = document.getElementById("membro-unidade-vinculo");

    if (campoUnidade) {
        if (tipoSelecionado === "Liderança") {
            campoUnidade.style.display = "none";
            campoUnidade.value = "";
        } else {
            campoUnidade.style.display = "block";
        }
    }
}

// Pré-visualização do Avatar
function mostrarPreviaImagem(inputElemento, idImgAlvo) {
    const imagemAlvo = document.getElementById(idImgAlvo);
    const arquivo = inputElemento.files[0];

    if (arquivo && imagemAlvo) {
        const leitor = new FileReader();
        leitor.onload = function(e) {
            imagemAlvo.src = e.target.result;
        };
        leitor.readAsDataURL(arquivo);
    }
}

// === LÓGICA DE GERENCIAMENTO DAS UNIDADES ===

async function salvarNovaUnidadeAdmin() {
    const btn = document.getElementById("btn-criar-unidade");
    const nomeInput = document.getElementById("unidade-nome");
    const fotoInput = document.getElementById("unidade-foto");
    if (!nomeInput) return;
    const nome = nomeInput.value.trim();
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;
    if (!nome) { alert("Nome da unidade é obrigatório!"); return; }
    try {
        btn.disabled = true;
        await window.ClubeDB.acoesAdmin.criarUnidade(nome, arquivoFoto);
        alert(`Sucesso!`);
        nomeInput.value = "";
        carregarUnidadesCadastradas();
    } catch (e) { alert("Erro: " + e.message); } finally { btn.disabled = false; }
}

async function carregarUnidadesCadastradas() {
    const container = document.getElementById("lista-unidades-render");
    const menuSelecao = document.getElementById("membro-unidade-vinculo");
    if (container) container.innerHTML = "";
    if (menuSelecao) menuSelecao.innerHTML = '<option value="">Selecione a Unidade...</option>';
    const snapshot = await window.ClubeDB.textoDB.collection("unidades").get();
    snapshot.forEach(doc => {
        const d = doc.data();
        const id = doc.id;
        const urlFoto = d.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';

        if (container) {
            container.innerHTML += `
                <div class="item-unidade" style="text-align: center; margin-bottom: 20px; border: 1px solid #444; padding: 10px; border-radius: 8px;">
                    <img src="${urlFoto}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">
                    <div style="font-weight: bold; margin-bottom: 10px;">${d.nome}</div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="iniciarEdicaoUnidade('${id}', '${d.nome}', '${d.fotoIdPublico || ''}')" style="flex: 1; padding: 5px;">✏️ Editar</button>
                        <button onclick="deletarUnidadeComFoto('${id}', '${d.fotoIdPublico || ''}')" style="flex: 1; padding: 5px; background:#ff4d4d; color:white; border:none;">🗑️ Apagar</button>
                    </div>
                </div>`;
        }
        if (menuSelecao) menuSelecao.innerHTML += `<option value="${d.nome}">${d.nome}</option>`;
    });
}

async function iniciarEdicaoUnidade(id, nomeAtual, fotoIdAntiga) {
    // 1. Edita o nome normalmente
    const novoNome = prompt("Digite o novo nome da unidade:", nomeAtual);
    if (!novoNome) return;

    // 2. Pergunta sobre a foto
    if (confirm("Deseja trocar a foto da unidade?")) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        // Quando o usuário selecionar o arquivo, a mágica acontece
        input.onchange = async (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            try {
                // Apenas deleta a antiga se ela existir no Cloudinary
                if (fotoIdAntiga && window.ClubeDB && window.ClubeDB.acoesAdmin) {
                    await window.ClubeDB.acoesAdmin.excluirFoto(fotoIdAntiga);
                }

                // Faz o upload da nova e cria a entrada no banco
                // Mantemos o nome atualizado e trocamos a foto
                await window.ClubeDB.acoesAdmin.criarUnidade(novoNome, arquivo);
                
                alert("Foto trocada com sucesso!");
                carregarUnidadesCadastradas();
            } catch (err) {
                console.error(err);
                alert("Erro ao trocar a foto: " + err.message);
            }
        };
        input.click(); // Abre o seletor de arquivos
    } else {
        // Se não quiser trocar a foto, apenas atualiza o nome no Firestore
        await window.ClubeDB.textoDB.collection("unidades").doc(id).update({ nome: novoNome });
        carregarUnidadesCadastradas();
    }
}

async function deletarUnidadeComFoto(id, idFoto) {
    if (!confirm("Tem certeza que deseja apagar esta unidade permanentemente?")) return;
    
    try {
        if (idFoto && idFoto !== "undefined" && window.ClubeDB.acoesAdmin) {
            await window.ClubeDB.acoesAdmin.excluirFoto(idFoto);
        }
        await window.ClubeDB.textoDB.collection("unidades").doc(id).delete();
        alert("Unidade apagada com sucesso!");
        carregarUnidadesCadastradas();
    } catch (erro) {
        alert("Não foi possível apagar. Erro: " + erro.message);
    }
}
// === LÓGICA DE GERENCIAMENTO DE MEMBROS ===

async function salvarNovoMembroAdmin() {
    const username = document.getElementById("membro-username").value.trim();
    const senha = document.getElementById("membro-senha").value;
    const nomeReal = document.getElementById("membro-nome-real").value.trim();
    const tipo = document.getElementById("membro-tipo").value;
    const unidade = document.getElementById("membro-unidade-vinculo").value;
    const cargo = document.getElementById("membro-cargo").value.trim();
    const dataNascimento = document.getElementById("membro-nascimento").value;
    const fotoInput = document.getElementById("membro-foto");
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;

    if (!username || !senha || !nomeReal || !cargo || !dataNascimento) {
        alert("Preencha todos os campos obrigatórios do membro!");
        return;
    }

    if (tipo === "Desbravador" && !unidade) {
        alert("Desbravadores precisam obrigatoriamente estar vinculados a uma unidade!");
        return;
    }

    const dadosMembro = {
        username: username,
        senha: senha,
        nomeReal: nomeReal,
        tipo: tipo,
        unidade: unidade,
        cargo: cargo,
        dataNascimento: dataNascimento
    };

    try {
        const btn = document.querySelector("#aba-membros button");
        if(btn) {
            btn.disabled = true;
            btn.textContent = idMembroSendoEditado ? "⏳ Salvando..." : "⏳ Cadastrando...";
        }

        if (window.ClubeDB) {
            if (idMembroSendoEditado) {
                // Se enviou nova foto, reprocessa tudo. Se não, atualiza apenas os textos preservando a foto atual
                if (arquivoFoto && window.ClubeDB.acoesAdmin) {
                    await window.ClubeDB.textoDB.collection("usuarios").doc(idMembroSendoEditado).delete();
                    await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
                } else {
                    await window.ClubeDB.textoDB.collection("usuarios").doc(idMembroSendoEditado).update(dadosMembro);
                }   
                alert(`🎉 Membro ${nomeReal} atualizado com sucesso!`);
                idMembroSendoEditado = null; 
            } else {
                await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
                alert(`🎉 Membro ${nomeReal} cadastrado com sucesso!`);
            }
            
            document.getElementById("membro-username").value = "";
            document.getElementById("membro-senha").value = "";
            document.getElementById("membro-nome-real").value = "";
            document.getElementById("membro-cargo").value = "";
            document.getElementById("membro-nascimento").value = "";
            if (fotoInput) fotoInput.value = "";
            document.getElementById("previa-membro-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
            
            carregarMembrosCadastrados();
        }
        
        if(btn) {
            btn.disabled = false;
            btn.textContent = "Cadastrar Membro";
        }
    } catch (erro) {
        alert("Erro ao cadastrar membro: " + erro.message);
        const btn = document.querySelector("#aba-membros button");
        if(btn) {
            btn.disabled = false;
            btn.textContent = "Cadastrar Membro";
        }
    }
}

// Controle global de edição de usuários
let idMembroSendoEditado = null;

async function carregarMembrosCadastrados() {
    console.log("Iniciando busca de membros no banco...");
    
    // Tenta encontrar a área da aba de membros de várias formas possíveis
    let abaMembros = document.getElementById("aba-membros") || document.getElementById("membros");
    
    // Se o ID for diferente, procura o container através do campo de nome que sabemos que existe
    if (!abaMembros) {
        const inputNome = document.getElementById("membro-nome-real");
        if (inputNome) abaMembros = inputNome.parentElement;
    }

    if (!abaMembros) {
        console.error("Erro: Não encontrei onde desenhar a lista no HTML (ID da aba não encontrado).");
        return;
    }

    let container = document.getElementById("lista-membros-render");
    if (!container) {
        container = document.createElement("div");
        container.id = "lista-membros-render";
        container.style.marginTop = "30px";
        container.style.borderTop = "1px solid #444";
        container.style.paddingTop = "20px";
        abaMembros.appendChild(container);
    }
    
    container.innerHTML = "<p style='color: #aaa;'>Buscando membros no servidor...</p>";
    
    try {
        const snapshot = await window.ClubeDB.textoDB.collection("usuarios").get();
        console.log("Encontrei " + snapshot.size + " membro(s) no banco de dados.");
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='color: #aaa;'>Nenhum membro cadastrado ainda.</p>";
            return;
        }

        container.innerHTML = "<h3 style='margin-bottom:15px;'>Membros Cadastrados</h3>"; 
        
        snapshot.forEach(doc => {
            const m = doc.data();
            const id = doc.id;
            const urlFoto = m.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';

            container.innerHTML += `
                <div class="item-membro" style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: #2b2b2b; border-radius: 8px;">
                    <img src="${urlFoto}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${m.nomeReal || 'Sem Nome'}</div>
                        <div style="font-size: 12px; color: #aaa;">${m.cargo || 'Membro'} | ${m.unidade || 'Sem unidade'}</div>
                    </div>
                    <button onclick="prepararEdicaoMembro('${id}', ${JSON.stringify(m).replace(/"/g, '&quot;')})" style="padding: 5px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; border: none;">✏️ Editar</button>
                    <button onclick="deletarMembro('${id}', '${m.fotoIdPublico || ''}')" style="padding: 5px 10px; font-size: 12px; background: #ff4d4d; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ Apagar</button>
                </div>
            `;
        });
    } catch (erro) {
        console.error("Erro do Firebase:", erro);
        container.innerHTML = `<p style="color: #ff4d4d;">Erro ao carregar membros: ${erro.message}</p>`;
    }
}

function prepararEdicaoMembro(id, dados) {
    idMembroSendoEditado = id;
    
    document.getElementById("membro-username").value = dados.username || "";
    document.getElementById("membro-senha").value = dados.senha || "";
    document.getElementById("membro-nome-real").value = dados.nomeReal || "";
    document.getElementById("membro-tipo").value = dados.tipo || "Desbravador";
    
    controlarExibicaoSelecaoUnidade();
    const campoUnidade = document.getElementById("membro-unidade-vinculo");
    if (campoUnidade) campoUnidade.value = dados.unidade || "";
    
    document.getElementById("membro-cargo").value = dados.cargo || "";
    document.getElementById("membro-nascimento").value = dados.dataNascimento || "";
    
    if (dados.fotoUrl) {
        document.getElementById("previa-membro-img").src = dados.fotoUrl;
    }

    const btn = document.querySelector("#aba-membros button");
    if (btn) btn.textContent = "💾 Salvar Alterações do Membro";
    
    document.getElementById("aba-membros").scrollIntoView({ behavior: 'smooth' });
}

async function deletarMembro(id, idFoto) {
    if (!confirm("Tem certeza que deseja apagar este membro permanentemente?")) return;
    try {
        if (idFoto && idFoto !== "undefined" && window.ClubeDB.acoesAdmin.excluirFoto) {
            await window.ClubeDB.acoesAdmin.excluirFoto(idFoto);
        }
        await window.ClubeDB.textoDB.collection("usuarios").doc(id).delete();
        alert("Membro removido com sucesso!");
        carregarMembrosCadastrados();
    } catch (erro) {
        alert("Erro ao remover membro: " + erro.message);
    }
}

// ==========================================
// CONTROLE DE TAMANHO DA LOGO DO HEADER
// ==========================================

window.alterarTamanhoLogoEmTempoReal = function(valor) {
    const logoImg = document.getElementById("site-logo-img");
    if (logoImg) {
        logoImg.style.maxHeight = valor + "px";
        logoImg.style.height = valor + "px";
        logoImg.style.maxWidth = "250px";
    }
};

window.salvarTamanhoLogoBD = async function() {
    const slider = document.getElementById("logo-tamanho-slider");
    if (!slider) return;
    
    const tamanho = slider.value;
    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        await docRef.set({ logoTamanho: Number(tamanho) }, { merge: true });
        alert("Tamanho da logo salvo com sucesso! 📐");
    } catch (e) {
        alert("Erro ao salvar tamanho da logo: " + e.message);
    }
};

// ==========================================
// CONTROLE DE TAMANHO DO FAVICON (MINIATURA)
// ==========================================

window.alterarTamanhoFaviconEmTempoReal = function(valor) {
    const previaFaviconAdmin = document.getElementById("previa-favicon");
    if (previaFaviconAdmin) {
        previaFaviconAdmin.style.setProperty('height', valor + 'px', 'important');
        previaFaviconAdmin.style.setProperty('max-height', valor + 'px', 'important');
        previaFaviconAdmin.style.setProperty('width', 'auto', 'important');
    }
    ['site-favicon', 'favicon-img', 'site-favicon-img', 'site-miniatura', 'miniatura-img'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.setProperty('height', valor + 'px', 'important');
            el.style.setProperty('max-height', valor + 'px', 'important');
            el.style.setProperty('width', 'auto', 'important');
        }
    });
};

window.salvarTamanhoFaviconBD = async function() {
    const slider = document.getElementById("favicon-tamanho-slider");
    if (!slider) return;
    
    const tamanho = slider.value;
    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        await docRef.set({ faviconTamanho: Number(tamanho) }, { merge: true });
        alert("Tamanho da miniatura salvo com sucesso! 📐");
    } catch (e) {
        alert("Erro ao salvar tamanho da miniatura: " + e.message);
    }
};
// ==========================================
// === LÓGICA: PROGRESSO (ESP, MEST, CLAS) ===
// ==========================================

// Caches globais para performance instantânea
window.cacheEspecialidades = [];
window.cacheMestrados = [];
window.cacheClasses = [];

// Fallbacks de segurança para Mestrados e Classes (caso ainda não estejam criados no Firebase)
const fallbackMestrados = [
    { id: "mest_1", nome: "Mestrado em Ecologia", categoria: "Ciência e Natureza", urlImagem: "" },
    { id: "mest_2", nome: "Mestrado em Artes Manuais", categoria: "Artes e Ofícios", urlImagem: "" }
];
const fallbackClasses = [
    { id: "cl_1", nome: "Amigo", categoria: "Regulares", urlImagem: "" },
    { id: "cl_2", nome: "Companheiro", categoria: "Regulares", urlImagem: "" },
    { id: "cl_3", nome: "Guia", categoria: "Regulares", urlImagem: "" },
    { id: "cl_4", nome: "Líder", categoria: "Liderança", urlImagem: "" }
];

// Auxiliar para limpar acentos e maiúsculas
function normalizarTextoBusca(texto) {
    if (!texto) return "";
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// === FUNÇÃO DISPARADA AO CLICAR NA ABA PROGRESSO ===
// === FUNÇÃO DISPARADA AO CLICAR NA ABA PROGRESSO ===
async function carregarEspecialidades() {
    fecharCatalogoEspecialidades();
    fecharCatalogoMestrados();
    fecharCatalogoClasses();

    const username = localStorage.getItem("usernameLogado");

    if (!username) {
        return;
    }

    try {
        const db = window.ClubeDB.textoDB;

        // =====================================================
        // 1. ESPECIALIDADES
        // =====================================================
        try {
            const snapEspecialidades = await db
                .collection("especialidades")
                .get();

            const mapaEspecialidades = new Map();

            snapEspecialidades.docs.forEach(doc => {
                const dados = doc.data() || {};

                // PREVENÇÃO DE RESSURREIÇÃO (SOFT DELETE)
                // Ignora a especialidade se ela foi marcada como excluída logicamente.
                if (dados.excluida === true || dados.status === "inativa" || dados.status === "excluida") {
                    return;
                }

                const item = {
                    id: String(doc.id),
                    ...dados,
                    categoria:
                        dados.categoria ||
                        dados.area ||
                        "Geral",
                    urlImagem:
                        dados.urlImagem ||
                        dados.logo ||
                        ""
                };

                /*
                 * Remove duplicidades apenas dentro do catálogo
                 * carregado do Firebase.
                 *
                 * O documento do Firebase continua sendo a
                 * fonte oficial do item.
                 */
                const chave =
                    `${(item.nome || "").trim().toLowerCase()}|` +
                    `${(item.categoria || "").trim().toLowerCase()}`;

                if (!mapaEspecialidades.has(chave)) {
                    mapaEspecialidades.set(chave, item);
                }
            });

            /*
             * IMPORTANTE:
             * Se o Firebase estiver vazio, o cache também fica vazio.
             *
             * Não usamos listaEspecialidadesParaImportar como fallback
             * aqui, porque um item apagado pelo administrador não pode
             * reaparecer automaticamente.
             */
            window.cacheEspecialidades = [
                ...mapaEspecialidades.values()
            ];
        } catch (erroEspecialidades) {
            console.error(
                "Erro ao carregar especialidades do Firebase:",
                erroEspecialidades
            );

            /*
             * Em caso de erro real de leitura, limpamos o cache
             * para evitar mostrar dados antigos que possam ter sido
             * excluídos do banco.
             */
            window.cacheEspecialidades = [];
        }

        renderizarCatalogoEspecialidades(
            window.cacheEspecialidades
        );

        await carregarEspecialidadesEmAndamento();


        // =====================================================
        // 2. MESTRADOS
        // =====================================================
        try {
            const snapMestrados = await db
                .collection("mestrados")
                .get();

            /*
             * O catálogo agora representa EXATAMENTE o Firebase.
             *
             * Se não houver nenhum documento na coleção,
             * o resultado será [].
             *
             * NÃO usamos fallbackMestrados aqui.
             */
            window.cacheMestrados = [];
            
            snapMestrados.docs.forEach(doc => {
                const dados = doc.data() || {};
                
                // PREVENÇÃO DE RESSURREIÇÃO (SOFT DELETE)
                if (dados.excluida === true || dados.status === "inativa" || dados.status === "excluida") {
                    return;
                }

                window.cacheMestrados.push({
                    id: String(doc.id),
                    ...dados,
                    categoria:
                        dados.categoria ||
                        dados.area ||
                        "Mestrado",
                    urlImagem:
                        dados.urlImagem ||
                        dados.logo ||
                        ""
                });
            });
        } catch (erroMestrados) {
            console.error(
                "Erro ao carregar mestrados do Firebase:",
                erroMestrados
            );

            window.cacheMestrados = [];
        }

        renderizarCatalogoMestrados(
            window.cacheMestrados
        );

        await carregarMestradosEmAndamento();


        // =====================================================
        // 3. CLASSES
        // =====================================================
        try {
            const snapClasses = await db
                .collection("classes")
                .get();

            /*
             * O catálogo agora representa EXATAMENTE o Firebase.
             *
             * Se a coleção estiver vazia, fica vazio.
             *
             * NÃO usamos fallbackClasses aqui.
             */
            window.cacheClasses = [];
            
            snapClasses.docs.forEach(doc => {
                const dados = doc.data() || {};
                
                // PREVENÇÃO DE RESSURREIÇÃO (SOFT DELETE)
                if (dados.excluida === true || dados.status === "inativa" || dados.status === "excluida") {
                    return;
                }

                window.cacheClasses.push({
                    id: String(doc.id),
                    ...dados,
                    categoria:
                        dados.categoria ||
                        "Classe",
                    urlImagem:
                        dados.urlImagem ||
                        dados.logo ||
                        ""
                });
            });
        } catch (erroClasses) {
            console.error(
                "Erro ao carregar classes do Firebase:",
                erroClasses
            );

            window.cacheClasses = [];
        }

        renderizarCatalogoClasses(
            window.cacheClasses
        );

        await carregarClassesEmAndamento();

    } catch (erro) {
        console.error(
            "Erro crítico no carregamento dos catálogos:",
            erro
        );

        /*
         * Em uma falha geral, não mantemos caches antigos.
         * Isso evita que itens já apagados continuem visualmente
         * disponíveis por causa de dados antigos em memória.
         */
        window.cacheEspecialidades = [];
        window.cacheMestrados = [];
        window.cacheClasses = [];
    }
}



// ==========================================
// CONTROLE DE VISIBILIDADE DOS CATÁLOGOS
// ==========================================
async function abrirCatalogoEspecialidades() {
    document.getElementById("tela-especialidades-andamento").style.display = "none";
    document.getElementById("tela-especialidades-catalogo").style.display = "block";
    document.getElementById("busca-especialidade").value = "";

    const container = document.getElementById("lista-especialidades-container");
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    window.especialidadesAdquiridasUsuario = new Set();

    if (container) {
        container.innerHTML = "<p style='color:#8e8e8e;text-align:center;padding:20px;'>Verificando suas especialidades...</p>";
    }

    if (username && tipoUsuario !== "admin") {
        try {
            const userSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (!userSnap.empty) {
                const dadosUsuario = userSnap.docs[0].data();

                const especialidadesAdquiridas = Array.isArray(dadosUsuario.especialidades)
                    ? dadosUsuario.especialidades
                    : [];

                window.especialidadesAdquiridasUsuario = new Set(
                    especialidadesAdquiridas.map(nomeEspecialidade =>
                        normalizarTextoBusca(nomeEspecialidade).trim()
                    )
                );
            }
        } catch (erro) {
            console.error("Erro ao verificar especialidades já adquiridas:", erro);
        }
    }

    renderizarCatalogoEspecialidades(window.cacheEspecialidades);
}
function fecharCatalogoEspecialidades() {
    document.getElementById("tela-especialidades-catalogo").style.display = "none";
    document.getElementById("tela-especialidades-andamento").style.display = "block";
}

async function abrirCatalogoMestrados() {
    document.getElementById("tela-especialidades-andamento").style.display = "none";
    document.getElementById("tela-mestrados-catalogo").style.display = "block";
    document.getElementById("busca-mestrado").value = "";

    const container = document.getElementById("lista-mestrados-container");
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    /*
     * Armazena somente os nomes normalizados.
     * Isso evita falhas causadas por letras maiúsculas,
     * minúsculas ou acentos diferentes.
     */
    window.mestradosAdquiridosUsuario = new Set();

    if (container) {
        container.innerHTML = `
            <p style="color:#8e8e8e; text-align:center; padding:20px;">
                Verificando seus mestrados...
            </p>
        `;
    }

    if (username && tipoUsuario !== "admin") {
        try {
            const usuarioSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (!usuarioSnap.empty) {
                const dadosUsuario = usuarioSnap.docs[0].data();

                const mestradosAdquiridos = Array.isArray(dadosUsuario.mestrados)
                    ? dadosUsuario.mestrados
                    : [];

                window.mestradosAdquiridosUsuario = new Set(
                    mestradosAdquiridos.map(nomeMestrado =>
                        normalizarTextoBusca(nomeMestrado).trim()
                    )
                );
            }
        } catch (erro) {
            console.error(
                "Erro ao verificar os mestrados já adquiridos:",
                erro
            );
        }
    }

    renderizarCatalogoMestrados(window.cacheMestrados);
}
function fecharCatalogoMestrados() {
    document.getElementById("tela-mestrados-catalogo").style.display = "none";
    document.getElementById("tela-especialidades-andamento").style.display = "block";
}

async function abrirCatalogoClasses() {
    document.getElementById("tela-especialidades-andamento").style.display = "none";
    document.getElementById("tela-classes-catalogo").style.display = "block";
    document.getElementById("busca-classe").value = "";

    const container = document.getElementById("lista-classes-container");
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    window.classesConcluidasUsuario = new Set();

    if (container) {
        container.innerHTML = `
            <p style="color:#8e8e8e; text-align:center; padding:20px;">
                Verificando suas classes concluídas...
            </p>
        `;
    }

    if (username && tipoUsuario !== "admin") {
        try {
            const usuarioSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (!usuarioSnap.empty) {
                const dadosUsuario = usuarioSnap.docs[0].data();

                const classesConcluidas = Array.isArray(dadosUsuario.classesConcluidas)
                    ? dadosUsuario.classesConcluidas
                    : [];

                window.classesConcluidasUsuario = new Set(
                    classesConcluidas.map(nomeClasse =>
                        normalizarTextoBusca(nomeClasse).trim()
                    )
                );
            }
        } catch (erro) {
            console.error(
                "Erro ao verificar as classes já concluídas:",
                erro
            );
        }
    }

    renderizarCatalogoClasses(window.cacheClasses);
}
function fecharCatalogoClasses() {
    document.getElementById("tela-classes-catalogo").style.display = "none";
    document.getElementById("tela-especialidades-andamento").style.display = "block";
}


// ==========================================
// ESTADOS ATUAIS DE CATEGORIA
// ==========================================
window.categoriaAtualEspecialidades = null;
window.categoriaAtualMestrados = null;
window.categoriaAtualClasses = null;

// ==========================================
// MECANISMO DE BUSCA LOCAL
// ==========================================
function pesquisarEspecialidadeLocal() {
    const termo = normalizarTextoBusca(document.getElementById("busca-especialidade").value);
    let filtrados = window.cacheEspecialidades;

    if (window.categoriaAtualEspecialidades && window.categoriaAtualEspecialidades !== 'Todas') {
        filtrados = filtrados.filter(e => (e.categoria || e.area || "Geral") === window.categoriaAtualEspecialidades);
    }

    filtrados = filtrados.filter(e => 
        normalizarTextoBusca(e.nome).includes(termo) || normalizarTextoBusca(e.categoria || e.area).includes(termo)
    );
    renderizarCatalogoEspecialidades(filtrados, true);
}

function pesquisarMestradoLocal() {
    const termo = normalizarTextoBusca(document.getElementById("busca-mestrado").value);
    let filtrados = window.cacheMestrados;

    if (window.categoriaAtualMestrados && window.categoriaAtualMestrados !== 'Todas') {
        filtrados = filtrados.filter(m => (m.categoria || m.area || "Mestrado") === window.categoriaAtualMestrados);
    }

    filtrados = filtrados.filter(m => 
        normalizarTextoBusca(m.nome).includes(termo) || normalizarTextoBusca(m.categoria || m.area).includes(termo)
    );
    renderizarCatalogoMestrados(filtrados, true);
}

function pesquisarClasseLocal() {
    const termo = normalizarTextoBusca(document.getElementById("busca-classe").value);
    let filtrados = window.cacheClasses;

    if (window.categoriaAtualClasses && window.categoriaAtualClasses !== 'Todas') {
        filtrados = filtrados.filter(c => (c.categoria || "Classe") === window.categoriaAtualClasses);
    }

    filtrados = filtrados.filter(c => 
        normalizarTextoBusca(c.nome).includes(termo) || normalizarTextoBusca(c.categoria).includes(termo)
    );
    renderizarCatalogoClasses(filtrados, true);
}


// ==========================================
// RENDERIZAÇÃO DOS CATÁLOGOS (PASTAS / AGRUPADOS)
// ==========================================
function renderizarCatalogoEspecialidades(lista, manterEstado = false) {
    const container = document.getElementById("lista-especialidades-container");
    if (!container) return;

    const inputBusca = document.getElementById("busca-especialidade");
    const termoBusca = inputBusca ? inputBusca.value.trim() : "";

    if (!manterEstado && !termoBusca) {
        window.categoriaAtualEspecialidades = null;
    }

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div style="margin-bottom:15px;">
                <button onclick="window.categoriaAtualEspecialidades = null; document.getElementById('busca-especialidade').value = ''; renderizarCatalogoEspecialidades(window.cacheEspecialidades);"
                    style="background:transparent; border:none; color:#007bff; cursor:pointer; font-size:13px; font-weight:bold; padding:0;">
                    ⬅ Voltar
                </button>
            </div>
            <p style="color:#8e8e8e; text-align:center;">Nenhum resultado encontrado.</p>
        `;
        return;
    }

    const tipoUsuario = localStorage.getItem("usuarioLogado");

    const especialidadesAdquiridas =
        window.especialidadesAdquiridasUsuario instanceof Set
            ? window.especialidadesAdquiridasUsuario
            : new Set();

    const categorias = {};

    lista.forEach(item => {
        const cat = item.categoria || item.area || "Geral";

        if (!categorias[cat]) {
            categorias[cat] = [];
        }

        categorias[cat].push(item);
    });

    let visualizacaoAtiva = window.categoriaAtualEspecialidades;

    if (termoBusca && !visualizacaoAtiva) {
        visualizacaoAtiva = "Todas";
    }

    if (!visualizacaoAtiva) {
        let htmlCategorias = `
            <div onclick="window.categoriaAtualEspecialidades = 'Todas'; renderizarCatalogoEspecialidades(window.cacheEspecialidades, true);"
                style="background:#1e1e1e; border:1px solid #333; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:12px; transition:0.2s;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:22px;">🌟</span>
                    <span style="color:#fff; font-weight:bold; font-size:15px;">
                        Todas as Especialidades
                    </span>
                </div>

                <span style="color:#007bff; font-size:13px; font-weight:bold;">
                    ${lista.length} itens &gt;
                </span>
            </div>
        `;

        Object.entries(categorias)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([cat, itens]) => {
                htmlCategorias += `
                    <div onclick="window.categoriaAtualEspecialidades = '${cat}'; renderizarCatalogoEspecialidades(window.cacheEspecialidades, true);"
                        style="background:#121212; border:1px solid #262626; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:8px; transition:0.2s;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:18px;">📁</span>
                            <span style="color:#fff; font-weight:500; font-size:14px;">
                                ${cat}
                            </span>
                        </div>

                        <span style="color:#8e8e8e; font-size:12px; font-weight:600;">
                            ${itens.length} itens &gt;
                        </span>
                    </div>
                `;
            });

        container.innerHTML = htmlCategorias;
        return;
    }

    let htmlFinal = `
        <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <button onclick="window.categoriaAtualEspecialidades = null; document.getElementById('busca-especialidade').value = ''; renderizarCatalogoEspecialidades(window.cacheEspecialidades, false);"
                style="background:transparent; border:none; color:#007bff; cursor:pointer; font-size:14px; font-weight:bold; display:flex; align-items:center; gap:5px; padding:0;">
                ⬅ Voltar às Pastas
            </button>

            <span style="color:#8e8e8e; font-size:12px; max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;">
                ${visualizacaoAtiva}
            </span>
        </div>
    `;

    const categoriasParaRenderizar =
        visualizacaoAtiva === "Todas"
            ? categorias
            : {
                [visualizacaoAtiva]:
                    categorias[visualizacaoAtiva] || []
            };

    htmlFinal += Object.entries(categoriasParaRenderizar)
        .map(([cat, itens]) => {
            if (!itens || itens.length === 0) {
                return "";
            }

            return `
                <div>
                    <h4 style="color:#007bff; font-size:12px; margin-bottom:8px; border-left:3px solid #007bff; padding-left:6px; text-transform:uppercase;">
                        ${cat}
                    </h4>

                    <div style="display:grid; gap:8px; width:100%; margin-bottom:15px;">
                        ${itens
                            .map(e => {
                                const especialidadeConcluida =
                                    tipoUsuario !== "admin" &&
                                    especialidadesAdquiridas.has(
                                        normalizarTextoBusca(e.nome).trim()
                                    );

                                const fundoCard = especialidadeConcluida
                                    ? "#102418"
                                    : "#121212";

                                const bordaCard = especialidadeConcluida
                                    ? "#28a745"
                                    : "#262626";

                                const corNome = especialidadeConcluida
                                    ? "#5ee27a"
                                    : "#fff";

                                const corBotao = especialidadeConcluida
                                    ? "#28a745"
                                    : "#007bff";

                                const textoBotao = especialidadeConcluida
                                    ? "✓ Rever checklist"
                                    : "Começar";

                                return `
                                    <div style="background:${fundoCard}; border:1px solid ${bordaCard}; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                                            <img
                                                src="${e.urlImagem || e.logo || "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png"}"
                                                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                                                style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0; border:${especialidadeConcluida ? "1px solid #28a745" : "none"};"
                                            >

                                            <div style="min-width:0; flex:1;">
                                                <div style="font-weight:bold; color:${corNome}; font-size:13px; word-break:break-word;">
                                                    ${e.nome}
                                                </div>

                                                ${
                                                    especialidadeConcluida
                                                        ? `
                                                            <div style="color:#28a745; font-size:10px; font-weight:bold; margin-top:3px;">
                                                                ESPECIALIDADE CONCLUÍDA
                                                            </div>
                                                        `
                                                        : ""
                                                }
                                            </div>
                                        </div>

                                                                                <div style="display:flex; flex-direction:column; gap:6px; min-width:92px;">

                                            <button
                                                onclick="solicitarInicioEspecialidade('${e.id}', '${e.nome}', 'iniciar')"
                                                style="width:100%; padding:6px 10px; background:${corBotao}; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                                ${textoBotao}
                                            </button>

                                            <button
                                                onclick="solicitarInicioEspecialidade('${e.id}', '${e.nome}', 'visualizar')"
                                                style="width:100%; padding:6px 10px; background:#262626; color:#fff; border:1px solid #444; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                                Ver
                                            </button>

                                            ${
                                                tipoUsuario === "admin"
                                                    ? `
                                                        <button
                                                            onclick="abrirModalGerenciarItem('especialidades', '${e.id}')"
                                                            style="width:100%; background:#333; color:#fff; border:none; border-radius:6px; padding:6px 8px; font-size:11px; cursor:pointer;">
                                                            Editar
                                                        </button>
                                                    `
                                                    : ""
                                            }

                                        </div>
                                    </div>
                                `;
                            })
                            .join("")}
                    </div>
                </div>
            `;
        })
        .join("");

    container.innerHTML = htmlFinal;
}



function renderizarCatalogoClasses(lista, manterEstado = false) {
    const container = document.getElementById("lista-classes-container");
    if (!container) return;

    const inputBusca = document.getElementById("busca-classe");
    const termoBusca = inputBusca ? inputBusca.value.trim() : "";

    if (!manterEstado && !termoBusca) {
        window.categoriaAtualClasses = null;
    }

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div style="margin-bottom:15px;">
                <button
                    onclick="window.categoriaAtualClasses = null; document.getElementById('busca-classe').value = ''; renderizarCatalogoClasses(window.cacheClasses);"
                    style="background:transparent; border:none; color:#ffc107; cursor:pointer; font-size:13px; font-weight:bold; padding:0;">
                    ⬅ Voltar
                </button>
            </div>

            <p style="color:#8e8e8e; text-align:center;">
                Nenhum resultado encontrado.
            </p>
        `;
        return;
    }

    const tipoUsuario = localStorage.getItem("usuarioLogado");

    const classesConcluidas =
        window.classesConcluidasUsuario instanceof Set
            ? window.classesConcluidasUsuario
            : new Set();

    const categorias = {};

    lista.forEach(item => {
        const cat = item.categoria || "Classe";

        if (!categorias[cat]) {
            categorias[cat] = [];
        }

        categorias[cat].push(item);
    });

    let visualizacaoAtiva = window.categoriaAtualClasses;

    if (termoBusca && !visualizacaoAtiva) {
        visualizacaoAtiva = "Todas";
    }

    if (!visualizacaoAtiva) {
        let htmlCategorias = `
            <div
                onclick="window.categoriaAtualClasses = 'Todas'; renderizarCatalogoClasses(window.cacheClasses, true);"
                style="background:#1e1e1e; border:1px solid #333; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:12px; transition:0.2s;">

                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:22px;">🌟</span>

                    <span style="color:#fff; font-weight:bold; font-size:15px;">
                        Todas as Categorias
                    </span>
                </div>

                <span style="color:#ffc107; font-size:13px; font-weight:bold;">
                    ${lista.length} itens &gt;
                </span>
            </div>
        `;

        Object.entries(categorias)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([cat, itens]) => {
                htmlCategorias += `
                    <div
                        onclick="window.categoriaAtualClasses = '${cat}'; renderizarCatalogoClasses(window.cacheClasses, true);"
                        style="background:#121212; border:1px solid #262626; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:8px; transition:0.2s;">

                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:18px;">📁</span>

                            <span style="color:#fff; font-weight:500; font-size:14px;">
                                ${cat}
                            </span>
                        </div>

                        <span style="color:#8e8e8e; font-size:12px; font-weight:600;">
                            ${itens.length} itens &gt;
                        </span>
                    </div>
                `;
            });

        container.innerHTML = htmlCategorias;
        return;
    }

    let htmlFinal = `
        <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <button
                onclick="window.categoriaAtualClasses = null; document.getElementById('busca-classe').value = ''; renderizarCatalogoClasses(window.cacheClasses, false);"
                style="background:transparent; border:none; color:#ffc107; cursor:pointer; font-size:14px; font-weight:bold; display:flex; align-items:center; gap:5px; padding:0;">
                ⬅ Voltar às Pastas
            </button>

            <span style="color:#8e8e8e; font-size:12px; max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;">
                ${visualizacaoAtiva}
            </span>
        </div>
    `;

    const categoriasParaRenderizar =
        visualizacaoAtiva === "Todas"
            ? categorias
            : {
                [visualizacaoAtiva]:
                    categorias[visualizacaoAtiva] || []
            };

    htmlFinal += Object.entries(categoriasParaRenderizar)
        .map(([cat, itens]) => {
            if (!itens || itens.length === 0) {
                return "";
            }

            return `
                <div style="width:100%;">
                    <h4 style="color:#ffc107; font-size:12px; margin-bottom:8px; border-left:3px solid #ffc107; padding-left:6px; text-transform:uppercase;">
                        ${cat}
                    </h4>

                    <div style="display:grid; gap:8px; width:100%; margin-bottom:15px;">
                        ${itens
                            .map(c => {
                                const classeConcluida =
                                    tipoUsuario !== "admin" &&
                                    classesConcluidas.has(
                                        normalizarTextoBusca(c.nome).trim()
                                    );

                                const fundoCard = classeConcluida
                                    ? "#102418"
                                    : "#121212";

                                const bordaCard = classeConcluida
                                    ? "#28a745"
                                    : "#262626";

                                const corNome = classeConcluida
                                    ? "#5ee27a"
                                    : "#fff";

                                const corBotao = classeConcluida
                                    ? "#28a745"
                                    : "#ffc107";

                                const corTextoBotao = classeConcluida
                                    ? "#fff"
                                    : "#121212";

                                const textoBotao = classeConcluida
                                    ? "✓ Rever checklist"
                                    : "Começar";

                                return `
                                    <div
                                        style="background:${fundoCard}; border:1px solid ${bordaCard}; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; ${classeConcluida ? "box-shadow:0 0 0 1px rgba(40,167,69,0.15);" : ""}">

                                        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                                            <img
                                                src="${c.urlImagem || c.logo || "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png"}"
                                                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                                                style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0; border:${classeConcluida ? "1px solid #28a745" : "none"};"
                                            >

                                            <div style="min-width:0; flex:1;">
                                                <div style="font-weight:bold; color:${corNome}; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                    ${c.nome}
                                                </div>

                                                ${
                                                    classeConcluida
                                                        ? `
                                                            <div style="color:#28a745; font-size:10px; font-weight:bold; margin-top:3px;">
                                                                CLASSE CONCLUÍDA
                                                            </div>
                                                        `
                                                        : ""
                                                }
                                            </div>
                                        </div>

                                                                                <div style="display:flex; flex-direction:column; gap:6px; min-width:92px;">

                                            <button
                                                onclick="solicitarInicioClasse('${c.id}', '${c.nome}', 'iniciar')"
                                                style="width:100%; padding:6px 10px; background:${corBotao}; color:${corTextoBotao}; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                                ${textoBotao}
                                            </button>

                                            <button
                                                onclick="solicitarInicioClasse('${c.id}', '${c.nome}', 'visualizar')"
                                                style="width:100%; padding:6px 10px; background:#262626; color:#fff; border:1px solid #444; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                                Ver
                                            </button>

                                            ${
                                                tipoUsuario === "admin"
                                                    ? `
                                                        <button
                                                            onclick="abrirModalGerenciarItem('classes', '${c.id}')"
                                                            style="width:100%; background:#333; color:#fff; border:none; border-radius:6px; padding:6px 8px; font-size:11px; cursor:pointer;">
                                                            Editar
                                                        </button>
                                                    `
                                                    : ""
                                            }

                                        </div>
                                    </div>
                                `;
                            })
                            .join("")}
                    </div>
                </div>
            `;
        })
        .join("");

    container.innerHTML = htmlFinal;
}




// ==========================================
// SALVAR NO FIRESTORE (AÇÃO "COMEÇAR")
// ==========================================
async function solicitarInicioEspecialidade(id, nome, modo = "editar") {
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    const modoNormalizado =
        modo === "visualizar"
            ? "visualizar"
            : modo === "continuar"
                ? "continuar"
                : "editar";

    if (!username) {
        return alert("Por favor, faça login para iniciar.");
    }

    const item = window.cacheEspecialidades.find(
        e => String(e.id) === String(id)
    );

    if (!item) {
        alert("Especialidade não encontrada no catálogo.");
        return;
    }

    const requisitos = Array.isArray(item.requisitos)
        ? item.requisitos
        : [];

    const fotoUrl =
        item.urlImagem ||
        item.logo ||
        "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

    let especialidadeJaAdquirida = false;

    /*
     * Verificação principal no documento do usuário.
     * Não confiamos apenas na cor ou no cache do catálogo.
     */
    if (tipoUsuario !== "admin") {
        try {
            const userSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (userSnap.empty) {
                alert("Não foi possível localizar seu perfil.");
                return;
            }

            const dadosUsuario = userSnap.docs[0].data();

            const especialidadesAdquiridas =
                Array.isArray(dadosUsuario.especialidades)
                    ? dadosUsuario.especialidades
                    : [];

            especialidadeJaAdquirida = especialidadesAdquiridas.some(
                nomeAdquirido =>
                    normalizarTextoBusca(nomeAdquirido).trim() ===
                    normalizarTextoBusca(nome).trim()
            );
        } catch (erro) {
            console.error(
                "Erro ao verificar se a especialidade já foi adquirida:",
                erro
            );

            alert(
                "Não foi possível verificar suas especialidades. Tente novamente."
            );

            return;
        }
    }

    let progressoSalvo = [];

    /*
     * Carrega o progresso salvo quando existir.
     * Se for modo de visualização, não cria documento novo aqui.
     */
    if (!especialidadeJaAdquirida) {
        try {
            const snap = await window.ClubeDB.textoDB
                .collection("progresso_especialidades")
                .doc(`${username}_${id}`)
                .get();

            if (snap.exists) {
                progressoSalvo = snap.data().requisitosConcluidos || [];
            }
        } catch (erro) {
            console.error(
                "Erro ao carregar progresso da especialidade:",
                erro
            );
        }
    }

    const registrarInicioNoBanco = async () => {
        await window.ClubeDB.textoDB
            .collection("progresso_especialidades")
            .doc(`${username}_${id}`)
            .set(
                {
                    usuario: username,
                    itemId: id,
                    nomeItem: nome,
                    requisitosConcluidos: Array.isArray(progressoSalvo)
                        ? progressoSalvo
                        : [],
                    status: "em_andamento",
                    atualizadoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    merge: true
                }
            );
    };

    /*
     * Ação direta de "Começar" no catálogo:
     * confirma, grava o progresso e leva para "Em andamento".
     *
     * IMPORTANTE:
     * O modo "continuar" não entra aqui.
     * Portanto, ao clicar em "Continuar" nas especialidades
     * em andamento, o checklist abre diretamente.
     */
    if (modoNormalizado === "editar" && !especialidadeJaAdquirida) {
        const confirmarInicio = confirm(
            "Tem certeza que você quer começar esta especialidade?"
        );

        if (!confirmarInicio) {
            return;
        }

        try {
            await registrarInicioNoBanco();
            alert("Especialidade iniciada com sucesso!");

            fecharCatalogoEspecialidades();
            await carregarEspecialidadesEmAndamento();
        } catch (erro) {
            console.error("Erro ao iniciar especialidade:", erro);
            alert("Erro ao iniciar especialidade.");
        }

        return;
    }

    /*
     * Somente "visualizar" e especialidade já concluída
     * ficam em modo somente leitura.
     *
     * "continuar" fica fora daqui e, portanto,
     * continua sendo um checklist totalmente editável.
     */
    const somenteLeitura =
        modoNormalizado === "visualizar" || especialidadeJaAdquirida;

    const modal = document.createElement("div");

    modal.style =
        "position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:9999; display:flex; flex-direction:column; color:#fff;";

    modal.innerHTML = `
        <button
            id="btn-fechar-checklist-esp"
            style="position:absolute; top:20px; right:20px; background:none; border:none; color:#fff; font-size:30px; cursor:pointer; z-index:10001; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
            ✕
        </button>

        <div style="display:flex; flex-direction:column; align-items:center; padding:50px 15px 10px 15px; gap:10px;">
            <img
                src="${fotoUrl}"
                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                style="width:120px; height:120px; object-fit:cover; border-radius:12px; border:2px solid ${especialidadeJaAdquirida ? "#28a745" : "#262626"}; flex-shrink:0;"
            >

            <h3 style="margin:0; font-size:16px; text-align:center; color:${especialidadeJaAdquirida ? "#5ee27a" : "#fff"}; font-weight:bold;">
                ${nome}
            </h3>

            ${
                especialidadeJaAdquirida
                    ? `
                        <div style="background:#102418; color:#5ee27a; border:1px solid #28a745; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                            ✓ ESPECIALIDADE CONCLUÍDA
                        </div>
                    `
                    : modoNormalizado === "visualizar"
                        ? `
                            <div style="background:#121212; color:#0095f6; border:1px solid #262626; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                                👁️ VISUALIZAÇÃO SOMENTE LEITURA
                            </div>
                        `
                        : ""
            }
        </div>

        <div style="width:100%; border-bottom:1px solid #262626;"></div>

        <div style="flex:1; overflow-y:auto; padding:20px;">
            <p style="color:${especialidadeJaAdquirida ? "#5ee27a" : "#8e8e8e"}; font-size:13px; margin-bottom:20px;">
                ${
                    especialidadeJaAdquirida
                        ? "Checklist disponível somente para consulta. Esta especialidade não pode ser iniciada novamente."
                        : modoNormalizado === "visualizar"
                            ? "Você pode ver a checklist, mas não pode marcar nada aqui. Para iniciar, use o botão Começar."
                            : "Marque os requisitos concluídos. Seu progresso é salvo automaticamente."
                }
            </p>

            <div id="lista-checks">
                ${
                    requisitos.length > 0
                        ? requisitos
                            .map((req, i) => {
                                const requisitoMarcado =
                                    especialidadeJaAdquirida ||
                                    progressoSalvo.includes(i);

                                return `
                                    <label style="display:flex; align-items:flex-start; gap:12px; margin-bottom:18px; cursor:${somenteLeitura ? "default" : "pointer"}; background:${somenteLeitura ? "#102418" : "#121212"}; padding:12px; border-radius:8px; border:1px solid ${somenteLeitura ? "#28a745" : "#262626"};">
                                        <input
                                            type="checkbox"
                                            class="req-check"
                                            data-idx="${i}"
                                            ${requisitoMarcado ? "checked" : ""}
                                            ${somenteLeitura ? "disabled" : ""}
                                            style="width:20px; height:20px; margin-top:2px; accent-color:${somenteLeitura ? "#28a745" : "#0095f6"};"
                                        >

                                        <span style="font-size:14px; line-height:1.4; color:${somenteLeitura ? "#d8f5df" : "#fff"};">
                                            ${req}
                                        </span>
                                    </label>
                                `;
                            })
                            .join("")
                        : `
                            <p style="color:#8e8e8e; text-align:center; padding:20px;">
                                Nenhum requisito cadastrado para esta especialidade.
                            </p>
                        `
                }
            </div>
        </div>

        <div style="padding:15px; border-top:1px solid #262626; display:flex; flex-direction:column; gap:10px;">
            ${
                especialidadeJaAdquirida
                    ? `
                        <button
                            id="btn-fechar-revisao-esp"
                            style="width:100%; padding:14px; background:#28a745; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
                            Fechar checklist
                        </button>
                    `
                    : modoNormalizado === "visualizar"
                        ? `
                            <button
                                id="btn-comecar-esp"
                                style="width:100%; padding:14px; background:#28a745; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
                                Começar
                            </button>
                        `
                        : `
                            <button
                                id="btn-enviar-aval"
                                disabled
                                style="width:100%; padding:14px; background:#333; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px;">
                                Enviar para Avaliação
                            </button>

                            <button
                                id="btn-cancelar-esp"
                                style="width:100%; padding:12px; background:none; color:#ff4d4d; border:1px solid #ff4d4d; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer;">
                                Cancelar Especialidade
                            </button>
                        `
            }
        </div>
    `;

    document.body.appendChild(modal);

    const btnFechar = modal.querySelector("#btn-fechar-checklist-esp");

    btnFechar.onclick = () => {
        modal.remove();
        abrirCatalogoEspecialidades();
    };

    if (especialidadeJaAdquirida) {
        const btnFecharRevisao = modal.querySelector("#btn-fechar-revisao-esp");

        if (btnFecharRevisao) {
            btnFecharRevisao.onclick = () => {
                modal.remove();
                abrirCatalogoEspecialidades();
            };
        }

        return;
    }

    /*
     * Modo somente leitura.
     * O modo "continuar" não passa por este bloco.
     */
    if (modoNormalizado === "visualizar") {
        const btnComecar = modal.querySelector("#btn-comecar-esp");

        if (btnComecar) {
            btnComecar.onclick = async () => {
                const confirmarInicio = confirm(
                    "Tem certeza que você quer começar esta especialidade?"
                );

                if (!confirmarInicio) {
                    return;
                }

                try {
                    await registrarInicioNoBanco();
                    alert("Especialidade iniciada com sucesso!");

                    modal.remove();
                    fecharCatalogoEspecialidades();
                    await carregarEspecialidadesEmAndamento();
                } catch (erro) {
                    console.error("Erro ao iniciar especialidade:", erro);
                    alert("Erro ao iniciar especialidade.");
                }
            };
        }

        return;
    }

    const checks = modal.querySelectorAll(".req-check");

    const btnEnv = modal.querySelector("#btn-enviar-aval");
    const btnCancel = modal.querySelector("#btn-cancelar-esp");

    btnCancel.onclick = async () => {
        const confirmarCancelamento = confirm(
            "Tem certeza que deseja cancelar? Todo o seu progresso nesta especialidade será excluído."
        );

        if (!confirmarCancelamento) {
            return;
        }

        try {
            await window.ClubeDB.textoDB
                .collection("progresso_especialidades")
                .doc(`${username}_${id}`)
                .delete();

            alert("Especialidade cancelada.");

            modal.remove();
            carregarEspecialidades();
        } catch (erro) {
            console.error(
                "Erro ao cancelar especialidade:",
                erro
            );

            alert("Erro ao cancelar.");
        }
    };

    const atualizarEstadoBotao = () => {
        if (!btnEnv) {
            return;
        }

        const todosMarcados =
            requisitos.length > 0 &&
            Array.from(checks).every(
                checkbox => checkbox.checked
            );

        btnEnv.disabled = !todosMarcados;
        btnEnv.style.background = todosMarcados
            ? "#28a745"
            : "#333";
    };

    atualizarEstadoBotao();

    checks.forEach(checkbox => {
        checkbox.onchange = async () => {
            atualizarEstadoBotao();

            const requisitosConcluidos = Array.from(checks)
                .filter(itemCheckbox => itemCheckbox.checked)
                .map(itemCheckbox =>
                    parseInt(itemCheckbox.dataset.idx)
                );

            try {
                await window.ClubeDB.textoDB
                    .collection("progresso_especialidades")
                    .doc(`${username}_${id}`)
                    .set(
                        {
                            usuario: username,
                            itemId: id,
                            nomeItem: nome,
                            requisitosConcluidos:
                                requisitosConcluidos,
                            status: "em_andamento",
                            atualizadoEm:
                                firebase.firestore.FieldValue.serverTimestamp()
                        },
                        {
                            merge: true
                        }
                    );
            } catch (erro) {
                console.error(
                    "Erro ao salvar progresso:",
                    erro
                );
            }
        };
    });

    btnEnv.onclick = async () => {
        const confirmarEnvio = confirm(
            "Deseja enviar para avaliação?"
        );

        if (!confirmarEnvio) {
            return;
        }

        btnEnv.disabled = true;
        btnEnv.textContent = "Enviando...";

        try {
            /*
             * Segunda verificação de segurança imediatamente antes
             * do envio. Impede duplicação mesmo com duas abas abertas
             * ou com o catálogo desatualizado.
             */
            const userSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (!userSnap.empty) {
                const dadosUsuario =
                    userSnap.docs[0].data();

                const especialidadesAtuais =
                    Array.isArray(dadosUsuario.especialidades)
                        ? dadosUsuario.especialidades
                        : [];

                const jaPossuiAntesDoEnvio =
                    especialidadesAtuais.some(
                        nomeAdquirido =>
                            normalizarTextoBusca(
                                nomeAdquirido
                            ).trim() ===
                            normalizarTextoBusca(nome).trim()
                    );

                if (jaPossuiAntesDoEnvio) {
                    await window.ClubeDB.textoDB
                        .collection("progresso_especialidades")
                        .doc(`${username}_${id}`)
                        .delete();

                    alert(
                        "Esta especialidade já pertence ao seu perfil e não pode ser enviada novamente."
                    );

                    modal.remove();
                    abrirCatalogoEspecialidades();
                    return;
                }
            }

            await window.ClubeDB.textoDB
                .collection("pendencias_aprovacao")
                .add({
                    usuario: username,
                    itemId: id,
                    nomeItem: nome,
                    colecaoOrigem:
                        "progresso_especialidades",
                    status: "pendente",
                    enviadoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                });

            await window.ClubeDB.textoDB
                .collection("progresso_especialidades")
                .doc(`${username}_${id}`)
                .delete();

            alert("Enviado com sucesso!");

            modal.remove();
            carregarEspecialidades();
        } catch (erro) {
            console.error(
                "Erro ao enviar especialidade:",
                erro
            );

            alert("Erro ao enviar.");

            btnEnv.disabled = false;
            btnEnv.textContent =
                "Enviar para Avaliação";

            atualizarEstadoBotao();
        }
    };
}




async function solicitarInicioMestrado(id, nome, modo = "iniciar") {
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    if (!username) {
        alert("Por favor, faça login para iniciar.");
        return;
    }

    const item = window.cacheMestrados.find(
        mestrado => String(mestrado.id) === String(id)
    );

    if (!item) {
        alert("Mestrado não encontrado no catálogo.");
        return;
    }

    const requisitos = Array.isArray(item.requisitos)
        ? item.requisitos
        : Array.isArray(item.reqs)
            ? item.reqs
            : [];

    const fotoUrl =
        item.urlImagem ||
        item.logo ||
        "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

    let mestradoJaAdquirido = false;

    /*
     * Verificação definitiva diretamente no perfil do usuário.
     */
    if (tipoUsuario !== "admin") {
        try {
            const usuarioSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (usuarioSnap.empty) {
                alert("Não foi possível localizar seu perfil.");
                return;
            }

            const dadosUsuario = usuarioSnap.docs[0].data();

            const mestradosAdquiridos = Array.isArray(dadosUsuario.mestrados)
                ? dadosUsuario.mestrados
                : [];

            mestradoJaAdquirido = mestradosAdquiridos.some(
                nomeMestradoAdquirido =>
                    normalizarTextoBusca(nomeMestradoAdquirido).trim() ===
                    normalizarTextoBusca(nome).trim()
            );
        } catch (erro) {
            console.error(
                "Erro ao verificar os mestrados já adquiridos:",
                erro
            );

            alert(
                "Não foi possível verificar seus mestrados. Tente novamente."
            );

            return;
        }
    }

    let progressoSalvo = [];

    /*
     * Carrega o progresso somente para itens ainda não concluídos.
     */
    if (!mestradoJaAdquirido) {
        try {
            const progressoSnap = await window.ClubeDB.textoDB
                .collection("progresso_mestrados")
                .doc(`${username}_${id}`)
                .get();

            if (progressoSnap.exists) {
                const dadosProgresso = progressoSnap.data();

                progressoSalvo = Array.isArray(
                    dadosProgresso.requisitosConcluidos
                )
                    ? dadosProgresso.requisitosConcluidos
                    : [];
            }
        } catch (erro) {
            console.error(
                "Erro ao carregar o progresso do mestrado:",
                erro
            );
        }
    }

    /*
     * Função central para registrar o início do mestrado.
     * O progresso existente é preservado.
     */
    const registrarInicioNoBanco = async () => {
        await window.ClubeDB.textoDB
            .collection("progresso_mestrados")
            .doc(`${username}_${id}`)
            .set(
                {
                    usuario: username,
                    itemId: id,
                    nomeItem: nome,
                    requisitosConcluidos:
                        Array.isArray(progressoSalvo)
                            ? progressoSalvo
                            : [],
                    status: "em_andamento",
                    atualizadoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    merge: true
                }
            );
    };

    /*
     * Modo "iniciar":
     * usado pelo botão Começar do catálogo.
     */
    if (
        modo === "iniciar" &&
        !mestradoJaAdquirido
    ) {
        const confirmouInicio = confirm(
            "Tem certeza que você quer começar este mestrado?"
        );

        if (!confirmouInicio) {
            return;
        }

        try {
            await registrarInicioNoBanco();

            alert("Mestrado iniciado com sucesso!");

            fecharCatalogoMestrados();
            await carregarMestradosEmAndamento();
        } catch (erro) {
            console.error(
                "Erro ao iniciar o mestrado:",
                erro
            );

            alert("Erro ao iniciar mestrado.");
        }

        return;
    }

    /*
     * Item concluído:
     * abre somente para consulta.
     */
    if (mestradoJaAdquirido) {
        modo = "concluido";
    }

    const somenteLeitura =
        modo === "visualizar" ||
        modo === "concluido";

    const modal = document.createElement("div");

    modal.style =
        "position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:9999; display:flex; flex-direction:column; color:#fff;";

    modal.innerHTML = `
        <button
            id="btn-fechar-checklist-mest"
            style="position:absolute; top:20px; right:20px; background:none; border:none; color:#fff; font-size:30px; cursor:pointer; z-index:10001; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
            ✕
        </button>

        <div style="display:flex; flex-direction:column; align-items:center; padding:50px 15px 10px 15px; gap:10px;">
            <img
                src="${fotoUrl}"
                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                style="width:120px; height:120px; object-fit:cover; border-radius:12px; border:${mestradoJaAdquirido ? "#28a745" : "#262626"}; border-width:2px; border-style:solid; flex-shrink:0;"
            >

            <h3 style="margin:0; font-size:16px; text-align:center; color:${mestradoJaAdquirido ? "#5ee27a" : "#fff"}; font-weight:bold;">
                ${nome}
            </h3>

            ${
                mestradoJaAdquirido
                    ? `
                        <div style="background:#102418; color:#5ee27a; border:1px solid #28a745; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                            ✓ MESTRADO CONCLUÍDO
                        </div>
                    `
                    : modo === "visualizar"
                        ? `
                            <div style="background:#121212; color:#0095f6; border:1px solid #262626; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                                👁️ VISUALIZAÇÃO SOMENTE LEITURA
                            </div>
                        `
                        : `
                            <div style="background:#102418; color:#5ee27a; border:1px solid #28a745; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                                EM ANDAMENTO
                            </div>
                        `
            }
        </div>

        <div style="width:100%; border-bottom:1px solid #262626;"></div>

        <div style="flex:1; overflow-y:auto; padding:20px;">
            <p style="color:${mestradoJaAdquirido ? "#5ee27a" : modo === "visualizar" ? "#0095f6" : "#8e8e8e"}; font-size:13px; margin-bottom:20px;">
                ${
                    mestradoJaAdquirido
                        ? "Checklist disponível somente para consulta."
                        : modo === "visualizar"
                            ? "Você pode consultar os requisitos, mas não pode marcar nenhum item neste modo."
                            : "Marque os requisitos concluídos. Seu progresso será salvo automaticamente."
                }
            </p>

            <div id="lista-checks-mest">
                ${
                    requisitos.length > 0
                        ? requisitos
                            .map((req, i) => {
                                const requisitoMarcado =
                                    mestradoJaAdquirido ||
                                    progressoSalvo.includes(i);

                                return `
                                    <label
                                        style="display:flex; align-items:flex-start; gap:12px; margin-bottom:18px; cursor:${somenteLeitura ? "default" : "pointer"}; background:${somenteLeitura ? "#102418" : "#121212"}; padding:12px; border-radius:8px; border:1px solid ${somenteLeitura ? "#28a745" : "#262626"};">

                                        <input
                                            type="checkbox"
                                            class="req-check-mest"
                                            data-idx="${i}"
                                            ${requisitoMarcado ? "checked" : ""}
                                            ${somenteLeitura ? "disabled" : ""}
                                            style="width:20px; height:20px; margin-top:2px; accent-color:${somenteLeitura ? "#28a745" : "#0095f6"};"
                                        >

                                        <span style="font-size:14px; line-height:1.4; color:${somenteLeitura ? "#d8f5df" : "#fff"};">
                                            ${req}
                                        </span>
                                    </label>
                                `;
                            })
                            .join("")
                        : `
                            <p style="color:#8e8e8e; text-align:center; padding:20px;">
                                Nenhum requisito cadastrado para este mestrado.
                            </p>
                        `
                }
            </div>
        </div>

        <div style="padding:15px; border-top:1px solid #262626; display:flex; flex-direction:column; gap:10px;">
            ${
                mestradoJaAdquirido
                    ? `
                        <button
                            id="btn-fechar-revisao-mest"
                            style="width:100%; padding:14px; background:#28a745; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
                            Fechar checklist
                        </button>
                    `
                    : modo === "visualizar"
                        ? `
                            <button
                                id="btn-comecar-mest"
                                style="width:100%; padding:14px; background:#28a745; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
                                Começar
                            </button>
                        `
                        : `
                            <button
                                id="btn-enviar-aval-mest"
                                disabled
                                style="width:100%; padding:14px; background:#333; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px;">
                                Enviar para Avaliação
                            </button>

                            <button
                                id="btn-cancelar-mest"
                                style="width:100%; padding:12px; background:none; color:#ff4d4d; border:1px solid #ff4d4d; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer;">
                                Cancelar Mestrado
                            </button>
                        `
            }
        </div>
    `;

    document.body.appendChild(modal);

    const btnFechar = modal.querySelector(
        "#btn-fechar-checklist-mest"
    );

    btnFechar.onclick = () => {
        modal.remove();

        if (modo === "continuar") {
            carregarMestradosEmAndamento();
        } else {
            abrirCatalogoMestrados();
        }
    };

    /*
     * Item concluído: somente consulta.
     */
    if (mestradoJaAdquirido) {
        const btnFecharRevisao = modal.querySelector(
            "#btn-fechar-revisao-mest"
        );

        if (btnFecharRevisao) {
            btnFecharRevisao.onclick = () => {
                modal.remove();
                abrirCatalogoMestrados();
            };
        }

        return;
    }

    /*
     * Modo "Ver":
     * nenhuma alteração é permitida.
     */
    if (modo === "visualizar") {
        const btnComecar = modal.querySelector(
            "#btn-comecar-mest"
        );

        if (btnComecar) {
            btnComecar.onclick = async () => {
                const confirmouInicio = confirm(
                    "Tem certeza que você quer começar este mestrado?"
                );

                if (!confirmouInicio) {
                    return;
                }

                try {
                    await registrarInicioNoBanco();

                    alert("Mestrado iniciado com sucesso!");

                    modal.remove();

                    fecharCatalogoMestrados();
                    await carregarMestradosEmAndamento();
                } catch (erro) {
                    console.error(
                        "Erro ao iniciar o mestrado:",
                        erro
                    );

                    alert("Erro ao iniciar mestrado.");
                }
            };
        }

        return;
    }

    /*
     * A partir daqui estamos no modo "Continuar".
     */
    const checks = modal.querySelectorAll(
        ".req-check-mest"
    );

    const btnEnv = modal.querySelector(
        "#btn-enviar-aval-mest"
    );

    const btnCancel = modal.querySelector(
        "#btn-cancelar-mest"
    );

    /*
     * Cancelamento.
     */
    if (btnCancel) {
        btnCancel.onclick = async () => {
            const confirmouCancelamento = confirm(
                "Tem certeza que deseja cancelar? Todo o seu progresso neste mestrado será excluído."
            );

            if (!confirmouCancelamento) {
                return;
            }

            try {
                await window.ClubeDB.textoDB
                    .collection("progresso_mestrados")
                    .doc(`${username}_${id}`)
                    .delete();

                alert("Mestrado cancelado.");

                modal.remove();

                await carregarMestradosEmAndamento();
            } catch (erro) {
                console.error(
                    "Erro ao cancelar o mestrado:",
                    erro
                );

                alert("Erro ao cancelar.");
            }
        };
    }

    /*
     * Atualiza o estado do botão de envio.
     */
    const atualizarEstadoBotao = () => {
        if (!btnEnv) {
            return;
        }

        const todosMarcados =
            requisitos.length > 0 &&
            Array.from(checks).every(
                checkbox => checkbox.checked
            );

        btnEnv.disabled = !todosMarcados;
        btnEnv.style.background =
            todosMarcados
                ? "#28a745"
                : "#333";
    };

    atualizarEstadoBotao();

    /*
     * Salva progresso automaticamente.
     */
    checks.forEach(checkbox => {
        checkbox.onchange = async () => {
            atualizarEstadoBotao();

            const requisitosConcluidos =
                Array.from(checks)
                    .filter(
                        itemCheckbox =>
                            itemCheckbox.checked
                    )
                    .map(
                        itemCheckbox =>
                            parseInt(
                                itemCheckbox.dataset.idx
                            )
                    );

            try {
                await window.ClubeDB.textoDB
                    .collection("progresso_mestrados")
                    .doc(`${username}_${id}`)
                    .set(
                        {
                            usuario: username,
                            itemId: id,
                            nomeItem: nome,
                            requisitosConcluidos:
                                requisitosConcluidos,
                            status: "em_andamento",
                            atualizadoEm:
                                firebase.firestore.FieldValue.serverTimestamp()
                        },
                        {
                            merge: true
                        }
                    );
            } catch (erro) {
                console.error(
                    "Erro ao salvar progresso do mestrado:",
                    erro
                );
            }
        };
    });

    /*
     * Envio para avaliação.
     */
    if (btnEnv) {
        btnEnv.onclick = async () => {
            const confirmouEnvio = confirm(
                "Deseja enviar este mestrado para avaliação?"
            );

            if (!confirmouEnvio) {
                return;
            }

            btnEnv.disabled = true;
            btnEnv.textContent = "Enviando...";

            try {
                const usuarioSnap =
                    await window.ClubeDB.textoDB
                        .collection("usuarios")
                        .where(
                            "username",
                            "==",
                            username
                        )
                        .get();

                if (!usuarioSnap.empty) {
                    const dadosUsuario =
                        usuarioSnap.docs[0].data();

                    const mestradosAtuais =
                        Array.isArray(
                            dadosUsuario.mestrados
                        )
                            ? dadosUsuario.mestrados
                            : [];

                    const jaPossuiAntesDoEnvio =
                        mestradosAtuais.some(
                            nomeAdquirido =>
                                normalizarTextoBusca(
                                    nomeAdquirido
                                ).trim() ===
                                normalizarTextoBusca(
                                    nome
                                ).trim()
                        );

                    if (jaPossuiAntesDoEnvio) {
                        await window.ClubeDB.textoDB
                            .collection(
                                "progresso_mestrados"
                            )
                            .doc(`${username}_${id}`)
                            .delete();

                        alert(
                            "Este mestrado já pertence ao seu perfil e não pode ser enviado novamente."
                        );

                        modal.remove();
                        abrirCatalogoMestrados();

                        return;
                    }
                }

                await window.ClubeDB.textoDB
                    .collection(
                        "pendencias_aprovacao"
                    )
                    .add({
                        usuario: username,
                        itemId: id,
                        nomeItem: nome,
                        colecaoOrigem:
                            "progresso_mestrados",
                        status: "pendente",
                        enviadoEm:
                            firebase.firestore.FieldValue.serverTimestamp()
                    });

                await window.ClubeDB.textoDB
                    .collection(
                        "progresso_mestrados"
                    )
                    .doc(`${username}_${id}`)
                    .delete();

                alert("Enviado com sucesso!");

                modal.remove();

                await carregarMestradosEmAndamento();
                if (
                    typeof carregarAprovacoesSite ===
                    "function"
                ) {
                    carregarAprovacoesSite();
                }
            } catch (erro) {
                console.error(
                    "Erro ao enviar o mestrado:",
                    erro
                );

                alert("Erro ao enviar.");

                btnEnv.disabled = false;
                btnEnv.textContent =
                    "Enviar para Avaliação";

                atualizarEstadoBotao();
            }
        };
    }
}



async function solicitarInicioClasse(id, nome, modo = "iniciar") {
    const username = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    if (!username) {
        alert("Por favor, faça login para iniciar.");
        return;
    }

    const item = window.cacheClasses.find(
        classe => String(classe.id) === String(id)
    );

    if (!item) {
        alert("Classe não encontrada no catálogo.");
        return;
    }

    const requisitos = Array.isArray(item.requisitos)
        ? item.requisitos
        : [];

    const fotoUrl =
        item.urlImagem ||
        item.logo ||
        "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

    let classeJaConcluida = false;

    /*
     * Verificação definitiva diretamente no perfil do usuário.
     */
    if (tipoUsuario !== "admin") {
        try {
            const usuarioSnap = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "==", username)
                .get();

            if (usuarioSnap.empty) {
                alert("Não foi possível localizar seu perfil.");
                return;
            }

            const dadosUsuario = usuarioSnap.docs[0].data();

            const classesConcluidas = Array.isArray(
                dadosUsuario.classesConcluidas
            )
                ? dadosUsuario.classesConcluidas
                : [];

            classeJaConcluida = classesConcluidas.some(
                nomeClasseConcluida =>
                    normalizarTextoBusca(
                        nomeClasseConcluida
                    ).trim() ===
                    normalizarTextoBusca(
                        nome
                    ).trim()
            );
        } catch (erro) {
            console.error(
                "Erro ao verificar as classes já concluídas:",
                erro
            );

            alert(
                "Não foi possível verificar suas classes concluídas. Tente novamente."
            );

            return;
        }
    }

    let progressoSalvo = [];

    /*
     * Carrega o progresso existente.
     */
    if (!classeJaConcluida) {
        try {
            const progressoSnap =
                await window.ClubeDB.textoDB
                    .collection("progresso_classes")
                    .doc(`${username}_${id}`)
                    .get();

            if (progressoSnap.exists) {
                const dadosProgresso =
                    progressoSnap.data();

                progressoSalvo =
                    Array.isArray(
                        dadosProgresso.requisitosConcluidos
                    )
                        ? dadosProgresso.requisitosConcluidos
                        : [];
            }
        } catch (erro) {
            console.error(
                "Erro ao carregar o progresso da classe:",
                erro
            );
        }
    }

    /*
     * Registra o início sem apagar progresso existente.
     */
    const registrarInicioNoBanco = async () => {
        await window.ClubeDB.textoDB
            .collection("progresso_classes")
            .doc(`${username}_${id}`)
            .set(
                {
                    usuario: username,
                    itemId: id,
                    nomeItem: nome,
                    requisitosConcluidos:
                        Array.isArray(progressoSalvo)
                            ? progressoSalvo
                            : [],
                    status: "em_andamento",
                    atualizadoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    merge: true
                }
            );
    };

    /*
     * Botão Começar do catálogo.
     */
    if (
        modo === "iniciar" &&
        !classeJaConcluida
    ) {
        const confirmouInicio = confirm(
            "Tem certeza que você quer começar esta classe?"
        );

        if (!confirmouInicio) {
            return;
        }

        try {
            await registrarInicioNoBanco();

            alert("Classe iniciada com sucesso!");

            fecharCatalogoClasses();
            await carregarClassesEmAndamento();
        } catch (erro) {
            console.error(
                "Erro ao iniciar a classe:",
                erro
            );

            alert("Erro ao iniciar classe.");
        }

        return;
    }

    /*
     * Classe concluída vira somente consulta.
     */
    if (classeJaConcluida) {
        modo = "concluido";
    }

    const somenteLeitura =
        modo === "visualizar" ||
        modo === "concluido";

    const modal = document.createElement("div");

    modal.style =
        "position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:9999; display:flex; flex-direction:column; color:#fff;";

    modal.innerHTML = `
        <button
            id="btn-fechar-checklist-class"
            style="position:absolute; top:20px; right:20px; background:none; border:none; color:#fff; font-size:30px; cursor:pointer; z-index:10001; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
            ✕
        </button>

        <div style="display:flex; flex-direction:column; align-items:center; padding:50px 15px 10px 15px; gap:10px;">
            <img
                src="${fotoUrl}"
                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                style="width:120px; height:120px; object-fit:cover; border-radius:12px; border:${classeJaConcluida ? "#28a745" : "#262626"}; border-width:2px; border-style:solid; flex-shrink:0;"
            >

            <h3 style="margin:0; font-size:16px; text-align:center; color:${classeJaConcluida ? "#5ee27a" : "#fff"}; font-weight:bold;">
                ${nome}
            </h3>

            ${
                classeJaConcluida
                    ? `
                        <div style="background:#102418; color:#5ee27a; border:1px solid #28a745; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                            ✓ CLASSE CONCLUÍDA
                        </div>
                    `
                    : modo === "visualizar"
                        ? `
                            <div style="background:#121212; color:#0095f6; border:1px solid #262626; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                                👁️ VISUALIZAÇÃO SOMENTE LEITURA
                            </div>
                        `
                        : `
                            <div style="background:#241f10; color:#ffc107; border:1px solid #ffc107; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:bold;">
                                EM ANDAMENTO
                            </div>
                        `
            }
        </div>

        <div style="width:100%; border-bottom:1px solid #262626;"></div>

        <div style="flex:1; overflow-y:auto; padding:20px;">
            <p style="color:${classeJaConcluida ? "#5ee27a" : modo === "visualizar" ? "#0095f6" : "#8e8e8e"}; font-size:13px; margin-bottom:20px;">
                ${
                    classeJaConcluida
                        ? "Checklist disponível somente para consulta."
                        : modo === "visualizar"
                            ? "Você pode consultar os requisitos, mas não pode marcar nenhum item neste modo."
                            : "Marque os requisitos concluídos. Seu progresso será salvo automaticamente."
                }
            </p>

            <div id="lista-checks-class">
                ${
                    requisitos.length > 0
                        ? requisitos
                            .map((req, i) => {
                                const requisitoMarcado =
                                    classeJaConcluida ||
                                    progressoSalvo.includes(i);

                                return `
                                    <label
                                        style="display:flex; align-items:flex-start; gap:12px; margin-bottom:18px; cursor:${somenteLeitura ? "default" : "pointer"}; background:${somenteLeitura ? "#102418" : "#121212"}; padding:12px; border-radius:8px; border:1px solid ${somenteLeitura ? "#28a745" : "#262626"};">

                                        <input
                                            type="checkbox"
                                            class="req-check-class"
                                            data-idx="${i}"
                                            ${requisitoMarcado ? "checked" : ""}
                                            ${somenteLeitura ? "disabled" : ""}
                                            style="width:20px; height:20px; margin-top:2px; accent-color:${somenteLeitura ? "#28a745" : "#ffc107"};"
                                        >

                                        <span style="font-size:14px; line-height:1.4; color:${somenteLeitura ? "#d8f5df" : "#fff"};">
                                            ${req}
                                        </span>
                                    </label>
                                `;
                            })
                            .join("")
                        : `
                            <p style="color:#8e8e8e; text-align:center; padding:20px;">
                                Nenhum requisito cadastrado para esta classe.
                            </p>
                        `
                }
            </div>
        </div>

        <div style="padding:15px; border-top:1px solid #262626; display:flex; flex-direction:column; gap:10px;">
            ${
                classeJaConcluida
                    ? `
                        <button
                            id="btn-fechar-revisao-class"
                            style="width:100%; padding:14px; background:#28a745; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
                            Fechar checklist
                        </button>
                    `
                    : modo === "visualizar"
                        ? `
                            <button
                                id="btn-comecar-class"
                                style="width:100%; padding:14px; background:#ffc107; color:#121212; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
                                Começar
                            </button>
                        `
                        : `
                            <button
                                id="btn-enviar-aval-class"
                                disabled
                                style="width:100%; padding:14px; background:#333; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:14px;">
                                Enviar para Avaliação
                            </button>

                            <button
                                id="btn-cancelar-class"
                                style="width:100%; padding:12px; background:none; color:#ff4d4d; border:1px solid #ff4d4d; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer;">
                                Cancelar Classe
                            </button>
                        `
            }
        </div>
    `;

    document.body.appendChild(modal);

    const btnFechar = modal.querySelector(
        "#btn-fechar-checklist-class"
    );

    btnFechar.onclick = () => {
        modal.remove();

        if (modo === "continuar") {
            carregarClassesEmAndamento();
        } else {
            abrirCatalogoClasses();
        }
    };

    /*
     * Classe concluída: somente consulta.
     */
    if (classeJaConcluida) {
        const btnFecharRevisao =
            modal.querySelector(
                "#btn-fechar-revisao-class"
            );

        if (btnFecharRevisao) {
            btnFecharRevisao.onclick = () => {
                modal.remove();
                abrirCatalogoClasses();
            };
        }

        return;
    }

    /*
     * Modo Ver: não permite edição.
     */
    if (modo === "visualizar") {
        const btnComecar =
            modal.querySelector(
                "#btn-comecar-class"
            );

        if (btnComecar) {
            btnComecar.onclick = async () => {
                const confirmouInicio = confirm(
                    "Tem certeza que você quer começar esta classe?"
                );

                if (!confirmouInicio) {
                    return;
                }

                try {
                    await registrarInicioNoBanco();

                    alert("Classe iniciada com sucesso!");

                    modal.remove();

                    fecharCatalogoClasses();
                    await carregarClassesEmAndamento();
                } catch (erro) {
                    console.error(
                        "Erro ao iniciar a classe:",
                        erro
                    );

                    alert("Erro ao iniciar classe.");
                }
            };
        }

        return;
    }

    /*
     * Modo Continuar.
     */
    const checks = modal.querySelectorAll(
        ".req-check-class"
    );

    const btnEnv = modal.querySelector(
        "#btn-enviar-aval-class"
    );

    const btnCancel = modal.querySelector(
        "#btn-cancelar-class"
    );

    /*
     * Cancelar classe.
     */
    if (btnCancel) {
        btnCancel.onclick = async () => {
            const confirmouCancelamento = confirm(
                "Tem certeza que deseja cancelar? Todo o seu progresso nesta classe será excluído."
            );

            if (!confirmouCancelamento) {
                return;
            }

            try {
                await window.ClubeDB.textoDB
                    .collection("progresso_classes")
                    .doc(`${username}_${id}`)
                    .delete();

                alert("Classe cancelada.");

                modal.remove();

                await carregarClassesEmAndamento();
            } catch (erro) {
                console.error(
                    "Erro ao cancelar a classe:",
                    erro
                );

                alert("Erro ao cancelar.");
            }
        };
    }

    /*
     * Atualiza o botão de envio.
     */
    const atualizarEstadoBotao = () => {
        if (!btnEnv) {
            return;
        }

        const todosMarcados =
            requisitos.length > 0 &&
            Array.from(checks).every(
                checkbox => checkbox.checked
            );

        btnEnv.disabled = !todosMarcados;
        btnEnv.style.background =
            todosMarcados
                ? "#ffc107"
                : "#333";

        btnEnv.style.color =
            todosMarcados
                ? "#121212"
                : "#fff";
    };

    atualizarEstadoBotao();

    /*
     * Salva progresso automaticamente.
     */
    checks.forEach(checkbox => {
        checkbox.onchange = async () => {
            atualizarEstadoBotao();

            const requisitosConcluidos =
                Array.from(checks)
                    .filter(
                        itemCheckbox =>
                            itemCheckbox.checked
                    )
                    .map(
                        itemCheckbox =>
                            parseInt(
                                itemCheckbox.dataset.idx
                            )
                    );

            try {
                await window.ClubeDB.textoDB
                    .collection("progresso_classes")
                    .doc(`${username}_${id}`)
                    .set(
                        {
                            usuario: username,
                            itemId: id,
                            nomeItem: nome,
                            requisitosConcluidos:
                                requisitosConcluidos,
                            status: "em_andamento",
                            atualizadoEm:
                                firebase.firestore.FieldValue.serverTimestamp()
                        },
                        {
                            merge: true
                        }
                    );
            } catch (erro) {
                console.error(
                    "Erro ao salvar progresso da classe:",
                    erro
                );
            }
        };
    });

    /*
     * Envio para avaliação.
     */
    if (btnEnv) {
        btnEnv.onclick = async () => {
            const confirmouEnvio = confirm(
                "Deseja enviar esta classe para avaliação?"
            );

            if (!confirmouEnvio) {
                return;
            }

            btnEnv.disabled = true;
            btnEnv.textContent = "Enviando...";

            try {
                const usuarioSnap =
                    await window.ClubeDB.textoDB
                        .collection("usuarios")
                        .where(
                            "username",
                            "==",
                            username
                        )
                        .get();

                if (!usuarioSnap.empty) {
                    const dadosUsuario =
                        usuarioSnap.docs[0].data();

                    const classesAtuais =
                        Array.isArray(
                            dadosUsuario.classesConcluidas
                        )
                            ? dadosUsuario.classesConcluidas
                            : [];

                    const jaPossuiAntesDoEnvio =
                        classesAtuais.some(
                            nomeAdquirido =>
                                normalizarTextoBusca(
                                    nomeAdquirido
                                ).trim() ===
                                normalizarTextoBusca(
                                    nome
                                ).trim()
                        );

                    if (jaPossuiAntesDoEnvio) {
                        await window.ClubeDB.textoDB
                            .collection(
                                "progresso_classes"
                            )
                            .doc(`${username}_${id}`)
                            .delete();

                        alert(
                            "Esta classe já pertence ao seu perfil e não pode ser enviada novamente."
                        );

                        modal.remove();
                        abrirCatalogoClasses();

                        return;
                    }
                }

                await window.ClubeDB.textoDB
                    .collection(
                        "pendencias_aprovacao"
                    )
                    .add({
                        usuario: username,
                        itemId: id,
                        nomeItem: nome,
                        colecaoOrigem:
                            "progresso_classes",
                        status: "pendente",
                        enviadoEm:
                            firebase.firestore.FieldValue.serverTimestamp()
                    });

                await window.ClubeDB.textoDB
                    .collection(
                        "progresso_classes"
                    )
                    .doc(`${username}_${id}`)
                    .delete();

                alert("Enviado com sucesso!");

                modal.remove();

                await carregarClassesEmAndamento();
                if (
                    typeof carregarAprovacoesSite ===
                    "function"
                ) {
                    carregarAprovacoesSite();
                }
            } catch (erro) {
                console.error(
                    "Erro ao enviar a classe:",
                    erro
                );

                alert("Erro ao enviar.");

                btnEnv.disabled = false;
                btnEnv.textContent =
                    "Enviar para Avaliação";

                atualizarEstadoBotao();
            }
        };
    }
}




// ==========================================
// LEITURA DO FIRESTORE (CARREGAR "EM ANDAMENTO")
// ==========================================
async function carregarEspecialidadesEmAndamento() {
    const username = localStorage.getItem("usernameLogado");
    const container = document.getElementById("lista-especialidades-progresso-container");

    if (!container) return;

    if (!username) {
        container.innerHTML = `
            <p style="color:#8e8e8e; font-size:12px; text-align:center; padding:10px;">
                Nenhuma especialidade em andamento.
            </p>
        `;
        return;
    }

    try {
        const db = window.ClubeDB.textoDB;

        /*
         * =====================================================
         * 1. BUSCA O CATÁLOGO REAL DE ESPECIALIDADES
         *
         * Consultamos diretamente o Firebase.
         * Não usamos somente window.cacheEspecialidades,
         * pois o cache pode estar desatualizado.
         * =====================================================
         */
        const snapCatalogoEspecialidades = await db
            .collection("especialidades")
            .get();

        /*
         * Guarda apenas os IDs que realmente continuam
         * existindo no catálogo.
         */
        const idsEspecialidadesExistentes = new Set(
            snapCatalogoEspecialidades.docs.map(doc =>
                String(doc.id)
            )
        );

        /*
         * Atualiza o cache com os dados atuais do Firebase.
         */
        const mapaEspecialidades = new Map();

        snapCatalogoEspecialidades.docs.forEach(doc => {
            const dados = doc.data() || {};

            const item = {
                id: String(doc.id),
                ...dados,
                categoria:
                    dados.categoria ||
                    dados.area ||
                    "Geral",
                urlImagem:
                    dados.urlImagem ||
                    dados.logo ||
                    ""
            };

            /*
             * Mantém a mesma lógica de deduplicação
             * por nome + categoria.
             */
            const chave =
                `${(item.nome || "").trim().toLowerCase()}|` +
                `${(item.categoria || "").trim().toLowerCase()}`;

            if (!mapaEspecialidades.has(chave)) {
                mapaEspecialidades.set(chave, item);
            }
        });

        window.cacheEspecialidades = [
            ...mapaEspecialidades.values()
        ];


        /*
         * =====================================================
         * 2. BUSCA O PROGRESSO DO USUÁRIO
         * =====================================================
         */
        const snapProgresso = await db
            .collection("progresso_especialidades")
            .where("usuario", "==", username)
            .where("status", "==", "em_andamento")
            .get();


        /*
         * =====================================================
         * 3. SEPARA PROGRESSOS VÁLIDOS E ÓRFÃOS
         * =====================================================
         */
        const progressosValidos = [];
        const progressosOrfaos = [];

        snapProgresso.docs.forEach(doc => {
            const dados = doc.data() || {};
            const itemId = String(dados.itemId || "");

            if (
                itemId &&
                idsEspecialidadesExistentes.has(itemId)
            ) {
                progressosValidos.push({
                    doc,
                    dados
                });
            } else {
                /*
                 * O item foi apagado do catálogo ou o progresso
                 * não possui mais um item válido associado.
                 */
                progressosOrfaos.push(doc);
            }
        });


        /*
         * =====================================================
         * 4. EXCLUI OS PROGRESSOS ÓRFÃOS
         *
         * Isso remove automaticamente da conta do usuário
         * as especialidades que foram apagadas do catálogo.
         *
         * Dividimos em lotes de 450 para manter margem segura
         * abaixo do limite de operações por batch do Firestore.
         * =====================================================
         */
        if (progressosOrfaos.length > 0) {
            for (
                let inicio = 0;
                inicio < progressosOrfaos.length;
                inicio += 450
            ) {
                const lote = db.batch();

                const grupo =
                    progressosOrfaos.slice(
                        inicio,
                        inicio + 450
                    );

                grupo.forEach(doc => {
                    lote.delete(doc.ref);
                });

                await lote.commit();
            }

            console.log(
                `Limpeza automática de especialidades concluída: ${progressosOrfaos.length} registro(s) órfão(s) removido(s) de "progresso_especialidades".`
            );
        }


        /*
         * =====================================================
         * 5. LIMPA O CONTAINER
         * =====================================================
         */
        container.innerHTML = "";


        /*
         * =====================================================
         * 6. NENHUMA ESPECIALIDADE VÁLIDA EM ANDAMENTO
         * =====================================================
         */
        if (progressosValidos.length === 0) {
            container.innerHTML = `
                <p style="color:#8e8e8e; font-size:12px; text-align:center; padding:10px;">
                    Nenhuma especialidade em andamento.
                </p>
            `;
            return;
        }


        /*
         * =====================================================
         * 7. RENDERIZA SOMENTE ESPECIALIDADES EXISTENTES
         * =====================================================
         */
        container.innerHTML = progressosValidos
            .map(({ dados }) => {
                const espItem =
                    window.cacheEspecialidades.find(
                        especialidade =>
                            String(especialidade.id) ===
                            String(dados.itemId)
                    );

                /*
                 * Proteção extra: se por algum motivo o item
                 * não estiver no cache, não renderiza.
                 */
                if (!espItem) {
                    return "";
                }

                const imgUrl =
                    espItem.urlImagem ||
                    espItem.logo ||
                    "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

                const nomeEspecialidade =
                    dados.nomeItem ||
                    dados.nome ||
                    espItem.nome ||
                    "Especialidade";

                /*
                 * Proteção para não quebrar o onclick
                 * caso o nome contenha apóstrofos.
                 */
                const nomeSeguro =
                    String(nomeEspecialidade)
                        .replace(/\\/g, "\\\\")
                        .replace(/'/g, "\\'");

                return `
                    <div style="background:#121212; border:1px solid #262626; padding:12px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:10px;">
                        
                        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                            <img
                                src="${imgUrl}"
                                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                                style="width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0;"
                            >

                            <div style="min-width:0; flex:1;">
                                <div style="font-weight:bold; color:#fff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${nomeEspecialidade}
                                </div>

                                <div style="color:#0095f6; font-size:11px; font-weight:bold;">
                                    Em Andamento
                                </div>
                            </div>
                        </div>

                        <button
                            onclick="solicitarInicioEspecialidade('${dados.itemId}', '${nomeSeguro}', 'continuar')"
                            style="flex-shrink:0; padding:8px 14px; background:#28a745; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; width:max-content; white-space:nowrap;"
                        >
                            Continuar
                        </button>
                    </div>
                `;
            })
            .join("");

    } catch (erro) {
        console.error(
            "Erro ao carregar e limpar especialidades em andamento:",
            erro
        );

        container.innerHTML = `
            <p style="color:#ff4d4d; font-size:11px; text-align:center; padding:10px;">
                Erro ao carregar especialidades em andamento.
            </p>
        `;
    }
}

async function carregarMestradosEmAndamento() {
    const username = localStorage.getItem("usernameLogado");
    const container = document.getElementById("lista-mestrados-progresso-container");

    if (!container) return;

    if (!username) {
        container.innerHTML = `
            <p style="color:#8e8e8e; font-size:12px; text-align:center; padding:10px;">
                Nenhum mestrado em andamento.
            </p>
        `;
        return;
    }

    try {
        const db = window.ClubeDB.textoDB;

        /*
         * =====================================================
         * 1. BUSCA O CATÁLOGO REAL DE MESTRADOS
         *
         * O Firebase é a fonte oficial.
         * Não usamos window.cacheMestrados aqui para decidir
         * se o item ainda existe, pois o cache pode estar
         * desatualizado.
         * =====================================================
         */
        const snapCatalogoMestrados = await db
            .collection("mestrados")
            .get();

        /*
         * Guarda os IDs que ainda existem no catálogo.
         *
         * Exemplo:
         * mestrado_1
         * mestrado_2
         * mestrado_3
         */
        const idsMestradosExistentes = new Set(
            snapCatalogoMestrados.docs.map(doc =>
                String(doc.id)
            )
        );

        /*
         * Atualiza o cache dos mestrados imediatamente.
         * Isso também evita que um item excluído continue sendo
         * encontrado visualmente por um cache antigo.
         */
        window.cacheMestrados =
            snapCatalogoMestrados.docs.map(doc => {
                const dados = doc.data() || {};

                return {
                    id: String(doc.id),
                    ...dados,
                    categoria:
                        dados.categoria ||
                        dados.area ||
                        "Mestrado",
                    urlImagem:
                        dados.urlImagem ||
                        dados.logo ||
                        ""
                };
            });


        /*
         * =====================================================
         * 2. BUSCA OS MESTRADOS EM ANDAMENTO DO USUÁRIO
         * =====================================================
         */
        const snapProgresso = await db
            .collection("progresso_mestrados")
            .where("usuario", "==", username)
            .where("status", "==", "em_andamento")
            .get();


        /*
         * =====================================================
         * 3. REMOVE REGISTROS ÓRFÃOS
         *
         * Qualquer progresso cujo itemId não exista mais
         * na coleção "mestrados" significa que o catálogo
         * foi apagado pelo administrador.
         *
         * Esses documentos são excluídos automaticamente.
         * =====================================================
         */
        const progressosValidos = [];
        const progressosOrfaos = [];

        snapProgresso.docs.forEach(doc => {
            const dados = doc.data() || {};
            const itemId = String(dados.itemId || "");

            if (
                itemId &&
                idsMestradosExistentes.has(itemId)
            ) {
                progressosValidos.push({
                    doc,
                    dados
                });
            } else {
                progressosOrfaos.push(doc);
            }
        });


        /*
         * =====================================================
         * 4. EXCLUI OS REGISTROS DE MESTRADOS APAGADOS
         *
         * Fazemos em lotes para respeitar o limite do Firestore.
         * =====================================================
         */
        if (progressosOrfaos.length > 0) {
            for (
                let inicio = 0;
                inicio < progressosOrfaos.length;
                inicio += 450
            ) {
                const lote = db.batch();

                const grupo =
                    progressosOrfaos.slice(
                        inicio,
                        inicio + 450
                    );

                grupo.forEach(doc => {
                    lote.delete(doc.ref);
                });

                await lote.commit();
            }

            console.log(
                `Limpeza automática concluída: ${progressosOrfaos.length} registro(s) de mestrado excluído(s) do catálogo foram removidos de "progresso_mestrados".`
            );
        }


        /*
         * =====================================================
         * 5. LIMPA A INTERFACE ANTES DE RENDERIZAR
         * =====================================================
         */
        container.innerHTML = "";


        /*
         * =====================================================
         * 6. SE NÃO SOBROU NENHUM MESTRADO VÁLIDO
         * =====================================================
         */
        if (progressosValidos.length === 0) {
            container.innerHTML = `
                <p style="color:#8e8e8e; font-size:12px; text-align:center; padding:10px;">
                    Nenhum mestrado em andamento.
                </p>
            `;
            return;
        }


        /*
         * =====================================================
         * 7. RENDERIZA SOMENTE MESTRADOS QUE AINDA EXISTEM
         * NO CATÁLOGO
         * =====================================================
         */
        container.innerHTML = progressosValidos
            .map(({ dados }) => {
                const mestItem =
                    window.cacheMestrados.find(
                        mestrado =>
                            String(mestrado.id) ===
                            String(dados.itemId)
                    );

                /*
                 * Esta proteção é redundante de propósito.
                 * Mesmo que algo inesperado aconteça,
                 * nunca renderizamos um progresso sem item
                 * correspondente no catálogo.
                 */
                if (!mestItem) {
                    return "";
                }

                const imgUrl =
                    mestItem.urlImagem ||
                    mestItem.logo ||
                    "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

                const nomeMestrado =
                    dados.nomeItem ||
                    dados.nome ||
                    mestItem.nome ||
                    "Mestrado";

                /*
                 * Proteção contra caracteres especiais no nome.
                 * Evita quebrar o onclick do botão Continuar.
                 */
                const nomeSeguro =
                    String(nomeMestrado)
                        .replace(/\\/g, "\\\\")
                        .replace(/'/g, "\\'")
                        .replace(/"/g, "&quot;");

                return `
                    <div style="background:#121212; border:1px solid #262626; padding:12px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:10px;">
                        
                        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                            <img
                                src="${imgUrl}"
                                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                                style="width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0;"
                            >

                            <div style="min-width:0; flex:1;">
                                <div style="font-weight:bold; color:#fff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${nomeMestrado}
                                </div>

                                <div style="color:#28a745; font-size:11px; font-weight:bold;">
                                    Em Andamento
                                </div>
                            </div>
                        </div>

                        <button
                            onclick="solicitarInicioMestrado('${dados.itemId}', '${nomeSeguro}', 'continuar')"
                            style="flex-shrink:0; padding:8px 14px; background:#28a745; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; width:max-content; white-space:nowrap;"
                        >
                            Continuar
                        </button>
                    </div>
                `;
            })
            .join("");

    } catch (erro) {
        console.error(
            "Erro ao carregar e limpar mestrados em andamento:",
            erro
        );

        container.innerHTML = `
            <p style="color:#ff4d4d; font-size:11px; text-align:center; padding:10px;">
                Erro ao carregar mestrados em andamento.
            </p>
        `;
    }
}

async function carregarClassesEmAndamento() {
    const container = document.getElementById("lista-classes-progresso-container");

    if (!container) return;

    const username = localStorage.getItem("usernameLogado");

    if (!username) {
        container.innerHTML = `
            <p style="color:#8e8e8e; text-align:center; font-size:12px; padding:10px;">
                Nenhuma classe em andamento.
            </p>
        `;
        return;
    }

    try {
        const db = window.ClubeDB.textoDB;

        /*
         * =====================================================
         * 1. BUSCA O CATÁLOGO REAL DE CLASSES
         * =====================================================
         */
        const snapCatalogoClasses = await db
            .collection("classes")
            .get();

        /*
         * Guarda os IDs de todas as classes que ainda existem.
         */
        const idsClassesExistentes = new Set(
            snapCatalogoClasses.docs.map(doc =>
                String(doc.id)
            )
        );

        /*
         * Atualiza o cache diretamente do Firebase.
         */
        window.cacheClasses =
            snapCatalogoClasses.docs.map(doc => {
                const dados = doc.data() || {};

                return {
                    id: String(doc.id),
                    ...dados,
                    categoria:
                        dados.categoria ||
                        "Classe",
                    urlImagem:
                        dados.urlImagem ||
                        dados.logo ||
                        ""
                };
            });


        /*
         * =====================================================
         * 2. BUSCA O PROGRESSO DO USUÁRIO
         * =====================================================
         */
        const snapProgresso = await db
            .collection("progresso_classes")
            .where("usuario", "==", username)
            .where("status", "==", "em_andamento")
            .get();


        /*
         * =====================================================
         * 3. SEPARA CLASSES VÁLIDAS E ÓRFÃS
         * =====================================================
         */
        const progressosValidos = [];
        const progressosOrfaos = [];

        snapProgresso.docs.forEach(doc => {
            const dados = doc.data() || {};
            const itemId = String(dados.itemId || "");

            if (
                itemId &&
                idsClassesExistentes.has(itemId)
            ) {
                progressosValidos.push({
                    doc,
                    dados
                });
            } else {
                /*
                 * A classe foi excluída do catálogo ou seu
                 * progresso ficou sem um item válido.
                 */
                progressosOrfaos.push(doc);
            }
        });


        /*
         * =====================================================
         * 4. APAGA AUTOMATICAMENTE OS PROGRESSOS ÓRFÃOS
         * =====================================================
         */
        if (progressosOrfaos.length > 0) {
            for (
                let inicio = 0;
                inicio < progressosOrfaos.length;
                inicio += 450
            ) {
                const lote = db.batch();

                const grupo =
                    progressosOrfaos.slice(
                        inicio,
                        inicio + 450
                    );

                grupo.forEach(doc => {
                    lote.delete(doc.ref);
                });

                await lote.commit();
            }

            console.log(
                `Limpeza automática de classes concluída: ${progressosOrfaos.length} registro(s) órfão(s) removido(s) de "progresso_classes".`
            );
        }


        /*
         * =====================================================
         * 5. LIMPA O CONTAINER
         * =====================================================
         */
        container.innerHTML = "";


        /*
         * =====================================================
         * 6. NENHUMA CLASSE VÁLIDA EM ANDAMENTO
         * =====================================================
         */
        if (progressosValidos.length === 0) {
            container.innerHTML = `
                <p style="color:#8e8e8e; text-align:center; font-size:12px; padding:10px;">
                    Nenhuma classe em andamento.
                </p>
            `;
            return;
        }


        /*
         * =====================================================
         * 7. RENDERIZA SOMENTE CLASSES EXISTENTES
         * =====================================================
         */
        container.innerHTML = progressosValidos
            .map(({ dados }) => {
                const classItem =
                    window.cacheClasses.find(
                        classe =>
                            String(classe.id) ===
                            String(dados.itemId)
                    );

                /*
                 * Proteção extra contra inconsistência de cache.
                 */
                if (!classItem) {
                    return "";
                }

                const imgUrl =
                    classItem.urlImagem ||
                    classItem.logo ||
                    "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

                const nomeClasse =
                    dados.nomeItem ||
                    dados.nome ||
                    classItem.nome ||
                    "Classe";

                /*
                 * Proteção contra apóstrofos no nome.
                 */
                const nomeSeguro =
                    String(nomeClasse)
                        .replace(/\\/g, "\\\\")
                        .replace(/'/g, "\\'");

                return `
                    <div style="background:#121212; border:1px solid #262626; padding:12px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:10px;">
                        
                        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                            <img
                                src="${imgUrl}"
                                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                                style="width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0;"
                            >

                            <div style="min-width:0; flex:1;">
                                <div style="font-weight:bold; color:#fff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${nomeClasse}
                                </div>

                                <div style="color:#ffc107; font-size:11px; font-weight:bold;">
                                    Em Andamento
                                </div>
                            </div>
                        </div>

                        <button
                            onclick="solicitarInicioClasse('${dados.itemId}', '${nomeSeguro}', 'continuar')"
                            style="flex-shrink:0; padding:8px 14px; background:#ffc107; color:#121212; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; width:max-content; white-space:nowrap;"
                        >
                            Continuar
                        </button>
                    </div>
                `;
            })
            .join("");

    } catch (erro) {
        console.error(
            "Erro ao carregar e limpar classes em andamento:",
            erro
        );

        container.innerHTML = `
            <p style="color:#ff4d4d; text-align:center; font-size:11px; padding:10px;">
                Erro ao carregar classes em andamento.
            </p>
        `;
    }
}


function renderizarCatalogoMestrados(lista, manterEstado = false) {
    const container = document.getElementById("lista-mestrados-container");
    if (!container) return;

    const inputBusca = document.getElementById("busca-mestrado");
    const termoBusca = inputBusca ? inputBusca.value.trim() : "";

    if (!manterEstado && !termoBusca) {
        window.categoriaAtualMestrados = null;
    }

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div style="margin-bottom:15px;">
                <button
                    onclick="window.categoriaAtualMestrados = null; document.getElementById('busca-mestrado').value = ''; renderizarCatalogoMestrados(window.cacheMestrados);"
                    style="background:transparent; border:none; color:#28a745; cursor:pointer; font-size:13px; font-weight:bold; padding:0;">
                    ⬅ Voltar
                </button>
            </div>

            <p style="color:#8e8e8e; text-align:center;">
                Nenhum resultado encontrado.
            </p>
        `;
        return;
    }

    const tipoUsuario = localStorage.getItem("usuarioLogado");

    const mestradosAdquiridos =
        window.mestradosAdquiridosUsuario instanceof Set
            ? window.mestradosAdquiridosUsuario
            : new Set();

    const categorias = {};

    lista.forEach(item => {
        const cat = item.categoria || item.area || "Mestrado";

        if (!categorias[cat]) {
            categorias[cat] = [];
        }

        categorias[cat].push(item);
    });

    let visualizacaoAtiva = window.categoriaAtualMestrados;

    if (termoBusca && !visualizacaoAtiva) {
        visualizacaoAtiva = "Todas";
    }

    if (!visualizacaoAtiva) {
        let htmlCategorias = `
            <div
                onclick="window.categoriaAtualMestrados = 'Todas'; renderizarCatalogoMestrados(window.cacheMestrados, true);"
                style="background:#1e1e1e; border:1px solid #333; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:12px; transition:0.2s;">

                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:22px;">🌟</span>

                    <span style="color:#fff; font-weight:bold; font-size:15px;">
                        Todas as Categorias
                    </span>
                </div>

                <span style="color:#28a745; font-size:13px; font-weight:bold;">
                    ${lista.length} itens &gt;
                </span>
            </div>
        `;

        Object.entries(categorias)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([cat, itens]) => {
                htmlCategorias += `
                    <div
                        onclick="window.categoriaAtualMestrados = '${cat}'; renderizarCatalogoMestrados(window.cacheMestrados, true);"
                        style="background:#121212; border:1px solid #262626; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:8px; transition:0.2s;">

                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:18px;">📁</span>

                            <span style="color:#fff; font-weight:500; font-size:14px;">
                                ${cat}
                            </span>
                        </div>

                        <span style="color:#8e8e8e; font-size:12px; font-weight:600;">
                            ${itens.length} itens &gt;
                        </span>
                    </div>
                `;
            });

        container.innerHTML = htmlCategorias;
        return;
    }

    let htmlFinal = `
        <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <button
                onclick="window.categoriaAtualMestrados = null; document.getElementById('busca-mestrado').value = ''; renderizarCatalogoMestrados(window.cacheMestrados, false);"
                style="background:transparent; border:none; color:#28a745; cursor:pointer; font-size:14px; font-weight:bold; display:flex; align-items:center; gap:5px; padding:0;">
                ⬅ Voltar às Pastas
            </button>

            <span style="color:#8e8e8e; font-size:12px; max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;">
                ${visualizacaoAtiva}
            </span>
        </div>
    `;

    const categoriasParaRenderizar =
        visualizacaoAtiva === "Todas"
            ? categorias
            : {
                [visualizacaoAtiva]:
                    categorias[visualizacaoAtiva] || []
            };

    htmlFinal += Object.entries(categoriasParaRenderizar)
        .map(([cat, itens]) => {
            if (!itens || itens.length === 0) {
                return "";
            }

            return `
                <div style="margin-bottom:15px; width:100%;">
                    <h4 style="color:#28a745; font-size:12px; margin-bottom:8px; border-left:3px solid #28a745; padding-left:6px; text-transform:uppercase;">
                        ${cat}
                    </h4>

                    <div style="display:grid; gap:8px; width:100%;">
                        ${itens
                            .map(m => {
                                const mestradoConcluido =
                                    tipoUsuario !== "admin" &&
                                    mestradosAdquiridos.has(
                                        normalizarTextoBusca(m.nome).trim()
                                    );

                                const fundoCard = mestradoConcluido
                                    ? "#102418"
                                    : "#121212";

                                const bordaCard = mestradoConcluido
                                    ? "#28a745"
                                    : "#262626";

                                const corNome = mestradoConcluido
                                    ? "#5ee27a"
                                    : "#fff";

                                const textoBotao = mestradoConcluido
                                    ? "✓ Rever checklist"
                                    : "Começar";

                                return `
                                    <div
                                        style="background:${fundoCard}; border:1px solid ${bordaCard}; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; ${mestradoConcluido ? "box-shadow:0 0 0 1px rgba(40,167,69,0.15);" : ""}">

                                        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                                            <img
                                                src="${m.urlImagem || m.logo || "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png"}"
                                                onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'"
                                                style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0; border:${mestradoConcluido ? "1px solid #28a745" : "none"};"
                                            >

                                            <div style="min-width:0; flex:1;">
                                                <div style="font-weight:bold; color:${corNome}; font-size:13px; word-break:break-word;">
                                                    ${m.nome}
                                                </div>

                                                ${
                                                    mestradoConcluido
                                                        ? `
                                                            <div style="color:#28a745; font-size:10px; font-weight:bold; margin-top:3px;">
                                                                MESTRADO CONCLUÍDO
                                                            </div>
                                                        `
                                                        : ""
                                                }
                                            </div>
                                        </div>

                                                                                <div style="display:flex; flex-direction:column; gap:6px; min-width:92px;">

                                            <button
                                                onclick="solicitarInicioMestrado('${m.id}', '${m.nome}', 'iniciar')"
                                                style="width:100%; padding:6px 10px; background:#28a745; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                                ${textoBotao}
                                            </button>

                                            <button
                                                onclick="solicitarInicioMestrado('${m.id}', '${m.nome}', 'visualizar')"
                                                style="width:100%; padding:6px 10px; background:#262626; color:#fff; border:1px solid #444; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
                                                Ver
                                            </button>

                                            ${
                                                tipoUsuario === "admin"
                                                    ? `
                                                        <button
                                                            onclick="abrirModalGerenciarItem('mestrados', '${m.id}')"
                                                            style="width:100%; background:#333; color:#fff; border:none; border-radius:6px; padding:6px 8px; font-size:11px; cursor:pointer;">
                                                            Editar
                                                        </button>
                                                    `
                                                    : ""
                                            }

                                        </div>
                                    </div>
                                `;
                            })
                            .join("")}
                    </div>
                </div>
            `;
        })
        .join("");

    container.innerHTML = htmlFinal;
}


// ==========================================
// CONCLUIR / REMOVER PROGRESSO DO BANCO
// ==========================================
async function solicitarAprovacao(colecaoOrigem, itemId, nomeItem, callbackRecarregar) {
    const username = localStorage.getItem("usernameLogado");
    if (!username) return;

    if (confirm(`Deseja enviar "${nomeItem}" para aprovação do líder?`)) {
        try {
            // 1. Salva na coleção de pendências
            await window.ClubeDB.textoDB.collection("pendencias_aprovacao").doc(`${username}_${itemId}`).set({
                usuario: username,
                itemId: itemId,
                nomeItem: nomeItem,
                colecaoOrigem: colecaoOrigem, // Para saber se é esp, mest ou class
                status: "pendente",
                data: new Date()
            });

            // 2. Remove do progresso ativo
            await window.ClubeDB.textoDB.collection(colecaoOrigem).doc(`${username}_${itemId}`).delete();
            
            alert(`Pedido de "${nomeItem}" enviado com sucesso!`);
            callbackRecarregar();
        } catch (e) {
            console.error("Erro ao enviar para aprovação:", e);
            alert("Erro ao enviar. Tente novamente.");
        }
    }
}

// ==========================================
// CORE: LÓGICA DE APROVAÇÃO DE CONQUISTAS (ADMIN)
// ==========================================

async function carregarAprovacoesSite() {
    const container = document.getElementById("lista-aprovacoes-render-site");
    const titulo = document.getElementById("titulo-aprovacoes-dinamico");
    if (!container) return;
    
    const usernameLogado = localStorage.getItem("usernameLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado"); // 'admin' ou 'membro'

    container.innerHTML = "<p style='color: #aaa; text-align: center; font-size: 13px;'>Buscando informações...</p>";
    
    try {
        // 1. Identifica o perfil real do usuário (Desbravador ou Liderança)
        let subTipo = "Desbravador";
        if (tipoUsuario === "admin") {
            subTipo = "Liderança";
        } else {
            const userSnap = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", usernameLogado).get();
            if (!userSnap.empty) subTipo = userSnap.docs[0].data().tipo;
        }

        // 2. Ajusta o título da seção conforme o perfil
        if (titulo) {
            titulo.textContent = (subTipo === "Liderança") ? "Aprovações Pendentes" : "Minhas Avaliações";
        }

        // 3. Monta a Query de busca com base no nível de acesso
        let query = window.ClubeDB.textoDB.collection("pendencias_aprovacao").where("status", "==", "pendente");
        
        if (tipoUsuario === "admin") {
            // Admin vê TUDO
        } else if (subTipo === "Liderança") {
            // Liderança comum vê apenas o que foi destinado a ela
            query = query.where("liderDestino", "==", usernameLogado);
        } else {
            // Desbravador vê apenas as DELE
            query = query.where("usuario", "==", usernameLogado);
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: #8e8e8e;">
                    <div style="font-size: 28px; margin-bottom: 8px;">✨</div>
                    <div style="font-weight: bold; color: #fff; font-size: 14px;">Tudo em dia!</div>
                    ${subTipo === "Liderança" ? "Nenhuma solicitação aguardando você." : "Você não tem especialidades em avaliação."}
                </div>`;
            return;
        }
        
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const p = doc.data();
            const id = doc.id;
            const isClasse = p.colecaoOrigem === "progresso_classes";
            const isMestrado = p.colecaoOrigem === "progresso_mestrados";
            const badgeCor = isClasse ? "#ffc107" : (isMestrado ? "#28a745" : "#007bff");
            const icone = isClasse ? "🎒" : (isMestrado ? "🏆" : "🎯");
            
            // Texto indicando o líder responsável, se houver
            const infoLider = p.liderDestino ? ` | <span style="color: #28a745; font-weight: bold;">Líder: @${p.liderDestino}</span>` : '';

            if (subTipo === "Liderança") {
                const cacheKey = isClasse ? 'cacheClasses' : (isMestrado ? 'cacheMestrados' : 'cacheEspecialidades');
                const cachedList = window[cacheKey] || [];
                const cachedItem = cachedList.find(c => String(c.id) === String(p.itemId));
                const imgUrl = cachedItem?.urlImagem || cachedItem?.logo || '';
                const itemImgHtml = imgUrl ? `<img src="${imgUrl}" onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'" style="width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0;">` : '';
                container.innerHTML += `
                    <div style="background: #121212; border: 1px solid #262626; padding: 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                            <div style="display:flex; align-items:flex-start; gap:12px; min-width: 0; flex: 1;">
                                ${itemImgHtml}
                                <div style="min-width: 0; flex: 1;">
                                    <div style="font-weight: bold; color: #fff; font-size: 14px; word-break: break-word;">${p.nomeItem}</div>
                                    <div style="font-size: 12px; color: #a8a8a8; margin-top: 4px;">
                                        Membro: <span style="color: #0095f6; font-weight: 600;">@${p.usuario}</span>${infoLider}
                                    </div>
                                </div>
                            </div>
                            <span style="background: ${badgeCor}; color: ${isClasse ? '#121212' : '#fff'}; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;">
                                ${isClasse ? 'Classe' : (isMestrado ? 'Mestrado' : 'Esp' )}
                            </span>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 4px;">
                            <button onclick="processarAprovacaoAdmin('${id}', true)" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">Conceder</button>
                            <button onclick="processarAprovacaoAdmin('${id}', false)" style="flex: 1; padding: 10px; background: #ff4d4d; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">Recusar</button>
                        </div>
                        ${tipoUsuario === 'admin' ? `
                        <div style="display: flex; margin-top: 10px;">
                            <button onclick="abrirSeletorLideranca('${id}')" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">Encaminhar para Líder</button>
                        </div>` : ''}
                    </div>`;

            } else {
                const cacheKey = isClasse ? 'cacheClasses' : (isMestrado ? 'cacheMestrados' : 'cacheEspecialidades');
                const cachedList = window[cacheKey] || [];
                const cachedItem = cachedList.find(c => String(c.id) === String(p.itemId));
                const imgUrl = cachedItem?.urlImagem || cachedItem?.logo || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';
                container.innerHTML += `
                    <div style="background: #121212; border: 1px solid #262626; padding: 12px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                            <img src="${imgUrl}" onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; flex-shrink: 0;">
                            <div style="min-width: 0; flex: 1;">
                                <div style="font-weight: bold; color: #fff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.nomeItem}</div>
                                <div style="color: #ffc107; font-size: 11px; font-weight: bold;">
                                    Aguardando Avaliação${p.liderDestino ? ` (@${p.liderDestino} )` : ''}
                                </div>
                            </div>
                        </div>
                    </div>`;

            }
        });
    } catch (error) {
        console.error("Erro ao carregar aprovações:", error);
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center; font-size: 12px;'>Erro ao carregar dados.</p>";
    }
}






async function processarAprovacaoAdmin(idPendencia, statusAprovado) {
    try {
        const docRef = window.ClubeDB.textoDB.collection("pendencias_aprovacao").doc(idPendencia);
        const snapshotDoc = await docRef.get();
        
        if (!snapshotDoc.exists) {
            alert("Esta requisição já foi processada ou não existe.");
            carregarPendenciasAprovacaoAdmin();
            return;
        }
        
        const dadosPendencia = snapshotDoc.data();
        
        if (statusAprovado) {
            // Localiza o membro no banco para injetar a conquista definitiva
            const usuarioSnap = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", dadosPendencia.usuario).get();
            if (!usuarioSnap.empty) {
                const userDoc = usuarioSnap.docs[0];
                const userId = userDoc.id;
                const userDados = userDoc.data();
                
                // Mapeia o array correto no documento do usuário
                let campoAlvo = "especialidades";
                if (dadosPendencia.colecaoOrigem === "progresso_mestrados") campoAlvo = "mestrados";
                if (dadosPendencia.colecaoOrigem === "progresso_classes") campoAlvo = "classesConcluidas";
                
                let conquistasAtuais = userDados[campoAlvo] || [];
                if (!conquistasAtuais.includes(dadosPendencia.nomeItem)) {
                    conquistasAtuais.push(dadosPendencia.nomeItem);
                }
                
                await window.ClubeDB.textoDB.collection("usuarios").doc(userId).update({
                    [campoAlvo]: conquistasAtuais
                });
            }
            alert(`Sucesso! Conquista vinculada ao perfil de @${dadosPendencia.usuario}.`);
        } else {
            // Se recusado, o item volta para a aba "Em andamento" do usuário
            await window.ClubeDB.textoDB.collection(dadosPendencia.colecaoOrigem).doc(`${dadosPendencia.usuario}_${dadosPendencia.itemId}`).set({
                usuario: dadosPendencia.usuario,
                itemId: dadosPendencia.itemId,
                nomeItem: dadosPendencia.nomeItem,
                requisitosConcluidos: [],
                status: "em_andamento",
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await docRef.delete();
        carregarPendenciasAprovacaoAdmin();
        if (typeof carregarAprovacoesSite === 'function') carregarAprovacoesSite();
    } catch (e) {
        console.error("Erro ao processar aprovação:", e);
        alert("Erro ao processar aprovação: " + e.message);
    }
}
            

// Nova função para enviar para outra liderança
// Variável global temporária para o ID da pendência sendo encaminhada
let pendenciaSendoEncaminhada = null;

async function abrirSeletorLideranca(idPendencia) {
    pendenciaSendoEncaminhada = idPendencia;
    const modal = document.getElementById("modal-seletor-lideranca");
    const lista = document.getElementById("lista-lideres-selecao");
    
    if (!modal || !lista) return;

    modal.style.display = "flex";
    lista.innerHTML = "<p style='color: #8e8e8e; text-align: center; padding: 20px;'>Buscando líderes...</p>";

    try {
        const snap = await window.ClubeDB.textoDB.collection("usuarios").where("tipo", "==", "Liderança").get();
        if (snap.empty) {
            lista.innerHTML = "<p style='color: #ff4d4d; text-align: center; padding: 20px;'>Nenhum líder encontrado.</p>";
            return;
        }

        lista.innerHTML = snap.docs.map(doc => {
            const lider = doc.data();
            return `
                <div onclick="confirmarEncaminhamento('${lider.username}')" style="padding: 12px; background: #262626; border-radius: 8px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
                    <img src="${lider.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="color: #fff; font-weight: bold; font-size: 14px;">${lider.nomeReal || lider.username}</div>
                        <div style="color: #0095f6; font-size: 11px;">@${lider.username}</div>
                    </div>
                    <div style="color: #0095f6; font-size: 18px;">›</div>
                </div>
            `;
        } ).join("");

    } catch (e) {
        lista.innerHTML = "<p style='color: #ff4d4d; text-align: center;'>Erro ao carregar lista.</p>";
    }
}

function fecharSeletorLideranca() {
    document.getElementById("modal-seletor-lideranca").style.display = "none";
    pendenciaSendoEncaminhada = null;
}

async function confirmarEncaminhamento(usernameLider) {
    if (!pendenciaSendoEncaminhada) return;
    
    try {
        const docRef = window.ClubeDB.textoDB.collection("pendencias_aprovacao").doc(pendenciaSendoEncaminhada);
        await docRef.update({
            liderDestino: usernameLider.toLowerCase(),
            status: "pendente" // Mantém como pendente, mas agora com o filtro de destino
        });

        alert(`Solicitação encaminhada com sucesso para @${usernameLider}!`);
        fecharSeletorLideranca();
        carregarAprovacoesSite();
    } catch (e) {
        alert("Erro ao encaminhar solicitação.");
    }
}




// ==========================================
// VISUALIZAÇÃO DE CONQUISTAS ADQUIRIDAS (TELA CHEIA)
// ==========================================
async function abrirModalConquistasVisualizacao(tipo) {
    const modal = document.getElementById("modal-conquistas-adquiridas");
    const tituloEl = document.getElementById("modal-conquistas-titulo");
    const listaEl = document.getElementById("modal-conquistas-lista");
    const username = localStorage.getItem("usernameLogado");
    
    if (!modal || !username) return;

    modal.style.display = "flex";
    listaEl.innerHTML = "<p style='color:#8e8e8e; text-align:center;'>Buscando informações...</p>";
    
    try {
        // 1. Pega os dados mais recentes do membro
        const userSnap = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", username).get();
        if (userSnap.empty) throw new Error("Usuário não encontrado.");
        const dadosUser = userSnap.docs[0].data();
        
        // 2. Garante que os catálogos estejam em memória para puxarmos as imagens
        if (window.cacheEspecialidades.length === 0) {
            try {
                const snapEsp = await window.ClubeDB.textoDB.collection("especialidades").get();
                if (!snapEsp.empty) window.cacheEspecialidades = snapEsp.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
                else if (typeof listaEspecialidadesParaImportar !== "undefined") {
                    window.cacheEspecialidades = listaEspecialidadesParaImportar.map(item => ({ ...item, id: String(item.id), requisitos: item.reqs || item.requisitos || [] }));
                }
            } catch {
                if (typeof listaEspecialidadesParaImportar !== "undefined") {
                    window.cacheEspecialidades = listaEspecialidadesParaImportar.map(item => ({ ...item, id: String(item.id), requisitos: item.reqs || item.requisitos || [] }));
                }
            }
        }
        if (window.cacheMestrados.length === 0) {
            try {
                const snapMest = await window.ClubeDB.textoDB.collection("mestrados").get();
                if (!snapMest.empty) window.cacheMestrados = snapMest.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
                else window.cacheMestrados = typeof listaMestradosParaImportar !== "undefined" ? listaMestradosParaImportar.map(m => ({ ...m, id: String(m.id) })) : fallbackMestrados;
            } catch { window.cacheMestrados = typeof listaMestradosParaImportar !== "undefined" ? listaMestradosParaImportar.map(m => ({ ...m, id: String(m.id) })) : fallbackMestrados; }
        }
        if (window.cacheClasses.length === 0) {
            try {
                const snapCl = await window.ClubeDB.textoDB.collection("classes").get();
                if (!snapCl.empty) window.cacheClasses = snapCl.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
                else window.cacheClasses = typeof listaClassesParaImportar !== "undefined" ? listaClassesParaImportar.map(c => ({ ...c, id: String(c.id) })) : fallbackClasses;
            } catch { window.cacheClasses = typeof listaClassesParaImportar !== "undefined" ? listaClassesParaImportar.map(c => ({ ...c, id: String(c.id) })) : fallbackClasses; }
        }

        // 3. Define onde buscar baseado no card clicado
        let conquistasNomes = [];
        let catalogoBase = [];
        let corBadge = "#007bff";

        if (tipo === 'classes') {
            tituloEl.textContent = "🎒 Classes Regulares";
            conquistasNomes = dadosUser.classesConcluidas || [];
            catalogoBase = window.cacheClasses;
            corBadge = "#ffc107";
        } else if (tipo === 'especialidades') {
            tituloEl.textContent = "🏅 Especialidades Adquiridas";
            conquistasNomes = dadosUser.especialidades || [];
            catalogoBase = window.cacheEspecialidades;
            corBadge = "#007bff";
        } else if (tipo === 'mestrados') {
            tituloEl.textContent = "🏆 Mestrados Adquiridos";
            conquistasNomes = dadosUser.mestrados || [];
            catalogoBase = window.cacheMestrados;
            corBadge = "#28a745";
        }

        // Validação se não houver conquistas
        if (conquistasNomes.length === 0) {
            listaEl.innerHTML = `<p style="color:#8e8e8e; text-align:center; padding: 20px;">Você ainda não possui conquistas validadas nesta categoria.</p>`;
            return;
        }

        // 4. Renderiza cruzando os arrays para achar as fotos
        listaEl.innerHTML = conquistasNomes.map(nomeItem => {
            const infoBanco = catalogoBase.find(item => item.nome === nomeItem) || {};
            const fotoUrl = infoBanco.urlImagem || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';
            
            return `
                <div style="background:#121212; border:1px solid #262626; padding:12px; border-radius:8px; display:flex; align-items:center; gap:12px;">
                    <img src="${fotoUrl}" onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'" style="width:45px; height:45px; object-fit:cover; border-radius:8px; border: 1px solid #333;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; color:#fff; font-size:14px;">${nomeItem}</div>
                        <div style="font-size:11px; color:${corBadge}; font-weight:bold; text-transform:uppercase; margin-top:4px;">Adquirida</div>
                    </div>
                </div>
            `;
        }).join("");

    } catch (erro) {
        console.error("Erro ao carregar visualização de conquistas:", erro);
        listaEl.innerHTML = "<p style='color:#ff4d4d; text-align:center;'>Erro ao processar as conquistas. Tente novamente.</p>";
    }
}

function fecharModalConquistasVisualizacao() {
    const modal = document.getElementById("modal-conquistas-adquiridas");
    if (modal) modal.style.display = "none";
}   

// ==========================================
// GERENCIAMENTO DE ITENS (ADMIN) - V2 SENIOR
// ==========================================

function verificarNovaCategoria(valor) {
    const campoNova = document.getElementById("edit-item-categoria-nova");
    campoNova.style.display = (valor === "NOVA") ? "block" : "none";
}

function popularCategoriasNoModal(tipo, selecionada = "") {
    const select = document.getElementById("edit-item-categoria-select");
    if (!select) return;

    let cache = [];
    if (tipo === 'especialidades') cache = window.cacheEspecialidades;
    else if (tipo === 'mestrados') cache = window.cacheMestrados;
    else if (tipo === 'classes') cache = window.cacheClasses;

    // Obtém categorias únicas do cache atual
    let categoriasUnicas = [...new Set(cache.map(i => i.categoria || i.area || "Geral"))].filter(c => c !== "").sort();
    
    // Se o cache estiver vazio, usa fallbacks apenas para popular o seletor inicial
    if (categoriasUnicas.length === 0) {
        if (tipo === 'mestrados') categoriasUnicas = [...new Set(fallbackMestrados.map(i => i.categoria))];
        if (tipo === 'classes') categoriasUnicas = [...new Set(fallbackClasses.map(i => i.categoria))];
    }

    select.innerHTML = ""; // Limpa o select
    
    const optDefault = document.createElement("option");
    optDefault.value = "";
    optDefault.textContent = "Selecionar Categoria...";
    select.appendChild(optDefault);

    categoriasUnicas.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        if (cat === selecionada) opt.selected = true;
        select.appendChild(opt);
    });

    const optNova = document.createElement("option");
    optNova.value = "NOVA";
    optNova.textContent = "+ Criar Nova Categoria";
    optNova.style.color = "#0095f6";
    optNova.style.fontWeight = "bold";
    if (selecionada === "NOVA") optNova.selected = true;
    select.appendChild(optNova);
    
    verificarNovaCategoria(select.value);
}


async function gerenciarCategoriasAdmin() {
    const tipo = document.getElementById("edit-item-tipo").value;
    const catAtual = document.getElementById("edit-item-categoria-select").value;

    if (!catAtual || catAtual === "NOVA") {
        return alert("Selecione uma categoria existente para editar ou apagar.");
    }

    const acao = prompt(
        `Categoria: "${catAtual}"\nDigite 'EDITAR' para renomear ou 'APAGAR' para remover de todos os itens desta categoria:`
    );

    if (!acao) return;

    const acaoNormalizada = acao.trim().toUpperCase();

    if (acaoNormalizada !== "EDITAR" && acaoNormalizada !== "APAGAR") {
        alert("Ação inválida.");
        return;
    }

    const db = window.ClubeDB.textoDB;

    const configuracoes = {
        especialidades: {
            cache: "cacheEspecialidades",
            render: renderizarCatalogoEspecialidades,
            categoriaAtual: "categoriaAtualEspecialidades",
            busca: "busca-especialidade",
            padrao: "Geral"
        },
        mestrados: {
            cache: "cacheMestrados",
            render: renderizarCatalogoMestrados,
            categoriaAtual: "categoriaAtualMestrados",
            busca: "busca-mestrado",
            padrao: "Geral"
        },
        classes: {
            cache: "cacheClasses",
            render: renderizarCatalogoClasses,
            categoriaAtual: "categoriaAtualClasses",
            busca: "busca-classe",
            padrao: "Geral"
        }
    };

    const cfg = configuracoes[tipo];
    if (!cfg) {
        alert("Tipo inválido.");
        return;
    }

    try {
        let novaCategoria = catAtual;

        if (acaoNormalizada === "EDITAR") {
            novaCategoria = prompt("Novo nome para a categoria:", catAtual);
            if (!novaCategoria || novaCategoria.trim() === "" || novaCategoria === catAtual) return;
            novaCategoria = novaCategoria.trim();

            const confirmou = confirm(
                `Isso vai renomear a categoria de TODOS os itens em "${tipo}". Continuar?`
            );

            if (!confirmou) return;

            const snap = await db.collection(tipo).where("categoria", "==", catAtual).get();
            const batch = db.batch();

            snap.forEach(doc => {
                batch.update(doc.ref, {
                    categoria: novaCategoria,
                    area: novaCategoria
                });
            });

            await batch.commit();
            alert("Categoria atualizada!");
        } else {
            const confirmou = confirm(
                `Deseja remover a categoria "${catAtual}" de todos os itens? (Os itens não serão excluídos, apenas ficarão sem categoria)`
            );

            if (!confirmou) return;

            const snap = await db.collection(tipo).where("categoria", "==", catAtual).get();
            const batch = db.batch();

            snap.forEach(doc => {
                batch.update(doc.ref, {
                    categoria: cfg.padrao,
                    area: cfg.padrao
                });
            });

            await batch.commit();
            alert("Categoria removida!");
        }

        const cacheAtual = Array.isArray(window[cfg.cache]) ? [...window[cfg.cache]] : [];
        const categoriaFinal = (acaoNormalizada === "EDITAR") ? novaCategoria : cfg.padrao;

        window[cfg.cache] = cacheAtual.map(item => {
            const itemCategoria = item.categoria || item.area || cfg.padrao;

            if (itemCategoria !== catAtual) return item;

            return {
                ...item,
                categoria: categoriaFinal,
                area: categoriaFinal
            };
        });

        if (window[cfg.categoriaAtual] === catAtual) {
            window[cfg.categoriaAtual] = (acaoNormalizada === "EDITAR") ? novaCategoria : null;
        }

        const buscaEl = document.getElementById(cfg.busca);
        if (buscaEl && acaoNormalizada === "APAGAR") {
            buscaEl.value = buscaEl.value;
        }

        fecharModalGerenciarItem();

        if (typeof cfg.render === "function") {
            cfg.render(window[cfg.cache], true);
        }
    } catch (erro) {
        console.error("Erro ao gerenciar categoria:", erro);
        alert("Não foi possível concluir a alteração da categoria.");
    }
}


function abrirModalCriarItem() {
    document.getElementById("titulo-modal-item").textContent = "Criar Novo Item";
    document.getElementById("edit-item-id").value = "";
    document.getElementById("container-seletor-tipo").style.display = "block";
    
    document.getElementById("edit-item-nome").value = "";
    document.getElementById("edit-item-foto-url").value = "";
    document.getElementById("previa-item-img").style.display = "none";
    document.getElementById("edit-item-requisitos").value = "";
    document.getElementById("edit-item-categoria-nova").value = "";
    
    popularCategoriasNoModal('especialidades'); // Padrão inicial
    
    document.getElementById("btn-excluir-item").style.display = "none";
    document.getElementById("modal-gerenciar-item").style.display = "flex";
}

function abrirModalGerenciarItem(tipo, id) {
    let cache = window.cacheEspecialidades;
    if (tipo === 'mestrados') cache = window.cacheMestrados;
    if (tipo === 'classes') cache = window.cacheClasses;

    const item = cache.find(i => String(i.id) === String(id));
    if (!item) return;

    document.getElementById("titulo-modal-item").textContent = "Editar Item";
    document.getElementById("edit-item-id").value = id;
    document.getElementById("edit-item-tipo").value = tipo;
    document.getElementById("container-seletor-tipo").style.display = "none"; // Não muda tipo na edição

    document.getElementById("edit-item-nome").value = item.nome;
    const fotoUrl = item.urlImagem || item.logo || "";
    // Garante que o campo hidden tenha a URL (mesmo que vazia, nunca undefined)
    document.getElementById("edit-item-foto-url").value = fotoUrl || "";
    
    const previa = document.getElementById("previa-item-img" );
    // Sempre mostra a prévia: com a foto real se existir, ou com o avatar padrão como placeholder
    if (fotoUrl) {
        previa.src = fotoUrl;
        previa.style.display = "block";
        previa.onerror = function() { this.src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png"; };
    } else {
        previa.src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        previa.style.display = "block";
    }



    popularCategoriasNoModal(tipo, item.categoria || item.area || "");
    document.getElementById("edit-item-requisitos").value = (item.requisitos || []).join("\n");

    document.getElementById("btn-excluir-item").style.display = "block";
    document.getElementById("modal-gerenciar-item").style.display = "flex";
}

function fecharModalGerenciarItem() {
    document.getElementById("modal-gerenciar-item").style.display = "none";
}

async function salvarAlteracoesItemAdmin() {
    const btn = document.getElementById("btn-salvar-item-geral");
    const id = String(document.getElementById("edit-item-id").value || "").trim();
    const tipo = document.getElementById("edit-item-tipo").value;
    const nome = document.getElementById("edit-item-nome").value.trim();
    const requisitos = document
        .getElementById("edit-item-requisitos")
        .value
        .split("\n")
        .map(r => r.trim())
        .filter(r => r !== "");

    const catSelect = document.getElementById("edit-item-categoria-select").value;
    const categoria = (catSelect === "NOVA")
        ? document.getElementById("edit-item-categoria-nova").value.trim()
        : catSelect;

    if (!nome || !categoria) return alert("Nome e Categoria são obrigatórios.");

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Salvando...";
    }

    try {
        let finalFotoUrl = document.getElementById("edit-item-foto-url").value || "";
        const arquivoFoto = document.getElementById("edit-item-foto-file").files[0];

        if (arquivoFoto) {
            const uploadResultado = await subirImagemParaNuvem(arquivoFoto);
            if (uploadResultado) {
                finalFotoUrl = uploadResultado;
                document.getElementById("edit-item-foto-url").value = finalFotoUrl;

                const previa = document.getElementById("previa-item-img");
                if (previa) {
                    previa.src = finalFotoUrl;
                    previa.style.display = "block";
                }
            }
        }

        const db = window.ClubeDB.textoDB;

        const dadosSeguros = {
            nome: nome,
            urlImagem: finalFotoUrl || "",
            categoria: categoria,
            area: categoria,
            requisitos: requisitos,
            atualizadoEm: new Date()
        };

        let idFinal = id;

        if (id) {
            await db.collection(tipo).doc(id).update({
                nome: dadosSeguros.nome,
                urlImagem: dadosSeguros.urlImagem,
                categoria: dadosSeguros.categoria,
                area: dadosSeguros.area,
                requisitos: dadosSeguros.requisitos,
                atualizadoEm: dadosSeguros.atualizadoEm
            });
        } else {
            const novoDoc = await db.collection(tipo).add(dadosSeguros);
            idFinal = String(novoDoc.id);
        }

        const configuracoes = {
            especialidades: {
                cache: "cacheEspecialidades",
                render: renderizarCatalogoEspecialidades,
                andamento: carregarEspecialidadesEmAndamento
            },
            mestrados: {
                cache: "cacheMestrados",
                render: renderizarCatalogoMestrados,
                andamento: carregarMestradosEmAndamento
            },
            classes: {
                cache: "cacheClasses",
                render: renderizarCatalogoClasses,
                andamento: carregarClassesEmAndamento
            }
        };

        const cfg = configuracoes[tipo];
        const itemSalvo = {
            id: idFinal,
            ...dadosSeguros
        };

        if (cfg) {
            const cacheAtual = Array.isArray(window[cfg.cache]) ? [...window[cfg.cache]] : [];
            const idx = cacheAtual.findIndex(item => String(item.id) === String(idFinal));

            if (idx >= 0) {
                cacheAtual[idx] = {
                    ...cacheAtual[idx],
                    ...itemSalvo
                };
            } else {
                cacheAtual.push(itemSalvo);
            }

            window[cfg.cache] = cacheAtual;

            if (typeof cfg.render === "function") {
                cfg.render(window[cfg.cache], true);
            }

            if (typeof cfg.andamento === "function") {
                await cfg.andamento();
            }
        }

        fecharModalGerenciarItem();
        alert(id ? "Item atualizado!" : "Item criado!");
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Salvar";
        }
    }
}

// Função auxiliar para upload (Reutilizando o padrão do seu app)
async function subirImagemParaNuvem(arquivo) {

    try {
        let urlUpload = "";

        // Tenta usar o método de upload do ClubeDB primeiro (que já funciona)
        if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadFoto === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadFoto(arquivo);
            urlUpload = res.url || res.secure_url || "";
        } else if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadImagem === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadImagem(arquivo);
            urlUpload = res.url || res.secure_url || "";
        } else {
            // Fallback direto para o Cloudinary com o preset correto
            const formData = new FormData();
            formData.append("file", arquivo);
            formData.append("upload_preset", "guardioes_preset");

            const resp = await fetch("https://api.cloudinary.com/v1_1/dkozbm1ik/image/upload", {
                method: "POST",
                body: formData
            } );

            if (resp.ok) {
                const data = await resp.json();
                urlUpload = data.secure_url || data.url || "";
            } else {
                throw new Error("Não foi possível conectar ao servidor de imagens Cloudinary.");
            }
        }

        return urlUpload;
    } catch (e) {
        console.error("Erro no upload Cloudinary:", e);
        return "";
    }
}


async function excluirItemAdmin() {
    const id = String(
        document.getElementById("edit-item-id").value || ""
    ).trim();

    const tipo = document.getElementById("edit-item-tipo").value;

    if (!id || !tipo) {
        alert("Não foi possível identificar o item que será excluído.");
        return;
    }

    const configuracaoTipos = {
        especialidades: {
            progresso: "progresso_especialidades",
            cache: "cacheEspecialidades",
            nome: "especialidade",
            render: renderizarCatalogoEspecialidades,
            andamento: carregarEspecialidadesEmAndamento
        },
        mestrados: {
            progresso: "progresso_mestrados",
            cache: "cacheMestrados",
            nome: "mestrado",
            render: renderizarCatalogoMestrados,
            andamento: carregarMestradosEmAndamento
        },
        classes: {
            progresso: "progresso_classes",
            cache: "cacheClasses",
            nome: "classe",
            render: renderizarCatalogoClasses,
            andamento: carregarClassesEmAndamento
        }
    };

    const config = configuracaoTipos[tipo];

    if (!config) {
        alert("Tipo de item inválido. Não foi possível excluir.");
        return;
    }

    const confirmou = confirm(
        `Tem certeza que deseja excluir permanentemente este ${config.nome}?\n\n` +
        "O item será removido do catálogo e os progressos/avaliações pendentes relacionados a ele também serão excluídos."
    );

    if (!confirmou) {
        return;
    }

    try {
        const db = window.ClubeDB.textoDB;
        const itemRef = db.collection(tipo).doc(id);

        /*
         * Se o item já tiver sido removido do catálogo por outra
         * ação anterior, seguimos mesmo assim com a limpeza dos
         * vínculos e da interface.
         */
        await itemRef.delete();

        const [snapProgressos, snapPendencias] = await Promise.all([
            db.collection(config.progresso)
                .where("itemId", "==", id)
                .get(),
            db.collection("pendencias_aprovacao")
                .where("itemId", "==", id)
                .where("colecaoOrigem", "==", config.progresso)
                .get()
        ]);

        const apagarEmLotes = async (docs) => {
            if (!docs || docs.length === 0) return;

            for (let inicio = 0; inicio < docs.length; inicio += 450) {
                const lote = db.batch();
                const grupo = docs.slice(inicio, inicio + 450);

                grupo.forEach(doc => lote.delete(doc.ref));

                await lote.commit();
            }
        };

        await apagarEmLotes([...snapProgressos.docs]);
        await apagarEmLotes([...snapPendencias.docs]);

        const cacheAtual = Array.isArray(window[config.cache]) ? window[config.cache] : [];
        window[config.cache] = cacheAtual.filter(item => String(item.id) !== id);

        fecharModalGerenciarItem();

        if (tipo === "especialidades") {
            if (window.categoriaAtualEspecialidades && !window.cacheEspecialidades.some(i => (i.categoria || i.area || "Geral") === window.categoriaAtualEspecialidades)) {
                window.categoriaAtualEspecialidades = null;
            }
            renderizarCatalogoEspecialidades(window.cacheEspecialidades, true);
            if (typeof carregarEspecialidadesEmAndamento === "function") {
                await carregarEspecialidadesEmAndamento();
            }
        } else if (tipo === "mestrados") {
            if (window.categoriaAtualMestrados && !window.cacheMestrados.some(i => (i.categoria || i.area || "Mestrado") === window.categoriaAtualMestrados)) {
                window.categoriaAtualMestrados = null;
            }
            renderizarCatalogoMestrados(window.cacheMestrados, true);
            if (typeof carregarMestradosEmAndamento === "function") {
                await carregarMestradosEmAndamento();
            }
        } else if (tipo === "classes") {
            if (window.categoriaAtualClasses && !window.cacheClasses.some(i => (i.categoria || "Classe") === window.categoriaAtualClasses)) {
                window.categoriaAtualClasses = null;
            }
            renderizarCatalogoClasses(window.cacheClasses, true);
            if (typeof carregarClassesEmAndamento === "function") {
                await carregarClassesEmAndamento();
            }
        }

        alert(
            `${config.nome.charAt(0).toUpperCase() + config.nome.slice(1)} excluído com sucesso.`
        );
    } catch (erro) {
        console.error(`Erro ao excluir ${config.nome}:`, erro);
        alert(`Não foi possível excluir o ${config.nome}.\n\n${erro.message || "Erro desconhecido."}`);
    }
}

// ==========================================
// GESTÃO DE CONQUISTAS (ADMIN)
// ==========================================

async function carregarUsuariosParaGestaoConquistas() {
    const container = document.getElementById("lista-usuarios-conquistas");
    if (!container) return;
    container.innerHTML = "<p style='color: #8e8e8e; text-align: center;'>Carregando usuários...</p>";

    try {
        const snap = await window.ClubeDB.textoDB.collection("usuarios").orderBy("username").get();
        if (snap.empty) {
            container.innerHTML = "<p style='color: #8e8e8e; text-align: center;'>Nenhum usuário encontrado.</p>";
            return;
        }

        container.innerHTML = snap.docs.map(doc => {
            const u = doc.data();
            return `
                <div onclick="abrirModalGestaoConquistas('${u.username}')" style="background: #121212; border: 1px solid #262626; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s;">
                    <img src="${u.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #333;">
                    <div style="flex: 1;">
                        <div style="color: #fff; font-weight: bold; font-size: 14px;">${u.nomeReal || u.username}</div>
                        <div style="color: #8e8e8e; font-size: 12px;">@${u.username} • ${u.tipo}</div>
                    </div>
                    <div style="color: #0095f6; font-size: 18px;">›</div>
                </div>
            `;
        } ).join("");
    } catch (e) {
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center;'>Erro ao carregar usuários.</p>";
    }
}

let usuarioSendoGerenciado = null;

async function abrirModalGestaoConquistas(username) {
    usuarioSendoGerenciado = username;
    const modal = document.getElementById("modal-gestao-conquistas-usuario");
    const nomeEl = document.getElementById("gestao-conquistas-usuario-nome");
    const listaEl = document.getElementById("gestao-conquistas-lista-render");
    
    if (!modal || !listaEl) return;

    modal.style.display = "flex";
    nomeEl.textContent = `Conquistas de @${username}`;
    listaEl.innerHTML = "<p style='color: #8e8e8e; text-align: center;'>Buscando conquistas...</p>";

    try {
        const snap = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", username).get();
        if (snap.empty) return;
        
        const dados = snap.docs[0].data();
        const userId = snap.docs[0].id;

        // Garante que os catálogos estejam carregados para as imagens
        if (window.cacheEspecialidades.length === 0) await carregarEspecialidades();

        const renderSecao = (titulo, lista, campoNoBanco, cor, catalogo) => {
            if (!lista || lista.length === 0) return "";
            return `
                <div style="margin-bottom: 15px; width: 100%;">
                    <h4 style="color: ${cor}; font-size: 12px; margin-bottom: 12px; text-transform: uppercase; border-left: 3px solid ${cor}; padding-left: 8px; font-weight: 800;">${titulo}</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                        ${lista.map(itemNome => {
                            const info = catalogo.find(c => c.nome === itemNome) || {};
                            const imgUrl = info.urlImagem || info.logo || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';
                            return `
                                <div style="background: #121212; border: 1px solid #262626; padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; width: 100%; box-sizing: border-box;">
                                    <!-- Lado Esquerdo: Foto e Nome -->
                                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                                        <img src="${imgUrl}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 8px; border: 1px solid #333; flex-shrink: 0;">
                                        <div style="color: #fff; font-size: 14px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${itemNome}</div>
                                    </div>
                                    <!-- Lado Direito: Botão Fixo -->
                                    <button onclick="removerConquistaUsuario('${userId}', '${campoNoBanco}', '${itemNome}' )" style="background: #ff4d4d; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: bold; cursor: pointer; flex-shrink: 0; margin-left: 10px; width: 80px; text-align: center;">Apagar</button>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>
            `;
        };

        const html = [
            renderSecao("🎒 Classes Concluídas", dados.classesConcluidas, "classesConcluidas", "#ffc107", window.cacheClasses),
            renderSecao("🏅 Especialidades", dados.especialidades, "especialidades", "#007bff", window.cacheEspecialidades),
            renderSecao("🏆 Mestrados", dados.mestrados, "mestrados", "#28a745", window.cacheMestrados)
        ].join("");

        listaEl.innerHTML = html || "<p style='color: #8e8e8e; text-align: center; padding: 20px;'>Este usuário ainda não possui conquistas aprovadas.</p>";

    } catch (e) {
        console.error(e);
        listaEl.innerHTML = "<p style='color: #ff4d4d; text-align: center;'>Erro ao carregar detalhes.</p>";
    }
}




function fecharModalGestaoConquistas() {
    document.getElementById("modal-gestao-conquistas-usuario").style.display = "none";
    usuarioSendoGerenciado = null;
}

async function removerConquistaUsuario(userId, campo, itemNome) {
    if (!confirm(`Tem certeza que deseja remover "${itemNome}" deste usuário? Esta ação não pode ser desfeita.`)) return;

    try {
        const docRef = window.ClubeDB.textoDB.collection("usuarios").doc(userId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) return;

        const listaAtual = docSnap.data()[campo] || [];
        const novaLista = listaAtual.filter(i => i !== itemNome);

        await docRef.update({ [campo]: novaLista });
        
        alert("Item removido com sucesso!");
        // Recarrega o modal para atualizar a lista
        abrirModalGestaoConquistas(usuarioSendoGerenciado);
    } catch (e) {
        alert("Erro ao remover item.");
    }
}

