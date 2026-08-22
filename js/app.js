/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

const VERSAO_ATUAL = "v0.383.0 - versão alpha";

// Esta variável guardará o avatar padrão dos usuários e será atualizada pelo banco
window.AVATAR_USUARIO_PADRAO = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";



/*
 * =====================================================
 * CONFIGURAÇÃO DAS PUBLICAÇÕES
 * =====================================================
 *
 * URL pública do Cloudflare Worker responsável por:
 *
 * - receber a foto ou vídeo;
 * - enviar a mídia para o Telegram;
 * - fornecer a mídia posteriormente pelo endpoint /media.
 */
const PUBLICACOES_WORKER_URL =
    "https://telegram.glucasdiasofc.workers.dev";

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
            carregarCargosParaSelect();
            // carregarPendenciasAprovacaoAdmin(); // Agora carregado na aba de especialidades do site
        } else {

            irParaSite();
        }
    }
});

// Executa o login do administrador
async function executarLoginMembro() {
    const usuarioInput =
        document.getElementById("login-username").value.trim();

    const senhaInput =
        document.getElementById("login-senha").value;

    const erroDisplay =
        document.getElementById("erro-login");

    if (!usuarioInput || !senhaInput) {
        if (erroDisplay) {
            erroDisplay.textContent =
                "Digite seu usuário e senha.";
        }

        return;
    }

    if (erroDisplay) {
        erroDisplay.textContent =
            "Validando...";
    }

    try {
        const entradaLogin = usuarioInput.trim().toLowerCase();
        const ehAdministrador = entradaLogin === "admin";
        const entradaEhEmail = entradaLogin.includes("@");
        const emailFirebase =
            ehAdministrador
                ? "admin@guardioesdbv.com"
                : entradaEhEmail
                    ? entradaLogin
                    : `${entradaLogin}@guardioesdbv.com`;

        await window.ClubeDB.loginDB
            .signInWithEmailAndPassword(
                emailFirebase,
                senhaInput
            );

        let usernameSessao = ehAdministrador
            ? "admin"
            : entradaEhEmail
                ? entradaLogin.split("@")[0]
                : entradaLogin;

        if (!ehAdministrador) {
            const usuarioFirebase =
                window.ClubeDB.loginDB.currentUser;

            if (usuarioFirebase && usuarioFirebase.uid) {
                try {
                    const perfilSnap = await window.ClubeDB.textoDB
                        .collection("usuarios")
                        .doc(usuarioFirebase.uid)
                        .get();

                    if (perfilSnap.exists) {
                        const dadosPerfil =
                            perfilSnap.data() || {};
                        const usernamePerfil = String(
                            dadosPerfil.username || ""
                        ).trim().toLowerCase();

                        if (usernamePerfil) {
                            usernameSessao = usernamePerfil;
                        }
                    }
                } catch (erroPerfil) {
                    console.warn(
                        "Não foi possível sincronizar o username do perfil:",
                        erroPerfil
                    );
                }
            }
        }

        localStorage.setItem(
            "sessaoAdminLogado",
            "true"
        );

        localStorage.setItem(
            "usuarioLogado",
            ehAdministrador
                ? "admin"
                : "membro"
        );

        localStorage.setItem(
            "usernameLogado",
            usernameSessao
        );

        document.getElementById(
            "login-username"
        ).value = "";

        document.getElementById(
            "login-senha"
        ).value = "";

        if (ehAdministrador) {
            document.getElementById(
                "tela-login"
            ).style.display = "none";

            document.getElementById(
                "tela-admin"
            ).style.display = "flex";

            carregarUnidadesCadastradas();
            carregarMembrosCadastrados();
            carregarCargosParaSelect();

            if (
                typeof carregarAprovacoesSite ===
                "function"
            ) {
                carregarAprovacoesSite();
            }

            return;
        }

        document.getElementById(
            "tela-login"
        ).style.display = "none";

        irParaSite();
    } catch (erro) {
        console.error(
            "Erro de login:",
            erro
        );

        if (
            erro &&
            erro.code === "auth/user-not-found"
        ) {
            if (erroDisplay) {
                erroDisplay.textContent =
                    "Usuário não encontrado.";
            }
        } else if (
            erro &&
            erro.code === "auth/wrong-password"
        ) {
            if (erroDisplay) {
                erroDisplay.textContent =
                    "Senha incorreta.";
            }
        } else if (
            erro &&
            erro.code === "auth/invalid-credential"
        ) {
            if (erroDisplay) {
                erroDisplay.textContent =
                    "Usuário ou senha incorretos.";
            }
        } else {
            if (erroDisplay) {
                erroDisplay.textContent =
                    "Não foi possível entrar. Verifique usuário e senha.";
            }
        }
    }
}


const VAPID_PUBLIC_KEY_PROPRIA = "BEqg1YF_tRSajW2-drR0Qv1d6BUpOUkUtYpJjlQG6y5wnjWGcQ4WP5y7ranaDKTCS3ovefcwCXToY-_tnsUE6q8";
const WORKER_NOTIFICACOES_URL = "https://telegram.glucasdiasofc.workers.dev";
let _registroServiceWorkerPush = null;

function converterChavePublicaVapid(chave ) {
    const preenchimento = "=".repeat((4 - chave.length % 4) % 4);
    const base64 = (chave + preenchimento)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const binario = atob(base64);

    return Uint8Array.from(
        binario,
        caractere => caractere.charCodeAt(0)
    );
}

async function registrarPushNesteDispositivo() {
    try {
        if (typeof Notification === "undefined") {
            throw new Error(
                "Este navegador não possui a API de notificações."
            );
        }

        if (Notification.permission !== "granted") {
            throw new Error(
                "A permissão de notificações ainda não foi concedida."
            );
        }

        if (!window.isSecureContext) {
            throw new Error(
                "O site precisa estar aberto em HTTPS."
            );
        }

        if (!navigator.serviceWorker) {
            throw new Error(
                "Este navegador não possui Service Worker."
            );
        }

        const usuarioFirebase = window.ClubeDB &&
            window.ClubeDB.loginDB &&
            window.ClubeDB.loginDB.currentUser;

        const username = String(
            localStorage.getItem("usernameLogado") || ""
        ).trim().toLowerCase();

        if (!usuarioFirebase) {
            throw new Error(
                "O usuário Firebase ainda não está pronto."
            );
        }

        if (!username) {
            throw new Error(
                "O usernameLogado não foi encontrado."
            );
        }

        const registro = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js",
            { scope: "/" }
        );

        if (typeof registro.update === "function") {
            await registro.update().catch(() => undefined);
        }

        const registroPronto = await navigator.serviceWorker.ready;
        const pushManager = registroPronto.pushManager;

        if (!pushManager) {
            throw new Error(
                "O navegador não disponibiliza PushManager."
            );
        }

        let subscription =
            await pushManager.getSubscription();

        if (!subscription) {
            subscription = await pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey:
                    converterChavePublicaVapid(
                        VAPID_PUBLIC_KEY_PROPRIA
                    )
            });
        }

        const dadosSubscription =
            typeof subscription.toJSON === "function"
                ? subscription.toJSON()
                : subscription;

        if (
            !dadosSubscription ||
            !dadosSubscription.endpoint ||
            !dadosSubscription.keys ||
            !dadosSubscription.keys.p256dh ||
            !dadosSubscription.keys.auth
        ) {
            throw new Error(
                "O navegador não forneceu uma assinatura Push completa."
            );
        }

        const idToken =
            await usuarioFirebase.getIdToken(true);

        const resposta = await fetch(
            `${WORKER_NOTIFICACOES_URL}/push/subscribe`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    username,
                    subscription: dadosSubscription
                })
            }
        );

        const corpoResposta = await resposta.text();
        let respostaJSON = {};

        try {
            respostaJSON = corpoResposta
                ? JSON.parse(corpoResposta)
                : {};
        } catch (erroJSON) {
            throw new Error(
                "Resposta inválida do Worker: " + corpoResposta
            );
        }

        if (!resposta.ok || respostaJSON.ok !== true) {
            throw new Error(
                `Worker recusou o cadastro: HTTP ${resposta.status} — ${corpoResposta}`
            );
        }

        localStorage.setItem(
            "webPushAssinaturaAtiva",
            "true"
        );
        localStorage.setItem(
            "webPushEndpoint",
            String(dadosSubscription.endpoint)
        );
        localStorage.setItem(
            "webPushUsuarioAtivo",
            username
        );

        delete window._ultimoErroRegistroPush;

        console.log(
            "Web Push registrado para a conta atual:",
            username,
            respostaJSON
        );

        return subscription;
    } catch (erro) {
        const mensagemErro = erro && erro.message
            ? erro.message
            : String(erro);

        console.error(
            "Falha completa ao registrar Web Push:",
            mensagemErro
        );

        window._ultimoErroRegistroPush = mensagemErro;
        localStorage.removeItem(
            "webPushAssinaturaAtiva"
        );
        localStorage.removeItem(
            "webPushUsuarioAtivo"
        );

        return null;
    }
}




async function enviarPushParaDestinatario(
    destinatario,
    remetente,
    texto,
    chatId,
    messageId
) {
    try {
        const usuarioFirebase = window.ClubeDB &&
            window.ClubeDB.loginDB &&
            window.ClubeDB.loginDB.currentUser;

        if (
            !usuarioFirebase ||
            !destinatario ||
            !remetente ||
            !texto ||
            !chatId
        ) {
            return;
        }

        const idToken = await usuarioFirebase.getIdToken();
        const resposta = await fetch(
            `${WORKER_NOTIFICACOES_URL}/push/send`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    destinatario: String(
                        destinatario
                    ).trim().toLowerCase(),
                    remetente: String(
                        remetente
                    ).trim().toLowerCase(),
                    texto: String(texto),
                    chatId: String(chatId),
                    messageId: String(messageId || "")
                })
            }
        );

        if (!resposta.ok) {
            throw new Error(
                `Worker de notificações retornou HTTP ${resposta.status}.`
            );
        }
    } catch (erro) {
        console.warn(
            "O push falhou, mas a mensagem foi enviada normalmente:",
            erro
        );
    }
}

async function sincronizarPresencaPush() {
    const usuarioFirebase = window.ClubeDB &&
        window.ClubeDB.loginDB &&
        window.ClubeDB.loginDB.currentUser;
    const username = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (!usuarioFirebase || !username) {
        return;
    }

    try {
        const idToken = await usuarioFirebase.getIdToken();
        const visivel = document.visibilityState === "visible";
        const resposta = await fetch(
            `${WORKER_NOTIFICACOES_URL}/push/presence`,
            {
                method: "POST",
                keepalive: true,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    username,
                    visivel,
                    chatId: visivel
                        ? String(window._chatIdAtivo || "")
                        : ""
                })
            }
        );

        if (!resposta.ok) {
            throw new Error(
                `Presença de notificações retornou HTTP ${resposta.status}.`
            );
        }
    } catch (erro) {
        console.warn(
            "Não foi possível sincronizar a presença de notificações:",
            erro
        );
    }
}

// Direciona o fluxo para a tela de visualização do site
async function solicitarPermissaoNotificacoes() {
    const cicloAtual = ++_cicloAvisoNotificacoes;

    if (typeof Notification === "undefined") {
        return;
    }

    const telaSite = document.getElementById("tela-site");

    if (!telaSite || telaSite.style.display === "none") {
        return;
    }

    const removerAviso = () => {
        const avisoAtual = document.getElementById(
            "aviso-notificacoes-site"
        );

        if (avisoAtual) {
            avisoAtual.remove();
        }
    };

    const permissaoConcedida = Notification.permission === "granted";
    const aplicativoIOSForaDaTelaInicial =
        ehIOS() && !ehAplicativoInstalado();

    if (permissaoConcedida && !aplicativoIOSForaDaTelaInicial) {
        try {
            const assinaturaCadastrada =
                await registrarPushNesteDispositivo();

            if (assinaturaCadastrada) {
                removerAviso();
                return;
            }
        } catch (erro) {
            console.warn(
                "Não foi possível reanexar o cadastro de notificações:",
                erro
            );
        }
    }

    if (cicloAtual !== _cicloAvisoNotificacoes) {
        return;
    }

    removerAviso();

    const aviso = document.createElement("div");
    aviso.id = "aviso-notificacoes-site";
    aviso.setAttribute("role", "status");
    aviso.style.position = "fixed";
    aviso.style.left = "50%";
    aviso.style.bottom = "24px";
    aviso.style.transform = "translateX(-50%)";
    aviso.style.zIndex = "2147483647";
    aviso.style.width = "min(92vw, 430px)";
    aviso.style.padding = "16px";
    aviso.style.borderRadius = "14px";
    aviso.style.background = "#20252b";
    aviso.style.color = "#fff";
    aviso.style.boxShadow = "0 8px 28px rgba(0,0,0,.38)";
    aviso.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    aviso.style.fontSize = "14px";
    aviso.style.lineHeight = "1.45";

    const texto = document.createElement("div");
    texto.style.marginBottom = "12px";

    const botao = document.createElement("button");
    botao.type = "button";
    botao.style.border = "0";
    botao.style.borderRadius = "9px";
    botao.style.padding = "9px 14px";
    botao.style.background = "#1683e8";
    botao.style.color = "#fff";
    botao.style.fontWeight = "700";
    botao.style.cursor = "pointer";
    botao.style.minHeight = "40px";

    const fecharAviso = () => {
        if (aviso.isConnected) {
            aviso.remove();
        }
    };

    const mostrarBloqueio = () => {
        texto.textContent =
            "As notificações estão bloqueadas neste dispositivo. " +
            "Abra as configurações do site, entre em Notificações, " +
            "selecione Permitir e retorne ao app.";
        botao.textContent = "Entendi";
        botao.disabled = false;
        botao.onclick = fecharAviso;
    };

    const configurarInstalacaoIOS = () => {
        texto.textContent =
            "Para receber notificações com o app fechado, instale o Clube Guardiões na Tela de Início.";
        botao.textContent = "Como instalar";
        botao.onclick = () => {
            texto.textContent =
                "No Safari, toque em Compartilhar, escolha Adicionar à Tela de Início, abra o ícone criado e permita as notificações dentro dele.";
            botao.textContent = "Entendi";
            botao.onclick = fecharAviso;
        };
    };

    const mostrarErroRegistro = () => {
        const detalhe = window._ultimoErroRegistroPush
            ? ` Detalhe: ${window._ultimoErroRegistroPush}`
            : "";
        texto.textContent =
            "Não foi possível registrar este dispositivo. Verifique a conexão e tente novamente." +
            detalhe;
        botao.disabled = false;
        botao.textContent = "Tentar novamente";
        botao.onclick = async () => {
            botao.disabled = true;
            botao.textContent = "Registrando...";
            const assinatura =
                await registrarPushNesteDispositivo();
            if (assinatura) {
                fecharAviso();
                return;
            }
            mostrarErroRegistro();
        };
    };

    if (Notification.permission === "denied") {
        texto.textContent =
            "As notificações estão bloqueadas neste dispositivo. Libere a permissão nas configurações do site.";
        botao.textContent = "Ver instruções";
        botao.onclick = mostrarBloqueio;
    } else if (aplicativoIOSForaDaTelaInicial) {
        configurarInstalacaoIOS();
    } else if (Notification.permission === "granted") {
        texto.textContent =
            "A permissão está concedida, mas não foi possível registrar este dispositivo automaticamente.";
        botao.textContent = "Tentar novamente";
        botao.onclick = async () => {
            botao.disabled = true;
            botao.textContent = "Registrando...";

            const assinatura =
                await registrarPushNesteDispositivo();

            if (assinatura) {
                fecharAviso();
                return;
            }

            mostrarErroRegistro();
        };
    } else {
        texto.textContent =
            "Ative as notificações para receber cada nova mensagem, inclusive quando o app estiver em segundo plano ou fechado.";
        botao.textContent = "Permitir notificações";
        botao.onclick = async () => {
            botao.disabled = true;
            botao.textContent = "Aguardando...";

            try {
                const permissao =
                    await Notification.requestPermission();

                if (permissao === "granted") {
                    const assinatura =
                        await registrarPushNesteDispositivo();

                    if (assinatura) {
                        fecharAviso();
                        return;
                    }

                    mostrarErroRegistro();
                    return;
                }

                if (permissao === "denied") {
                    mostrarBloqueio();
                    return;
                }

                botao.disabled = false;
                botao.textContent = "Permitir notificações";
            } catch (erro) {
                console.error(
                    "Erro ao solicitar notificações:",
                    erro
                );
                mostrarErroRegistro();
            }
        };
    }

    aviso.appendChild(texto);
    aviso.appendChild(botao);
    telaSite.appendChild(aviso);
}







function criarBotaoAtivacaoPush(motivo) {
    if (document.getElementById("btn-ativar-notificacoes")) {
        return;
    }

    const aviso = document.createElement("button");
    aviso.id = "btn-ativar-notificacoes";
    aviso.type = "button";
    aviso.textContent = "Ativar notificações";
    aviso.title = motivo || "Ative as notificações";
    aviso.style.position = "fixed";
    aviso.style.right = "16px";
    aviso.style.bottom = "78px";
    aviso.style.zIndex = "2147483647";
    aviso.style.padding = "11px 14px";
    aviso.style.border = "0";
    aviso.style.borderRadius = "10px";
    aviso.style.background = "#1683e8";
    aviso.style.color = "#fff";
    aviso.style.fontWeight = "700";
    aviso.style.cursor = "pointer";

    aviso.addEventListener("click", async () => {
        if (Notification.permission === "denied") {
            alert(
                "As notificações estão bloqueadas. " +
                "Abra as configurações do site no navegador, " +
                "permita as notificações e recarregue a página."
            );
            return;
        }

        aviso.disabled = true;
        aviso.textContent = "Ativando...";

        try {
            const permissao = await Notification.requestPermission();

            if (permissao !== "granted") {
                aviso.disabled = false;
                aviso.textContent = "Ativar notificações";
                return;
            }

            const subscription =
                await registrarPushNesteDispositivo();

            if (!subscription) {
                throw new Error(
                    "O dispositivo não foi registrado no Worker."
                );
            }

            aviso.textContent = "Notificações ativadas";
            setTimeout(() => aviso.remove(), 2200);
        } catch (erro) {
            console.error(
                "Erro ao ativar notificações:",
                erro
            );
            aviso.disabled = false;
            aviso.textContent = "Tentar novamente";
        }
    });

    document.body.appendChild(aviso);
}


function mostrarNotificacaoNovaMensagem(
    quantidade,
    nomeContato,
    chatId
) {
    if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
    ) {
        return;
    }

    const chatAtualVisivel =
        document.visibilityState === "visible" &&
        String(window._chatIdAtivo || "") === String(chatId || "");

    if (chatId && chatAtualVisivel) {
        return;
    }

    const texto = quantidade === 1
        ? "Você recebeu uma nova mensagem."
        : `Você recebeu ${quantidade} novas mensagens.`;
    const mensagem = nomeContato
        ? `${nomeContato}: ${texto}`
        : texto;

    let toast = document.getElementById("notificacao-mensagem-chat");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "notificacao-mensagem-chat";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.style.position = "fixed";
        toast.style.right = "16px";
        toast.style.bottom = "78px";
        toast.style.zIndex = "2147483646";
        toast.style.maxWidth = "min(320px, calc(100vw - 32px))";
        toast.style.padding = "12px 16px";
        toast.style.borderRadius = "12px";
        toast.style.background = "#1683e8";
        toast.style.color = "#fff";
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "600";
        toast.style.lineHeight = "1.4";
        toast.style.boxShadow = "0 4px 18px rgba(0,0,0,.45)";
        toast.style.cursor = "pointer";
        document.body.appendChild(toast);
    }

    toast.textContent = mensagem;
    toast.style.display = "block";

    clearTimeout(window._timerNotificacaoMensagem);
    window._timerNotificacaoMensagem = setTimeout(() => {
        toast.style.display = "none";
    }, 5000);
}

let _timerOrdenacaoContatosChat = null;
let _ordenacaoContatosChatEmAndamento = false;
let _ordenacaoContatosChatPendente = false;

function agendarAtualizacaoOrdenacaoContatosChat() {
    clearTimeout(_timerOrdenacaoContatosChat);

    _timerOrdenacaoContatosChat = setTimeout(
        atualizarOrdenacaoContatosChat,
        180
    );
}

async function atualizarOrdenacaoContatosChat() {
    if (_ordenacaoContatosChatEmAndamento) {
        _ordenacaoContatosChatPendente = true;
        return;
    }

    _ordenacaoContatosChatEmAndamento = true;

    try {
        await carregarListaDeContatosChat();
    } catch (erro) {
        console.error(
            "Erro ao atualizar a lista de contatos e grupos:",
            erro
        );
    } finally {
        _ordenacaoContatosChatEmAndamento = false;

        if (_ordenacaoContatosChatPendente) {
            _ordenacaoContatosChatPendente = false;
            agendarAtualizacaoOrdenacaoContatosChat();
        }
    }
}


function iniciarListenerGlobalMensagens() {
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (
        !usernameLogado ||
        !window.ClubeDB ||
        !window.ClubeDB.textoDB ||
        typeof window.ClubeDB.textoDB.collectionGroup !== "function"
    ) {
        clearTimeout(window._timerListenerMensagens);
        window._timerListenerMensagens = setTimeout(
            iniciarListenerGlobalMensagens,
            500
        );
        return;
    }

    if (
        window._listenerGlobalMensagensAtivo &&
        window._listenerGlobalMensagensUsuario === usernameLogado &&
        window._unsubscribeGlobalMensagens
    ) {
        return;
    }

    if (window._unsubscribeGlobalMensagens) {
        window._unsubscribeGlobalMensagens();
    }

    clearTimeout(_timerOrdenacaoContatosChat);

    const estado = {
        total: 0,
        porChat: {},
        porContato: {},
        contatosPorChat: {},
        tipoPorChat: {},
        anteriores: {},
        assinaturasChats: {},
        ultimaInteracaoPorChat: {},
        inicializado: false,
        chatsInicializados: false
    };

    window._estadoContadoresMensagens = estado;
    window._listenerGlobalMensagensAtivo = true;
    window._listenerGlobalMensagensUsuario = usernameLogado;

    const converterTimestampParaMillis = valor => {
        if (
            valor &&
            typeof valor.toMillis === "function"
        ) {
            return valor.toMillis();
        }

        if (
            valor &&
            typeof valor.toDate === "function"
        ) {
            return valor.toDate().getTime();
        }

        if (
            typeof valor === "string" ||
            typeof valor === "number"
        ) {
            const resultado = new Date(valor).getTime();
            return Number.isNaN(resultado)
                ? 0
                : resultado;
        }

        return 0;
    };

    const obterListaVisivel = () => {
        const lista = document.getElementById(
            "lista-msg-outras"
        );

        if (!lista) {
            return null;
        }

        return lista;
    };

    const obterCardsVisiveis = lista => {
        if (!lista) {
            return [];
        }

        return Array.from(lista.children).filter(card => {
            return card && card.getAttribute(
                "data-tipo-chat"
            );
        });
    };

    const reordenarCardsContatosChat = () => {
        const lista = obterListaVisivel();
        const cards = obterCardsVisiveis(lista);

        if (!lista || cards.length < 2) {
            return;
        }

        const ordemOriginal = new Map(
            cards.map((card, indice) => [card, indice])
        );

        cards.sort((primeiro, segundo) => {
            const diferenca = Number(
                segundo.getAttribute(
                    "data-ultima-interacao"
                ) || 0
            ) - Number(
                primeiro.getAttribute(
                    "data-ultima-interacao"
                ) || 0
            );

            if (diferenca !== 0) {
                return diferenca;
            }

            return Number(
                ordemOriginal.get(primeiro) || 0
            ) - Number(
                ordemOriginal.get(segundo) || 0
            );
        });

        const fragmento = document.createDocumentFragment();
        cards.forEach(card => fragmento.appendChild(card));
        lista.appendChild(fragmento);
    };

    const encontrarCardPorChatId = chatId => {
        const lista = obterListaVisivel();
        const cards = obterCardsVisiveis(lista);
        const contato = String(
            estado.contatosPorChat[chatId] || ""
        ).trim().toLowerCase();

        return cards.find(card => {
            const idGrupo = String(
                card.getAttribute("data-group-chat-id") || ""
            );
            const usernameContato = String(
                card.getAttribute("data-chat-username") || ""
            ).trim().toLowerCase();

            return idGrupo === String(chatId) ||
                Boolean(contato) &&
                usernameContato === contato;
        }) || null;
    };

    const moverCardParaTopo = (chatId, timestamp) => {
        const card = encontrarCardPorChatId(chatId);
        const valorNovo = Number(timestamp || 0);

        if (!card || !valorNovo) {
            return;
        }

        const valorAnterior = Number(
            card.getAttribute(
                "data-ultima-interacao"
            ) || 0
        );

        if (valorNovo > valorAnterior) {
            card.setAttribute(
                "data-ultima-interacao",
                String(valorNovo)
            );
        }

        reordenarCardsContatosChat();
    };

    const listaJaFoiRenderizada = () => {
        const lista = obterListaVisivel();
        return Boolean(
            lista &&
            obterCardsVisiveis(lista).length
        );
    };

    const renderizar = () => {
        const badgeAba = criarOuAtualizarBadgeMensagens();

        if (badgeAba) {
            badgeAba.textContent = estado.total > 99
                ? "99+"
                : String(estado.total);
            badgeAba.style.display = estado.total > 0
                ? "block"
                : "none";
        }

        document.querySelectorAll("[data-chat-username]")
            .forEach(card => {
                const usernameContato = String(
                    card.getAttribute("data-chat-username") || ""
                ).trim().toLowerCase();
                const badgeContato = card.querySelector(
                    "[data-unread-badge]"
                );

                if (!badgeContato) {
                    return;
                }

                const quantidade = Number(
                    estado.porContato[usernameContato] || 0
                );
                badgeContato.textContent = quantidade > 99
                    ? "99+"
                    : String(quantidade);
                badgeContato.style.display = quantidade > 0
                    ? "inline-flex"
                    : "none";
            });
    };

    const unsubscribeChats = window.ClubeDB.textoDB
        .collection("chats")
        .where("usuarios", "array-contains", usernameLogado)
        .onSnapshot(snapshot => {
            const assinaturasAtuais = {};
            const contatosAtuais = {};
            const tiposAtuais = {};
            let precisaReconstruir = !estado.chatsInicializados;

            snapshot.forEach(doc => {
                const dados = doc.data() || {};
                const usuarios = Array.isArray(dados.usuarios)
                    ? dados.usuarios
                    : [];
                const usuariosNormalizados = usuarios
                    .map(usuario => String(
                        usuario || ""
                    ).trim().toLowerCase())
                    .filter(Boolean)
                    .sort();
                const tipo = String(
                    dados.tipo || "individual"
                ).trim().toLowerCase();
                const assinatura = JSON.stringify({
                    tipo,
                    usuarios: usuariosNormalizados,
                    nomeGrupo: String(
                        dados.nomeGrupo || ""
                    ),
                    fotoGrupoUrl: String(
                        dados.fotoGrupoUrl || ""
                    )
                });

                assinaturasAtuais[doc.id] = assinatura;
                tiposAtuais[doc.id] = tipo;

                if (
                    estado.assinaturasChats[doc.id] &&
                    estado.assinaturasChats[doc.id] !== assinatura
                ) {
                    precisaReconstruir = true;
                }

                if (tipo !== "grupo") {
                    const outro = usuarios.find(usuario => {
                        return String(usuario || "")
                            .trim()
                            .toLowerCase() !== usernameLogado;
                    });

                    if (outro) {
                        contatosAtuais[doc.id] = String(
                            outro
                        ).trim().toLowerCase();
                    }
                }

                const ultimaInteracao =
                    converterTimestampParaMillis(
                        dados.ultimoEnvio
                    );

                if (ultimaInteracao > 0) {
                    estado.ultimaInteracaoPorChat[doc.id] = Math.max(
                        Number(
                            estado.ultimaInteracaoPorChat[doc.id] || 0
                        ),
                        ultimaInteracao
                    );
                }
            });

            Object.keys(estado.assinaturasChats).forEach(chatId => {
                if (!assinaturasAtuais[chatId]) {
                    precisaReconstruir = true;
                    delete estado.contatosPorChat[chatId];
                    delete estado.tipoPorChat[chatId];
                    delete estado.ultimaInteracaoPorChat[chatId];
                }
            });

            estado.assinaturasChats = assinaturasAtuais;
            estado.contatosPorChat = contatosAtuais;
            estado.tipoPorChat = tiposAtuais;
            estado.chatsInicializados = true;

            Object.keys(estado.ultimaInteracaoPorChat)
                .forEach(chatId => {
                    moverCardParaTopo(
                        chatId,
                        estado.ultimaInteracaoPorChat[chatId]
                    );
                });

            Object.keys(estado.porChat).forEach(chatId => {
                const contato = estado.contatosPorChat[chatId];
                if (contato) {
                    estado.porContato[
                        String(contato).trim().toLowerCase()
                    ] = estado.porChat[chatId];
                }
            });

            renderizar();

            if (
                precisaReconstruir ||
                !listaJaFoiRenderizada()
            ) {
                agendarAtualizacaoOrdenacaoContatosChat();
            } else {
                reordenarCardsContatosChat();
            }
        }, erro => {
            console.error(
                "Erro ao observar contatos do chat:",
                erro
            );
        });

    const unsubscribeMensagens = window.ClubeDB.textoDB
        .collectionGroup("mensagens")
        .onSnapshot(snapshot => {
            const novasContagens = {};
            const ultimasMensagens = {};

            snapshot.forEach(doc => {
                const mensagem = doc.data() || {};
                const chatRef = doc.ref.parent.parent;
                const chatId = chatRef
                    ? chatRef.id
                    : "";

                if (chatId) {
                    const timestampMensagem =
                        converterTimestampParaMillis(
                            mensagem.enviadoEm ||
                            mensagem.timestamp
                        ) || Date.now();
                    ultimasMensagens[chatId] = Math.max(
                        Number(ultimasMensagens[chatId] || 0),
                        timestampMensagem
                    );
                }

                const destinatario = String(
                    mensagem.destinatario || ""
                ).trim().toLowerCase();

                if (
                    destinatario !== usernameLogado ||
                    mensagem.lido === true
                ) {
                    return;
                }

                if (!chatRef) {
                    return;
                }

                novasContagens[chatRef.id] =
                    (novasContagens[chatRef.id] || 0) + 1;
            });

            if (estado.inicializado) {
                Object.keys(novasContagens).forEach(chatId => {
                    const anterior = Number(
                        estado.anteriores[chatId] || 0
                    );
                    const atual = Number(
                        novasContagens[chatId] || 0
                    );

                    if (atual > anterior) {
                        mostrarNotificacaoNovaMensagem(
                            atual - anterior,
                            estado.contatosPorChat[chatId] || "",
                            chatId
                        );
                    }
                });
            }

            Object.keys(ultimasMensagens).forEach(chatId => {
                const timestampMensagem =
                    ultimasMensagens[chatId];
                const timestampAnterior = Number(
                    estado.ultimaInteracaoPorChat[chatId] || 0
                );

                if (timestampMensagem > timestampAnterior) {
                    estado.ultimaInteracaoPorChat[chatId] =
                        timestampMensagem;
                    moverCardParaTopo(
                        chatId,
                        timestampMensagem
                    );
                }
            });

            estado.porChat = novasContagens;
            estado.porContato = {};
            estado.total = Object.values(novasContagens)
                .reduce((soma, valor) => soma + valor, 0);
            estado.anteriores = { ...novasContagens };
            estado.inicializado = true;

            Object.keys(novasContagens).forEach(chatId => {
                const contato = estado.contatosPorChat[chatId];
                if (contato) {
                    estado.porContato[
                        String(contato).trim().toLowerCase()
                    ] = novasContagens[chatId];
                }
            });

            renderizar();
            reordenarCardsContatosChat();
        }, erro => {
            console.error(
                "Erro ao observar mensagens em tempo real:",
                erro
            );
        });

    window._unsubscribeGlobalMensagens = () => {
        unsubscribeChats();
        unsubscribeMensagens();
    };
}




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

    mudarSubAbaSite("feed");
    solicitarPermissaoNotificacoes();
    iniciarListenerGlobalMensagens();
    iniciarListenerNotificacoesGerais();
    sincronizarPresencaPush();
    window.setTimeout(
        processarAberturaChatPorNotificacao,
        0
    );
}





// Retorna para o Painel do Administrador
function irParaPainel() {
    document.getElementById("tela-site").style.display = "none";
    document.getElementById("tela-admin").style.display = "flex";
    
    carregarUnidadesCadastradas();
    carregarMembrosCadastrados();
    carregarCargosParaSelect();
    if (typeof carregarAprovacoesSite === 'function') carregarAprovacoesSite();
}

// Carrega os cargos cadastrados no Firestore para os campos de seleção de membros
async function carregarCargosParaSelect() {
    const selectCadastro = document.getElementById("membro-cargo");
    const selectEdicao = document.getElementById("edit-membro-cargo");

    if (!selectCadastro && !selectEdicao) return;

    try {
        const db = window.ClubeDB ? window.ClubeDB.textoDB : firebase.firestore();
        const snapshot = await db.collection("cargos").get();

        let optionsHTML = '<option value="">Selecionar Cargo...</option>';

        snapshot.forEach((doc) => {
            const data = doc.data();
            const nomeCargo = data.nome || data.cargo || doc.id;
            const funcaoCargo = data.funcao || "nenhuma";
            optionsHTML += `<option value="${doc.id}" data-funcao="${funcaoCargo}">${nomeCargo}</option>`;
        });

        if (selectCadastro) selectCadastro.innerHTML = optionsHTML;
        if (selectEdicao) selectEdicao.innerHTML = optionsHTML;
    } catch (erro) {
        console.error("Erro ao carregar cargos para os selects:", erro);
    }
}

// Atualiza a prévia da função associada ao cargo selecionado
function atualizarFuncaoCargoSelecionado(selectId, previewId) {
    const select = document.getElementById(selectId);
    const preview = document.getElementById(previewId);
    if (!select || !preview) return;

    const opSelecionada = select.options[select.selectedIndex];
    if (!opSelecionada || !opSelecionada.value) {
        preview.textContent = "Nenhuma função adicional associada.";
        return;
    }

    const funcao = opSelecionada.getAttribute("data-funcao") || "nenhuma";
    const mapaFuncoes = {
        "nenhuma": "Nenhuma função adicional associada.",
        "publicar": "Pode publicar no feed",
        "gerenciar_membros": "Pode gerenciar membros",
        "gerenciar_conquistas": "Pode gerenciar conquistas",
        "gerenciar_unidades": "Pode gerenciar unidades",
        "acesso_total": "Acesso administrativo total"
    };

    preview.textContent = mapaFuncoes[funcao] || `Função: ${funcao}`;
}

// Alterna entre o Feed e o Perfil no App do Usuário
function mudarSubAbaSite(abaAlvo) {
    const feedAba = document.getElementById("sub-aba-feed");
    const perfilAba = document.getElementById("sub-aba-perfil");
    const espAba = document.getElementById("sub-aba-especialidades");
    const msgAba = document.getElementById("sub-aba-mensagens");
    const btnCriarPublicacao = document.getElementById("btn-criar-publicacao");

    const btnFeed = document.getElementById("btn-sub-feed");
    const btnEsp = document.getElementById("btn-sub-especialidades");
    const btnMsg = document.getElementById("btn-sub-mensagens");
    const btnPerfil = document.getElementById("btn-sub-perfil");

    if (feedAba) feedAba.style.display = "none";
    if (perfilAba) perfilAba.style.display = "none";
    if (espAba) espAba.style.display = "none";
    if (msgAba) msgAba.style.display = "none";

    /*
     * O botão de criar publicação só aparece na aba Feed,
     * que é a área de Publicações.
     */
    if (btnCriarPublicacao) {
        const exibirBotao = abaAlvo === "feed";

        btnCriarPublicacao.style.display = exibirBotao
            ? "flex"
            : "none";

        btnCriarPublicacao.setAttribute(
            "aria-hidden",
            exibirBotao ? "false" : "true"
        );
    }

    const configurarBotaoNavbar = (btn, isAtivo) => {
        if (!btn) return;

        btn.style.transition =
            "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        btn.style.opacity = isAtivo ? "1" : "0.5";
        btn.style.transform = isAtivo ? "scale(1.2)" : "scale(1)";
        btn.style.filter = isAtivo
            ? "drop-shadow(0 0 12px rgba(255, 215, 0, 1))"
            : "none";

        btn.onmouseenter = () => {
            if (!isAtivo) {
                btn.style.transform = "scale(1.15)";
                btn.style.filter =
                    "drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))";
            }
        };

        btn.onmouseleave = () => {
            if (!isAtivo) {
                btn.style.transform = "scale(1)";
                btn.style.filter = "none";
            }
        };
    };

    configurarBotaoNavbar(btnFeed, abaAlvo === "feed");
    configurarBotaoNavbar(btnEsp, abaAlvo === "especialidades");
    configurarBotaoNavbar(btnMsg, abaAlvo === "mensagens");
    configurarBotaoNavbar(btnPerfil, abaAlvo === "perfil");

    const animarLogoParaEsquerda = (moverParaEsquerda) => {
        const logoImg = document.getElementById("site-logo-img");
        const logoTexto = document.getElementById("site-logo-texto");

        [logoImg, logoTexto].forEach((elemento) => {
            if (!elemento || elemento.style.display === "none") return;

            elemento.style.transition =
                "transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)";

            elemento.style.transform = moverParaEsquerda
                ? "translate3d(-35vw, 0, 0) scale(0.9)"
                : "translate3d(0, 0, 0) scale(1)";
        });
    };

    animarLogoParaEsquerda(abaAlvo === "perfil");

    if (abaAlvo === "feed") {
        if (feedAba) feedAba.style.display = "block";

        // LÓGICA SÊNIOR: Sincroniza em tempo real a foto de perfil do autor no gatilho da UI
        const avatarCriadorModal = document.getElementById("criador-publicacao-avatar");
        const usernameLogado = localStorage.getItem("usernameLogado");
        
        if (avatarCriadorModal && usernameLogado && window.ClubeDB && window.ClubeDB.textoDB) {
            // Fallback Imediato: Evita "piscar" uma imagem quebrada caso a rede demore
            avatarCriadorModal.src = avatarCriadorModal.src || window.AVATAR_USUARIO_PADRAO;
            
            window.ClubeDB.textoDB.collection("usuarios")
                .where("username", "==", usernameLogado)
                .limit(1)
                .get()
                .then(snap => {
                    if (!snap.empty) {
                        const dados = snap.docs[0].data();
                        // Ajustado para usar fotoUrl e a coleção correta (usuarios)
                        avatarCriadorModal.src = normalizarUrlPublicacao(dados.fotoUrl || dados.foto) || window.AVATAR_USUARIO_PADRAO;
                    } else {
                        avatarCriadorModal.src = window.AVATAR_USUARIO_PADRAO;
                    }
                })
                .catch(err => {
                    console.error("Erro ao validar foto para a área de publicações:", err);
                    avatarCriadorModal.src = window.AVATAR_USUARIO_PADRAO;
                });
        }


        if (typeof carregarPublicacoesFeed === "function") {
            carregarPublicacoesFeed();
        }
    } else if (abaAlvo === "especialidades") {
        if (espAba) espAba.style.display = "block";

        if (typeof carregarEspecialidades === "function") {
            carregarEspecialidades();
        }

        if (typeof carregarAprovacoesSite === "function") {
            carregarAprovacoesSite();
        }
    } else if (abaAlvo === "mensagens") {
        if (msgAba) msgAba.style.display = "flex";

        if (typeof carregarListaDeContatosChat === "function") {
            carregarListaDeContatosChat();
        }
    } else if (abaAlvo === "perfil") {
        if (perfilAba) perfilAba.style.display = "block";

        if (typeof carregarPerfilDoUsuario === "function") {
            carregarPerfilDoUsuario();
        }
    }
}

// ==========================================
// LÓGICA DE MENSAGENS / CHAT DIRECT
// ==========================================
let unsubscribeChatAtivo = null;
let usuarioChatDestino = null;
window._chatIdAtivo = "";

function sincronizarEstadoChatComServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    navigator.serviceWorker.getRegistration("/")
        .then(registro => {
            if (!registro || !registro.active) {
                return;
            }

            registro.active.postMessage({
                type: "CHAT_STATE",
                chatId: String(window._chatIdAtivo || ""),
                visivel: document.visibilityState === "visible" &&
                    Boolean(window._chatIdAtivo)
            });
        })
        .catch(erro => {
            console.warn(
                "Não foi possível sincronizar o estado do chat:",
                erro
            );
        });
}

document.addEventListener(
    "visibilitychange",
    sincronizarEstadoChatComServiceWorker
);

async function carregarListaDeContatosChat() {
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const tipoUsuarioLogado = localStorage.getItem(
        "usuarioLogado"
    );
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!usernameLogado || !banco) {
        return;
    }

    const carregando = document.getElementById(
        "msg-loading-state"
    );
    const vazio = document.getElementById(
        "msg-empty-state"
    );
    const container = document.getElementById(
        "msg-contatos-container"
    );
    const divGrupos = document.getElementById(
        "lista-msg-grupos"
    );
    const tituloGrupos = document.getElementById(
        "titulo-msg-grupos"
    );
    const divSuporte = document.getElementById(
        "lista-msg-suporte"
    );
    const divLideranca = document.getElementById(
        "lista-msg-lideranca"
    );
    const divUnidade = document.getElementById(
        "lista-msg-unidade"
    );
    const divOutras = document.getElementById(
        "lista-msg-outras"
    );

    const listaJaRenderizada = Boolean(
        container &&
        container.querySelector(
            "[data-tipo-chat]"
        )
    );

    if (carregando) {
        carregando.style.display = listaJaRenderizada
            ? "none"
            : "block";
    }
    if (vazio) {
        vazio.style.display = "none";
    }
    if (container && !listaJaRenderizada) {
        container.style.display = "none";
    }


    const limparListaDepoisDaConsulta = () => {
        [
            divGrupos,
            divSuporte,
            divLideranca,
            divUnidade,
            divOutras
        ].forEach(div => {
            if (div) {
                div.innerHTML = "";
            }
        });
    };


    let minhaUnidade = "";
    const ultimaInteracaoPorContato = {};
    const gruposChat = [];

    const timestampEmMillis = valor => {
        if (
            valor &&
            typeof valor.toMillis === "function"
        ) {
            return valor.toMillis();
        }

        if (
            valor &&
            typeof valor.toDate === "function"
        ) {
            return valor.toDate().getTime();
        }

        if (
            typeof valor === "string" ||
            typeof valor === "number"
        ) {
            const resultado = new Date(valor).getTime();
            return Number.isNaN(resultado)
                ? 0
                : resultado;
        }

        return 0;
    };

    try {
        if (tipoUsuarioLogado !== "admin") {
            const usuarioSnap = await banco
                .collection("usuarios")
                .where(
                    "username",
                    "==",
                    usernameLogado
                )
                .get();

            if (!usuarioSnap.empty) {
                minhaUnidade = String(
                    usuarioSnap.docs[0]
                        .data()
                        .unidade || ""
                );
            }
        }

        const chatsSnap = await banco
            .collection("chats")
            .where(
                "usuarios",
                "array-contains",
                usernameLogado
            )
            .get();

        chatsSnap.forEach(documento => {
            const dadosChat = documento.data() || {};
            const usuarios = Array.isArray(
                dadosChat.usuarios
            )
                ? dadosChat.usuarios
                : [];
            const ultimaInteracao = timestampEmMillis(
                dadosChat.ultimoEnvio
            );

            if (dadosChat.tipo === "grupo") {
                gruposChat.push({
                    id: documento.id,
                    nome: String(
                        dadosChat.nomeGrupo ||
                        "Grupo sem nome"
                    ),
                    membros: usuarios.length,
                    fotoGrupoUrl: String(
                        dadosChat.fotoGrupoUrl || ""
                    ),
                    ultimaInteracao
                });

                return;
            }

            const outroUsuario = usuarios.find(
                usuario => String(
                    usuario || ""
                ).trim().toLowerCase() !==
                    usernameLogado
            );

            if (!outroUsuario) {
                return;
            }

            const contato = String(
                outroUsuario
            ).trim().toLowerCase();

            ultimaInteracaoPorContato[contato] =
                Math.max(
                    Number(
                        ultimaInteracaoPorContato[
                            contato
                        ] || 0
                    ),
                    ultimaInteracao
                );
        });

        gruposChat.sort((primeiro, segundo) => {
            return Number(
                segundo.ultimaInteracao || 0
            ) - Number(
                primeiro.ultimaInteracao || 0
            );
        });

        limparListaDepoisDaConsulta();

        if (divGrupos) {
            divGrupos.style.display = "none";
        }


        if (tituloGrupos) {
            tituloGrupos.style.display = "none";
        }


        const gruposIndividuais = {
            suporte: [],
            lideranca: [],
            unidade: [],
            outras: []
        };

        if (usernameLogado !== "admin") {
            gruposIndividuais.suporte.push({
                username: "admin",
                nome: "Central de Suporte",
                cargo: "Administração",
                fotoUrl:
                    "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png",
                ultimaInteracao: Number(
                    ultimaInteracaoPorContato.admin || 0
                 )
            });
        }

        const usuariosSnap = await banco
            .collection("usuarios")
            .get();

        usuariosSnap.forEach(documento => {
            const usuario = documento.data() || {};
            const username = String(
                usuario.username || ""
            ).trim().toLowerCase();

            if (!username || username === usernameLogado) {
                return;
            }

            const contato = {
                username,
                nome: usuario.nomeReal || username,
                cargo: usuario.cargo ||
                    usuario.tipo ||
                    "Membro",
                fotoUrl: usuario.fotoUrl,
                ultimaInteracao: Number(
                    ultimaInteracaoPorContato[
                        username
                    ] || 0
                )
            };

            if (usuario.tipo === "Liderança") {
                gruposIndividuais.lideranca.push(contato);
            } else if (
                minhaUnidade &&
                usuario.unidade &&
                String(usuario.unidade)
                    .trim()
                    .toLowerCase() ===
                    minhaUnidade.trim().toLowerCase()
            ) {
                gruposIndividuais.unidade.push(contato);
            } else {
                gruposIndividuais.outras.push(contato);
            }
        });

        const ordenarContatos = lista => {
            lista.sort((primeiro, segundo) => {
                const diferenca = Number(
                    segundo.ultimaInteracao || 0
                ) - Number(
                    primeiro.ultimaInteracao || 0
                );

                if (diferenca !== 0) {
                    return diferenca;
                }

                return String(
                    primeiro.nome || ""
                ).localeCompare(
                    String(segundo.nome || ""),
                    "pt-BR",
                    {
                        sensitivity: "base"
                    }
                );
            });
        };

        Object.values(gruposIndividuais).forEach(
            ordenarContatos
        );

        const renderizarGrupo = (
            div,
            titulo,
            lista
        ) => {
            if (!div || !titulo) {
                return 0;
            }

            div.innerHTML = lista
                .map(contato => {
                    return criarCardContatoChat(
                        contato.username,
                        contato.nome,
                        contato.cargo,
                        contato.fotoUrl,
                        contato.ultimaInteracao
                    );
                })
                .join("");
            titulo.style.display = lista.length
                ? "block"
                : "none";

            return lista.length;
        };

        const itensUnificados = [
            ...gruposChat.map(grupo => ({
                tipo: "grupo",
                ultimaInteracao: Number(
                    grupo.ultimaInteracao || 0
                ),
                dados: grupo
            })),
            ...Object.values(gruposIndividuais)
                .flat()
                .map(contato => ({
                    tipo: "individual",
                    ultimaInteracao: Number(
                        contato.ultimaInteracao || 0
                    ),
                    dados: contato
                }))
        ];

        itensUnificados.sort((primeiro, segundo) => {
            const diferenca = Number(
                segundo.ultimaInteracao || 0
            ) - Number(
                primeiro.ultimaInteracao || 0
            );

            if (diferenca !== 0) {
                return diferenca;
            }

            const nomePrimeiro = primeiro.tipo === "grupo"
                ? primeiro.dados.nome
                : primeiro.dados.nome;
            const nomeSegundo = segundo.tipo === "grupo"
                ? segundo.dados.nome
                : segundo.dados.nome;

            return String(nomePrimeiro || "").localeCompare(
                String(nomeSegundo || ""),
                "pt-BR",
                {
                    sensitivity: "base"
                }
            );
        });

        const titulosCategorias = [
            "titulo-msg-grupos",
            "titulo-msg-suporte",
            "titulo-msg-lideranca",
            "titulo-msg-unidade"
        ];

        titulosCategorias.forEach(idTitulo => {
            const titulo = document.getElementById(idTitulo);
            if (titulo) {
                titulo.style.display = "none";
            }
        });

        [
            divGrupos,
            divSuporte,
            divLideranca,
            divUnidade
        ].forEach(div => {
            if (div) {
                div.innerHTML = "";
                div.style.display = "none";
            }
        });

        const tituloUnificado = document.getElementById(
            "titulo-msg-outras"
        );

        if (tituloUnificado) {
            tituloUnificado.textContent = "Contatos e grupos";
            tituloUnificado.style.display =
                itensUnificados.length
                    ? "block"
                    : "none";
        }

        if (divOutras) {
            divOutras.innerHTML = itensUnificados
                .map(item => {
                    if (item.tipo === "grupo") {
                        return criarCardGrupoChat(
                            item.dados.id,
                            item.dados.nome,
                            item.dados.membros,
                            item.dados.fotoGrupoUrl,
                            item.ultimaInteracao
                        );
                    }

                    return criarCardContatoChat(
                        item.dados.username,
                        item.dados.nome,
                        item.dados.cargo,
                        item.dados.fotoUrl,
                        item.ultimaInteracao
                    );
                })
                .join("");
        }

        const total = itensUnificados.length;


        if (carregando) {
            carregando.style.display = "none";
        }

        if (!total) {
            if (vazio) {
                vazio.style.display = "block";
            }
            return;
        }

        if (container) {
            container.style.display = "block";
        }

        atualizarMarcadoresContatosChat();

        const pesquisa = document.getElementById(
            "input-pesquisa-contatos-chat"
        );

        if (
            pesquisa &&
            pesquisa.value.trim() &&
            typeof filtrarContatosChat === "function"
        ) {
            filtrarContatosChat(pesquisa.value);
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar contatos e grupos:",
            erro
        );

        if (carregando) {
            carregando.style.display = "none";
        }
        if (vazio) {
            vazio.style.display = "block";
        }
    }
}


function filtrarContatosChat(termo) {
    const pesquisa = String(
        termo || ""
    )
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const container = document.getElementById(
        "msg-contatos-container"
    );
    const vazio = document.getElementById(
        "msg-empty-state"
    );

    if (!container) {
        return;
    }

    const cards = Array.from(
        container.querySelectorAll(
            "[data-chat-username], [data-group-chat-id]"
        )
    );
    let encontrados = 0;

    cards.forEach(card => {
        const username = String(
            card.getAttribute("data-chat-username") || ""
        );
        const grupoId = String(
            card.getAttribute("data-group-chat-id") || ""
        );
        const textoCard = `${username} ${grupoId} ${
            card.textContent || ""
        }`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        const corresponde = !pesquisa ||
            textoCard.includes(pesquisa);

        card.style.display = corresponde
            ? "flex"
            : "none";

        if (corresponde) {
            encontrados += 1;
        }
    });

    const secoes = [
        [
            "titulo-msg-grupos",
            "lista-msg-grupos"
        ],
        [
            "titulo-msg-suporte",
            "lista-msg-suporte"
        ],
        [
            "titulo-msg-lideranca",
            "lista-msg-lideranca"
        ],
        [
            "titulo-msg-unidade",
            "lista-msg-unidade"
        ],
        [
            "titulo-msg-outras",
            "lista-msg-outras"
        ]
    ];

    secoes.forEach(([idTitulo, idLista]) => {
        const titulo = document.getElementById(idTitulo);
        const lista = document.getElementById(idLista);

        if (!titulo || !lista) {
            return;
        }

        const possuiCardVisivel = Array.from(
            lista.querySelectorAll(
                "[data-chat-username], [data-group-chat-id]"
            )
        ).some(card => card.style.display !== "none");

        titulo.style.display = possuiCardVisivel
            ? "block"
            : "none";
    });

    if (vazio) {
        vazio.style.display = encontrados === 0
            ? "block"
            : "none";
    }
}

let _participantesGrupoChatSelecionados = new Set();


function atualizarContadorParticipantesGrupoChat() {
    const contador = document.getElementById(
        "contador-participantes-grupo-chat"
    );

    if (!contador) {
        return;
    }

    contador.textContent =
        `${_participantesGrupoChatSelecionados.size} selecionados`;
}

function fecharModalCriarGrupoChat() {
    const modal = document.getElementById(
        "modal-criar-grupo-chat"
    );

    if (modal) {
        modal.style.display = "none";
    }

    _participantesGrupoChatSelecionados = new Set();
}

async function carregarParticipantesGrupoChat() {
    const lista = document.getElementById(
        "lista-participantes-grupo-chat"
    );
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!lista || !usernameLogado || !banco) {
        return;
    }

    lista.innerHTML = "";

    const adicionarOpcao = (
        username,
        nome,
        cargo,
        bloqueado
    ) => {
        const usernameNormalizado = String(
            username || ""
        ).trim().toLowerCase();

        if (!usernameNormalizado) {
            return;
        }

        const linha = document.createElement("label");
        const checkbox = document.createElement("input");
        const textos = document.createElement("div");
        const nomeEl = document.createElement("strong");
        const cargoEl = document.createElement("span");

        linha.style.display = "flex";
        linha.style.alignItems = "center";
        linha.style.gap = "10px";
        linha.style.padding = "9px 8px";
        linha.style.borderRadius = "8px";
        linha.style.cursor = bloqueado
            ? "default"
            : "pointer";
        linha.style.background = bloqueado
            ? "#252525"
            : "transparent";

        checkbox.type = "checkbox";
        checkbox.name = "participante-grupo-chat";
        checkbox.value = usernameNormalizado;
        checkbox.checked =
            _participantesGrupoChatSelecionados.has(
                usernameNormalizado
            );
        checkbox.disabled = Boolean(bloqueado);
        checkbox.style.width = "17px";
        checkbox.style.height = "17px";
        checkbox.style.accentColor = "#0095f6";

        if (!bloqueado) {
            checkbox.addEventListener(
                "change",
                () => {
                    if (checkbox.checked) {
                        _participantesGrupoChatSelecionados.add(
                            usernameNormalizado
                        );
                    } else {
                        _participantesGrupoChatSelecionados.delete(
                            usernameNormalizado
                        );
                    }
                    atualizarContadorParticipantesGrupoChat();
                }
            );
        }

        textos.style.display = "flex";
        textos.style.flexDirection = "column";
        textos.style.gap = "3px";
        textos.style.minWidth = "0";

        nomeEl.textContent = bloqueado
            ? `${nome} (você)`
            : String(nome || usernameNormalizado);
        nomeEl.style.color = "#fff";
        nomeEl.style.fontSize = "13px";
        nomeEl.style.fontWeight = "600";

        cargoEl.textContent = String(
            cargo || "Membro"
        );
        cargoEl.style.color = "#8e8e8e";
        cargoEl.style.fontSize = "11px";

        textos.appendChild(nomeEl);
        textos.appendChild(cargoEl);
        linha.appendChild(checkbox);
        linha.appendChild(textos);
        lista.appendChild(linha);
    };

    adicionarOpcao(
        usernameLogado,
        usernameLogado,
        "Participante obrigatório",
        true
    );

    try {
        const snapshot = await banco
            .collection("usuarios")
            .get();
        const usuarios = [];

        snapshot.forEach(documento => {
            const dados = documento.data() || {};
            const username = String(
                dados.username || ""
            ).trim().toLowerCase();

            if (!username || username === usernameLogado) {
                return;
            }

            usuarios.push({
                username,
                nome: dados.nomeReal || username,
                cargo: dados.cargo || dados.tipo || "Membro"
            });
        });

        usuarios.sort((primeiro, segundo) => {
            return String(primeiro.nome).localeCompare(
                String(segundo.nome),
                "pt-BR",
                {
                    sensitivity: "base"
                }
            );
        });

        usuarios.forEach(usuario => {
            adicionarOpcao(
                usuario.username,
                usuario.nome,
                usuario.cargo,
                false
            );
        });

        atualizarContadorParticipantesGrupoChat();
    } catch (erro) {
        console.error(
            "Erro ao carregar participantes do grupo:",
            erro
        );
        lista.innerHTML = "";
        const erroEl = document.createElement("div");
        erroEl.textContent =
            "Não foi possível carregar os usuários. Tente novamente.";
        erroEl.style.padding = "18px 8px";
        erroEl.style.color = "#ff6b6b";
        erroEl.style.fontSize = "13px";
        erroEl.style.textAlign = "center";
        lista.appendChild(erroEl);
    }
}

function abrirModalCriarGrupoChat() {
    const modal = document.getElementById(
        "modal-criar-grupo-chat"
    );
    const nome = document.getElementById(
        "input-nome-grupo-chat"
    );
    const lista = document.getElementById(
        "lista-participantes-grupo-chat"
    );

    if (!modal || !nome || !lista) {
        return;
    }

    _participantesGrupoChatSelecionados = new Set([
        String(
            localStorage.getItem("usernameLogado") || ""
        ).trim().toLowerCase()
    ]);
    nome.value = "";
    modal.style.display = "flex";
    carregarParticipantesGrupoChat();
    nome.focus();
    atualizarContadorParticipantesGrupoChat();
}

function mostrarPreviaImagemGrupoChat(input) {
    const imagem = document.getElementById(
        "previa-foto-grupo-chat"
    );
    const arquivo = input &&
        input.files &&
        input.files[0];

    if (!imagem || !arquivo) {
        if (imagem) {
            imagem.removeAttribute("src");
            imagem.style.display = "none";
        }
        return;
    }

    if (!arquivo.type.startsWith("image/")) {
        input.value = "";
        imagem.removeAttribute("src");
        imagem.style.display = "none";
        window.alert("Selecione um arquivo de imagem válido.");
        return;
    }

    const leitor = new FileReader();

    leitor.onload = evento => {
        imagem.src = String(
            evento.target &&
            evento.target.result ||
            ""
        );
        imagem.style.display = imagem.src
            ? "block"
            : "none";
    };

    leitor.readAsDataURL(arquivo);
}

async function criarGrupoChat() {
    const nomeEl = document.getElementById(
        "input-nome-grupo-chat"
    );
    const fotoInput = document.getElementById(
        "input-foto-grupo-chat"
    );
    const botao = document.getElementById(
        "btn-confirmar-criacao-grupo-chat"
    );
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const nomeGrupo = nomeEl
        ? String(nomeEl.value || "").trim()
        : "";
    const participantes = Array.from(
        _participantesGrupoChatSelecionados
    )
        .map(usuario => String(usuario || "").trim().toLowerCase())
        .filter(Boolean);
    const arquivoFoto = fotoInput &&
        fotoInput.files &&
        fotoInput.files[0];

    if (!nomeGrupo) {
        window.alert("Informe um nome para o grupo.");
        return;
    }

    if (nomeGrupo.length < 2) {
        window.alert(
            "O nome do grupo precisa ter pelo menos 2 caracteres."
        );
        return;
    }

    if (!usernameLogado || !participantes.includes(usernameLogado)) {
        window.alert(
            "A conta atual precisa participar do grupo."
        );
        return;
    }

    if (participantes.length < 2) {
        window.alert(
            "Selecione pelo menos mais uma pessoa para criar o grupo."
        );
        return;
    }

    if (!banco) {
        window.alert(
            "O banco de dados ainda não está disponível."
        );
        return;
    }

    if (botao) {
        botao.disabled = true;
        botao.textContent = "Criando...";
        botao.style.opacity = "0.65";
    }

    try {
        let fotoGrupoUrl = "";

        if (arquivoFoto) {
            if (!arquivoFoto.type.startsWith("image/")) {
                throw new Error(
                    "Selecione um arquivo de imagem válido."
                );
            }

            fotoGrupoUrl = await subirImagemParaNuvem(
                arquivoFoto
            );

            if (!fotoGrupoUrl) {
                throw new Error(
                    "Não foi possível enviar a foto do grupo."
                );
            }
        }

        const referencia = banco
            .collection("chats")
            .doc();
        const naoLidasPor = {};

        participantes.forEach(usuario => {
            naoLidasPor[usuario] = 0;
        });

        await referencia.set({
            tipo: "grupo",
            nomeGrupo,
            fotoGrupoUrl,
            usuarios: participantes,
            administradores: [usernameLogado],
            criadoPor: usernameLogado,
            criadoEm:
                firebase.firestore.FieldValue.serverTimestamp(),
            ultimoEnvio:
                firebase.firestore.FieldValue.serverTimestamp(),
            naoLidasPor
        });

        fecharModalCriarGrupoChat();
        await carregarListaDeContatosChat();
        window.alert("Grupo criado com sucesso.");
    } catch (erro) {
        const codigo = String(
            erro && erro.code ||
            "sem-codigo"
        );
        const mensagem = String(
            erro && erro.message ||
            erro ||
            "Falha desconhecida."
        );

        console.error(
            "Erro ao criar grupo de chat:",
            {
                codigo,
                mensagem,
                usernameLogado,
                participantes
            }
        );

        window.alert(
            `Não foi possível criar o grupo.\n\n` +
            `Código: ${codigo}\n` +
            `Detalhes: ${mensagem}`
        );
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = "Criar grupo";
            botao.style.opacity = "1";
        }
    }
}




function criarCardGrupoChat(
    chatId,
    nomeGrupo,
    quantidadeParticipantes,
    fotoGrupoUrl,
    ultimaInteracao
) {
    const id = String(chatId || "");
    const nome = String(
        nomeGrupo || "Grupo sem nome"
    );
    const quantidade = Number(
        quantidadeParticipantes || 0
    );
    const imagem = String(
        fotoGrupoUrl ||
        window.AVATAR_USUARIO_PADRAO ||
        ""
    );

    return `
        <div
            data-group-chat-id="${id}"
            data-tipo-chat="grupo"
            data-ultima-interacao="${Number(ultimaInteracao || 0)}"
            onclick="abrirSalaGrupoChat('${id}', '${nome.replace(/'/g, "\\'")}')"
            style="display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; transition: background-color 0.2s ease;"
        >
            <img src="${imagem}" alt="Foto do grupo" style="width: 50px; height: 50px; flex-shrink: 0; border-radius: 50%; object-fit: cover; border: 1px solid #262626;">
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 15px; font-weight: 600;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nome}</span>
                </div>
                <div style="color: #8e8e8e; font-size: 13px;">${quantidade} participantes</div>
            </div>
            <div style="color: #8e8e8e; font-size: 20px; padding-right: 5px;">&gt;</div>
        </div>
    `;
}


function criarCardContatoChat(
    username,
    nome,
    cargo,
    fotoUrl,
    ultimaInteracao
) {
    const usernameNormalizado = String(
        username || ""
    ).trim().toLowerCase();
    const avatarPadrao = String(
        window.AVATAR_USUARIO_PADRAO ||
        ""
    );
    let img = String(
        fotoUrl ||
        avatarPadrao
    );

    if (
        usernameNormalizado === "admin" &&
        !fotoUrl
    ) {
        const fotoAdminJaCarregada = String(
            window._fotoCentralSuporteChat ||
            ""
        ).trim();

        if (fotoAdminJaCarregada) {
            img = fotoAdminJaCarregada;
        } else {
            const banco = window.ClubeDB &&
                window.ClubeDB.textoDB;

            if (
                banco &&
                !window._fotoCentralSuporteChatPromise
            ) {
                window._fotoCentralSuporteChatPromise = banco
                    .collection("usuarios")
                    .where(
                        "username",
                        "==",
                        "admin"
                    )
                    .limit(1)
                    .get()
                    .then(snapshot => {
                        let fotoEncontrada = "";

                        if (!snapshot.empty) {
                            const dados = snapshot
                                .docs[0]
                                .data() || {};
                            fotoEncontrada = String(
                                dados.fotoUrl ||
                                dados.foto ||
                                ""
                            ).trim();
                        }

                        window._fotoCentralSuporteChat =
                            fotoEncontrada ||
                            avatarPadrao;

                        document
                            .querySelectorAll(
                                '[data-chat-username="admin"] img'
                            )
                            .forEach(imagem => {
                                imagem.src =
                                    window._fotoCentralSuporteChat;
                            });

                        return window._fotoCentralSuporteChat;
                    })
                    .catch(erro => {
                        console.error(
                            "Erro ao carregar a foto da Central de Suporte:",
                            erro
                        );
                        window._fotoCentralSuporteChat =
                            avatarPadrao;
                        return avatarPadrao;
                    });
            }
        }
    }

    return `
        <div data-chat-username="${username}" data-tipo-chat="individual" data-ultima-interacao="${Number(ultimaInteracao || 0)}" onclick="abrirSalaChat('${username}', '${nome}', '${cargo}', '${img}' )" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; transition: background-color 0.2s ease;">
            <img src="${img}" alt="Foto de ${nome}" onerror="this.onerror=null; this.src='${avatarPadrao}';" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 1px solid #262626;">
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 15px; font-weight: 600;">
                    <span>${nome}</span>
                    <span data-unread-badge style="display: none; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 10px; background: #ff3040; color: #fff; font-size: 10px; font-weight: 700; line-height: 18px;"></span>
                </div>
                <div style="color: #8e8e8e; font-size: 13px;">${cargo}</div>
            </div>
            <div style="color: #8e8e8e; font-size: 20px; padding-right: 5px;">&gt;</div>
        </div>
    `;
}



// Cria um Hash único para as mensagens independentemente de quem enviou primeiro (Garante o P2P da mesma sala)

// Localiza o card do contato para abrir a conversa correta.
function encontrarCardChatPorNotificacao(remetente, chatId) {
    const remetenteNormalizado = String(
        remetente || ""
    ).trim().toLowerCase();
    const chatIdNormalizado = String(chatId || "");
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    return Array.from(
        document.querySelectorAll("[data-chat-username]")
    ).find(card => {
        const usernameContato = String(
            card.getAttribute("data-chat-username") || ""
        ).trim().toLowerCase();

        if (
            remetenteNormalizado &&
            usernameContato === remetenteNormalizado
        ) {
            return true;
        }

        return Boolean(
            chatIdNormalizado &&
            usernameLogado &&
            gerarIdChat(usernameLogado, usernameContato) ===
                chatIdNormalizado
        );
    }) || null;
}

function abrirChatPorNotificacao(dados) {
    const remetente = String(
        dados && dados.remetente || ""
    ).trim().toLowerCase();
    const chatId = String(
        dados && dados.chatId || ""
    ).trim();

    if (!remetente && !chatId) {
        return;
    }

    window._chatNotificacaoPendente = {
        remetente,
        chatId
    };

    mudarSubAbaSite("mensagens");

    let tentativas = 0;
    const tentarAbrir = () => {
        const pendente = window._chatNotificacaoPendente;

        if (!pendente) {
            return;
        }

        const card = encontrarCardChatPorNotificacao(
            pendente.remetente,
            pendente.chatId
        );

        if (card) {
            window._chatNotificacaoPendente = null;
            card.click();
            return;
        }

        tentativas += 1;

        if (tentativas < 24) {
            window.setTimeout(tentarAbrir, 250);
        } else {
            window._chatNotificacaoPendente = null;
        }
    };

    window.setTimeout(tentarAbrir, 0);
}

function processarAberturaChatPorNotificacao() {
    if (typeof window === "undefined") {
        return;
    }

    const parametros = new URLSearchParams(
        window.location.search
    );
    const remetente = parametros.get("openChatUser") || "";
    const chatId = parametros.get("openChatId") || "";

    if (!remetente && !chatId) {
        return;
    }

    if (
        window.history &&
        typeof window.history.replaceState === "function"
    ) {
        const urlLimpa =
            `${window.location.pathname}${window.location.hash}`;
        window.history.replaceState(
            {},
            document.title,
            urlLimpa
        );
    }

    abrirChatPorNotificacao({
        remetente,
        chatId
    });
}

if (typeof window !== "undefined") {
    window.addEventListener("message", evento => {
        const dados = evento && evento.data;

        if (
            !dados ||
            dados.type !== "OPEN_CHAT_NOTIFICATION"
        ) {
            return;
        }

        abrirChatPorNotificacao(dados);
    });
}

// Cria um Hash único para as mensagens independentemente de quem enviou primeiro (Garante o P2P da mesma sala)
function gerarIdChat(user1, user2) {
    return [user1, user2].sort().join("_");
}


window._mensagensSelecionadasChat =
    window._mensagensSelecionadasChat instanceof Map
        ? window._mensagensSelecionadasChat
        : new Map();
window._modoSelecaoMensagens = false;

function atualizarVisualSelecaoMensagem(elemento, mensagemId) {
    if (!elemento) {
        return;
    }

    const selecionada = window
        ._mensagensSelecionadasChat
        .has(String(mensagemId || ""));

    elemento.style.outline = selecionada
        ? "2px solid #58b7ff"
        : "none";
    elemento.style.outlineOffset = selecionada
        ? "3px"
        : "0";
    elemento.style.filter = selecionada
        ? "brightness(1.18)"
        : "none";
    elemento.style.borderRadius = "10px";
}

function alternarSelecaoMensagem(
    elemento,
    mensagemId,
    dadosMensagem
) {
    const id = String(mensagemId || "");

    if (!id || !elemento) {
        return;
    }

    if (window._mensagensSelecionadasChat.has(id)) {
        window._mensagensSelecionadasChat.delete(id);
    } else {
        window._mensagensSelecionadasChat.set(id, {
            id,
            remetente: String(
                dadosMensagem &&
                dadosMensagem.remetente ||
                ""
            ).trim().toLowerCase(),
            texto: String(
                dadosMensagem &&
                dadosMensagem.texto ||
                ""
            )
        });
    }

    window._modoSelecaoMensagens =
        window._mensagensSelecionadasChat.size > 0;
    atualizarVisualSelecaoMensagem(elemento, id);
    renderizarBarraSelecaoMensagens();

    document.dispatchEvent(

        new CustomEvent("mensagens-selecao-atualizada", {
            detail: {
                quantidade: window
                    ._mensagensSelecionadasChat
                    .size
            }
        })
    );
}

function fecharMenuContextualMensagemChat() {
    const menu = document.getElementById(
        "menu-contextual-mensagem-chat"
    );

    if (menu) {
        menu.remove();
    }
}

function abrirMenuContextualMensagemChat(
    elemento,
    mensagemId,
    dadosMensagem,
    evento
) {
    fecharMenuContextualMensagemChat();

    const menu = document.createElement("div");
    const selecionar = document.createElement("button");
    const responder = document.createElement("button");
    const apagar = document.createElement("button");
    const cancelar = document.createElement("button");
    const x = Number(evento && evento.clientX || 0);
    const y = Number(evento && evento.clientY || 0);

    menu.id = "menu-contextual-mensagem-chat";
    menu.style.position = "fixed";
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 178))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 190))}px`;
    menu.style.zIndex = "2147483647";
    menu.style.display = "flex";
    menu.style.flexDirection = "column";
    menu.style.gap = "4px";
    menu.style.minWidth = "170px";
    menu.style.padding = "7px";
    menu.style.border = "1px solid #3a3a3a";
    menu.style.borderRadius = "10px";
    menu.style.background = "#1c1c1c";
    menu.style.boxShadow = "0 10px 28px rgba(0,0,0,.45)";

    const configurarBotao = (
        botao,
        texto,
        cor,
        acao
    ) => {
        botao.type = "button";
        botao.textContent = texto;
        botao.style.width = "100%";
        botao.style.padding = "8px 10px";
        botao.style.border = "1px solid #3a3a3a";
        botao.style.borderRadius = "7px";
        botao.style.background = "transparent";
        botao.style.color = cor;
        botao.style.textAlign = "left";
        botao.style.fontSize = "12px";
        botao.style.cursor = "pointer";
        botao.addEventListener("click", eventoBotao => {
            eventoBotao.stopPropagation();
            acao();
            fecharMenuContextualMensagemChat();
        });
        menu.appendChild(botao);
    };

    configurarBotao(
        selecionar,
        "Selecionar",
        "#d7d9db",
        () => {
            alternarSelecaoMensagem(
                elemento,
                mensagemId,
                dadosMensagem
            );
        }
    );
    configurarBotao(
        responder,
        "Responder",
        "#58b7ff",
        () => {
            cancelarSelecaoMensagensChat();

            window.setTimeout(() => {
                prepararRespostaMensagemChat(
                    mensagemId,
                    dadosMensagem
                );
            }, 0);
        }
    );
    configurarBotao(
        apagar,
        "Apagar",
        "#ff6b6b",
        () => {
            window._mensagensSelecionadasChat.clear();
            window._mensagensSelecionadasChat.set(
                String(mensagemId),
                {
                    id: String(mensagemId),
                    remetente: String(
                        dadosMensagem &&
                        dadosMensagem.remetente ||
                        ""
                    ).trim().toLowerCase(),
                    texto: String(
                        dadosMensagem &&
                        dadosMensagem.texto ||
                        ""
                    )
                }
            );
            window._modoSelecaoMensagens = true;
            apagarMensagensSelecionadasChat();
        }
    );
    configurarBotao(
        cancelar,
        "Cancelar",
        "#d7d9db",
        () => {
            cancelarSelecaoMensagensChat();
        }
    );

    menu.addEventListener(
        "click",
        eventoMenu => eventoMenu.stopPropagation()
    );
    document.body.appendChild(menu);

    window.setTimeout(() => {
        document.addEventListener(
            "click",
            fecharMenuContextualMensagemChat,
            {
                once: true
            }
        );
    }, 0);
}

function configurarPressaoProlongadaMensagem(
    elemento,
    mensagemId,
    dadosMensagem
) {
    if (!elemento || !mensagemId) {
        return;
    }

    const id = String(mensagemId);
    let timerPressao = null;
    let cliqueSuprimido = false;
    let inicioX = 0;
    let inicioY = 0;
    let arrastoResposta = false;

    const iniciarPressao = evento => {
        if (
            evento.type === "mousedown" &&
            evento.button !== 0
        ) {
            return;
        }

        const toque = evento.touches &&
            evento.touches[0];
        inicioX = toque
            ? toque.clientX
            : Number(evento.clientX || 0);
        inicioY = toque
            ? toque.clientY
            : Number(evento.clientY || 0);
        arrastoResposta = false;
        window.clearTimeout(timerPressao);
        cliqueSuprimido = false;
        timerPressao = window.setTimeout(() => {
            cliqueSuprimido = true;
            alternarSelecaoMensagem(
                elemento,
                id,
                dadosMensagem
            );
        }, 600);
    };

    const moverToque = evento => {
        const toque = evento.touches &&
            evento.touches[0];

        if (!toque) {
            return;
        }

        const deslocamentoX = toque.clientX - inicioX;
        const deslocamentoY = Math.abs(
            toque.clientY - inicioY
        );

        if (
            deslocamentoX > 12 &&
            deslocamentoY < 45
        ) {
            window.clearTimeout(timerPressao);
            arrastoResposta = deslocamentoX > 70;
            elemento.style.transform =
                `translateX(${Math.min(deslocamentoX, 86)}px)`;
            elemento.style.transition =
                "transform .12s ease";
        }
    };

    const finalizarToque = evento => {
        window.clearTimeout(timerPressao);

        if (arrastoResposta) {
            if (
                evento &&
                evento.cancelable
            ) {
                evento.preventDefault();
            }

            elemento.style.transform = "translateX(0)";
            prepararRespostaMensagemChat(
                id,
                dadosMensagem
            );
            cliqueSuprimido = true;
        } else {
            elemento.style.transform = "translateX(0)";
        }

        window.setTimeout(() => {
            elemento.style.transform = "translateX(0)";
        }, 140);
    };

    const finalizarPressao = () => {
        window.clearTimeout(timerPressao);
    };

    elemento.addEventListener(
        "touchstart",
        iniciarPressao,
        { passive: true }
    );
    elemento.addEventListener(
        "touchmove",
        moverToque,
        { passive: true }
    );
    elemento.addEventListener(
        "touchend",
        finalizarToque,
        { passive: false }
    );
    elemento.addEventListener(
        "touchcancel",
        finalizarPressao,
        { passive: true }
    );
    elemento.addEventListener(
        "mousedown",
        iniciarPressao
    );
    elemento.addEventListener(
        "mouseup",
        finalizarPressao
    );
    elemento.addEventListener(
        "mouseleave",
        finalizarPressao
    );
    elemento.addEventListener(
        "dblclick",
        eventoDuploClique => {
            eventoDuploClique.preventDefault();
            eventoDuploClique.stopPropagation();
            prepararRespostaMensagemChat(
                id,
                dadosMensagem
            );
        }
    );
    elemento.addEventListener(
        "contextmenu",
        eventoContexto => {
            eventoContexto.preventDefault();
            eventoContexto.stopPropagation();
            abrirMenuContextualMensagemChat(
                elemento,
                id,
                dadosMensagem,
                eventoContexto
            );
        }
    );
    elemento.addEventListener(
        "click",
        eventoClique => {
            if (cliqueSuprimido) {
                eventoClique.preventDefault();
                eventoClique.stopPropagation();
                cliqueSuprimido = false;
                return;
            }

            if (window._modoSelecaoMensagens) {
                eventoClique.preventDefault();
                eventoClique.stopPropagation();
                alternarSelecaoMensagem(
                    elemento,
                    id,
                    dadosMensagem
                );
                return;
            }

            if (
                window.matchMedia &&
                window.matchMedia("(min-width: 769px)").matches &&
                eventoClique.detail === 1
            ) {
                eventoClique.preventDefault();
                eventoClique.stopPropagation();
                abrirMenuContextualMensagemChat(
                    elemento,
                    id,
                    dadosMensagem,
                    eventoClique
                );
            }
        }
    );

    elemento.setAttribute(
        "data-mensagem-id",
        id
    );
    atualizarVisualSelecaoMensagem(elemento, id);
}


async function apagarMensagensSelecionadasChat() {
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const meuUsername = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const chatId = String(
        window._chatIdAtivo || ""
    ).trim();
    const selecionadas = window
        ._mensagensSelecionadasChat instanceof Map
        ? Array.from(
            window._mensagensSelecionadasChat.values()
        )
        : [];
    const ehAdministradorPrincipal =
        localStorage.getItem("usuarioLogado") === "admin";

    if (
        !banco ||
        !meuUsername ||
        !chatId ||
        !selecionadas.length
    ) {
        return;
    }

    const existemMensagensDeOutraPessoa =
        selecionadas.some(mensagem => {
            return !ehAdministradorPrincipal &&
                String(
                    mensagem.remetente || ""
                ).trim().toLowerCase() !== meuUsername;
        });

    if (existemMensagensDeOutraPessoa) {
        window.alert(
            "Você só pode apagar mensagens enviadas pela sua própria conta."
        );
        return;
    }

    const confirmou = window.confirm(
        selecionadas.length === 1
            ? "Apagar a mensagem selecionada?"
            : `Apagar as ${selecionadas.length} mensagens selecionadas?`
    );

    if (!confirmou) {
        return;
    }

    const mensagensRef = banco
        .collection("chats")
        .doc(chatId)
        .collection("mensagens");
    const lote = banco.batch();

    selecionadas.forEach(mensagem => {
        lote.delete(
            mensagensRef.doc(String(mensagem.id))
        );
    });

    const botao = document.getElementById(
        "btn-apagar-mensagens-selecionadas"
    );

    if (botao) {
        botao.disabled = true;
        botao.textContent = "Apagando...";
        botao.style.opacity = "0.6";
    }

    try {
        await lote.commit();
        cancelarSelecaoMensagensChat();
    } catch (erro) {
        console.error(
            "Erro ao apagar mensagens selecionadas:",
            erro
        );
        window.alert(
            `Não foi possível apagar as mensagens.\n\n` +
            `Código: ${String(erro && erro.code || "sem-codigo")}\n` +
            `Detalhes: ${String(erro && erro.message || erro)}`
        );

        if (botao) {
            botao.disabled = false;
            botao.textContent = "Apagar";
            botao.style.opacity = "1";
        }
    }
}

function cancelarSelecaoMensagensChat() {
    if (
        !(window._mensagensSelecionadasChat instanceof Map)
    ) {
        window._mensagensSelecionadasChat = new Map();
    }

    window._mensagensSelecionadasChat.clear();
    window._modoSelecaoMensagens = false;

    document.querySelectorAll(
        "[data-mensagem-id]"
    ).forEach(elemento => {
        atualizarVisualSelecaoMensagem(
            elemento,
            elemento.getAttribute("data-mensagem-id")
        );
    });

    const barra = document.getElementById(
        "barra-selecao-mensagens"
    );

    if (barra) {
        barra.remove();
    }
}

function renderizarBarraSelecaoMensagens() {
    const telaChat = document.getElementById(
        "tela-sala-chat"
    );
    const quantidade = window
        ._mensagensSelecionadasChat instanceof Map
        ? window._mensagensSelecionadasChat.size
        : 0;
    let barra = document.getElementById(
        "barra-selecao-mensagens"
    );

    if (!telaChat) {
        return;
    }

    if (!quantidade) {
        if (barra) {
            barra.remove();
        }
        return;
    }

    if (!barra) {
        barra = document.createElement("div");
        barra.id = "barra-selecao-mensagens";
        barra.style.position = "absolute";
        barra.style.top = "8px";
        barra.style.left = "50%";
        barra.style.zIndex = "100002";
        barra.style.display = "flex";
        barra.style.alignItems = "center";
        barra.style.justifyContent = "center";
        barra.style.gap = "8px";
        barra.style.width = "min(calc(100% - 32px), 430px)";
        barra.style.minHeight = "42px";
        barra.style.padding = "6px 8px";
        barra.style.boxSizing = "border-box";
        barra.style.transform = "translateX(-50%)";
        barra.style.border = "1px solid #3a3a3a";
        barra.style.borderRadius = "12px";
        barra.style.background = "rgba(38, 38, 38, .97)";
        barra.style.boxShadow = "0 8px 24px rgba(0,0,0,.35)";

        const titulo = document.createElement("span");
        titulo.id = "contador-selecao-mensagens";
        titulo.style.flex = "1";
        titulo.style.color = "#fff";
        titulo.style.fontSize = "12px";
        titulo.style.fontWeight = "700";

        const apagar = document.createElement("button");
        apagar.type = "button";
        apagar.id = "btn-apagar-mensagens-selecionadas";
        apagar.textContent = "Apagar";
        apagar.title = "Apagar mensagens selecionadas";
        apagar.style.border = "1px solid #ff4d4d";
        apagar.style.borderRadius = "8px";
        apagar.style.background = "transparent";
        apagar.style.color = "#ff6b6b";
        apagar.style.padding = "7px 9px";
        apagar.style.fontSize = "11px";
        apagar.style.fontWeight = "700";
        apagar.style.cursor = "pointer";
        apagar.addEventListener(
            "click",
            () => {
                if (
                    typeof apagarMensagensSelecionadasChat ===
                    "function"
                ) {
                    apagarMensagensSelecionadasChat();
                }
            }
        );

        const responder = document.createElement("button");
        responder.type = "button";
        responder.id = "btn-responder-mensagem-selecionada";
        responder.textContent = "Responder";
        responder.title = "Responder à mensagem selecionada";
        responder.style.border = "1px solid #58b7ff";
        responder.style.borderRadius = "8px";
        responder.style.background = "transparent";
        responder.style.color = "#58b7ff";
        responder.style.padding = "7px 9px";
        responder.style.fontSize = "11px";
        responder.style.fontWeight = "700";
        responder.style.cursor = "pointer";
        responder.addEventListener(
            "click",
            () => {
                const selecionadas = window
                    ._mensagensSelecionadasChat instanceof Map
                    ? Array.from(
                        window._mensagensSelecionadasChat.values()
                    )
                    : [];

                if (selecionadas.length !== 1) {
                    window.alert(
                        "Selecione exatamente uma mensagem para responder."
                    );
                    return;
                }

                const mensagemParaResponder =
                    selecionadas[0];

                cancelarSelecaoMensagensChat();

                window.setTimeout(() => {
                    prepararRespostaMensagemChat(
                        mensagemParaResponder.id,
                        mensagemParaResponder
                    );
                }, 0);
            }
        );

        const cancelar = document.createElement("button");
        cancelar.type = "button";
        cancelar.textContent = "Cancelar";
        cancelar.title = "Cancelar seleção";
        cancelar.style.border = "1px solid #666";
        cancelar.style.borderRadius = "8px";
        cancelar.style.background = "transparent";
        cancelar.style.color = "#d7d9db";
        cancelar.style.padding = "7px 9px";
        cancelar.style.fontSize = "11px";
        cancelar.style.cursor = "pointer";
        cancelar.addEventListener(
            "click",
            cancelarSelecaoMensagensChat
        );

        barra.appendChild(titulo);
        barra.appendChild(apagar);
        barra.appendChild(responder);
        barra.appendChild(cancelar);
        telaChat.appendChild(barra);
    }

    const contador = document.getElementById(
        "contador-selecao-mensagens"
    );

    if (contador) {
        contador.textContent = quantidade === 1
            ? "1 mensagem selecionada"
            : `${quantidade} mensagens selecionadas`;
    }

    const responder = document.getElementById(
        "btn-responder-mensagem-selecionada"
    );

    if (responder) {
        responder.disabled = quantidade !== 1;
        responder.style.opacity = quantidade === 1
            ? "1"
            : "0.45";
        responder.style.cursor = quantidade === 1
            ? "pointer"
            : "not-allowed";
    }
}


function abrirSalaChat(usernameAlvo, nomeAlvo, cargoAlvo, fotoAlvo) {
    const usernameAlvoNormalizado = String(
        usernameAlvo || ""
    ).trim().toLowerCase();

    usuarioChatDestino = usernameAlvoNormalizado;

    if (typeof limparRespostaMensagemChat === "function") {
        limparRespostaMensagemChat();
    }

    const telaLista = document.getElementById("tela-lista-mensagens");
    const telaChat = document.getElementById("tela-sala-chat");
    const container = document.getElementById("chat-mensagens-container");
    const inputMsg = document.getElementById("input-nova-mensagem");
    const cabecalhoChat = document.getElementById("cabecalho-sala-chat");

    if (typeof desativarMenuAcoesGrupoChat === "function") {
        desativarMenuAcoesGrupoChat();
    }

    if (!telaChat || !inputMsg) return;


    const nomeEl = document.getElementById("chat-nome-atual");
    const cargoEl = document.getElementById("chat-cargo-atual");
    const avatarEl = document.getElementById("chat-avatar-atual");

    if (nomeEl) nomeEl.textContent = nomeAlvo || "Usuário";
    if (cargoEl) cargoEl.textContent = cargoAlvo || "";
    if (avatarEl) {
        avatarEl.src = (
            typeof normalizarUrlPublicacao === "function"
                ? normalizarUrlPublicacao(fotoAlvo)
                : fotoAlvo
        ) || window.AVATAR_USUARIO_PADRAO;
        avatarEl.onerror = () => {
            avatarEl.src = window.AVATAR_USUARIO_PADRAO;
        };
    }

    const scrollPos =
        window.pageYOffset || document.documentElement.scrollTop;

    telaChat._backupBody = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        height: document.body.style.height,
        width: document.body.style.width,
        backgroundColor: document.body.style.backgroundColor
    };

    if (telaLista) telaLista.style.display = "none";

    const siteHeader =
        document.querySelector(".site-header") ||
        document.querySelector("header");

    if (siteHeader) siteHeader.style.visibility = "hidden";

    document.body.style.backgroundColor = "#000";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollPos}px`;
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    telaChat._scrollPos = scrollPos;

    telaChat.style.display = "flex";
    telaChat.style.flexDirection = "column";
    telaChat.style.position = "fixed";
    telaChat.style.top = "0";
    telaChat.style.left = "0";
    telaChat.style.width = "100%";
    telaChat.style.height = "100%";
    telaChat.style.boxSizing = "border-box";
    telaChat.style.paddingLeft = "0";
    telaChat.style.paddingRight = "0";

    if (window.matchMedia("(min-width: 769px)").matches) {
        telaChat.style.paddingLeft = "12vw";
        telaChat.style.paddingRight = "12vw";
    }

    telaChat.style.zIndex = "2147483647";
    telaChat.style.backgroundColor = "#000";
    telaChat.style.overflow = "hidden";
    telaChat.style.transform = "none";

    if (cabecalhoChat) {
        cabecalhoChat.style.position = "relative";
        cabecalhoChat.style.top = "0";
        cabecalhoChat.style.flexShrink = "0";
        cabecalhoChat.style.zIndex = "100000";
        cabecalhoChat.style.pointerEvents = "auto";
    }

    if (container) {
        container.style.flex = "1";
        container.style.overflowY = "auto";
        container.style.webkitOverflowScrolling = "touch";
    }

    const syncViewport = () => {
        const vv = window.visualViewport;

        if (vv && telaChat.style.display !== "none") {
            window.scrollTo(0, 0);
            telaChat.style.top = `${vv.offsetTop}px`;
            telaChat.style.height = `${vv.height}px`;

            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", syncViewport);
        window.visualViewport.addEventListener("scroll", syncViewport);
        telaChat._vvSync = syncViewport;
    }

    syncViewport();

    if (!document.getElementById("style-borda-header-chat")) {
        const styleEl = document.createElement("style");
        styleEl.id = "style-borda-header-chat";
        styleEl.innerHTML = `
            @keyframes bordaRespiracaoVerde {
                0%, 100% {
                    border-color: #00ff66;
                    box-shadow: 0 0 8px #00ff66, inset 0 0 8px #00ff66;
                }
                50% {
                    border-color: #00ff66;
                    box-shadow: 0 0 22px #00ff66, inset 0 0 14px #00ff66;
                }
            }
        `;
        document.head.appendChild(styleEl);
    }

    let timerCorBordaHeader = null;

    const aplicarBordaVerdeHeader = () => {
        if (!cabecalhoChat) return;
        cabecalhoChat.style.boxSizing = "border-box";
        cabecalhoChat.style.border = "2px solid #00ff66";
        cabecalhoChat.style.animation =
            "bordaRespiracaoVerde 1.8s infinite ease-in-out";
    };

    const removerBordaHeader = () => {
        if (!cabecalhoChat) return;
        if (timerCorBordaHeader) clearTimeout(timerCorBordaHeader);
        cabecalhoChat.style.border = "none";
        cabecalhoChat.style.boxShadow = "none";
        cabecalhoChat.style.animation = "none";
    };

    const piscarBordaHeader = cor => {
        if (!cabecalhoChat) return;
        if (timerCorBordaHeader) clearTimeout(timerCorBordaHeader);
        cabecalhoChat.style.animation = "none";
        cabecalhoChat.style.borderColor = cor;
        cabecalhoChat.style.boxShadow =
            `0 0 22px ${cor}, inset 0 0 14px ${cor}`;
        timerCorBordaHeader = setTimeout(() => {
            aplicarBordaVerdeHeader();
        }, 220);
    };

    inputMsg.onfocus = () => {
        syncViewport();
        setTimeout(syncViewport, 100);
        aplicarBordaVerdeHeader();
    };

    inputMsg.onblur = () => {
        removerBordaHeader();
    };

    inputMsg.onkeydown = event => {
        if (event.key === "Backspace" || event.key === "Delete") {
            piscarBordaHeader("#ff0044");
        } else if (
            event.key !== "Shift" &&
            event.key !== "Control" &&
            event.key !== "Alt" &&
            event.key !== "Meta" &&
            event.key !== "CapsLock"
        ) {
            piscarBordaHeader("#0088ff");
        }
    };

    if (unsubscribeChatAtivo) {
        unsubscribeChatAtivo();
    }

    if (container) {
        container.innerHTML =
            "<p style='color:#8e8e8e; text-align:center; margin-top:20px; font-size:12px;'>Conectando...</p>";
    }

    const meuUsername = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    const chatId = gerarIdChat(
        meuUsername,
        usernameAlvoNormalizado
    );

    window._chatIdAtivo = chatId;
    sincronizarEstadoChatComServiceWorker();
    marcarMensagensComoLidas(chatId, meuUsername);

    unsubscribeChatAtivo = window.ClubeDB.textoDB
        .collection("chats")
        .doc(chatId)
        .collection("mensagens")
        .orderBy("timestamp", "asc")
        .onSnapshot(snapshot => {
            if (!container) {
                return;
            }

            container.innerHTML = "";

            snapshot.forEach(doc => {
                const msg = doc.data() || {};
                const remetenteMensagem = String(
                    msg.remetente || ""
                ).trim().toLowerCase();
                const isMinha =
                    remetenteMensagem === meuUsername;
                const div = document.createElement("div");
                const balao = document.createElement("div");
                const dadosResposta =
                    msg.respostaMensagem || {};
                const respostaId = String(
                    msg.respostaMensagemId ||
                    dadosResposta.id ||
                    ""
                ).trim();
                const respostaRemetente = String(
                    msg.respostaMensagemRemetente ||
                    dadosResposta.remetente ||
                    ""
                ).trim().toLowerCase();
                const respostaTexto = String(
                    msg.respostaMensagemTexto ||
                    dadosResposta.texto ||
                    ""
                ).trim();

                div.style.display = "flex";
                div.style.width = "100%";
                div.style.marginBottom = "8px";
                div.style.justifyContent = isMinha
                    ? "flex-end"
                    : "flex-start";

                balao.style.display = "flex";
                balao.style.flexDirection = "column";
                balao.style.gap = "4px";
                balao.style.textAlign = "left";
                balao.style.maxWidth = "75%";
                balao.style.padding = "10px 14px";
                balao.style.borderRadius = "18px";
                balao.style.fontSize = "14px";
                balao.style.wordBreak = "break-word";
                balao.style.background = isMinha
                    ? "#0095f6"
                    : "#262626";
                balao.style.color = "#fff";

                if (isMinha) {
                    balao.style.borderBottomRightRadius = "4px";
                } else {
                    balao.style.borderBottomLeftRadius = "4px";
                }

                if (
                    respostaId &&
                    (respostaTexto || respostaRemetente)
                ) {
                    const blocoResposta = document.createElement(
                        "button"
                    );
                    const tituloResposta = document.createElement(
                        "span"
                    );
                    const textoResposta = document.createElement(
                        "span"
                    );

                    blocoResposta.type = "button";
                    blocoResposta.title =
                        "Ir para a mensagem respondida";
                    blocoResposta.style.display = "flex";
                    blocoResposta.style.flexDirection = "column";
                    blocoResposta.style.alignItems = "stretch";
                    blocoResposta.style.width = "100%";
                    blocoResposta.style.boxSizing = "border-box";
                    blocoResposta.style.padding = "6px 8px";
                    blocoResposta.style.marginBottom = "2px";
                    blocoResposta.style.border = "none";
                    blocoResposta.style.borderLeft =
                        "3px solid #58b7ff";
                    blocoResposta.style.borderRadius = "6px";
                    blocoResposta.style.background = isMinha
                        ? "rgba(0, 0, 0, .18)"
                        : "#1f3b46";
                    blocoResposta.style.color = "#d7d9db";
                    blocoResposta.style.textAlign = "left";
                    blocoResposta.style.cursor = "pointer";

                    tituloResposta.textContent =
                        respostaRemetente
                            ? `@${respostaRemetente}`
                            : "Mensagem respondida";
                    tituloResposta.style.color = "#8bd3ff";
                    tituloResposta.style.fontSize = "11px";
                    tituloResposta.style.fontWeight = "700";
                    tituloResposta.style.marginBottom = "2px";

                    textoResposta.textContent = respostaTexto ||
                        "Mensagem";
                    textoResposta.style.display = "block";
                    textoResposta.style.overflow = "hidden";
                    textoResposta.style.textOverflow = "ellipsis";
                    textoResposta.style.whiteSpace = "nowrap";
                    textoResposta.style.color = "#d7d9db";
                    textoResposta.style.fontSize = "12px";

                    blocoResposta.appendChild(tituloResposta);
                    blocoResposta.appendChild(textoResposta);
                    blocoResposta.addEventListener(
                        "click",
                        eventoResposta => {
                            eventoResposta.preventDefault();
                            eventoResposta.stopPropagation();

                            const original = Array.from(
                                container.querySelectorAll(
                                    "[data-mensagem-id]"
                                )
                            ).find(elementoMensagem => {
                                return elementoMensagem.getAttribute(
                                    "data-mensagem-id"
                                ) === respostaId;
                            });

                            if (!original) {
                                return;
                            }

                            original.scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });
                            original.style.outline =
                                "2px solid #58b7ff";
                            original.style.outlineOffset = "4px";

                            window.setTimeout(() => {
                                original.style.outline = "none";
                                original.style.outlineOffset = "0";
                            }, 1200);
                        }
                    );
                    balao.appendChild(blocoResposta);
                }

                const textoMensagem = document.createElement("div");
                textoMensagem.textContent = String(
                    msg.texto || ""
                );
                balao.appendChild(textoMensagem);

                const horarioEnvio = document.createElement("span");
                horarioEnvio.textContent = formatarHoraMensagem(
                    msg.enviadoEm || msg.timestamp
                );
                horarioEnvio.style.fontSize = "10px";
                horarioEnvio.style.opacity = "0.75";
                horarioEnvio.style.alignSelf = "flex-end";
                balao.appendChild(horarioEnvio);

                if (isMinha) {
                    const statusLeitura = document.createElement("span");
                    statusLeitura.textContent = msg.lido === true
                        ? `Lida ${formatarHoraMensagem(msg.lidoEm)}`
                        : "Enviada";
                    statusLeitura.style.fontSize = "10px";
                    statusLeitura.style.opacity = "0.8";
                    statusLeitura.style.alignSelf = "flex-end";
                    balao.appendChild(statusLeitura);
                }

                div.appendChild(balao);
                configurarPressaoProlongadaMensagem(
                    div,
                    doc.id,
                    msg
                );
                container.appendChild(div);
            });

            container.scrollTop = container.scrollHeight;
            marcarMensagensComoLidas(chatId, meuUsername);
            atualizarIndicadorAbaMensagens();
        });

}


let _salaGrupoAtiva = null;

function fecharVisualizadorMembrosGrupoChat() {
    const modal = document.getElementById(
        "modal-visualizar-membros-grupo-chat"
    );

    if (modal) {
        modal.remove();
    }
}

async function abrirVisualizadorMembrosGrupoChat() {
    const grupo = _salaGrupoAtiva;
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (
        !grupo ||
        !grupo.chatId ||
        !Array.isArray(grupo.participantes) ||
        !grupo.participantes.includes(usernameLogado) ||
        !banco
    ) {
        return;
    }

    fecharVisualizadorMembrosGrupoChat();

    const modal = document.createElement("div");
    const caixa = document.createElement("div");
    const topo = document.createElement("div");
    const titulo = document.createElement("strong");
    const fechar = document.createElement("button");
    const lista = document.createElement("div");

    modal.id = "modal-visualizar-membros-grupo-chat";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "2147483647";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "18px";
    modal.style.boxSizing = "border-box";
    modal.style.background = "rgba(0,0,0,.78)";

    caixa.style.display = "flex";
    caixa.style.flexDirection = "column";
    caixa.style.width = "min(100%, 430px)";
    caixa.style.maxHeight = "min(82vh, 600px)";
    caixa.style.overflow = "hidden";
    caixa.style.background = "#121212";
    caixa.style.border = "1px solid #2f3336";
    caixa.style.borderRadius = "16px";

    topo.style.display = "flex";
    topo.style.alignItems = "center";
    topo.style.justifyContent = "space-between";
    topo.style.gap = "10px";
    topo.style.padding = "16px";
    topo.style.borderBottom = "1px solid #2f3336";

    titulo.textContent =
        `Integrantes — ${grupo.nomeGrupo || "Grupo"}`;
    titulo.style.color = "#fff";
    titulo.style.fontSize = "16px";

    fechar.type = "button";
    fechar.textContent = "×";
    fechar.setAttribute(
        "aria-label",
        "Fechar integrantes do grupo"
    );
    fechar.style.border = "none";
    fechar.style.background = "transparent";
    fechar.style.color = "#fff";
    fechar.style.fontSize = "24px";
    fechar.style.cursor = "pointer";
    fechar.addEventListener(
        "click",
        fecharVisualizadorMembrosGrupoChat
    );

    lista.style.display = "flex";
    lista.style.flexDirection = "column";
    lista.style.gap = "8px";
    lista.style.padding = "14px 16px";
    lista.style.overflowY = "auto";

    topo.appendChild(titulo);
    topo.appendChild(fechar);
    caixa.appendChild(topo);
    caixa.appendChild(lista);
    modal.appendChild(caixa);
    document.body.appendChild(modal);

    try {
        const usuariosSnap = await banco
            .collection("usuarios")
            .get();
        const perfis = new Map();

        usuariosSnap.forEach(documento => {
            const dados = documento.data() || {};
            const username = String(
                dados.username || ""
            ).trim().toLowerCase();

            if (username) {
                perfis.set(username, dados);
            }
        });

        const administradores = Array.isArray(
            grupo.administradores
        )
            ? grupo.administradores.map(usuario => String(
                usuario || ""
            ).trim().toLowerCase()).filter(Boolean)
            : [String(
                grupo.criadoPor || ""
            ).trim().toLowerCase()];

        grupo.participantes.forEach(usuario => {
            const username = String(
                usuario || ""
            ).trim().toLowerCase();
            const perfil = perfis.get(username) || {};
            const linha = document.createElement("div");
            const avatar = document.createElement("div");
            const textos = document.createElement("div");
            const nome = document.createElement("strong");
            const detalhe = document.createElement("span");
            const selo = document.createElement("span");

            linha.style.display = "flex";
            linha.style.alignItems = "center";
            linha.style.gap = "10px";
            linha.style.padding = "10px";
            linha.style.borderRadius = "10px";
            linha.style.background = "#1c1c1c";

            avatar.textContent = String(
                perfil.nomeReal || username
            ).charAt(0).toUpperCase();
            avatar.style.display = "flex";
            avatar.style.alignItems = "center";
            avatar.style.justifyContent = "center";
            avatar.style.width = "38px";
            avatar.style.height = "38px";
            avatar.style.flexShrink = "0";
            avatar.style.borderRadius = "50%";
            avatar.style.background = "#26384a";
            avatar.style.color = "#58b7ff";
            avatar.style.fontWeight = "700";

            textos.style.display = "flex";
            textos.style.flexDirection = "column";
            textos.style.gap = "3px";
            textos.style.flex = "1";
            textos.style.minWidth = "0";

            nome.textContent = String(
                perfil.nomeReal || username
            );
            nome.style.color = "#fff";
            nome.style.fontSize = "13px";
            nome.style.overflow = "hidden";
            nome.style.textOverflow = "ellipsis";
            nome.style.whiteSpace = "nowrap";

            detalhe.textContent =
                `${perfil.cargo || perfil.tipo || "Membro"} · @${username}`;
            detalhe.style.color = "#8e8e8e";
            detalhe.style.fontSize = "11px";

            if (administradores.includes(username)) {
                selo.textContent = "Admin";
                selo.style.color = "#c4a7ff";
                selo.style.fontSize = "11px";
                selo.style.fontWeight = "700";
                selo.style.padding = "4px 7px";
                selo.style.border = "1px solid #8b5cf6";
                selo.style.borderRadius = "8px";
            }

            textos.appendChild(nome);
            textos.appendChild(detalhe);
            linha.appendChild(avatar);
            linha.appendChild(textos);

            if (selo.textContent) {
                linha.appendChild(selo);
            }

            lista.appendChild(linha);
        });
    } catch (erro) {
        console.error(
            "Erro ao carregar visualização dos integrantes:",
            erro
        );
        lista.textContent =
            "Não foi possível carregar os integrantes agora.";
        lista.style.color = "#ff6b6b";
    }
}

function abrirMenuAcoesGrupoChat() {
    const menu = document.getElementById(
        "menu-acoes-grupo-chat"
    );
    const botao = document.getElementById(
        "btn-menu-acoes-grupo-chat"
    );
    const painel = document.getElementById(
        "painel-acoes-grupo-chat"
    );
    const identidade = document.getElementById(
        "identidade-chat-atual"
    );

    if (!menu || !botao || !painel || !identidade) {
        return;
    }

    window._menuAcoesGrupoChatAberto = true;
    menu.style.display = "flex";
    botao.textContent = "×";
    botao.setAttribute("aria-label", "Fechar ações do grupo");
    botao.setAttribute("aria-expanded", "true");
    botao.style.transform = "rotate(90deg)";
    botao.style.background = "#262626";
    botao.style.borderColor = "#666";

    painel.style.display = "flex";
    painel.style.opacity = "0";
    painel.style.transform = "translateX(10px) scale(.96)";
    identidade.style.display = "flex";
    identidade.style.opacity = "0";
    identidade.style.transform = "translateX(-8px) scale(.96)";

    window.requestAnimationFrame(() => {
        painel.style.opacity = "1";
        painel.style.transform = "translateX(0) scale(1)";
        identidade.style.opacity = "0";
        identidade.style.transform = "translateX(-8px) scale(.96)";
    });

    window.clearTimeout(
        window._timerFecharIdentidadeChat
    );
    window._timerFecharIdentidadeChat = window.setTimeout(
        () => {
            if (window._menuAcoesGrupoChatAberto) {
                identidade.style.display = "none";
            }
        },
        220
    );
}

function fecharMenuAcoesGrupoChat() {
    const menu = document.getElementById(
        "menu-acoes-grupo-chat"
    );
    const botao = document.getElementById(
        "btn-menu-acoes-grupo-chat"
    );
    const painel = document.getElementById(
        "painel-acoes-grupo-chat"
    );
    const identidade = document.getElementById(
        "identidade-chat-atual"
    );

    if (!menu || !botao || !painel || !identidade) {
        return;
    }

    window._menuAcoesGrupoChatAberto = false;
    botao.textContent = "☰";
    botao.setAttribute("aria-label", "Abrir ações do grupo");
    botao.setAttribute("aria-expanded", "false");
    botao.style.transform = "rotate(0deg)";
    botao.style.background = "#121212";
    botao.style.borderColor = "#3a3a3a";

    identidade.style.display = "flex";
    identidade.style.opacity = "0";
    identidade.style.transform = "translateX(-8px) scale(.96)";
    painel.style.opacity = "0";
    painel.style.transform = "translateX(10px) scale(.96)";

    window.clearTimeout(
        window._timerFecharMenuAcoesGrupoChat
    );
    window._timerFecharMenuAcoesGrupoChat = window.setTimeout(
        () => {
            if (!window._menuAcoesGrupoChatAberto) {
                painel.style.display = "none";
                identidade.style.opacity = "1";
                identidade.style.transform = "translateX(0) scale(1)";
            }
        },
        220
    );
}

function desativarMenuAcoesGrupoChat() {
    const menu = document.getElementById(
        "menu-acoes-grupo-chat"
    );
    const painel = document.getElementById(
        "painel-acoes-grupo-chat"
    );
    const identidade = document.getElementById(
        "identidade-chat-atual"
    );

    window._menuAcoesGrupoChatAberto = false;
    window.clearTimeout(
        window._timerFecharMenuAcoesGrupoChat
    );
    window.clearTimeout(
        window._timerFecharIdentidadeChat
    );

    if (menu) {
        menu.style.display = "none";
    }
    if (painel) {
        painel.style.display = "none";
        painel.style.opacity = "0";
        painel.style.transform = "translateX(10px) scale(.96)";
        painel.innerHTML = "";
    }
    if (identidade) {
        identidade.style.display = "flex";
        identidade.style.opacity = "1";
        identidade.style.transform = "translateX(0) scale(1)";
    }
}

function configurarMenuAcoesGrupoChat() {
    const menu = document.getElementById(
        "menu-acoes-grupo-chat"
    );
    const botao = document.getElementById(
        "btn-menu-acoes-grupo-chat"
    );

    if (!menu || !botao) {
        return;
    }

    menu.style.display = "flex";

    if (botao.dataset.menuConfigurado === "true") {
        return;
    }

    botao.dataset.menuConfigurado = "true";
    botao.addEventListener("click", () => {
        if (window._menuAcoesGrupoChatAberto) {
            fecharMenuAcoesGrupoChat();
        } else {
            abrirMenuAcoesGrupoChat();
        }
    });
}

async function registrarEventoSistemaGrupoChat(
    texto,
    chatIdInformado,
    participantesInformados
) {
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const grupo = _salaGrupoAtiva;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const chatId = String(
        chatIdInformado ||
        grupo && grupo.chatId ||
        ""
    ).trim();
    const participantes = Array.isArray(
        participantesInformados
            ? participantesInformados
            : grupo && grupo.participantes
    )
        ? (
            participantesInformados ||
            grupo && grupo.participantes ||
            []
        ).map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];

    if (
        !banco ||
        !chatId ||
        !usernameLogado ||
        !String(texto || "").trim()
    ) {
        return false;
    }

    try {
        await banco
            .collection("chats")
            .doc(chatId)
            .collection("mensagens")
            .add({
                remetente: usernameLogado,
                destinatario: "",
                destinatarios: participantes,
                grupoId: chatId,
                texto: String(texto).trim(),
                tipoMensagem: "sistema",
                eventoSistema: true,
                lido: true,
                lidoEm: null,
                enviadoEm:
                    firebase.firestore.FieldValue.serverTimestamp(),
                timestamp:
                    firebase.firestore.FieldValue.serverTimestamp()
            });

        return true;
    } catch (erro) {
        console.error(
            "Não foi possível registrar evento do grupo:",
            erro
        );
        return false;
    }
}

async function sairDoGrupoChat() {
    const grupo = _salaGrupoAtiva;
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (
        !grupo ||
        !grupo.chatId ||
        !banco ||
        !usernameLogado
    ) {
        return;
    }

    const criadoPor = String(
        grupo.criadoPor || ""
    ).trim().toLowerCase();

    if (usernameLogado === criadoPor) {
        window.alert(
            "O criador não pode sair do grupo. Exclua o grupo ou transfira a administração antes de sair."
        );
        return;
    }

    const confirmou = window.confirm(
        `Deseja realmente sair do grupo “${grupo.nomeGrupo || "Grupo"}”?`
    );

    if (!confirmou) {
        return;
    }

    const participantes = Array.isArray(
        grupo.participantes
    )
        ? grupo.participantes.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const administradores = Array.isArray(
        grupo.administradores
    )
        ? grupo.administradores.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(usuario => {
            return usuario !== usernameLogado;
        })
        : [];
    const participantesRestantes = participantes.filter(
        usuario => usuario !== usernameLogado
    );

    if (!participantes.includes(usernameLogado)) {
        return;
    }

    try {
        await registrarEventoSistemaGrupoChat(
            `@${usernameLogado} saiu do grupo.`,
            grupo.chatId,
            participantes
        );

        await banco
            .collection("chats")
            .doc(grupo.chatId)
            .update({
                usuarios: participantesRestantes,
                administradores
            });

        if (
            typeof fecharMenuAcoesGrupoChat === "function"

        ) {
            fecharMenuAcoesGrupoChat();
        }

        if (typeof fecharSalaChat === "function") {
            fecharSalaChat();
        }

        if (
            typeof agendarAtualizacaoOrdenacaoContatosChat ===
            "function"
        ) {
            agendarAtualizacaoOrdenacaoContatosChat();
        }

        window.alert(
            "Você saiu do grupo."
        );
    } catch (erro) {
        console.error(
            "Erro ao sair do grupo:",
            erro
        );
        window.alert(
            "Não foi possível sair do grupo agora. Verifique sua conexão e tente novamente."
        );
    }
}

function configurarBotaoVisualizarMembrosGrupoChat(dadosGrupo) {
    const cabecalho = document.getElementById(
        "cabecalho-sala-chat"
    );
    const painel = document.getElementById(
        "painel-acoes-grupo-chat"
    );
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const criadoPor = String(
        dadosGrupo && dadosGrupo.criadoPor || ""
    ).trim().toLowerCase();
    const administradores = Array.isArray(
        dadosGrupo && dadosGrupo.administradores
    )
        ? dadosGrupo.administradores.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const participantes = Array.isArray(
        dadosGrupo && dadosGrupo.participantes
    )
        ? dadosGrupo.participantes.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const antigo = document.getElementById(
        "btn-ver-membros-grupo-chat"
    );

    const antigoSair = document.getElementById(
        "btn-sair-grupo-chat"
    );

    if (antigoSair) {
        antigoSair.remove();
    }

    if (antigo) {
        antigo.remove();
    }

    if (
        !cabecalho ||
        !painel ||
        !usernameLogado ||
        !participantes.includes(usernameLogado)
    ) {
        return;
    }

    if (
        usernameLogado === criadoPor ||
        administradores.includes(usernameLogado)
    ) {
        return;
    }

    const botaoSair = document.createElement("button");
    botaoSair.id = "btn-sair-grupo-chat";
    botaoSair.type = "button";
    botaoSair.textContent = "Sair";
    botaoSair.title = "Sair deste grupo";
    botaoSair.style.border = "1px solid #ff9f43";
    botaoSair.style.borderRadius = "7px";
    botaoSair.style.background = "transparent";
    botaoSair.style.color = "#ffb86b";
    botaoSair.style.padding = "5px 7px";
    botaoSair.style.fontSize = "11px";
    botaoSair.style.cursor = "pointer";
    botaoSair.addEventListener(
        "click",
        sairDoGrupoChat
    );
    painel.appendChild(botaoSair);


    const botao = document.createElement("button");
    botao.id = "btn-ver-membros-grupo-chat";
    botao.type = "button";
    botao.textContent = "Ver membros";
    botao.title = "Ver integrantes do grupo";
    botao.style.border = "1px solid #3a3a3a";
    botao.style.borderRadius = "7px";
    botao.style.background = "transparent";
    botao.style.color = "#d7d9db";
    botao.style.padding = "5px 7px";
    botao.style.fontSize = "11px";
    botao.style.cursor = "pointer";
    botao.addEventListener(
        "click",
        abrirVisualizadorMembrosGrupoChat
    );
    painel.appendChild(botao);
}



function fecharModalEditarGrupoChat() {
    const modal = document.getElementById(
        "modal-editar-grupo-chat"
    );

    if (modal) {
        modal.remove();
    }
}

async function salvarEdicaoGrupoChat() {
    const modal = document.getElementById(
        "modal-editar-grupo-chat"
    );
    const grupo = _salaGrupoAtiva;
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (!modal || !grupo || !grupo.chatId || !banco) {
        return;
    }

    const criadoPor = String(
        grupo.criadoPor || ""
    ).trim().toLowerCase();
    const administradores = Array.isArray(
        grupo.administradores
    )
        ? grupo.administradores.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const podeEditar =
        localStorage.getItem("usuarioLogado") === "admin" ||
        usernameLogado === criadoPor ||
        administradores.includes(usernameLogado);

    if (!podeEditar) {
        window.alert(
            "Você não tem permissão para editar este grupo."
        );
        return;
    }

    const nomeInput = document.getElementById(
        "input-editar-nome-grupo-chat"
    );
    const fotoInput = document.getElementById(
        "input-editar-foto-grupo-chat"
    );
    const botao = modal.querySelector(
        "[data-salvar-edicao-grupo]"
    );
    const nomeGrupo = String(
        nomeInput && nomeInput.value || ""
    ).trim();
    const arquivoFoto = fotoInput &&
        fotoInput.files &&
        fotoInput.files[0];

    if (nomeGrupo.length < 2) {
        window.alert(
            "O nome do grupo precisa ter pelo menos 2 caracteres."
        );
        return;
    }

    if (botao) {
        botao.disabled = true;
        botao.textContent = "Salvando...";
        botao.style.opacity = "0.65";
    }

    try {
        const dadosAtualizacao = {
            nomeGrupo
        };

        if (arquivoFoto) {
            if (!arquivoFoto.type.startsWith("image/")) {
                throw new Error(
                    "Escolha um arquivo de imagem válido."
                );
            }

            const fotoGrupoUrl =
                await subirImagemParaNuvem(arquivoFoto);

            if (!fotoGrupoUrl) {
                throw new Error(
                    "O upload da nova foto não retornou uma URL."
                );
            }

            dadosAtualizacao.fotoGrupoUrl = fotoGrupoUrl;
        }

        await banco
            .collection("chats")
            .doc(grupo.chatId)
            .set(
                dadosAtualizacao,
                {
                    merge: true
                }
            );

        grupo.nomeGrupo = nomeGrupo;

        if (dadosAtualizacao.fotoGrupoUrl) {
            grupo.fotoGrupoUrl =
                dadosAtualizacao.fotoGrupoUrl;
        }

        const nomeEl = document.getElementById(
            "chat-nome-atual"
        );
        const cargoEl = document.getElementById(
            "chat-cargo-atual"
        );
        const avatarEl = document.getElementById(
            "chat-avatar-atual"
        );

        if (nomeEl) {
            nomeEl.textContent = nomeGrupo;
        }
        if (cargoEl) {
            cargoEl.textContent =
                `${grupo.participantes.length} participantes`;
        }
        if (avatarEl && dadosAtualizacao.fotoGrupoUrl) {
            avatarEl.src = dadosAtualizacao.fotoGrupoUrl;
        }

        fecharModalEditarGrupoChat();
        configurarAcoesGrupoChat(grupo);
        configurarMenuAcoesGrupoChat();
        await carregarListaDeContatosChat();

        if (
            typeof registrarEventoSistemaGrupoChat ===
            "function"
        ) {
            await registrarEventoSistemaGrupoChat(
                `@${usernameLogado} editou as informações do grupo.`,
                grupo.chatId,
                grupo.participantes
            );
        }

        window.alert("Informações do grupo atualizadas.");
    } catch (erro) {
        console.error(
            "Erro ao editar grupo:",
            erro
        );
        window.alert(
            `Não foi possível editar o grupo.\n\n` +
            `Código: ${String(erro && erro.code || "sem-codigo")}\n` +
            `Detalhes: ${String(erro && erro.message || erro)}`
        );
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = "Salvar";
            botao.style.opacity = "1";
        }
    }
}

function abrirModalEditarGrupoChat() {
    const grupo = _salaGrupoAtiva;

    if (!grupo || !grupo.chatId) {
        return;
    }

    fecharModalEditarGrupoChat();

    const modal = document.createElement("div");
    const caixa = document.createElement("div");
    const topo = document.createElement("div");
    const titulo = document.createElement("strong");
    const fechar = document.createElement("button");
    const nome = document.createElement("input");
    const foto = document.createElement("input");
    const salvar = document.createElement("button");
    const cancelar = document.createElement("button");

    modal.id = "modal-editar-grupo-chat";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "2147483647";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "18px";
    modal.style.background = "rgba(0,0,0,.78)";
    modal.style.boxSizing = "border-box";

    caixa.style.display = "flex";
    caixa.style.flexDirection = "column";
    caixa.style.gap = "12px";
    caixa.style.width = "min(100%, 420px)";
    caixa.style.padding = "18px";
    caixa.style.background = "#121212";
    caixa.style.border = "1px solid #2f3336";
    caixa.style.borderRadius = "16px";
    caixa.style.boxSizing = "border-box";

    topo.style.display = "flex";
    topo.style.alignItems = "center";
    topo.style.justifyContent = "space-between";
    topo.style.gap = "10px";

    titulo.textContent = "Editar grupo";
    titulo.style.color = "#fff";
    titulo.style.fontSize = "17px";

    fechar.type = "button";
    fechar.textContent = "×";
    fechar.style.border = "none";
    fechar.style.background = "transparent";
    fechar.style.color = "#fff";
    fechar.style.fontSize = "24px";
    fechar.style.cursor = "pointer";
    fechar.addEventListener(
        "click",
        fecharModalEditarGrupoChat
    );

    nome.id = "input-editar-nome-grupo-chat";
    nome.type = "text";
    nome.value = String(grupo.nomeGrupo || "");
    nome.placeholder = "Nome do grupo";
    nome.maxLength = 80;
    nome.style.width = "100%";
    nome.style.padding = "11px";
    nome.style.boxSizing = "border-box";
    nome.style.border = "1px solid #3a3a3a";
    nome.style.borderRadius = "9px";
    nome.style.background = "#1c1c1c";
    nome.style.color = "#fff";
    nome.style.outline = "none";

    foto.id = "input-editar-foto-grupo-chat";
    foto.type = "file";
    foto.accept = "image/png,image/jpeg,image/webp";
    foto.style.color = "#d7d9db";
    foto.style.fontSize = "12px";

    salvar.type = "button";
    salvar.textContent = "Salvar";
    salvar.setAttribute(
        "data-salvar-edicao-grupo",
        "true"
    );
    salvar.style.border = "none";
    salvar.style.borderRadius = "9px";
    salvar.style.background = "#0095f6";
    salvar.style.color = "#fff";
    salvar.style.padding = "10px 14px";
    salvar.style.fontWeight = "700";
    salvar.style.cursor = "pointer";
    salvar.addEventListener(
        "click",
        salvarEdicaoGrupoChat
    );

    cancelar.type = "button";
    cancelar.textContent = "Cancelar";
    cancelar.style.border = "1px solid #3a3a3a";
    cancelar.style.borderRadius = "9px";
    cancelar.style.background = "transparent";
    cancelar.style.color = "#d7d9db";
    cancelar.style.padding = "10px 14px";
    cancelar.style.cursor = "pointer";
    cancelar.addEventListener(
        "click",
        fecharModalEditarGrupoChat
    );

    topo.appendChild(titulo);
    topo.appendChild(fechar);
    caixa.appendChild(topo);
    caixa.appendChild(nome);
    caixa.appendChild(foto);

    const rodape = document.createElement("div");
    rodape.style.display = "flex";
    rodape.style.justifyContent = "flex-end";
    rodape.style.gap = "8px";
    rodape.appendChild(cancelar);
    rodape.appendChild(salvar);
    caixa.appendChild(rodape);

    modal.appendChild(caixa);
    document.body.appendChild(modal);
    nome.focus();
}

function configurarAcoesGrupoChat(dadosGrupo) {
    const cabecalho = document.getElementById(
        "cabecalho-sala-chat"
    );
    const painel = document.getElementById(
        "painel-acoes-grupo-chat"
    );
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const criadoPor = String(
        dadosGrupo && dadosGrupo.criadoPor || ""
    ).trim().toLowerCase();
    const administradores = Array.isArray(
        dadosGrupo && dadosGrupo.administradores
    )
        ? dadosGrupo.administradores.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const podeGerenciar =
        localStorage.getItem("usuarioLogado") === "admin" ||
        Boolean(
            usernameLogado &&
            (
                usernameLogado === criadoPor ||
                administradores.includes(usernameLogado)
            )
        );

    if (!cabecalho || !painel) {
        return;
    }

    const antigo = document.getElementById(
        "acoes-grupo-chat"
    );

    if (antigo) {
        antigo.remove();
    }

    if (podeGerenciar) {
        const botaoVisualizar = document.getElementById(
            "btn-ver-membros-grupo-chat"
        );

        if (botaoVisualizar) {
            botaoVisualizar.remove();
        }
    }

    if (
        !administradores.length &&
        dadosGrupo &&
        dadosGrupo.chatId &&
        !dadosGrupo._administradoresRecarregados &&
        banco
    ) {
        dadosGrupo._administradoresRecarregados = true;

        banco
            .collection("chats")
            .doc(dadosGrupo.chatId)
            .get()
            .then(documento => {
                if (!documento.exists) {
                    return;
                }

                const dadosAtuais = documento.data() || {};
                dadosGrupo.administradores = Array.isArray(
                    dadosAtuais.administradores
                )
                    ? dadosAtuais.administradores
                    : [];
                configurarAcoesGrupoChat(dadosGrupo);
                configurarBotaoVisualizarMembrosGrupoChat(
                    dadosGrupo
                );
            })
            .catch(erro => {
                console.error(
                    "Erro ao recarregar administradores do grupo:",
                    erro
                );
            });
    }

    if (!podeGerenciar) {
        return;
    }

    const acoes = document.createElement("div");
    const botaoEditar = document.createElement("button");
    const botaoMembros = document.createElement("button");
    const botaoExcluir = document.createElement("button");

    acoes.id = "acoes-grupo-chat";
    acoes.style.display = "flex";
    acoes.style.alignItems = "center";
    acoes.style.gap = "6px";
    acoes.style.flexWrap = "nowrap";
    acoes.style.whiteSpace = "nowrap";
    acoes.style.flexShrink = "0";
    acoes.style.justifyContent = "flex-end";

    botaoEditar.type = "button";
    botaoEditar.textContent = "Editar";
    botaoEditar.title = "Editar nome e foto do grupo";
    botaoEditar.style.border = "1px solid #0095f6";
    botaoEditar.style.borderRadius = "7px";
    botaoEditar.style.background = "transparent";
    botaoEditar.style.color = "#58b7ff";
    botaoEditar.style.padding = "5px 7px";
    botaoEditar.style.fontSize = "11px";
    botaoEditar.style.cursor = "pointer";
    botaoEditar.addEventListener(
        "click",
        abrirModalEditarGrupoChat
    );


    botaoMembros.type = "button";
    botaoMembros.textContent = "Membros";
    botaoMembros.title = "Gerenciar participantes e administradores";
    botaoMembros.style.border = "1px solid #8b5cf6";
    botaoMembros.style.borderRadius = "7px";
    botaoMembros.style.background = "transparent";
    botaoMembros.style.color = "#c4a7ff";
    botaoMembros.style.padding = "5px 7px";
    botaoMembros.style.fontSize = "11px";
    botaoMembros.style.cursor = "pointer";
    botaoMembros.addEventListener(
        "click",
        () => abrirGerenciadorMembrosGrupoChat()
    );

    botaoExcluir.type = "button";
    botaoExcluir.textContent = "Excluir";
    botaoExcluir.title = "Excluir grupo";
    botaoExcluir.style.border = "1px solid #ff4d4d";
    botaoExcluir.style.borderRadius = "7px";
    botaoExcluir.style.background = "transparent";
    botaoExcluir.style.color = "#ff6b6b";
    botaoExcluir.style.padding = "5px 7px";
    botaoExcluir.style.fontSize = "11px";
    botaoExcluir.style.cursor = "pointer";
    botaoExcluir.addEventListener(
        "click",
        excluirGrupoChat
    );

    acoes.appendChild(botaoEditar);
    acoes.appendChild(botaoMembros);
    acoes.appendChild(botaoExcluir);
    painel.style.flexWrap = "nowrap";
    painel.style.whiteSpace = "nowrap";
    painel.style.overflowX = "auto";
    painel.style.overflowY = "hidden";
    painel.appendChild(acoes);
}



function fecharGerenciadorMembrosGrupoChat() {
    const modal = document.getElementById(
        "modal-gerenciar-membros-grupo-chat"
    );

    if (modal) {
        modal.remove();
    }
}

async function salvarGerenciamentoMembrosGrupoChat() {
    const modal = document.getElementById(
        "modal-gerenciar-membros-grupo-chat"
    );
    const grupo = _salaGrupoAtiva;
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (!modal || !grupo || !grupo.chatId || !banco) {
        return;
    }

    const criadoPor = String(
        grupo.criadoPor || ""
    ).trim().toLowerCase();
    const participantesAnteriores = Array.isArray(
        grupo.participantes
    )
        ? grupo.participantes.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const administradoresAnteriores = Array.isArray(
        grupo.administradores
    )
        ? grupo.administradores.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const participantes = Array.from(
        modal.querySelectorAll(
            "[data-membro-grupo]:checked"
        )
    )
        .map(elemento => String(
            elemento.value || ""
        ).trim().toLowerCase())
        .filter(Boolean);
    const administradores = Array.from(
        modal.querySelectorAll(
            "[data-admin-grupo]:checked"
        )
    )
        .map(elemento => String(
            elemento.value || ""
        ).trim().toLowerCase())
        .filter(Boolean);

    if (!criadoPor || !participantes.includes(criadoPor)) {
        window.alert(
            "O criador do grupo não pode ser removido."
        );
        return;
    }

    if (!administradores.includes(criadoPor)) {
        window.alert(
            "O criador precisa continuar como administrador."
        );
        return;
    }

    if (participantes.length < 2) {
        window.alert(
            "O grupo precisa ter pelo menos dois participantes."
        );
        return;
    }

    const adminsForaDoGrupo = administradores.some(
        administrador => !participantes.includes(administrador)
    );

    if (adminsForaDoGrupo) {
        window.alert(
            "Um administrador precisa ser participante do grupo."
        );
        return;
    }

    const botao = modal.querySelector(
        "[data-salvar-membros-grupo]"
    );

    if (botao) {
        botao.disabled = true;
        botao.textContent = "Salvando...";
        botao.style.opacity = "0.65";
    }

    try {
        await banco
            .collection("chats")
            .doc(grupo.chatId)
            .set(
                {
                    usuarios: Array.from(
                        new Set(participantes)
                    ),
                    administradores: Array.from(
                        new Set(administradores)
                    )
                },
                {
                    merge: true
                }
            );

        grupo.participantes = Array.from(
            new Set(participantes)
        );
        grupo.administradores = Array.from(
            new Set(administradores)
        );

        const novosParticipantes = grupo.participantes
            .filter(usuario => {
                return !participantesAnteriores.includes(
                    usuario
                );
            });
        const novosAdministradores = grupo.administradores
            .filter(usuario => {
                return !administradoresAnteriores.includes(
                    usuario
                ) && participantesAnteriores.includes(usuario);
            });

        for (const usuario of novosParticipantes) {
            await registrarEventoSistemaGrupoChat(
                `@${usernameLogado} adicionou @${usuario} ao grupo.`,
                grupo.chatId,
                grupo.participantes
            );
        }

        for (const usuario of novosAdministradores) {
            await registrarEventoSistemaGrupoChat(
                `@${usernameLogado} promoveu @${usuario} a administrador.`,
                grupo.chatId,
                grupo.participantes
            );
        }

        fecharGerenciadorMembrosGrupoChat();
        configurarAcoesGrupoChat(grupo);
        await carregarListaDeContatosChat();
        window.alert(
            "Participantes e administradores atualizados."
        );
    } catch (erro) {
        console.error(
            "Erro ao salvar membros do grupo:",
            erro
        );
        window.alert(
            `Não foi possível salvar as alterações.\n\n` +
            `Código: ${String(erro && erro.code || "sem-codigo")}\n` +
            `Detalhes: ${String(erro && erro.message || erro)}`
        );
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = "Salvar alterações";
            botao.style.opacity = "1";
        }
    }
}

async function expulsarMembroDoGrupoChat(usuarioExpulso) {
    const grupo = _salaGrupoAtiva;
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const alvo = String(
        usuarioExpulso || ""
    ).trim().toLowerCase();

    if (!grupo || !grupo.chatId || !banco || !alvo) {
        return;
    }

    const criadoPor = String(
        grupo.criadoPor || ""
    ).trim().toLowerCase();
    const administradores = Array.isArray(
        grupo.administradores
    )
        ? grupo.administradores.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const podeGerenciar =
        localStorage.getItem("usuarioLogado") === "admin" ||
        usernameLogado === criadoPor ||
        administradores.includes(usernameLogado);

    if (!podeGerenciar) {
        window.alert(
            "Você não tem permissão para expulsar membros."
        );
        return;
    }

    if (alvo === criadoPor) {
        window.alert(
            "O criador não pode ser expulso do grupo."
        );
        return;
    }

    if (alvo === usernameLogado) {
        window.alert(
            "Para sair, use o botão Sair do menu do grupo."
        );
        return;
    }

    const confirmou = window.confirm(
        `Expulsar @${alvo} do grupo “${grupo.nomeGrupo || "Grupo"}”?`
    );

    if (!confirmou) {
        return;
    }

    const participantesAtuais = Array.isArray(
        grupo.participantes
    )
        ? grupo.participantes.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];
    const participantesRestantes = participantesAtuais.filter(
        usuario => usuario !== alvo
    );
    const administradoresRestantes = administradores.filter(
        usuario => usuario !== alvo
    );

    if (
        !participantesAtuais.includes(alvo) ||
        participantesRestantes.length < 2
    ) {
        window.alert(
            "O grupo precisa continuar com pelo menos dois participantes."
        );
        return;
    }

    try {
        await banco
            .collection("chats")
            .doc(grupo.chatId)
            .update({
                usuarios: participantesRestantes,
                administradores: administradoresRestantes
            });

        grupo.participantes = participantesRestantes;
        grupo.administradores = administradoresRestantes;

        await registrarEventoSistemaGrupoChat(
            `@${usernameLogado} removeu @${alvo} do grupo.`,
            grupo.chatId,
            participantesRestantes
        );

        fecharGerenciadorMembrosGrupoChat();
        configurarAcoesGrupoChat(grupo);
        configurarBotaoVisualizarMembrosGrupoChat(grupo);
        configurarMenuAcoesGrupoChat();

        if (
            typeof agendarAtualizacaoOrdenacaoContatosChat ===
            "function"
        ) {
            agendarAtualizacaoOrdenacaoContatosChat();
        }

        window.alert(
            `@${alvo} foi expulso do grupo.`
        );
    } catch (erro) {
        console.error(
            "Erro ao expulsar membro do grupo:",
            erro
        );
        window.alert(
            `Não foi possível expulsar o membro.\n\n` +
            `Código: ${String(erro && erro.code || "sem-codigo")}\n` +
            `Detalhes: ${String(erro && erro.message || erro)}`
        );
    }
}

async function abrirGerenciadorMembrosGrupoChat() {
    const grupo = _salaGrupoAtiva;
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (!grupo || !grupo.chatId || !banco) {
        return;
    }

    const administradoresAtuais = Array.isArray(
        grupo.administradores
    ) && grupo.administradores.length
        ? grupo.administradores
        : [String(
            grupo.criadoPor || ""
        ).trim().toLowerCase()];
    const podeGerenciar =
        localStorage.getItem("usuarioLogado") === "admin" ||
        usernameLogado === String(
            grupo.criadoPor || ""
        ).trim().toLowerCase() ||
        administradoresAtuais.includes(usernameLogado);

    if (!podeGerenciar) {
        window.alert(
            "Você não tem permissão para gerenciar este grupo."
        );
        return;
    }

    fecharGerenciadorMembrosGrupoChat();

    const modal = document.createElement("div");
    const caixa = document.createElement("div");
    const topo = document.createElement("div");
    const titulo = document.createElement("strong");
    const fechar = document.createElement("button");
    const conteudo = document.createElement("div");
    const lista = document.createElement("div");
    const rodape = document.createElement("div");
    const cancelar = document.createElement("button");
    const salvar = document.createElement("button");

    modal.id = "modal-gerenciar-membros-grupo-chat";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "2147483647";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "18px";
    modal.style.boxSizing = "border-box";
    modal.style.background = "rgba(0,0,0,.78)";

    caixa.style.display = "flex";
    caixa.style.flexDirection = "column";
    caixa.style.width = "min(100%, 520px)";
    caixa.style.maxHeight = "min(88vh, 680px)";
    caixa.style.overflow = "hidden";
    caixa.style.background = "#121212";
    caixa.style.border = "1px solid #2f3336";
    caixa.style.borderRadius = "16px";

    topo.style.display = "flex";
    topo.style.alignItems = "center";
    topo.style.justifyContent = "space-between";
    topo.style.padding = "16px";
    topo.style.borderBottom = "1px solid #2f3336";

    titulo.textContent =
        `Gerenciar membros — ${grupo.nomeGrupo}`;
    titulo.style.color = "#fff";
    titulo.style.fontSize = "16px";

    fechar.type = "button";
    fechar.textContent = "×";
    fechar.setAttribute(
        "aria-label",
        "Fechar gerenciamento de membros"
    );
    fechar.style.border = "none";
    fechar.style.background = "transparent";
    fechar.style.color = "#fff";
    fechar.style.fontSize = "24px";
    fechar.style.cursor = "pointer";
    fechar.addEventListener(
        "click",
        fecharGerenciadorMembrosGrupoChat
    );

    conteudo.style.padding = "14px 16px";
    conteudo.style.overflowY = "auto";

    const explicacao = document.createElement("div");
    explicacao.textContent =
        "Marque os participantes e, na coluna Admin, escolha quem poderá gerenciar este grupo.";
    explicacao.style.marginBottom = "12px";
    explicacao.style.color = "#8e8e8e";
    explicacao.style.fontSize = "12px";
    explicacao.style.lineHeight = "1.4";

    lista.style.display = "flex";
    lista.style.flexDirection = "column";
    lista.style.gap = "7px";
    lista.style.minHeight = "80px";

    const cabecalhoLista = document.createElement("div");
    cabecalhoLista.style.display = "grid";
    cabecalhoLista.style.gridTemplateColumns =
        "1fr 72px 72px 78px";
    cabecalhoLista.style.gap = "8px";
    cabecalhoLista.style.padding = "0 9px 5px";
    cabecalhoLista.style.color = "#8e8e8e";
    cabecalhoLista.style.fontSize = "11px";
    cabecalhoLista.innerHTML =
        "<span>Usuário</span><span>Participa</span><span>Admin</span><span>Ação</span>";

    const adicionarLinha = (
        usuario,
        nome,
        cargo,
        participa,
        eCriador,
        eAdmin
    ) => {
        const linha = document.createElement("div");
        const textos = document.createElement("div");
        const nomeLinha = document.createElement("div");
        const nomeEl = document.createElement("strong");
        const voceEl = document.createElement("span");
        const cargoEl = document.createElement("span");
        const participante = document.createElement("input");
        const admin = document.createElement("input");
        const acao = document.createElement("button");
        const usuarioNormalizado = String(
            usuario || ""
        ).trim().toLowerCase();
        const souEu = usuarioNormalizado === usernameLogado;
        const souAdmin = Boolean(eAdmin || eCriador);

        linha.style.display = "grid";
        linha.style.gridTemplateColumns =
            "1fr 72px 72px 78px";
        linha.style.alignItems = "center";
        linha.style.gap = "8px";
        linha.style.padding = "9px";
        linha.style.borderRadius = "9px";
        linha.style.background = "#1c1c1c";

        textos.style.display = "flex";
        textos.style.flexDirection = "column";
        textos.style.gap = "3px";
        textos.style.minWidth = "0";

        nomeLinha.style.display = "flex";
        nomeLinha.style.alignItems = "center";
        nomeLinha.style.gap = "6px";
        nomeLinha.style.minWidth = "0";

        nomeEl.textContent = String(nome || usuario);
        nomeEl.style.color = "#fff";
        nomeEl.style.fontSize = "13px";
        nomeEl.style.overflow = "hidden";
        nomeEl.style.textOverflow = "ellipsis";
        nomeEl.style.whiteSpace = "nowrap";

        voceEl.textContent = souEu
            ? "Você"
            : "";
        voceEl.style.display = souEu
            ? "inline-flex"
            : "none";
        voceEl.style.alignItems = "center";
        voceEl.style.padding = "3px 6px";
        voceEl.style.borderRadius = "6px";
        voceEl.style.background = "#26384a";
        voceEl.style.color = "#58b7ff";
        voceEl.style.fontSize = "10px";
        voceEl.style.fontWeight = "700";

        cargoEl.textContent = `${cargo || "Membro"} · @${usuario}`;
        cargoEl.style.color = "#8e8e8e";
        cargoEl.style.fontSize = "10px";
        cargoEl.style.overflow = "hidden";
        cargoEl.style.textOverflow = "ellipsis";
        cargoEl.style.whiteSpace = "nowrap";

        participante.type = "checkbox";
        participante.value = usuario;
        participante.checked = Boolean(participa);
        participante.setAttribute(
            "data-membro-grupo",
            "true"
        );
        participante.style.width = "17px";
        participante.style.height = "17px";
        participante.style.accentColor = "#0095f6";
        participante.style.justifySelf = "center";

        admin.type = "checkbox";
        admin.value = usuario;
        admin.checked = Boolean(eAdmin || eCriador);
        admin.setAttribute(
            "data-admin-grupo",
            "true"
        );
        admin.style.width = "17px";
        admin.style.height = "17px";
        admin.style.accentColor = "#8b5cf6";
        admin.style.justifySelf = "center";
        admin.disabled = Boolean(eCriador || !participa);

        acao.type = "button";
        acao.style.borderRadius = "6px";
        acao.style.padding = "4px 5px";
        acao.style.fontSize = "10px";
        acao.style.cursor = "pointer";

        if (souEu && souAdmin && !eCriador) {
            acao.id = "btn-sair-grupo-chat-membros";
            acao.textContent = "Sair";
            acao.title = "Sair deste grupo";
            acao.style.border = "1px solid #ff9f43";
            acao.style.background = "transparent";
            acao.style.color = "#ffb86b";
            acao.addEventListener(
                "click",
                sairDoGrupoChat
            );
        } else if (souEu && eCriador) {
            acao.textContent = "Você";
            acao.title = "Você é o criador deste grupo";
            acao.style.border = "1px solid #3a3a3a";
            acao.style.background = "transparent";
            acao.style.color = "#8e8e8e";
            acao.disabled = true;
            acao.style.cursor = "default";
        } else {
            acao.textContent = "Expulsar";
            acao.title = eCriador
                ? "O criador não pode ser expulso"
                : "Expulsar este membro do grupo";
            acao.style.border = "1px solid #ff4d4d";
            acao.style.background = "transparent";
            acao.style.color = "#ff6b6b";
            acao.disabled = Boolean(eCriador || !participa);
            acao.style.cursor = acao.disabled
                ? "not-allowed"
                : "pointer";
            acao.style.opacity = acao.disabled
                ? "0.45"
                : "1";
            acao.addEventListener(
                "click",
                evento => {
                    evento.stopPropagation();
                    expulsarMembroDoGrupoChat(usuario);
                }
            );
        }

        if (eCriador) {
            participante.disabled = true;
            admin.disabled = true;
        }

        participante.addEventListener(
            "change",
            () => {
                if (!participante.checked) {
                    admin.checked = false;
                    admin.disabled = true;
                } else if (!eCriador) {
                    admin.disabled = false;
                }
            }
        );

        admin.addEventListener(
            "change",
            () => {
                if (admin.checked) {
                    participante.checked = true;
                }
            }
        );

        nomeLinha.appendChild(nomeEl);
        if (souEu) {
            nomeLinha.appendChild(voceEl);
        }
        textos.appendChild(nomeLinha);
        textos.appendChild(cargoEl);
        linha.appendChild(textos);
        linha.appendChild(participante);
        linha.appendChild(admin);
        linha.appendChild(acao);
        lista.appendChild(linha);
    };

    const membrosAtuais = Array.isArray(
        grupo.participantes
    )
        ? grupo.participantes.map(usuario => String(
            usuario || ""
        ).trim().toLowerCase()).filter(Boolean)
        : [];

    try {
        const usuariosSnap = await banco
            .collection("usuarios")
            .get();
        const usuarios = [];

        usuariosSnap.forEach(documento => {
            const dados = documento.data() || {};
            const usuario = String(
                dados.username || ""
            ).trim().toLowerCase();

            if (!usuario) {
                return;
            }

            usuarios.push({
                usuario,
                nome: dados.nomeReal || usuario,
                cargo: dados.cargo || dados.tipo || "Membro"
            });
        });

        usuarios.sort((primeiro, segundo) => {
            return String(primeiro.nome).localeCompare(
                String(segundo.nome),
                "pt-BR",
                {
                    sensitivity: "base"
                }
            );
        });

        const ordem = [
            ...membrosAtuais,
            ...usuarios
                .map(item => item.usuario)
                .filter(usuario => !membrosAtuais.includes(usuario))
        ];
        const mapaUsuarios = new Map(
            usuarios.map(item => [item.usuario, item])
        );

        ordem.forEach(usuario => {
            const dados = mapaUsuarios.get(usuario) || {
                usuario,
                nome: usuario,
                cargo: "Membro"
            };
            adicionarLinha(
                usuario,
                dados.nome,
                dados.cargo,
                membrosAtuais.includes(usuario),
                usuario === String(
                    grupo.criadoPor || ""
                ).trim().toLowerCase(),
                administradoresAtuais.includes(usuario)
            );
        });
    } catch (erro) {
        console.error(
            "Erro ao carregar gerenciamento de membros:",
            erro
        );
        const erroEl = document.createElement("div");
        erroEl.textContent =
            "Não foi possível carregar os usuários.";
        erroEl.style.color = "#ff6b6b";
        erroEl.style.padding = "16px 8px";
        lista.appendChild(erroEl);
    }

    rodape.style.display = "flex";
    rodape.style.justifyContent = "flex-end";
    rodape.style.gap = "9px";
    rodape.style.padding = "14px 16px";
    rodape.style.borderTop = "1px solid #2f3336";

    cancelar.type = "button";
    cancelar.textContent = "Cancelar";
    cancelar.style.border = "1px solid #3a3a3a";
    cancelar.style.borderRadius = "8px";
    cancelar.style.background = "transparent";
    cancelar.style.color = "#d7d9db";
    cancelar.style.padding = "9px 13px";
    cancelar.style.cursor = "pointer";
    cancelar.addEventListener(
        "click",
        fecharGerenciadorMembrosGrupoChat
    );

    salvar.type = "button";
    salvar.textContent = "Salvar alterações";
    salvar.setAttribute(
        "data-salvar-membros-grupo",
        "true"
    );
    salvar.style.border = "none";
    salvar.style.borderRadius = "8px";
    salvar.style.background = "#0095f6";
    salvar.style.color = "#fff";
    salvar.style.padding = "9px 13px";
    salvar.style.fontWeight = "700";
    salvar.style.cursor = "pointer";
    salvar.addEventListener(
        "click",
        salvarGerenciamentoMembrosGrupoChat
    );

    topo.appendChild(titulo);
    topo.appendChild(fechar);
    conteudo.appendChild(explicacao);
    conteudo.appendChild(cabecalhoLista);
    conteudo.appendChild(lista);
    rodape.appendChild(cancelar);
    rodape.appendChild(salvar);
    caixa.appendChild(topo);
    caixa.appendChild(conteudo);
    caixa.appendChild(rodape);
    modal.appendChild(caixa);
    document.body.appendChild(modal);
}

async function trocarFotoGrupoChat(input) {

    const grupo = _salaGrupoAtiva;
    const arquivo = input &&
        input.files &&
        input.files[0];
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!grupo || !grupo.chatId || !arquivo || !banco) {
        return;
    }

    if (
        localStorage.getItem("usuarioLogado") !== "admin" &&
        usernameLogado !== grupo.criadoPor
    ) {
        window.alert(
            "Somente o criador do grupo pode trocar a foto."
        );
        input.value = "";
        return;
    }

    try {
        const fotoGrupoUrl =
            await subirImagemParaNuvem(arquivo);

        if (!fotoGrupoUrl) {
            throw new Error(
                "O upload da nova foto não retornou uma URL."
            );
        }

        await banco
            .collection("chats")
            .doc(grupo.chatId)
            .set(
                {
                    fotoGrupoUrl
                },
                {
                    merge: true
                }
            );

        grupo.fotoGrupoUrl = fotoGrupoUrl;

        await registrarEventoSistemaGrupoChat(
            `@${usernameLogado} alterou a foto do grupo.`,
            grupo.chatId,
            grupo.participantes
        );

        const avatar = document.getElementById(
            "chat-avatar-atual"
        );

        if (avatar) {
            avatar.src = fotoGrupoUrl;
        }

        await carregarListaDeContatosChat();
        window.alert("Foto do grupo atualizada.");
    } catch (erro) {
        console.error(
            "Erro ao trocar foto do grupo:",
            erro
        );
        window.alert(
            `Não foi possível trocar a foto.\n\n` +
            `Código: ${String(erro && erro.code || "sem-codigo")}\n` +
            `Detalhes: ${String(erro && erro.message || erro)}`
        );
    } finally {
        input.value = "";
    }
}

async function excluirGrupoChat() {
    const grupo = _salaGrupoAtiva;
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!grupo || !grupo.chatId || !banco) {
        return;
    }

    const podeExcluir =
        localStorage.getItem("usuarioLogado") === "admin" ||
        usernameLogado === grupo.criadoPor;

    if (!podeExcluir) {
        window.alert(
            "Somente o criador do grupo pode excluí-lo."
        );
        return;
    }

    if (!window.confirm(
        `Excluir o grupo \"${grupo.nomeGrupo}\"? Esta ação não pode ser desfeita.`
    )) {
        return;
    }

    try {
        await banco
            .collection("chats")
            .doc(grupo.chatId)
            .delete();

        fecharSalaChat();
        await carregarListaDeContatosChat();
        window.alert("Grupo excluído com sucesso.");
    } catch (erro) {
        console.error(
            "Erro ao excluir grupo:",
            erro
        );
        window.alert(
            `Não foi possível excluir o grupo.\n\n` +
            `Código: ${String(erro && erro.code || "sem-codigo")}\n` +
            `Detalhes: ${String(erro && erro.message || erro)}`
        );
    }
}

async function abrirSalaGrupoChat(chatId, nomeGrupo) {
    if (typeof limparRespostaMensagemChat === "function") {
        limparRespostaMensagemChat();
    }

    const id = String(chatId || "").trim();
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!id || !usernameLogado || !banco) {
        return;
    }

    try {
        const grupoSnap = await banco
            .collection("chats")
            .doc(id)
            .get();

        if (!grupoSnap.exists) {
            window.alert("Este grupo não existe mais.");
            return;
        }

        const dadosGrupo = grupoSnap.data() || {};
        const participantes = Array.isArray(
            dadosGrupo.usuarios
        )
            ? dadosGrupo.usuarios.map(usuario => String(
                usuario || ""
            ).trim().toLowerCase()).filter(Boolean)
            : [];

        if (!participantes.includes(usernameLogado)) {
            window.alert(
                "Você não participa deste grupo."
            );
            return;
        }

        _salaGrupoAtiva = {
            chatId: id,
            nomeGrupo: String(
                dadosGrupo.nomeGrupo ||
                nomeGrupo ||
                "Grupo sem nome"
            ),
            participantes,
            administradores: Array.isArray(
                dadosGrupo.administradores
            )
                ? dadosGrupo.administradores.map(usuario => String(
                    usuario || ""
                ).trim().toLowerCase()).filter(Boolean)
                : [],
            fotoGrupoUrl: String(
                dadosGrupo.fotoGrupoUrl || ""
            ),
            criadoPor: String(
                dadosGrupo.criadoPor || ""
            ).trim().toLowerCase()
        };

        abrirSalaChat(
            `__grupo__${id}`,
            _salaGrupoAtiva.nomeGrupo,
            `${participantes.length} participantes`,
            _salaGrupoAtiva.fotoGrupoUrl ||
                window.AVATAR_USUARIO_PADRAO
        );
        configurarBotaoVisualizarMembrosGrupoChat(
            _salaGrupoAtiva
        );
        configurarAcoesGrupoChat(
            _salaGrupoAtiva
        );
        configurarMenuAcoesGrupoChat();
        configurarBotaoVisualizarMembrosGrupoChat(
            _salaGrupoAtiva
        );

        if (unsubscribeChatAtivo) {

            unsubscribeChatAtivo();
            unsubscribeChatAtivo = null;
        }

        if (window._unsubscribeGrupoMetadados) {
            window._unsubscribeGrupoMetadados();
            window._unsubscribeGrupoMetadados = null;
        }

        const atualizarCabecalhoGrupo = () => {
            const nomeEl = document.getElementById(
                "chat-nome-atual"
            );
            const cargoEl = document.getElementById(
                "chat-cargo-atual"
            );
            const avatarEl = document.getElementById(
                "chat-avatar-atual"
            );
            const foto = _salaGrupoAtiva.fotoGrupoUrl ||
                window.AVATAR_USUARIO_PADRAO;

            if (nomeEl) {
                nomeEl.textContent =
                    _salaGrupoAtiva.nomeGrupo;
            }
            if (cargoEl) {
                cargoEl.textContent =
                    `${_salaGrupoAtiva.participantes.length} participantes`;
            }
            if (avatarEl) {
                avatarEl.src = foto;
                avatarEl.onerror = () => {
                    avatarEl.src =
                        window.AVATAR_USUARIO_PADRAO;
                };
            }
        };

        window._unsubscribeGrupoMetadados = banco
            .collection("chats")
            .doc(id)
            .onSnapshot(
                documento => {
                    if (!documento.exists) {
                        if (window._unsubscribeGrupoMetadados) {
                            window._unsubscribeGrupoMetadados();
                            window._unsubscribeGrupoMetadados = null;
                        }
                        if (typeof fecharSalaChat === "function") {
                            fecharSalaChat();
                        }
                        if (
                            typeof agendarAtualizacaoOrdenacaoContatosChat ===
                            "function"
                        ) {
                            agendarAtualizacaoOrdenacaoContatosChat();
                        }
                        return;
                    }

                    const dadosAtuais = documento.data() || {};
                    const participantesAtuais = Array.isArray(
                        dadosAtuais.usuarios
                    )
                        ? dadosAtuais.usuarios.map(usuario => String(
                            usuario || ""
                        ).trim().toLowerCase()).filter(Boolean)
                        : [];

                    if (!participantesAtuais.includes(usernameLogado)) {
                        window.alert(
                            "Você foi removido deste grupo."
                        );
                        if (typeof fecharSalaChat === "function") {
                            fecharSalaChat();
                        }
                        if (
                            typeof agendarAtualizacaoOrdenacaoContatosChat ===
                            "function"
                        ) {
                            agendarAtualizacaoOrdenacaoContatosChat();
                        }
                        return;
                    }

                    _salaGrupoAtiva.nomeGrupo = String(
                        dadosAtuais.nomeGrupo ||
                        "Grupo sem nome"
                    );
                    _salaGrupoAtiva.participantes =
                        participantesAtuais;
                    _salaGrupoAtiva.administradores =
                        Array.isArray(
                            dadosAtuais.administradores
                        )
                            ? dadosAtuais.administradores.map(usuario => String(
                                usuario || ""
                            ).trim().toLowerCase()).filter(Boolean)
                            : [];
                    _salaGrupoAtiva.fotoGrupoUrl = String(
                        dadosAtuais.fotoGrupoUrl || ""
                    );
                    _salaGrupoAtiva.criadoPor = String(
                        dadosAtuais.criadoPor || ""
                    ).trim().toLowerCase();

                    atualizarCabecalhoGrupo();
                    configurarBotaoVisualizarMembrosGrupoChat(
                        _salaGrupoAtiva
                    );
                    configurarAcoesGrupoChat(
                        _salaGrupoAtiva
                    );
                    configurarMenuAcoesGrupoChat();
                    configurarBotaoVisualizarMembrosGrupoChat(
                        _salaGrupoAtiva
                    );

                    if (



                        typeof agendarAtualizacaoOrdenacaoContatosChat ===
                        "function"
                    ) {
                        agendarAtualizacaoOrdenacaoContatosChat();
                    }
                },
                erro => {
                    console.error(
                        "Erro ao observar dados do grupo:",
                        erro
                    );
                }
            );

        const container = document.getElementById(
            "chat-mensagens-container"
        );
        const perfisGrupoChat = {};

        try {
            const usuariosSnap = await banco
                .collection("usuarios")
                .get();

            usuariosSnap.forEach(documentoUsuario => {
                const dadosUsuario = documentoUsuario.data() || {};
                const usernameUsuario = String(
                    dadosUsuario.username || ""
                ).trim().toLowerCase();

                if (!usernameUsuario) {
                    return;
                }

                perfisGrupoChat[usernameUsuario] = {
                    nome: String(
                        dadosUsuario.nomeReal ||
                        usernameUsuario
                    ).trim(),
                    cargo: String(
                        dadosUsuario.cargo ||
                        dadosUsuario.tipo ||
                        "Membro"
                    ).trim(),
                    fotoUrl: String(
                        dadosUsuario.fotoUrl ||
                        dadosUsuario.foto ||
                        ""
                    ).trim()
                };
            });
        } catch (erroPerfis) {
            console.error(
                "Erro ao carregar perfis dos integrantes:",
                erroPerfis
            );
        }

        window._chatIdAtivo = id;
        sincronizarEstadoChatComServiceWorker();

                const renderizarMensagens = snapshot => {
            if (!container) {
                return;
            }

            container.innerHTML = "";

            snapshot.forEach(documento => {
                const mensagem = documento.data() || {};
                const ehEventoSistema =
                    mensagem.tipoMensagem === "sistema" ||
                    mensagem.eventoSistema === true ||
                    mensagem.tipo === "sistema";

                if (ehEventoSistema) {
                    const aviso = document.createElement("div");
                    aviso.textContent = String(
                        mensagem.texto || ""
                    );
                    aviso.style.width = "100%";
                    aviso.style.boxSizing = "border-box";
                    aviso.style.padding = "4px 14px";
                    aviso.style.margin = "3px 0 8px";
                    aviso.style.color = "#8e8e8e";
                    aviso.style.fontSize = "11px";
                    aviso.style.lineHeight = "1.35";
                    aviso.style.textAlign = "center";
                    aviso.style.fontStyle = "italic";
                    aviso.style.wordBreak = "break-word";
                    aviso.setAttribute(
                        "data-evento-sistema",
                        "true"
                    );
                    container.appendChild(aviso);
                    return;
                }

                const remetenteMensagem = String(
                    mensagem.remetente || ""
                ).trim().toLowerCase();
                const minha = remetenteMensagem ===
                    usernameLogado;
                const perfilRemetente =
                    perfisGrupoChat[remetenteMensagem] || {};
                const linha = document.createElement("div");
                const balao = document.createElement("div");
                const cabecalhoRemetente =
                    document.createElement("div");
                const avatarRemetente =
                    document.createElement("img");
                const nomeRemetente =
                    document.createElement("span");
                const texto = document.createElement("div");
                const horario = document.createElement("span");
                const dadosResposta =
                    mensagem.respostaMensagem || {};
                const respostaId = String(
                    mensagem.respostaMensagemId ||
                    dadosResposta.id ||
                    ""
                ).trim();
                const respostaRemetente = String(
                    mensagem.respostaMensagemRemetente ||
                    dadosResposta.remetente ||
                    ""
                ).trim().toLowerCase();
                const respostaTexto = String(
                    mensagem.respostaMensagemTexto ||
                    dadosResposta.texto ||
                    ""
                ).trim();

                linha.style.display = "flex";
                linha.style.width = "100%";
                linha.style.marginBottom = "8px";
                linha.style.justifyContent = minha
                    ? "flex-end"
                    : "flex-start";

                balao.style.display = "flex";
                balao.style.flexDirection = "column";
                balao.style.gap = "4px";
                balao.style.maxWidth = "75%";
                balao.style.padding = "10px 14px";
                balao.style.borderRadius = "18px";
                balao.style.fontSize = "14px";
                balao.style.wordBreak = "break-word";
                balao.style.background = minha
                    ? "#0095f6"
                    : "#262626";
                balao.style.color = "#fff";
                balao.style.borderBottomRightRadius = minha
                    ? "4px"
                    : "18px";
                balao.style.borderBottomLeftRadius = minha
                    ? "18px"
                    : "4px";

                const fotoRemetente = String(
                    perfilRemetente.fotoUrl ||
                    window.AVATAR_USUARIO_PADRAO ||
                    ""
                );

                cabecalhoRemetente.style.display = "flex";
                cabecalhoRemetente.style.alignItems = "center";
                cabecalhoRemetente.style.gap = "6px";
                cabecalhoRemetente.style.marginBottom = "2px";

                avatarRemetente.src = fotoRemetente;
                avatarRemetente.alt = "Foto do remetente";
                avatarRemetente.style.width = "24px";
                avatarRemetente.style.height = "24px";
                avatarRemetente.style.flex = "0 0 24px";
                avatarRemetente.style.borderRadius = "50%";
                avatarRemetente.style.objectFit = "cover";
                avatarRemetente.style.border =
                    "1px solid rgba(255,255,255,.22)";
                avatarRemetente.onerror = () => {
                    avatarRemetente.onerror = null;
                    avatarRemetente.src =
                        window.AVATAR_USUARIO_PADRAO;
                };

                nomeRemetente.textContent = minha
                    ? "Você"
                    : String(
                        perfilRemetente.nome ||
                        remetenteMensagem ||
                        "Membro"
                    );
                nomeRemetente.style.color = minha
                    ? "#9edcff"
                    : "#fff";
                nomeRemetente.style.fontSize = "11px";
                nomeRemetente.style.fontWeight = "700";
                nomeRemetente.style.overflow = "hidden";
                nomeRemetente.style.textOverflow = "ellipsis";
                nomeRemetente.style.whiteSpace = "nowrap";

                cabecalhoRemetente.appendChild(
                    avatarRemetente
                );
                cabecalhoRemetente.appendChild(
                    nomeRemetente
                );
                balao.appendChild(cabecalhoRemetente);

                if (
                    respostaId &&
                    (respostaTexto || respostaRemetente)
                ) {
                    const blocoResposta = document.createElement(
                        "button"
                    );
                    const tituloResposta = document.createElement(
                        "span"
                    );
                    const textoResposta = document.createElement(
                        "span"
                    );

                    blocoResposta.type = "button";
                    blocoResposta.title =
                        "Ir para a mensagem respondida";
                    blocoResposta.style.display = "flex";
                    blocoResposta.style.flexDirection = "column";
                    blocoResposta.style.alignItems = "stretch";
                    blocoResposta.style.width = "100%";
                    blocoResposta.style.boxSizing = "border-box";
                    blocoResposta.style.padding = "6px 8px";
                    blocoResposta.style.marginBottom = "2px";
                    blocoResposta.style.border = "none";
                    blocoResposta.style.borderLeft = "3px solid #58b7ff";
                    blocoResposta.style.borderRadius = "6px";
                    blocoResposta.style.background = minha
                        ? "rgba(0, 0, 0, .18)"
                        : "#1f3b46";
                    blocoResposta.style.color = "#d7d9db";
                    blocoResposta.style.textAlign = "left";
                    blocoResposta.style.cursor = "pointer";

                    tituloResposta.textContent = respostaRemetente
                        ? `@${respostaRemetente}`
                        : "Mensagem respondida";
                    tituloResposta.style.color = "#8bd3ff";
                    tituloResposta.style.fontSize = "11px";
                    tituloResposta.style.fontWeight = "700";
                    tituloResposta.style.marginBottom = "2px";

                    textoResposta.textContent = respostaTexto ||
                        "Mensagem";
                    textoResposta.style.display = "block";
                    textoResposta.style.overflow = "hidden";
                    textoResposta.style.textOverflow = "ellipsis";
                    textoResposta.style.whiteSpace = "nowrap";
                    textoResposta.style.color = "#d7d9db";
                    textoResposta.style.fontSize = "12px";

                    blocoResposta.appendChild(tituloResposta);
                    blocoResposta.appendChild(textoResposta);
                    blocoResposta.addEventListener(
                        "click",
                        eventoResposta => {
                            eventoResposta.preventDefault();
                            eventoResposta.stopPropagation();

                            const mensagens = Array.from(
                                container.querySelectorAll(
                                    "[data-mensagem-id]"
                                )
                            );
                            const original = mensagens.find(
                                elementoMensagem => {
                                    return elementoMensagem.getAttribute(
                                        "data-mensagem-id"
                                    ) === respostaId;
                                }
                            );

                            if (!original) {
                                return;
                            }

                            original.scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });
                            original.style.transition =
                                "filter .2s ease, outline .2s ease";
                            original.style.outline =
                                "2px solid #58b7ff";
                            original.style.outlineOffset = "4px";

                            window.setTimeout(() => {
                                original.style.outline = "none";
                                original.style.outlineOffset = "0";
                            }, 1200);
                        }
                    );
                    balao.appendChild(blocoResposta);
                }

                texto.textContent = String(
                    mensagem.texto || ""
                );
                balao.appendChild(texto);

                horario.textContent = formatarHoraMensagem(
                    mensagem.enviadoEm ||
                    mensagem.timestamp
                );
                horario.style.fontSize = "10px";
                horario.style.opacity = "0.75";
                horario.style.alignSelf = "flex-end";
                balao.appendChild(horario);

                linha.appendChild(balao);
                configurarPressaoProlongadaMensagem(
                    linha,
                    documento.id,
                    mensagem
                );
                container.appendChild(linha);
            });

            container.scrollTop = container.scrollHeight;
        };

        unsubscribeChatAtivo = banco
            .collection("chats")
            .doc(id)
            .collection("mensagens")
            .orderBy("timestamp", "asc")
            .onSnapshot(
                renderizarMensagens,
                erro => {
                    console.error(
                        "Erro ao carregar mensagens do grupo:",
                        erro
                    );
                }
            );
    } catch (erro) {
        console.error(
            "Erro ao abrir grupo:",
            erro
        );
        _salaGrupoAtiva = null;
        window.alert(
            "Não foi possível abrir este grupo."
        );
    }
}



function fecharSalaChat() {
    cancelarSelecaoMensagensChat();

    if (typeof limparRespostaMensagemChat === "function") {
        limparRespostaMensagemChat();
    }

    const telaChat = document.getElementById(
        "tela-sala-chat"
    );
    const telaLista = document.getElementById(
        "tela-lista-mensagens"
    );
    const inputMsg = document.getElementById(
        "input-nova-mensagem"
    );
    const cabecalhoChat = document.getElementById(
        "cabecalho-sala-chat"
    );

    if (cabecalhoChat) {
        cabecalhoChat.style.border = "none";
        cabecalhoChat.style.boxShadow = "none";
        cabecalhoChat.style.animation = "none";
    }

    if (inputMsg) {
        inputMsg.blur();
    }

    if (
        telaChat &&
        telaChat._vvSync &&
        window.visualViewport
    ) {
        window.visualViewport.removeEventListener(
            "resize",
            telaChat._vvSync
        );
        window.visualViewport.removeEventListener(
            "scroll",
            telaChat._vvSync
        );
        telaChat._vvSync = null;
    }

    if (telaChat && telaChat._backupBody) {
        document.body.style.overflow =
            telaChat._backupBody.overflow;
        document.body.style.position =
            telaChat._backupBody.position;
        document.body.style.top =
            telaChat._backupBody.top;
        document.body.style.height =
            telaChat._backupBody.height;
        document.body.style.width =
            telaChat._backupBody.width;
        document.body.style.backgroundColor =
            telaChat._backupBody.backgroundColor;

        const siteHeader =
            document.querySelector(".site-header") ||
            document.querySelector("header");

        if (siteHeader) {
            siteHeader.style.visibility = "visible";
        }
    }

    if (telaChat) {
        telaChat.style.display = "none";
        telaChat.style.transform = "none";
        window.scrollTo(
            0,
            telaChat._scrollPos || 0
        );
    }

    if (telaLista) {
        telaLista.style.display = "flex";
    }

    if (window._unsubscribeGrupoMetadados) {
        window._unsubscribeGrupoMetadados();
        window._unsubscribeGrupoMetadados = null;
    }

    const acoesGrupo = document.getElementById(
        "acoes-grupo-chat"
    );


    if (acoesGrupo) {
        acoesGrupo.remove();
    }

    usuarioChatDestino = null;
    _salaGrupoAtiva = null;
    window._chatIdAtivo = "";
    sincronizarEstadoChatComServiceWorker();

    if (unsubscribeChatAtivo) {
        unsubscribeChatAtivo();
        unsubscribeChatAtivo = null;
    }
}


function formatarHoraMensagem(valor) {
    try {
        let data = null;

        if (valor && typeof valor.toDate === "function") {
            data = valor.toDate();
        } else if (valor instanceof Date) {
            data = valor;
        } else if (
            typeof valor === "string" ||
            typeof valor === "number"
        ) {
            data = new Date(valor);
        }

        if (!data || Number.isNaN(data.getTime())) {
            return "Data indisponível";
        }

        return data.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (erro) {
        return "Data indisponível";
    }
}



function criarOuAtualizarBadgeMensagens() {
    const botao = document.getElementById("btn-sub-mensagens");
    if (!botao) return null;
    let badge = botao.querySelector("[data-badge-mensagens]");
    if (!badge) {
        botao.style.position = "relative";
        badge = document.createElement("span");
        badge.setAttribute("data-badge-mensagens", "true");
        badge.style.position = "absolute";
        badge.style.top = "6px";
        badge.style.right = "28%";
        badge.style.minWidth = "17px";
        badge.style.height = "17px";
        badge.style.padding = "0 4px";
        badge.style.borderRadius = "10px";
        badge.style.background = "#ff3040";
        badge.style.color = "#fff";
        badge.style.fontSize = "10px";
        badge.style.fontWeight = "700";
        badge.style.lineHeight = "17px";
        badge.style.textAlign = "center";
        badge.style.boxSizing = "border-box";
        badge.style.display = "none";
        badge.style.pointerEvents = "none";
        botao.appendChild(badge);
    }
    return badge;
}

const FCM_VAPID_PUBLIC_KEY = "BEqg1YF_tRSajW2-drRQQv1d6BUpOUkUtYpJjLQG6y5WnjWGcQ4WP5y7ranaDKTCS3ovefcwCXToY-_tnsUE6q8";
let _registroServiceWorkerFCM = null;
let _listenerForegroundFCMAtivo = false;

async function registrarTokenFCM() {
    try {
        if (
            typeof firebase === "undefined" ||
            typeof firebase.messaging !== "function" ||
            !navigator.serviceWorker ||
            !window.ClubeDB ||
            !window.ClubeDB.textoDB
        ) {
            return null;
        }

        const usuarioFirebase = window.ClubeDB.loginDB &&
            window.ClubeDB.loginDB.currentUser;
        const usernameLogado = String(
            localStorage.getItem("usernameLogado") || ""
        ).trim().toLowerCase();

        if (!usuarioFirebase || !usernameLogado) {
            return null;
        }

        if (!_registroServiceWorkerFCM) {
            _registroServiceWorkerFCM = await navigator.serviceWorker.register(
                "/firebase-messaging-sw.js",
                { scope: "/" }
            );
        }

        const messaging = firebase.messaging();
        const token = await messaging.getToken({
            vapidKey: FCM_VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: _registroServiceWorkerFCM
        });

        if (!token) {
            console.warn("FCM não retornou um token para este dispositivo.");
            return null;
        }

        const usuariosSnap = await window.ClubeDB.textoDB
            .collection("usuarios")
            .where("username", "==", usernameLogado)
            .limit(1)
            .get();

        if (!usuariosSnap.empty) {
            await usuariosSnap.docs[0].ref.set({
                fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
                fcmTokenAtualizadoEm:
                    firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        if (!_listenerForegroundFCMAtivo) {
            firebase.messaging().onMessage(payload => {
                const dados = payload && payload.data ? payload.data : {};
                const notificacao = payload && payload.notification
                    ? payload.notification
                    : {};
                const nome = notificacao.title || dados.title || "Nova mensagem";
                mostrarNotificacaoNovaMensagem(
                    1,
                    nome === "Nova mensagem" ? "" : nome
                );
            });
            _listenerForegroundFCMAtivo = true;
        }

        console.log("✅ Token FCM registrado neste dispositivo.");
        return token;
    } catch (erro) {
        console.error("Erro ao registrar notificações push FCM:", erro);
        return null;
    }
}


/* A notificação interna possui uma única implementação acima. */

function renderizarMarcadoresMensagens(snapshot) {
    const usernameLogado = localStorage.getItem("usernameLogado");
    if (!usernameLogado || !snapshot) return;

    let totalNaoLidas = 0;
    const contagens = {};

    snapshot.forEach(doc => {
        const dados = doc.data() || {};
        const quantidade = Number(
            (dados.naoLidasPor || {})[usernameLogado] || 0
        );
        const usuarios = Array.isArray(dados.usuarios)
            ? dados.usuarios
            : [];
        const outroUsuario = usuarios.find(
            usuario => usuario !== usernameLogado
        );

        totalNaoLidas += quantidade;

        if (outroUsuario) {
            contagens[outroUsuario.toLowerCase()] = quantidade;
        }
    });

    document.querySelectorAll("[data-chat-username]").forEach(card => {
        const usernameContato = (
            card.getAttribute("data-chat-username") || ""
        ).toLowerCase();
        const badgeContato = card.querySelector("[data-unread-badge]");

        if (!badgeContato) return;

        const quantidade = contagens[usernameContato] || 0;
        badgeContato.textContent = quantidade > 99
            ? "99+"
            : String(quantidade);
        badgeContato.style.display = quantidade > 0
            ? "inline-flex"
            : "none";
    });

    const badgeAba = criarOuAtualizarBadgeMensagens();

    if (badgeAba) {
        badgeAba.textContent = totalNaoLidas > 99
            ? "99+"
            : String(totalNaoLidas);
        badgeAba.style.display = totalNaoLidas > 0
            ? "block"
            : "none";
    }

    return { contagens, totalNaoLidas };
}

function atualizarIndicadorAbaMensagens() {
    const estado = window._estadoContadoresMensagens;
    const badge = criarOuAtualizarBadgeMensagens();

    if (!badge) return;

    const total = estado ? Number(estado.total || 0) : 0;
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.style.display = total > 0 ? "block" : "none";
}

function atualizarMarcadoresContatosChat() {
    const estado = window._estadoContadoresMensagens;
    if (!estado) return;

    const porContato = estado.porContato || {};

    document.querySelectorAll("[data-chat-username]").forEach(card => {
        const usernameContato = (
            card.getAttribute("data-chat-username") || ""
        ).toLowerCase();
        const badgeContato = card.querySelector("[data-unread-badge]");

        if (!badgeContato) return;

        const quantidade = Number(porContato[usernameContato] || 0);
        badgeContato.textContent = quantidade > 99
            ? "99+"
            : String(quantidade);
        badgeContato.style.display = quantidade > 0
            ? "inline-flex"
            : "none";
    });
}





async function sincronizarContadorNaoLidasChat(chatId, usernameLogado) {
    if (
        !chatId ||
        !usernameLogado ||
        !window.ClubeDB ||
        !window.ClubeDB.textoDB
    ) {
        return 0;
    }

    const chatRef = window.ClubeDB.textoDB
        .collection("chats")
        .doc(chatId);

    const mensagensSnap = await chatRef
        .collection("mensagens")
        .get();

    let quantidadeNaoLidas = 0;

    mensagensSnap.forEach(doc => {
        const mensagem = doc.data() || {};

        if (
            mensagem.destinatario === usernameLogado &&
            mensagem.lido !== true
        ) {
            quantidadeNaoLidas += 1;
        }
    });

    const chatSnap = await chatRef.get();
    const dadosChat = chatSnap.exists
        ? chatSnap.data() || {}
        : {};

    const quantidadeAtual = Number(
        (dadosChat.naoLidasPor || {})[usernameLogado] || 0
    );

    if (quantidadeAtual !== quantidadeNaoLidas) {
        await chatRef.set({
            naoLidasPor: {
                [usernameLogado]: quantidadeNaoLidas
            }
        }, {
            merge: true
        });
    }

    return quantidadeNaoLidas;
}

async function atualizarMarcadoresContatosChat() {
    const usernameLogado = localStorage.getItem("usernameLogado");

    if (
        !usernameLogado ||
        !window.ClubeDB ||
        !window.ClubeDB.textoDB
    ) {
        return;
    }

    if (window._unsubscribeMarcadoresMensagens) {
        window._unsubscribeMarcadoresMensagens();
        window._unsubscribeMarcadoresMensagens = null;
    }

    let cicloAtual = 0;

    const aplicarMarcadores = async snapshot => {
        const ciclo = ++cicloAtual;
        const contagens = {};
        let totalNaoLidas = 0;

        for (const doc of snapshot.docs) {
            const dados = doc.data() || {};
            const usuarios = Array.isArray(dados.usuarios)
                ? dados.usuarios
                : [];

            const outroUsuario = usuarios.find(
                usuario => usuario !== usernameLogado
            );

            if (!outroUsuario) {
                continue;
            }

            const quantidade = await sincronizarContadorNaoLidasChat(
                doc.id,
                usernameLogado
            );

            contagens[outroUsuario.toLowerCase()] = quantidade;
            totalNaoLidas += quantidade;
        }

        if (ciclo !== cicloAtual) {
            return;
        }

        document.querySelectorAll("[data-chat-username]").forEach(card => {
            const usernameContato = (
                card.getAttribute("data-chat-username") || ""
            ).toLowerCase();

            const badgeContato = card.querySelector(
                "[data-unread-badge]"
            );

            if (!badgeContato) {
                return;
            }

            const quantidade = contagens[usernameContato] || 0;

            badgeContato.textContent = quantidade > 99
                ? "99+"
                : String(quantidade);

            badgeContato.style.display = quantidade > 0
                ? "inline-flex"
                : "none";
        });

        const badgeAba = criarOuAtualizarBadgeMensagens();

        if (badgeAba) {
            badgeAba.textContent = totalNaoLidas > 99
                ? "99+"
                : String(totalNaoLidas);

            badgeAba.style.display = totalNaoLidas > 0
                ? "block"
                : "none";
        }
    };

    window._unsubscribeMarcadoresMensagens = window.ClubeDB.textoDB
        .collection("chats")
        .where(
            "usuarios",
            "array-contains",
            usernameLogado
        )
        .onSnapshot(
            snapshot => {
                aplicarMarcadores(snapshot).catch(erro => {
                    console.error(
                        "Erro ao recalcular contadores:",
                        erro
                    );
                });
            },
            erro => {
                console.error(
                    "Erro no listener dos contadores:",
                    erro
                );
            }
        );
}




async function ajustarNaoLidasChat(chatId, username, delta) {
    if (!chatId || !username || !window.ClubeDB || !window.ClubeDB.textoDB) return;
    const ref = window.ClubeDB.textoDB.collection("chats").doc(chatId);
    const snap = await ref.get();
    const dados = snap.exists ? (snap.data() || {}) : {};
    const naoLidasPor = { ...(dados.naoLidasPor || {}) };
    naoLidasPor[username] = Math.max(0, Number(naoLidasPor[username] || 0) + Number(delta || 0));
    await ref.set({ naoLidasPor }, { merge: true });
}

async function marcarMensagensComoLidas(chatId, usernameLogado) {
    if (
        !chatId ||
        !usernameLogado ||
        !window.ClubeDB ||
        !window.ClubeDB.textoDB
    ) {
        return;
    }

    try {
        const mensagensRef = window.ClubeDB.textoDB
            .collection("chats")
            .doc(chatId)
            .collection("mensagens");

        const snap = await mensagensRef.get();
        const batch = window.ClubeDB.textoDB.batch();
        const dataLeitura = firebase.firestore.FieldValue.serverTimestamp();
        let encontrouNaoLida = false;

        snap.forEach(doc => {
            const mensagem = doc.data() || {};

            if (
                mensagem.destinatario === usernameLogado &&
                mensagem.lido !== true
            ) {
                batch.update(doc.ref, {
                    lido: true,
                    lidoEm: dataLeitura
                });

                encontrouNaoLida = true;
            }
        });

        if (encontrouNaoLida) {
            await batch.commit();
        }

        atualizarMarcadoresContatosChat();
    } catch (erro) {
        console.error(
            "Erro ao marcar mensagens como lidas:",
            erro
        );
    }
}




    window._respostaMensagemChat =
    window._respostaMensagemChat || null;

function limparRespostaMensagemChat() {
    window._respostaMensagemChat = null;

    const barra = document.getElementById(
        "barra-resposta-mensagem-chat"
    );

    if (barra) {
        barra.remove();
    }

    if (window._reposicionarBarraResposta) {
        window.removeEventListener(
            "resize",
            window._reposicionarBarraResposta
        );
        window.removeEventListener(
            "scroll",
            window._reposicionarBarraResposta,
            true
        );

        if (window.visualViewport) {
            window.visualViewport.removeEventListener(
                "resize",
                window._reposicionarBarraResposta
            );
            window.visualViewport.removeEventListener(
                "scroll",
                window._reposicionarBarraResposta
            );
        }
    }

    window._reposicionarBarraResposta = null;
}

function prepararRespostaMensagemChat(
    mensagemId,
    dadosMensagem
) {
    const id = String(mensagemId || "").trim();
    const dados = dadosMensagem || {};
    const remetente = String(
        dados.remetente || ""
    ).trim().toLowerCase();
    const texto = String(
        dados.texto || ""
    ).trim();

    if (!id) {
        return;
    }

    window._respostaMensagemChat = {
        id,
        remetente,
        texto
    };

    const tentarExibirPrevia = tentativas => {
        const input = document.getElementById(
            "input-nova-mensagem"
        );

        if (!input) {
            if (tentativas < 12) {
                window.setTimeout(() => {
                    tentarExibirPrevia(tentativas + 1);
                }, 50);
            }
            return;
        }

        let barra = document.getElementById(
            "barra-resposta-mensagem-chat"
        );

        if (!barra) {
            barra = document.createElement("div");
            barra.id = "barra-resposta-mensagem-chat";
            barra.style.position = "relative";
            barra.style.zIndex = "1";
            barra.style.display = "flex";
            barra.style.alignItems = "center";
            barra.style.gap = "8px";
            barra.style.flex = "0 0 100%";
            barra.style.width = "100%";
            barra.style.minHeight = "44px";
            barra.style.padding = "7px 10px";
            barra.style.margin = "0 0 2px";
            barra.style.boxSizing = "border-box";
            barra.style.border = "1px solid #3a3a3a";
            barra.style.borderLeft = "3px solid #58b7ff";
            barra.style.borderRadius = "9px";
            barra.style.background = "#1c1c1c";
            barra.style.boxShadow =
                "0 2px 8px rgba(0,0,0,.25)";
            barra.style.order = "-1";

            const conteudo = document.createElement("div");
            conteudo.id = "texto-resposta-mensagem-chat";
            conteudo.style.flex = "1";
            conteudo.style.minWidth = "0";
            conteudo.style.overflow = "hidden";
            conteudo.style.textOverflow = "ellipsis";
            conteudo.style.whiteSpace = "nowrap";
            conteudo.style.color = "#d7d9db";
            conteudo.style.fontSize = "12px";
            conteudo.style.lineHeight = "1.3";

            const fechar = document.createElement("button");
            fechar.type = "button";
            fechar.textContent = "×";
            fechar.title = "Cancelar resposta";
            fechar.setAttribute(
                "aria-label",
                "Cancelar resposta"
            );
            fechar.style.flex = "0 0 auto";
            fechar.style.width = "30px";
            fechar.style.height = "30px";
            fechar.style.border = "none";
            fechar.style.borderRadius = "7px";
            fechar.style.background = "transparent";
            fechar.style.color = "#fff";
            fechar.style.fontSize = "22px";
            fechar.style.lineHeight = "1";
            fechar.style.cursor = "pointer";
            fechar.addEventListener(
                "click",
                limparRespostaMensagemChat
            );

            barra.appendChild(conteudo);
            barra.appendChild(fechar);
        }

        const paiCompositor = input.parentElement;

        if (paiCompositor) {
            paiCompositor.style.display = "flex";
            paiCompositor.style.flexWrap = "wrap";
            paiCompositor.style.alignItems = "center";
            paiCompositor.style.alignContent = "center";
            paiCompositor.style.rowGap = "6px";

            if (barra.parentElement !== paiCompositor) {
                paiCompositor.insertBefore(
                    barra,
                    input
                );
            }
        } else if (barra.parentElement !== input.parentElement) {
            input.insertAdjacentElement(
                "beforebegin",
                barra
            );
        }

        const conteudo = document.getElementById(
            "texto-resposta-mensagem-chat"
        );

        if (conteudo) {
            conteudo.textContent = remetente
                ? `Respondendo a @${remetente}: ${texto}`
                : `Respondendo: ${texto}`;
        }

        input.focus({
            preventScroll: true
        });
    };

    tentarExibirPrevia(0);
}


async function enviarMensagemChat() {
    const input = document.getElementById(
        "input-nova-mensagem"
    );
    const container = document.getElementById(
        "chat-mensagens-container"
    );
    const meuUsername = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const texto = input
        ? String(input.value || "").trim()
        : "";
    const grupoAtivo = _salaGrupoAtiva;

    if (
        !input ||
        !texto ||
        !meuUsername
    ) {
        return;
    }

    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!banco) {
        return;
    }

    const grupoEstaAtivo = Boolean(
        grupoAtivo &&
        grupoAtivo.chatId &&
        Array.isArray(grupoAtivo.participantes)
    );

    if (!grupoEstaAtivo && !usuarioChatDestino) {
        return;
    }

    input.value = "";
    input.focus({
        preventScroll: true
    });

    try {
        const chatId = grupoEstaAtivo
            ? String(grupoAtivo.chatId)
            : gerarIdChat(
                meuUsername,
                String(
                    usuarioChatDestino
                ).trim().toLowerCase()
            );
        const destinatarioIndividual =
            String(
                usuarioChatDestino || ""
            ).trim().toLowerCase();
        const destinatariosPush = grupoEstaAtivo
            ? grupoAtivo.participantes.filter(
                usuario => String(
                    usuario || ""
                ).trim().toLowerCase() !==
                    meuUsername
            )
            : [destinatarioIndividual];
        const resposta = window._respostaMensagemChat;

        const dadosMensagem = {
            remetente: meuUsername,
            texto,
            destinatario: grupoEstaAtivo
                ? ""
                : destinatarioIndividual,
            destinatarios: grupoEstaAtivo
                ? grupoAtivo.participantes
                : [destinatarioIndividual],
            grupoId: grupoEstaAtivo
                ? chatId
                : "",
            respostaMensagemId: resposta
                ? resposta.id
                : "",
            respostaMensagemRemetente: resposta
                ? resposta.remetente
                : "",
            respostaMensagemTexto: resposta
                ? resposta.texto
                : "",
            respostaMensagem: resposta
                ? {
                    id: resposta.id,
                    remetente: resposta.remetente,
                    texto: resposta.texto
                }
                : null,
            enviadoEm:
                firebase.firestore.FieldValue.serverTimestamp(),
            lido: false,
            lidoEm: null,
            timestamp:
                firebase.firestore.FieldValue.serverTimestamp()
        };

        const mensagemCriada = await banco
            .collection("chats")
            .doc(chatId)
            .collection("mensagens")
            .add(dadosMensagem);

        const dadosChat = {
            ultimoEnvio:
                firebase.firestore.FieldValue.serverTimestamp(),
            usuarios: grupoEstaAtivo
                ? grupoAtivo.participantes
                : [
                    meuUsername,
                    destinatarioIndividual
                ]
        };

        if (grupoEstaAtivo) {
            dadosChat.tipo = "grupo";
            dadosChat.nomeGrupo = grupoAtivo.nomeGrupo;
        }

        await banco
            .collection("chats")
            .doc(chatId)
            .set(
                dadosChat,
                {
                    merge: true
                }
            );

        for (const destinatario of destinatariosPush) {
            if (!destinatario) {
                continue;
            }

            await ajustarNaoLidasChat(
                chatId,
                destinatario,
                1
            );

            enviarPushParaDestinatario(
                destinatario,
                meuUsername,
                grupoEstaAtivo
                    ? `${grupoAtivo.nomeGrupo}: ${texto}`
                    : texto,
                chatId,
                mensagemCriada.id
            );
        }

        await atualizarIndicadorAbaMensagens();
        limparRespostaMensagemChat();

        requestAnimationFrame(() => {
            input.focus({
                preventScroll: true
            });
            if (container) {
                container.scrollTop =
                    container.scrollHeight;
            }
        });
    } catch (erro) {
        console.error(
            "Erro ao enviar mensagem:",
            erro
        );
        input.focus({
            preventScroll: true
        });
    }
}




// Carrega as informações dinâmicas do membro logado diretamente no perfil
function fecharPainelUnidade() {
    const painel = document.getElementById(
        "modal-painel-unidade"
    );

    if (painel) {
        painel.remove();
    }
}

function criarIdUnidadeParaPainel(nomeUnidade) {
    return String(nomeUnidade || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function criarLinhaFrequenciaUnidade(membro, selecionado, aoMudar) {
    const linha = document.createElement("label");
    const avatar = document.createElement("img");
    const textos = document.createElement("span");
    const nome = document.createElement("strong");
    const detalhe = document.createElement("small");
    const checkbox = document.createElement("input");

    linha.style.display = "flex";
    linha.style.alignItems = "center";
    linha.style.gap = "10px";
    linha.style.padding = "9px 10px";
    linha.style.border = "1px solid #262626";
    linha.style.borderRadius = "10px";
    linha.style.background = "#121212";
    linha.style.cursor = "pointer";

    avatar.src = String(
        membro.fotoUrl ||
        window.AVATAR_USUARIO_PADRAO ||
        ""
    );
    avatar.alt = `Foto de ${membro.nome}`;
    avatar.style.width = "38px";
    avatar.style.height = "38px";
    avatar.style.flex = "0 0 38px";
    avatar.style.objectFit = "cover";
    avatar.style.borderRadius = "50%";
    avatar.style.border = "1px solid #3a3a3a";
    avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = window.AVATAR_USUARIO_PADRAO;
    };

    textos.style.display = "flex";
    textos.style.flexDirection = "column";
    textos.style.gap = "2px";
    textos.style.flex = "1";
    textos.style.minWidth = "0";

    nome.textContent = membro.nome;
    nome.style.color = "#fff";
    nome.style.fontSize = "13px";
    nome.style.overflow = "hidden";
    nome.style.textOverflow = "ellipsis";
    nome.style.whiteSpace = "nowrap";

    detalhe.textContent = `${membro.cargo || "Membro"} · @${membro.username}`;
    detalhe.style.color = "#8e8e8e";
    detalhe.style.fontSize = "10px";
    detalhe.style.overflow = "hidden";
    detalhe.style.textOverflow = "ellipsis";
    detalhe.style.whiteSpace = "nowrap";

    checkbox.type = "checkbox";
    checkbox.checked = Boolean(selecionado);
    checkbox.setAttribute(
        "data-frequencia-username",
        membro.username
    );
    checkbox.style.width = "19px";
    checkbox.style.height = "19px";
    checkbox.style.flex = "0 0 19px";
    checkbox.style.accentColor = "#20c997";
    checkbox.addEventListener(
        "change",
        () => aoMudar(membro.username, checkbox.checked)
    );

    textos.appendChild(nome);
    textos.appendChild(detalhe);
    linha.appendChild(avatar);
    linha.appendChild(textos);
    linha.appendChild(checkbox);
    return linha;
}

async function renderizarPainelSecretarioFrequencia(
    container,
    unidadeId,
    nomeUnidade,
    banco,
    usernameLogado
) {
    const secao = document.createElement("section");
    const titulo = document.createElement("h2");
    const descricao = document.createElement("p");
    const barraMes = document.createElement("div");
    const voltarMes = document.createElement("button");
    const avancarMes = document.createElement("button");
    const tituloMes = document.createElement("strong");
    const diasSemana = document.createElement("div");
    const calendario = document.createElement("div");
    const detalhe = document.createElement("div");
    const status = document.createElement("p");
    const hoje = new Date();
    const membros = [];
    const eventosPorData = new Map();
    let mesAtual = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        1
    );

    const tiposAtividade = {
        reuniao: "📌 Reunião",
        acao: "🔷 Ação",
        acampamento: "🏕️ Acampamento",
        agenda: "⏳ Agenda",
        outra_atividade: "📅 Atividade"
    };

    const nomesMeses = [
        "JANEIRO",
        "FEVEREIRO",
        "MARÇO",
        "ABRIL",
        "MAIO",
        "JUNHO",
        "JULHO",
        "AGOSTO",
        "SETEMBRO",
        "OUTUBRO",
        "NOVEMBRO",
        "DEZEMBRO"
    ];

    const nomesDias = [
        "DOM",
        "SEG",
        "TER",
        "QUA",
        "QUI",
        "SEX",
        "SÁB"
    ];

    const criarDataId = data => {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1)
            .padStart(2, "0");
        const dia = String(data.getDate())
            .padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    };

    const formatarData = dataId => {
        const partes = String(dataId || "").split("-");
        return partes.length === 3
            ? `${partes[2]}/${partes[1]}/${partes[0]}`
            : String(dataId || "");
    };

    const estiloBotaoMes = botao => {
        botao.type = "button";
        botao.style.width = "36px";
        botao.style.height = "36px";
        botao.style.border = "1px solid #3a3a3a";
        botao.style.borderRadius = "8px";
        botao.style.background = "#1c1c1c";
        botao.style.color = "#fff";
        botao.style.fontSize = "18px";
        botao.style.cursor = "pointer";
    };

    const criarBotaoStatus = (
        texto,
        valor,
        statusAtual,
        aoSelecionar
    ) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = texto;
        botao.style.minWidth = "38px";
        botao.style.padding = "7px 8px";
        botao.style.border = "1px solid #3a3a3a";
        botao.style.borderRadius = "7px";
        botao.style.background = statusAtual === valor
            ? valor === "P"
                ? "#20c997"
                : valor === "A"
                    ? "#ff4d4d"
                    : "#f0ad4e"
            : "#1c1c1c";
        botao.style.color = statusAtual === valor
            ? "#071b16"
            : "#d7d9db";
        botao.style.fontSize = "11px";
        botao.style.fontWeight = "700";
        botao.style.cursor = "pointer";
        botao.addEventListener(
            "click",
            () => aoSelecionar(valor)
        );
        return botao;
    };

    secao.id = "secao-frequencia-unidade";
    secao.style.display = "flex";
    secao.style.flexDirection = "column";
    secao.style.gap = "10px";
    secao.style.marginTop = "22px";

    titulo.textContent = "Controle de frequência";
    titulo.style.margin = "0";
    titulo.style.fontSize = "17px";

    descricao.textContent =
        `Calendário de reuniões e atividades da unidade ${nomeUnidade}.`;
    descricao.style.margin = "0";
    descricao.style.color = "#8e8e8e";
    descricao.style.fontSize = "12px";
    descricao.style.lineHeight = "1.45";

    barraMes.style.display = "flex";
    barraMes.style.alignItems = "center";
    barraMes.style.justifyContent = "space-between";
    barraMes.style.gap = "8px";
    barraMes.style.padding = "8px 0";

    estiloBotaoMes(voltarMes);
    estiloBotaoMes(avancarMes);
    voltarMes.textContent = "‹";
    avancarMes.textContent = "›";

    tituloMes.style.flex = "1";
    tituloMes.style.color = "#fff";
    tituloMes.style.fontSize = "14px";
    tituloMes.style.textAlign = "center";

    barraMes.appendChild(voltarMes);
    barraMes.appendChild(tituloMes);
    barraMes.appendChild(avancarMes);

    diasSemana.style.display = "grid";
    diasSemana.style.gridTemplateColumns =
        "repeat(7, minmax(0, 1fr))";
    diasSemana.style.gap = "3px";

    nomesDias.forEach(nomeDia => {
        const celula = document.createElement("div");
        celula.textContent = nomeDia;
        celula.style.padding = "6px 2px";
        celula.style.color = "#8e8e8e";
        celula.style.fontSize = "9px";
        celula.style.fontWeight = "700";
        celula.style.textAlign = "center";
        diasSemana.appendChild(celula);
    });

    calendario.style.display = "grid";
    calendario.style.gridTemplateColumns =
        "repeat(7, minmax(0, 1fr))";
    calendario.style.gap = "3px";
    calendario.style.padding = "3px";
    calendario.style.border = "1px solid #262626";
    calendario.style.borderRadius = "12px";
    calendario.style.background = "#0b0b0b";

    detalhe.style.display = "none";
    detalhe.style.flexDirection = "column";
    detalhe.style.gap = "10px";
    detalhe.style.marginTop = "10px";
    detalhe.style.padding = "14px";
    detalhe.style.border = "1px solid #26384a";
    detalhe.style.borderRadius = "12px";
    detalhe.style.background = "#101820";

    status.style.margin = "0";
    status.style.color = "#8e8e8e";
    status.style.fontSize = "11px";
    status.style.textAlign = "center";

    secao.appendChild(titulo);
    secao.appendChild(descricao);
    secao.appendChild(barraMes);
    secao.appendChild(diasSemana);
    secao.appendChild(calendario);
    secao.appendChild(detalhe);
    secao.appendChild(status);
    container.appendChild(secao);

    const carregarMembros = async () => {
        membros.length = 0;
        const membrosSnap = await banco
            .collection("usuarios")
            .where("unidade", "==", nomeUnidade)
            .get();

        membrosSnap.forEach(documento => {
            const dados = documento.data() || {};
            const username = String(
                dados.username || ""
            ).trim().toLowerCase();
            const tipo = String(
                dados.tipo || ""
            ).trim().toLowerCase();

            if (!username || tipo === "liderança") {
                return;
            }

            membros.push({
                username,
                nome: String(
                    dados.nomeReal || username
                ).trim(),
                cargo: String(
                    dados.cargo || "Desbravador"
                ).trim(),
                fotoUrl: String(
                    dados.fotoUrl || ""
                ).trim()
            });
        });

        membros.sort((a, b) => a.nome.localeCompare(
            b.nome,
            "pt-BR"
        ));
    };

    const carregarEventos = async () => {
        status.textContent = "Carregando eventos...";
        eventosPorData.clear();

        const [eventosClubeSnap, registrosSnap] =
            await Promise.all([
                banco
                    .collection("eventos_clube")
                    .get(),
                banco
                    .collection("frequencias_unidades")
                    .doc(unidadeId)
                    .collection("registros")
                    .get()
            ]);

        eventosClubeSnap.forEach(documento => {
            const dados = documento.data() || {};
            const data = String(
                dados.data || ""
            ).trim();

            if (!data) {
                return;
            }

            eventosPorData.set(data, {
                ...dados,
                data,
                eventoCentralId: documento.id,
                eventoCentral: true,
                eventoCentralStatus: String(
                    dados.status || "ativo"
                ).trim().toLowerCase(),
                tipoAtividade: String(
                    dados.tipoId ||
                    dados.tipo ||
                    "outra_atividade"
                ).trim(),
                tituloEvento: String(
                    dados.titulo || ""
                ).trim()
            });
        });

        registrosSnap.forEach(documento => {
            const dados = documento.data() || {};
            const data = String(
                dados.data || documento.id || ""
            ).trim();
            const eventoCentral = eventosPorData.get(data);

            if (!data || !eventoCentral) {
                return;
            }

            eventosPorData.set(data, {
                ...eventoCentral,
                ...dados,
                data,
                eventoCentral: true,
                eventoCentralId:
                    eventoCentral.eventoCentralId,
                eventoCentralStatus:
                    eventoCentral.eventoCentralStatus,
                tipoAtividade:
                    eventoCentral.tipoAtividade,
                tituloEvento:
                    eventoCentral.tituloEvento,
                frequenciaSalva: true
            });
        });

        status.textContent = "";
    };

    const abrirFichaUnidadeEvento = async (
        eventoAtual,
        dataId,
        registroAtual
    ) => {
        const eventoId = String(
            eventoAtual &&
            (
                eventoAtual.eventoCentralId ||
                eventoAtual.id ||
                dataId
            ) ||
            dataId
        ).trim();
        const fichaRef = banco
            .collection("fichas_unidades")
            .doc(unidadeId)
            .collection("eventos")
            .doc(eventoId);
        const painelFicha = document.createElement("section");
        const topo = document.createElement("div");
        const titulo = document.createElement("h3");
        const fechar = document.createElement("button");
        const identificacao = document.createElement("p");
        const resumo = document.createElement("div");
        const lista = document.createElement("div");
        const observacoes = document.createElement("textarea");
        const ocorrencias = document.createElement("textarea");
        const patrimonio = document.createElement("textarea");
        const salvar = document.createElement("button");
        const avaliacaoPorMembro = {};
        let fichaAtual = {};

        const criarOpcoes = (campo, opcoes, valor) => {
            const select = document.createElement("select");
            select.dataset.campo = campo;
            opcoes.forEach(opcao => {
                const option = document.createElement("option");
                option.value = opcao.value;
                option.textContent = opcao.label;
                select.appendChild(option);
            });
            select.value = opcoes.some(
                opcao => opcao.value === valor
            )
                ? valor
                : opcoes[0].value;
            select.style.padding = "7px";
            select.style.border = "1px solid #334351";
            select.style.borderRadius = "7px";
            select.style.background = "#0d1115";
            select.style.color = "#fff";
            select.style.fontSize = "10px";
            select.style.minWidth = "92px";
            return select;
        };

        const prepararCampoTexto = (
            campo,
            placeholder,
            valor = ""
        ) => {
            campo.value = String(valor || "");
            campo.placeholder = placeholder;
            campo.rows = 3;
            campo.style.width = "100%";
            campo.style.boxSizing = "border-box";
            campo.style.padding = "9px";
            campo.style.border = "1px solid #334351";
            campo.style.borderRadius = "8px";
            campo.style.background = "#0d1115";
            campo.style.color = "#fff";
            campo.style.fontSize = "11px";
            campo.style.resize = "vertical";
            campo.style.fontFamily = "inherit";
        };

        try {
            const fichaSnap = await fichaRef.get();
            fichaAtual = fichaSnap.exists
                ? fichaSnap.data() || {}
                : {};
        } catch (erro) {
            console.error(
                "Erro ao carregar ficha da unidade:",
                erro
            );
            window.alert(
                "Não foi possível carregar a ficha desta unidade."
            );
            return;
        }

        const avaliacoesSalvas =
            fichaAtual.avaliacoesPorMembro || {};
        membros.forEach(membro => {
            const salva = avaliacoesSalvas[membro.username] || {};
            avaliacaoPorMembro[membro.username] = {
                uniforme: salva.uniforme || "nao_avaliado",
                biblia: salva.biblia || "nao_avaliado",
                licao: salva.licao || "nao_avaliado",
                tarefa: salva.tarefa || "nao_avaliado",
                mensalidade: salva.mensalidade || "nao_avaliado"
            };
        });

        painelFicha.style.display = "flex";
        painelFicha.style.flexDirection = "column";
        painelFicha.style.gap = "10px";
        painelFicha.style.marginTop = "12px";
        painelFicha.style.padding = "14px";
        painelFicha.style.border = "1px solid #20c997";
        painelFicha.style.borderRadius = "12px";
        painelFicha.style.background = "#101820";

        topo.style.display = "flex";
        topo.style.alignItems = "center";
        topo.style.gap = "8px";

        titulo.textContent = "Ficha operacional da unidade";
        titulo.style.flex = "1";
        titulo.style.margin = "0";
        titulo.style.color = "#fff";
        titulo.style.fontSize = "15px";

        fechar.type = "button";
        fechar.textContent = "×";
        fechar.style.width = "32px";
        fechar.style.height = "32px";
        fechar.style.border = "1px solid #52606d";
        fechar.style.borderRadius = "8px";
        fechar.style.background = "#1b232b";
        fechar.style.color = "#fff";
        fechar.style.fontSize = "20px";
        fechar.style.cursor = "pointer";
        fechar.addEventListener(
            "click",
            () => painelFicha.remove()
        );

        topo.appendChild(titulo);
        topo.appendChild(fechar);
        painelFicha.appendChild(topo);

        identificacao.textContent =
            `${eventoAtual.titulo || "Evento"} · ${formatarData(dataId)}`;
        identificacao.style.margin = "0";
        identificacao.style.color = "#a8a8a8";
        identificacao.style.fontSize = "11px";
        painelFicha.appendChild(identificacao);

        resumo.style.display = "flex";
        resumo.style.flexWrap = "wrap";
        resumo.style.gap = "6px";
        resumo.style.padding = "9px";
        resumo.style.border = "1px solid #26384a";
        resumo.style.borderRadius = "9px";
        resumo.style.background = "#0d1115";
        resumo.innerHTML = `
            <span style="color:#65e6bf;font-size:11px">
                Presentes: ${Array.isArray(registroAtual && registroAtual.presentes)
                    ? registroAtual.presentes.length
                    : 0}
            </span>
            <span style="color:#ffb45c;font-size:11px">
                Ausências: ${(Array.isArray(registroAtual && registroAtual.faltas)
                    ? registroAtual.faltas.length
                    : 0) + (Array.isArray(registroAtual && registroAtual.justificados)
                    ? registroAtual.justificados.length
                    : 0)}
            </span>
            <span style="color:#58b7ff;font-size:11px">
                Justificadas: ${Array.isArray(registroAtual && registroAtual.justificados)
                    ? registroAtual.justificados.length
                    : 0}
            </span>
        `;
        painelFicha.appendChild(resumo);

        const legenda = document.createElement("p");
        legenda.textContent =
            "Avalie os itens da unidade somente quando se aplicarem ao evento.";
        legenda.style.margin = "0";
        legenda.style.color = "#8e9aa5";
        legenda.style.fontSize = "10px";
        painelFicha.appendChild(legenda);

        lista.style.display = "flex";
        lista.style.flexDirection = "column";
        lista.style.gap = "6px";
        lista.style.maxHeight = "min(52vh, 520px)";
        lista.style.overflowY = "auto";

        const opcoesUniforme = [
            { value: "nao_avaliado", label: "Não avaliado" },
            { value: "completo", label: "Completo" },
            { value: "incompleto", label: "Incompleto" },
            { value: "sem_uniforme", label: "Sem uniforme" }
        ];
        const opcoesSimNao = [
            { value: "nao_avaliado", label: "Não avaliado" },
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" }
        ];
        const opcoesMensalidade = [
            { value: "nao_avaliado", label: "Não avaliado" },
            { value: "pago", label: "Pago" },
            { value: "parcial", label: "Parcial" },
            { value: "pendente", label: "Pendente" },
            { value: "isento", label: "Isento" }
        ];

        membros.forEach(membro => {
            const linha = document.createElement("article");
            const cabecalho = document.createElement("div");
            const avatar = document.createElement("img");
            const nome = document.createElement("strong");
            const controles = document.createElement("div");

            linha.style.display = "flex";
            linha.style.flexDirection = "column";
            linha.style.gap = "7px";
            linha.style.padding = "9px";
            linha.style.border = "1px solid #26384a";
            linha.style.borderRadius = "9px";
            linha.style.background = "#0d1115";

            cabecalho.style.display = "flex";
            cabecalho.style.alignItems = "center";
            cabecalho.style.gap = "8px";

            avatar.src = membro.fotoUrl ||
                window.AVATAR_USUARIO_PADRAO;
            avatar.alt = `Foto de ${membro.nome}`;
            avatar.style.width = "32px";
            avatar.style.height = "32px";
            avatar.style.objectFit = "cover";
            avatar.style.borderRadius = "50%";
            avatar.onerror = () => {
                avatar.onerror = null;
                avatar.src = window.AVATAR_USUARIO_PADRAO;
            };

            nome.textContent = membro.nome;
            nome.style.color = "#fff";
            nome.style.fontSize = "12px";

            controles.style.display = "grid";
            controles.style.gridTemplateColumns =
                "repeat(auto-fit, minmax(100px, 1fr))";
            controles.style.gap = "6px";

            const campos = [
                ["uniforme", "Uniforme", opcoesUniforme],
                ["biblia", "Bíblia", opcoesSimNao],
                ["licao", "Lição", opcoesSimNao],
                ["tarefa", "Tarefa", opcoesSimNao],
                ["mensalidade", "Mensalidade", opcoesMensalidade]
            ];

            campos.forEach(([campo, rotulo, opcoes]) => {
                const grupo = document.createElement("label");
                const texto = document.createElement("span");
                const select = criarOpcoes(
                    campo,
                    opcoes,
                    avaliacaoPorMembro[membro.username][campo]
                );

                texto.textContent = rotulo;
                texto.style.display = "block";
                texto.style.marginBottom = "3px";
                texto.style.color = "#8e9aa5";
                texto.style.fontSize = "9px";
                grupo.appendChild(texto);
                grupo.appendChild(select);
                controles.appendChild(grupo);

                select.addEventListener(
                    "change",
                    () => {
                        avaliacaoPorMembro[membro.username][campo] =
                            select.value;
                    }
                );
            });

            cabecalho.appendChild(avatar);
            cabecalho.appendChild(nome);
            linha.appendChild(cabecalho);
            linha.appendChild(controles);
            lista.appendChild(linha);
        });

        painelFicha.appendChild(lista);

        prepararCampoTexto(
            observacoes,
            "Observações da unidade...",
            fichaAtual.observacoes
        );
        prepararCampoTexto(
            ocorrencias,
            "Ocorrências e justificativas administrativas...",
            fichaAtual.ocorrencias
        );
        prepararCampoTexto(
            patrimonio,
            "Materiais, equipamentos e patrimônio...",
            fichaAtual.patrimonio
        );
        painelFicha.appendChild(observacoes);
        painelFicha.appendChild(ocorrencias);
        painelFicha.appendChild(patrimonio);

        const exportarPdf = document.createElement("button");
        exportarPdf.type = "button";
        exportarPdf.textContent = "Baixar ficha em PDF";
        exportarPdf.style.width = "100%";
        exportarPdf.style.padding = "11px";
        exportarPdf.style.border = "1px solid #58b7ff";
        exportarPdf.style.borderRadius = "8px";
        exportarPdf.style.background = "#10283a";
        exportarPdf.style.color = "#b9e5ff";
        exportarPdf.style.fontWeight = "700";
        exportarPdf.style.cursor = "pointer";

        exportarPdf.addEventListener(
            "click",
            async () => {
                const modalPdf = document.createElement("div");
                const cabecalhoPdf = document.createElement("div");
                const tituloPdf = document.createElement("strong");
                const acoesPdf = document.createElement("div");
                const statusPdf = document.createElement("span");
                const imprimirPdf = document.createElement("button");
                const fecharPdf = document.createElement("button");
                const framePdf = document.createElement("iframe");
                const janelaPdf = {
                    get document() {
                        return framePdf.contentDocument ||
                            framePdf.contentWindow.document;
                    },
                    focus() {
                        if (framePdf.contentWindow) {
                            framePdf.contentWindow.focus();
                        }
                    }
                };


                const overflowBodyAnterior = document.body.style.overflow;
                document.body.style.overflow = "hidden";

                modalPdf.style.position = "fixed";
                modalPdf.style.inset = "0";
                modalPdf.style.zIndex = "2147483647";
                modalPdf.style.display = "flex";
                modalPdf.style.flexDirection = "column";
                modalPdf.style.width = "100vw";
                modalPdf.style.height = "100dvh";
                modalPdf.style.overflow = "hidden";
                modalPdf.style.background = "#000";
                modalPdf.style.padding = "12px";
                modalPdf.style.boxSizing = "border-box";
                modalPdf.style.pointerEvents = "auto";

                cabecalhoPdf.style.display = "flex";
                cabecalhoPdf.style.alignItems = "center";
                cabecalhoPdf.style.gap = "8px";
                cabecalhoPdf.style.padding = "10px 12px";
                cabecalhoPdf.style.border = "1px solid #334351";
                cabecalhoPdf.style.borderBottom = "none";
                cabecalhoPdf.style.borderRadius = "10px 10px 0 0";
                cabecalhoPdf.style.background = "#101820";
                cabecalhoPdf.style.color = "#fff";

                tituloPdf.textContent = "Pré-visualização da ficha operacional";
                tituloPdf.style.flex = "1";
                tituloPdf.style.fontSize = "13px";

                statusPdf.textContent = "Preparando...";
                statusPdf.style.color = "#9fb0bd";
                statusPdf.style.fontSize = "10px";

                acoesPdf.style.display = "flex";
                acoesPdf.style.alignItems = "center";
                acoesPdf.style.gap = "6px";

                imprimirPdf.type = "button";
                imprimirPdf.textContent = "Imprimir / salvar PDF";
                imprimirPdf.style.padding = "8px 10px";
                imprimirPdf.style.border = "1px solid #58b7ff";
                imprimirPdf.style.borderRadius = "7px";
                imprimirPdf.style.background = "#10283a";
                imprimirPdf.style.color = "#b9e5ff";
                imprimirPdf.style.fontWeight = "700";
                imprimirPdf.style.cursor = "pointer";
                imprimirPdf.disabled = true;

                fecharPdf.type = "button";
                fecharPdf.textContent = "Fechar prévia";
                fecharPdf.style.padding = "8px 10px";
                fecharPdf.style.border = "1px solid #52606d";
                fecharPdf.style.borderRadius = "7px";
                fecharPdf.style.background = "#1b232b";
                fecharPdf.style.color = "#fff";
                fecharPdf.style.cursor = "pointer";

                fecharPdf.addEventListener(
                    "click",
                    () => {
                        document.body.style.overflow =
                            overflowBodyAnterior;
                        modalPdf.remove();
                    }
                );

                imprimirPdf.addEventListener(
                    "click",
                    () => {
                        if (framePdf.contentWindow) {
                            framePdf.contentWindow.focus();
                            framePdf.contentWindow.print();
                        }
                    }
                );

                acoesPdf.appendChild(statusPdf);
                acoesPdf.appendChild(imprimirPdf);
                acoesPdf.appendChild(fecharPdf);
                cabecalhoPdf.appendChild(tituloPdf);
                cabecalhoPdf.appendChild(acoesPdf);

                framePdf.title = "Prévia da ficha operacional";
                framePdf.style.flex = "1";
                framePdf.style.width = "100%";
                framePdf.style.minHeight = "0";
                framePdf.style.border = "1px solid #334351";
                framePdf.style.borderRadius = "0 0 10px 10px";
                framePdf.style.background = "#fff";

                modalPdf.appendChild(cabecalhoPdf);
                modalPdf.appendChild(framePdf);
                document.body.appendChild(modalPdf);

                exportarPdf.disabled = true;
                exportarPdf.textContent = "Preparando PDF...";
                janelaPdf.document.open();
                janelaPdf.document.write(`
                    <!doctype html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <title>Preparando ficha em PDF</title>
                    </head>
                    <body style="font-family:Arial,sans-serif;padding:32px;color:#173b57">
                        Preparando a ficha operacional...
                    </body>
                    </html>
                `);
                janelaPdf.document.close();

                try {
                    const configuracaoSnap = await banco
                        .collection("configuracoes")
                        .doc("geral")
                        .get();
                    const configuracao = configuracaoSnap.exists
                        ? configuracaoSnap.data() || {}
                        : {};
                    const logoUrl = String(
                        configuracao.logoAppUrl ||
                        configuracao.logoUrl ||
                        ""
                    ).trim();
                    const nomeClube = String(
                        configuracao.nomeClube ||
                        "Clube Guardiões"
                    ).trim();

                    const usernameAssinaturaPdf = String(
                        usernameLogado ||
                        localStorage.getItem("usernameLogado") ||
                        ""
                    ).trim().toLowerCase();
                    let assinaturaPngUrl = "";
                    let nomeAssinaturaPdf = usernameAssinaturaPdf;
                    let cargoAssinaturaPdf = "Responsável";

                    if (usernameAssinaturaPdf) {

                        const assinaturaSnap = await banco
                            .collection("assinaturas_usuarios")
                            .doc(usernameAssinaturaPdf)
                            .get();

                        if (assinaturaSnap.exists) {
                            const dadosAssinatura =
                                assinaturaSnap.data() || {};
                            assinaturaPngUrl = String(
                                dadosAssinatura.pngUrl ||
                                dadosAssinatura.url ||
                                ""
                            ).trim();
                            nomeAssinaturaPdf = String(
                                dadosAssinatura.nomeAssinatura ||
                                dadosAssinatura.nomeUsuario ||
                                usernameAssinaturaPdf
                            ).trim();
                            cargoAssinaturaPdf = String(
                                dadosAssinatura.cargoAssinatura ||
                                "Responsável"
                            ).trim();

                        }
                    }

                    const escaparHtmlPdf = valor => String(
                        valor === null || valor === undefined
                            ? ""
                            : valor
                    )
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                    const rotulos = {
                        uniforme: {
                            nao_avaliado: "Não avaliado",
                            completo: "Completo",
                            incompleto: "Incompleto",
                            sem_uniforme: "Sem uniforme"
                        },
                        simNao: {
                            nao_avaliado: "Não avaliado",
                            sim: "Sim",
                            nao: "Não"
                        },
                        mensalidade: {
                            nao_avaliado: "Não avaliado",
                            pago: "Pago",
                            parcial: "Parcial",
                            pendente: "Pendente",
                            isento: "Isento"
                        }
                    };
                    const statusPorMembro =
                        registroAtual &&
                        registroAtual.statusPorMembro ||
                        {};
                    const avaliacoes = avaliacaoPorMembro || {};
                    const membrosHtml = membros.map(membro => {
                        const username = String(
                            membro.username || ""
                        ).trim().toLowerCase();
                        const avaliacao = avaliacoes[username] || {};
                        const status = String(
                            statusPorMembro[username] || ""
                        ).toUpperCase();
                        const presenca = status === "P"
                            ? "Presente"
                            : status === "J"
                                ? "Justificado"
                                : status === "A"
                                    ? "Ausente"
                                    : "Não registrado";
                        return `
                            <tr>
                                <td>${escaparHtmlPdf(membro.nome || username)}</td>
                                <td>${escaparHtmlPdf(presenca)}</td>
                                <td>${escaparHtmlPdf(rotulos.uniforme[avaliacao.uniforme] || "Não avaliado")}</td>
                                <td>${escaparHtmlPdf(rotulos.simNao[avaliacao.biblia] || "Não avaliado")}</td>
                                <td>${escaparHtmlPdf(rotulos.simNao[avaliacao.licao] || "Não avaliado")}</td>
                                <td>${escaparHtmlPdf(rotulos.simNao[avaliacao.tarefa] || "Não avaliado")}</td>
                                <td>${escaparHtmlPdf(rotulos.mensalidade[avaliacao.mensalidade] || "Não avaliado")}</td>
                            </tr>
                        `;
                    }).join("");
                    const logoHtml = logoUrl
                        ? `<img class="logo" src="${escaparHtmlPdf(logoUrl)}" alt="Logo do clube">`
                        : "";
                    const assinaturaDigitalHtml = assinaturaPngUrl
                        ? `<div class="assinatura-digital">
                               <span>Assinatura digital aprovada</span>
                               <img src="${escaparHtmlPdf(assinaturaPngUrl)}" alt="Assinatura digital">
                           </div>`
                        : `<div class="assinatura-digital assinatura-ausente">
                               Assinatura digital não cadastrada
                           </div>`;
                    const frequencia = registroAtual || {};
                    const presentes = Array.isArray(frequencia.presentes)
                        ? frequencia.presentes.length
                        : 0;
                    const faltas = Array.isArray(frequencia.faltas)
                        ? frequencia.faltas.length
                        : 0;
                    const justificados = Array.isArray(
                        frequencia.justificados
                    )
                        ? frequencia.justificados.length
                        : 0;

                    janelaPdf.document.open();
                    janelaPdf.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha operacional - ${escaparHtmlPdf(nomeUnidade)}</title>
<style>
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #17202a; font-family: Arial, sans-serif; font-size: 10px; }
.cabecalho { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #173b57; padding-bottom: 12px; margin-bottom: 14px; }
.logo { width: 68px; height: 68px; object-fit: contain; }
h1 { margin: 0; font-size: 18px; color: #173b57; }
h2 { margin: 3px 0 0; font-size: 13px; color: #405465; font-weight: 600; }
h3 { margin: 18px 0 7px; font-size: 12px; color: #173b57; border-bottom: 1px solid #c5d1da; padding-bottom: 4px; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; background: #eef5f9; padding: 9px; border-radius: 6px; }
.meta strong { color: #405465; }
.indicadores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 9px; }
.indicador { border: 1px solid #c5d1da; padding: 7px; border-radius: 6px; text-align: center; }
.indicador strong { display: block; font-size: 15px; color: #173b57; }
.indicador span { color: #52606d; }
table { width: 100%; border-collapse: collapse; margin-top: 7px; font-size: 8px; }
th { background: #173b57; color: #fff; padding: 6px 4px; text-align: left; }
td { border: 1px solid #c5d1da; padding: 5px 4px; vertical-align: top; }
tr:nth-child(even) { background: #f5f8fa; }
.texto { min-height: 42px; white-space: pre-wrap; border: 1px solid #c5d1da; padding: 8px; border-radius: 5px; }
.assinaturas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; align-items: end; margin-top: 30px; page-break-inside: avoid; }
.bloco-assinatura { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end; min-width: 0; min-height: 142px; text-align: center; }
.assinatura-digital { display: flex; align-items: center; justify-content: flex-end; height: 78px; margin: 0; color: #52606d; font-size: 8px; }
.assinatura-digital img { display: block; width: auto; max-width: 100%; height: 68px; max-height: 68px; object-fit: contain; margin: 0 auto; }
.assinatura-ausente { justify-content: center; border: 1px dashed #c5d1da; padding: 8px; }
.linha-assinatura { width: 100%; height: 1px; margin-top: 4px; border-top: 1px solid #17202a; }
.nome-assinatura { margin-top: 7px; color: #17202a; font-size: 10px; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
.cargo-assinatura { margin-top: 3px; color: #52606d; font-size: 9px; line-height: 1.25; overflow-wrap: anywhere; }
.rodape { margin-top: 18px; color: #687782; font-size: 8px; text-align: center; }
@media print { .nao-imprimir { display: none; } }
</style>
</head>
<body>
<header class="cabecalho">
    ${logoHtml}
    <div>
        <h1>${escaparHtmlPdf(nomeClube)}</h1>
        <h2>Ficha operacional da unidade</h2>
    </div>
</header>
<section class="meta">
    <div><strong>Unidade:</strong> ${escaparHtmlPdf(nomeUnidade)}</div>
    <div><strong>Evento:</strong> ${escaparHtmlPdf(eventoAtual.titulo || "Evento")}</div>
    <div><strong>Data:</strong> ${escaparHtmlPdf(formatarData(dataId))}</div>
    <div><strong>Tipo:</strong> ${escaparHtmlPdf(eventoAtual.tipo || eventoAtual.tipoAtividade || "Atividade")}</div>
</section>
<section class="indicadores">
    <div class="indicador"><strong>${presentes}</strong><span>Presentes</span></div>
    <div class="indicador"><strong>${faltas + justificados}</strong><span>Ausências totais</span></div>
    <div class="indicador"><strong>${justificados}</strong><span>Justificados</span></div>
</section>
<h3>Avaliação dos participantes</h3>
<table>
<thead><tr><th>Participante</th><th>Frequência</th><th>Uniforme</th><th>Bíblia</th><th>Lição</th><th>Tarefa</th><th>Mensalidade</th></tr></thead>
<tbody>${membrosHtml || "<tr><td colspan=\"7\">Nenhum participante encontrado.</td></tr>"}</tbody>
</table>
<h3>Observações da unidade</h3>
<div class="texto">${escaparHtmlPdf(observacoes.value.trim() || "Nenhuma observação registrada.")}</div>
<h3>Ocorrências e justificativas administrativas</h3>
<div class="texto">${escaparHtmlPdf(ocorrencias.value.trim() || "Nenhuma ocorrência registrada.")}</div>
<h3>Patrimônio e materiais</h3>
<div class="texto">${escaparHtmlPdf(patrimonio.value.trim() || "Nenhuma informação patrimonial registrada.")}</div>
<div class="assinaturas">
    <div class="bloco-assinatura">
        ${assinaturaDigitalHtml}
        <div class="linha-assinatura"></div>
        <div class="nome-assinatura">${escaparHtmlPdf(nomeAssinaturaPdf || "Nome não informado")}</div>
        <div class="cargo-assinatura">${escaparHtmlPdf(cargoAssinaturaPdf || "Cargo não informado")}</div>
    </div>
    <div class="bloco-assinatura">
        <div class="assinatura-digital assinatura-ausente">Assinatura física</div>
        <div class="linha-assinatura"></div>
        <div class="nome-assinatura">Responsável pela Unidade</div>
        <div class="cargo-assinatura">Assinatura física</div>
    </div>
</div>
<div class="rodape">Documento gerado pelo Clube Guardiões · ${escaparHtmlPdf(new Date().toLocaleString("pt-BR"))}</div>
</body>
</html>`);
                    janelaPdf.document.close();
                    statusPdf.textContent = "Prévia pronta";
                    imprimirPdf.disabled = false;

                } catch (erro) {
                    console.error(
                        "Erro ao exportar ficha em PDF:",
                        erro
                    );
                    window.alert(
                        erro.message ||
                        "Não foi possível preparar a ficha em PDF."
                    );
                } finally {
                    exportarPdf.disabled = false;
                    exportarPdf.textContent = "Baixar ficha em PDF";
                }
            }
        );

        salvar.type = "button";
        salvar.textContent = "Salvar ficha da unidade";
        salvar.style.width = "100%";
        salvar.style.padding = "11px";
        salvar.style.border = "none";
        salvar.style.borderRadius = "8px";
        salvar.style.background = "#20c997";
        salvar.style.color = "#071b16";
        salvar.style.fontWeight = "700";
        salvar.style.cursor = "pointer";
        salvar.addEventListener(
            "click",
            async () => {
                salvar.disabled = true;
                salvar.textContent = "Salvando...";
                try {
                    await fichaRef.set({
                        ...fichaAtual,
                        eventoId,
                        data: dataId,
                        unidadeId,
                        unidade: nomeUnidade,
                        tipoEvento:
                            eventoAtual.tipo ||
                            eventoAtual.tipoAtividade ||
                            "",
                        tituloEvento:
                            eventoAtual.titulo ||
                            "",
                        statusPorMembro:
                            registroAtual.statusPorMembro ||
                            {},
                        justificativasPorMembro:
                            registroAtual.justificativasPorMembro ||
                            {},
                        presentes:
                            registroAtual.presentes ||
                            [],
                        faltas:
                            registroAtual.faltas ||
                            [],
                        justificados:
                            registroAtual.justificados ||
                            [],
                        avaliacoesPorMembro: avaliacaoPorMembro,
                        observacoes: observacoes.value.trim(),
                        ocorrencias: ocorrencias.value.trim(),
                        patrimonio: patrimonio.value.trim(),
                        atualizadoPor: usernameLogado,
                        atualizadoEm:
                            firebase.firestore.FieldValue.serverTimestamp()
                    }, {
                        merge: true
                    });
                    window.alert(
                        "Ficha da unidade salva com sucesso."
                    );
                    painelFicha.remove();
                } catch (erro) {
                    console.error(
                        "Erro ao salvar ficha da unidade:",
                        erro
                    );
                    window.alert(
                        "Não foi possível salvar a ficha da unidade. Verifique as regras do Firestore."
                    );
                } finally {
                    salvar.disabled = false;
                    salvar.textContent =
                        "Salvar ficha da unidade";
                }
            }
        );
        painelFicha.appendChild(exportarPdf);
        painelFicha.appendChild(salvar);
        detalhe.appendChild(painelFicha);
        painelFicha.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    };

    const abrirChamada = (dataId, registro) => {
        detalhe.innerHTML = "";
        detalhe.style.display = "flex";

        const topo = document.createElement("div");
        const voltar = document.createElement("button");
        const tituloDetalhe = document.createElement("strong");
        const seletorTodos = document.createElement("button");
        const lista = document.createElement("div");
        const salvar = document.createElement("button");
        const editar = document.createElement("button");
        const tipo = document.createElement("select");
        const estados = {};
        const justificativas = {};
        let modoEdicaoChamada = !registro;

        topo.style.display = "flex";
        topo.style.alignItems = "center";
        topo.style.gap = "8px";

        voltar.type = "button";
        voltar.textContent = "‹ Voltar";
        voltar.style.border = "none";
        voltar.style.background = "transparent";
        voltar.style.color = "#d7d9db";
        voltar.style.cursor = "pointer";
        voltar.addEventListener(
            "click",
            () => {
                detalhe.style.display = "none";
                detalhe.innerHTML = "";
            }
        );

        tituloDetalhe.textContent =
            `Frequência — ${formatarData(dataId)}`;
        tituloDetalhe.style.flex = "1";
        tituloDetalhe.style.color = "#fff";
        tituloDetalhe.style.fontSize = "14px";
        tituloDetalhe.style.textAlign = "center";

        topo.appendChild(voltar);
        topo.appendChild(tituloDetalhe);
        detalhe.appendChild(topo);

        tipo.innerHTML = `
            <option value="reuniao">📌 Reunião</option>
            <option value="acao">🔷 Ação</option>
            <option value="acampamento">🏕️ Acampamento</option>
            <option value="agenda">⏳ Agenda</option>
            <option value="outra_atividade">📅 Outra atividade</option>
        `;
        tipo.value = registro && registro.tipoAtividade
            ? registro.tipoAtividade
            : "reuniao";
        tipo.style.width = "100%";
        tipo.style.padding = "9px";
        tipo.style.border = "1px solid #3a3a3a";
        tipo.style.borderRadius = "8px";
        tipo.style.background = "#1c1c1c";
        tipo.style.color = "#fff";
        detalhe.appendChild(tipo);

        const estadosSalvos = registro &&
            registro.statusPorMembro ||
            {};
        const justificativasSalvas = registro &&
            registro.justificativasPorMembro ||
            {};
        const presentesAntigos = new Set(
            Array.isArray(registro && registro.presentes)
                ? registro.presentes
                : []
        );
        const faltasAntigas = new Set(
            Array.isArray(registro && registro.faltas)
                ? registro.faltas
                : []
        );
        const justificadosAntigos = new Set(
            Array.isArray(registro && registro.justificados)
                ? registro.justificados
                : []
        );

        membros.forEach(membro => {
            estados[membro.username] =
                estadosSalvos[membro.username] ||
                (presentesAntigos.has(membro.username)
                    ? "P"
                    : faltasAntigas.has(membro.username)
                        ? "A"
                        : justificadosAntigos.has(membro.username)
                            ? "J"
                            : "");
            justificativas[membro.username] = String(
                justificativasSalvas[membro.username] ||
                ""
            ).trim();
        });


        seletorTodos.type = "button";
        seletorTodos.textContent =
            "Selecionar todos como presentes";
        seletorTodos.style.width = "100%";
        seletorTodos.style.padding = "9px";
        seletorTodos.style.border = "1px solid #20c997";
        seletorTodos.style.borderRadius = "8px";
        seletorTodos.style.background = "transparent";
        seletorTodos.style.color = "#65e6bf";
        seletorTodos.style.fontSize = "11px";
        seletorTodos.style.cursor = "pointer";
        seletorTodos.addEventListener(
            "click",
            () => {
                membros.forEach(membro => {
                    estados[membro.username] = "P";
                });
                renderizarLista();
            }
        );
        detalhe.appendChild(seletorTodos);

        lista.style.display = "flex";
        lista.style.flexDirection = "column";
        lista.style.gap = "7px";
        lista.style.maxHeight = "min(52vh, 480px)";
        lista.style.overflowY = "auto";

        const renderizarLista = () => {
            lista.innerHTML = "";

            membros.forEach(membro => {
                const linha = document.createElement("div");
                const avatar = document.createElement("img");
                const textos = document.createElement("div");
                const nome = document.createElement("strong");
                const cargo = document.createElement("small");
                const colunaStatus = document.createElement("div");
                const botoes = document.createElement("div");
                const justificativa = document.createElement("textarea");
                const estadoAtual = estados[membro.username] || "";

                linha.style.display = "flex";
                linha.style.alignItems = "center";
                linha.style.gap = "8px";
                linha.style.padding = "8px";
                linha.style.border = "1px solid #26384a";
                linha.style.borderRadius = "9px";
                linha.style.background = "#121212";

                avatar.src = membro.fotoUrl ||
                    window.AVATAR_USUARIO_PADRAO;
                avatar.alt = `Foto de ${membro.nome}`;
                avatar.style.width = "36px";
                avatar.style.height = "36px";
                avatar.style.flex = "0 0 36px";
                avatar.style.objectFit = "cover";
                avatar.style.borderRadius = "50%";
                avatar.onerror = () => {
                    avatar.onerror = null;
                    avatar.src =
                        window.AVATAR_USUARIO_PADRAO;
                };

                textos.style.display = "flex";
                textos.style.flexDirection = "column";
                textos.style.gap = "2px";
                textos.style.flex = "1";
                textos.style.minWidth = "0";

                nome.textContent = membro.nome;
                nome.style.color = "#fff";
                nome.style.fontSize = "12px";
                nome.style.overflow = "hidden";
                nome.style.textOverflow = "ellipsis";
                nome.style.whiteSpace = "nowrap";

                cargo.textContent =
                    `${membro.cargo} · ${estadoAtual || "Não marcado"}`;
                cargo.style.color = "#8e8e8e";
                cargo.style.fontSize = "10px";

                colunaStatus.style.display = "flex";
                colunaStatus.style.flexDirection = "column";
                colunaStatus.style.alignItems = "stretch";
                colunaStatus.style.gap = "5px";
                colunaStatus.style.flex = "0 0 124px";
                colunaStatus.style.minWidth = "0";

                botoes.style.display = "flex";
                botoes.style.justifyContent = "flex-end";
                botoes.style.gap = "4px";

                [
                    ["P", "P"],
                    ["A", "A"],
                    ["J", "J"]
                ].forEach(([texto, valor]) => {
                    botoes.appendChild(
                        criarBotaoStatus(
                            texto,
                            valor,
                            estadoAtual,
                            novoEstado => {
                                estados[membro.username] =
                                    novoEstado;

                                if (novoEstado !== "J") {
                                    justificativas[membro.username] = "";
                                }

                                renderizarLista();
                            }
                        )
                    );
                });

                textos.appendChild(nome);
                textos.appendChild(cargo);
                linha.appendChild(avatar);
                linha.appendChild(textos);
                colunaStatus.appendChild(botoes);

                if (estadoAtual === "J") {
                    justificativa.value =
                        justificativas[membro.username] || "";
                    justificativa.placeholder =
                        "Digite a justificativa...";
                    justificativa.rows = 2;
                    justificativa.maxLength = 300;
                    justificativa.setAttribute(
                        "aria-label",
                        `Justificativa de ${membro.nome}`
                    );
                    justificativa.dataset.usernameJustificativa =
                        membro.username;
                    justificativa.style.width = "100%";
                    justificativa.style.boxSizing = "border-box";
                    justificativa.style.padding = "6px 7px";
                    justificativa.style.border = "1px solid #f0ad4e";
                    justificativa.style.borderRadius = "7px";
                    justificativa.style.background = "#1c1c1c";
                    justificativa.style.color = "#fff";
                    justificativa.style.fontSize = "10px";
                    justificativa.style.lineHeight = "1.3";
                    justificativa.style.resize = "vertical";
                    justificativa.addEventListener(
                        "input",
                        () => {
                            justificativas[membro.username] =
                                justificativa.value;
                        }
                    );
                    colunaStatus.appendChild(justificativa);
                }

                linha.appendChild(colunaStatus);
                lista.appendChild(linha);
            });
        };


        detalhe.appendChild(lista);

        salvar.type = "button";
        salvar.textContent = "Salvar frequência";
        salvar.style.width = "100%";
        salvar.style.padding = "11px";
        salvar.style.border = "none";
        salvar.style.borderRadius = "9px";
        salvar.style.background = "#20c997";
        salvar.style.color = "#071b16";
        salvar.style.fontWeight = "700";
        salvar.style.cursor = "pointer";
        salvar.addEventListener(
            "click",
            async () => {
                const eventoSelecionado =
                    eventosPorData.get(dataId) || {};
                const statusEvento = String(
                    eventoSelecionado.eventoCentralStatus ||
                    eventoSelecionado.status ||
                    "ativo"
                ).trim().toLowerCase();
                const existeEventoCentralAtivo =
                    eventoSelecionado.eventoCentral === true &&
                    statusEvento !== "cancelado";

                if (!existeEventoCentralAtivo) {
                    window.alert(
                        "Não é possível salvar a frequência porque não existe um evento central ativo cadastrado para esta data."
                    );
                    return;
                }

                const faltando = membros.some(membro => {
                    return !estados[membro.username];
                });

                if (faltando) {
                    window.alert(
                        "Marque P, A ou J para todos os participantes antes de salvar."
                    );
                    return;
                }

                salvar.disabled = true;
                salvar.textContent = "Salvando...";

                try {
                    const presentes = membros
                        .filter(membro => estados[membro.username] === "P")
                        .map(membro => membro.username);
                    const faltas = membros
                        .filter(membro => estados[membro.username] === "A")
                        .map(membro => membro.username);
                    const justificados = membros
                        .filter(membro => estados[membro.username] === "J")
                        .map(membro => membro.username);
                    const justificativasPorMembro = {};
                    const camposJustificativa =
                        lista.querySelectorAll(
                            "textarea[data-username-justificativa]"
                        );

                    camposJustificativa.forEach(campo => {
                        const username = String(
                            campo.dataset.usernameJustificativa ||
                            ""
                        ).trim().toLowerCase();

                        if (username) {
                            justificativasPorMembro[username] =
                                String(campo.value || "").trim();
                        }
                    });

                    justificados.forEach(username => {
                        if (
                            !Object.prototype.hasOwnProperty.call(
                                justificativasPorMembro,
                                username
                            )
                        ) {
                            justificativasPorMembro[username] =
                                String(
                                    justificativas[username] ||
                                    ""
                                ).trim();
                        }
                    });

                    await banco
                        .collection("frequencias_unidades")
                        .doc(unidadeId)
                        .collection("registros")
                        .doc(dataId)
                        .set({
                            data: dataId,
                            unidade: nomeUnidade,
                            unidadeId,
                            tipoAtividade: tipo.value,
                            statusPorMembro: estados,
                            justificativasPorMembro,
                            presentes,
                            faltas,
                            justificados,
                            atualizadoPor: usernameLogado,
                            atualizadoEm:
                                firebase.firestore.FieldValue.serverTimestamp()
                        }, {
                            merge: true
                        });

                    const eventoAtual =
                        eventosPorData.get(dataId) || {};

                    eventosPorData.set(dataId, {
                        ...eventoAtual,
                        data: dataId,
                        unidade: nomeUnidade,
                        unidadeId,
                        tipoAtividade:
                            eventoAtual.tipoAtividade ||
                            tipo.value,
                        presentes,
                        faltas,
                        justificados,
                        statusPorMembro: estados,
                        justificativasPorMembro,
                        frequenciaSalva: true,
                        eventoCentral:
                            eventoAtual.eventoCentral === true,
                        eventoCentralId:
                            eventoAtual.eventoCentralId ||
                            "",
                        eventoCentralStatus:
                            eventoAtual.eventoCentralStatus ||
                            "ativo",
                        tituloEvento:
                            eventoAtual.tituloEvento ||
                            eventoAtual.titulo ||
                            ""
                    });

                    renderizarCalendario();
                    window.alert(
                        "Frequência salva com sucesso."
                    );
                } catch (erro) {
                    console.error(
                        "Erro ao salvar frequência:",
                        erro
                    );
                    window.alert(
                        "Não foi possível salvar a frequência. Verifique as regras do Firestore."
                    );
                } finally {
                    salvar.disabled = false;
                    salvar.textContent = "Salvar frequência";
                }
            }
        );
        const fichaUnidade = document.createElement("button");
        fichaUnidade.type = "button";
        fichaUnidade.textContent =
            "Abrir ficha operacional da unidade";
        fichaUnidade.style.width = "100%";
        fichaUnidade.style.padding = "10px";
        fichaUnidade.style.border = "1px solid #20c997";
        fichaUnidade.style.borderRadius = "8px";
        fichaUnidade.style.background = "transparent";
        fichaUnidade.style.color = "#65e6bf";
        fichaUnidade.style.fontSize = "11px";
        fichaUnidade.style.fontWeight = "700";
        fichaUnidade.style.cursor = "pointer";
        fichaUnidade.addEventListener(
            "click",
            () => abrirFichaUnidadeEvento(
                registro || {},
                dataId,
                registro || {}
            )
        );
        detalhe.appendChild(fichaUnidade);
        detalhe.appendChild(salvar);

        const apagar = document.createElement("button");
        apagar.type = "button";
        apagar.textContent =
            "Apagar chamada desta data";
        apagar.style.width = "100%";
        apagar.style.marginTop = "8px";
        apagar.style.padding = "10px";
        apagar.style.border = "1px solid #8f3030";
        apagar.style.borderRadius = "9px";
        apagar.style.background = "transparent";
        apagar.style.color = "#ff8b8b";
        apagar.style.fontWeight = "700";
        apagar.style.cursor = "pointer";
        apagar.style.display = modoEdicaoChamada
            ? "block"
            : "none";

        apagar.addEventListener(
            "click",
            async () => {
                const confirmar = window.confirm(
                    `Apagar a chamada de ${formatarData(dataId)}? Esta ação não pode ser desfeita.`
                );

                if (!confirmar) {
                    return;
                }

                apagar.disabled = true;
                apagar.textContent = "Apagando...";

                try {
                    await banco
                        .collection("frequencias_unidades")
                        .doc(unidadeId)
                        .collection("registros")
                        .doc(dataId)
                        .delete();

                    const eventoAtualizado =
                        eventosPorData.get(dataId) || {};
                    const statusEvento = String(
                        eventoAtualizado.eventoCentralStatus ||
                        eventoAtualizado.status ||
                        "ativo"
                    ).trim().toLowerCase();
                    const eventoCentralAtivo =
                        eventoAtualizado.eventoCentral === true &&
                        statusEvento !== "cancelado";

                    if (eventoCentralAtivo) {
                        eventosPorData.set(dataId, {
                            ...eventoAtualizado,
                            presentes: [],
                            faltas: [],
                            justificados: [],
                            statusPorMembro: {},
                            justificativasPorMembro: {},
                            frequenciaSalva: false
                        });
                    } else {
                        eventosPorData.delete(dataId);
                    }

                    calendario.dataset.diaSelecionado = dataId;
                    detalhe.innerHTML = "";
                    detalhe.style.display = "none";
                    renderizarCalendario();
                    status.textContent =
                        "Chamada apagada com sucesso. O evento continua no calendário.";
                } catch (erro) {
                    console.error(
                        "Erro ao apagar frequência:",
                        erro
                    );
                    window.alert(
                        "Não foi possível apagar a chamada. Verifique as regras do Firestore."
                    );
                    apagar.disabled = false;
                    apagar.textContent =
                        "Apagar chamada desta data";
                }
            }
        );

        detalhe.appendChild(apagar);

        const resumoChamada = document.createElement("div");



        const criarGrupoResumo = (
            tituloGrupo,
            estadoGrupo,
            corGrupo
        ) => {
            const grupo = document.createElement("section");
            const tituloGrupoElemento = document.createElement("strong");
            const pessoas = document.createElement("div");

            grupo.style.display = "flex";
            grupo.style.flexDirection = "column";
            grupo.style.gap = "6px";
            grupo.style.padding = "9px";
            grupo.style.border = `1px solid ${corGrupo}`;
            grupo.style.borderRadius = "9px";
            grupo.style.background = "#121212";

            tituloGrupoElemento.style.color = corGrupo;
            tituloGrupoElemento.style.fontSize = "12px";
            tituloGrupoElemento.style.fontWeight = "700";
            grupo.appendChild(tituloGrupoElemento);

            pessoas.style.display = "flex";
            pessoas.style.flexDirection = "column";
            pessoas.style.gap = "5px";

            const membrosDoGrupo = membros.filter(
                membro => estados[membro.username] === estadoGrupo
            );
            const totalGrupo = estadoGrupo === "A"
                ? membros.filter(membro => {
                    return estados[membro.username] === "A" ||
                        estados[membro.username] === "J";
                }).length
                : membrosDoGrupo.length;
            tituloGrupoElemento.textContent =
                `${tituloGrupo} (${totalGrupo})`;



            if (!membrosDoGrupo.length) {
                const vazio = document.createElement("small");
                vazio.textContent = "Nenhum participante";
                vazio.style.color = "#8e8e8e";
                pessoas.appendChild(vazio);
            }

            membrosDoGrupo.forEach(membro => {
                const pessoa = document.createElement("div");
                const avatarPessoa = document.createElement("img");
                const textoPessoa = document.createElement("div");
                const nomePessoa = document.createElement("strong");
                const detalhePessoa = document.createElement("small");

                pessoa.style.display = "flex";
                pessoa.style.alignItems = "center";
                pessoa.style.gap = "7px";
                pessoa.style.padding = "5px";
                pessoa.style.borderRadius = "7px";
                pessoa.style.background = "#1a1a1a";

                avatarPessoa.src = membro.fotoUrl ||
                    window.AVATAR_USUARIO_PADRAO;
                avatarPessoa.alt = `Foto de ${membro.nome}`;
                avatarPessoa.style.width = "28px";
                avatarPessoa.style.height = "28px";
                avatarPessoa.style.flex = "0 0 28px";
                avatarPessoa.style.objectFit = "cover";
                avatarPessoa.style.borderRadius = "50%";
                avatarPessoa.onerror = () => {
                    avatarPessoa.onerror = null;
                    avatarPessoa.src =
                        window.AVATAR_USUARIO_PADRAO;
                };

                textoPessoa.style.display = "flex";
                textoPessoa.style.flexDirection = "column";
                textoPessoa.style.gap = "1px";
                textoPessoa.style.minWidth = "0";
                textoPessoa.style.flex = "1";

                nomePessoa.textContent = membro.nome;
                nomePessoa.style.color = "#fff";
                nomePessoa.style.fontSize = "11px";

                detalhePessoa.textContent =
                    membro.cargo || "Participante";
                detalhePessoa.style.color = "#8e8e8e";
                detalhePessoa.style.fontSize = "9px";

                if (estadoGrupo === "J") {
                    const justificativaTexto = String(
                        justificativas[membro.username] ||
                        "Justificativa não informada"
                    ).trim();
                    detalhePessoa.textContent =
                        `Justificativa: ${justificativaTexto || "Justificativa não informada"}`;
                    detalhePessoa.style.color = "#f0c36d";
                }

                textoPessoa.appendChild(nomePessoa);
                textoPessoa.appendChild(detalhePessoa);
                pessoa.appendChild(avatarPessoa);
                pessoa.appendChild(textoPessoa);
                pessoas.appendChild(pessoa);
            });

            grupo.appendChild(pessoas);
            return grupo;
        };

        resumoChamada.style.display = "flex";
        resumoChamada.style.flexDirection = "column";
        resumoChamada.style.gap = "8px";
        resumoChamada.style.marginTop = "4px";
        resumoChamada.appendChild(
            criarGrupoResumo(
                "Presentes",
                "P",
                "#20c997"
            )
        );
        resumoChamada.appendChild(
            criarGrupoResumo(
                "Ausentes",
                "A",
                "#ff6b6b"
            )
        );
        resumoChamada.appendChild(
            criarGrupoResumo(
                "Justificados",
                "J",
                "#f0ad4e"
            )
        );

        editar.type = "button";
        editar.textContent = "Editar chamada";
        editar.style.width = "100%";
        editar.style.marginTop = "8px";
        editar.style.padding = "10px";
        editar.style.border = "1px solid #3b9cff";
        editar.style.borderRadius = "9px";
        editar.style.background = "transparent";
        editar.style.color = "#8dccff";
        editar.style.fontWeight = "700";
        editar.style.cursor = "pointer";
        editar.addEventListener(
            "click",
            () => {
                modoEdicaoChamada = true;
                resumoChamada.style.display = "none";
                editar.style.display = "none";
                tipo.style.display = "block";
                seletorTodos.style.display = "block";
                lista.style.display = "flex";
                salvar.style.display = "block";

                const botaoApagar = Array.from(
                    detalhe.querySelectorAll("button")
                ).find(botao => {
                    return botao.textContent.trim() ===
                        "Apagar chamada desta data";
                });

                if (botaoApagar) {
                    botaoApagar.style.display = "block";
                }

            }
        );

        detalhe.appendChild(editar);
        detalhe.appendChild(resumoChamada);

        renderizarLista();

        if (registro && !modoEdicaoChamada) {
            tipo.style.display = "none";
            seletorTodos.style.display = "none";
            lista.style.display = "none";
            salvar.style.display = "none";
            editar.style.display = "block";
            resumoChamada.style.display = "flex";
        } else {
            editar.style.display = "none";
            resumoChamada.style.display = "none";
        }
    };

    const renderizarCalendario = () => {
        calendario.innerHTML = "";
        tituloMes.textContent =
            `${nomesMeses[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;

        const primeiroDia = new Date(
            mesAtual.getFullYear(),
            mesAtual.getMonth(),
            1
        );
        const deslocamento = primeiroDia.getDay();
        const totalDias = new Date(
            mesAtual.getFullYear(),
            mesAtual.getMonth() + 1,
            0
        ).getDate();
        const hojeId = criarDataId(new Date());

        for (let indice = 0; indice < deslocamento; indice += 1) {
            const vazio = document.createElement("div");
            vazio.style.minHeight = "76px";
            calendario.appendChild(vazio);
        }

        for (let dia = 1; dia <= totalDias; dia += 1) {
            const data = new Date(
                mesAtual.getFullYear(),
                mesAtual.getMonth(),
                dia
            );
            const dataId = criarDataId(data);
            const evento = eventosPorData.get(dataId);
            const existeEventoCentral = Boolean(
                evento && evento.eventoCentral === true
            );
            const possuiStatusDeFrequencia = Boolean(
                evento &&
                evento.statusPorMembro &&
                Object.keys(evento.statusPorMembro).length > 0
            );
            const frequenciaSalva = Boolean(
                evento && (
                    evento.frequenciaSalva === true ||
                    possuiStatusDeFrequencia
                )
            );
            const diaSelecionado =
                dataId === calendario.dataset.diaSelecionado;
            const celula = document.createElement("button");
            const numero = document.createElement("strong");
            const listaEventos = document.createElement("span");

            celula.type = "button";
            celula.style.display = "flex";
            celula.style.flexDirection = "column";
            celula.style.alignItems = "stretch";
            celula.style.justifyContent = "flex-start";
            celula.style.gap = "4px";
            celula.style.minHeight = "76px";
            celula.style.padding = "6px 4px";
            celula.style.border = diaSelecionado
                ? "1px solid #0095f6"
                : frequenciaSalva
                    ? "1px solid #20c997"
                    : dataId === hojeId
                        ? "1px solid #58b7ff"
                        : "1px solid #262626";
            celula.style.borderRadius = "6px";
            celula.style.background = diaSelecionado
                ? "#0f2f4d"
                : frequenciaSalva
                    ? "#103c32"
                    : existeEventoCentral
                        ? "#172b3b"
                        : "#121212";

            celula.style.color = "#fff";
            celula.style.textAlign = "left";
            celula.style.cursor = existeEventoCentral
                ? "pointer"
                : "default";
            celula.style.boxSizing = "border-box";

            if (diaSelecionado) {
                celula.style.boxShadow =
                    "0 0 0 2px #0095f6";
            }

            numero.textContent = dataId === hojeId
                ? `${dia} · HOJE`
                : String(dia);
            numero.style.display = "block";
            numero.style.fontSize = "11px";
            numero.style.fontWeight = "700";
            numero.style.color = diaSelecionado
                ? "#8dccff"
                : frequenciaSalva
                    ? "#8ff0ce"
                    : dataId === hojeId
                        ? "#58b7ff"
                        : "#d7d9db";


            listaEventos.style.display = "flex";
            listaEventos.style.flexDirection = "column";
            listaEventos.style.gap = "2px";
            listaEventos.style.minWidth = "0";
            listaEventos.style.color = diaSelecionado
                ? "#d9efff"
                : frequenciaSalva
                    ? "#c7ffec"
                    : "#d7d9db";
            listaEventos.style.fontSize = "9px";
            listaEventos.style.lineHeight = "1.2";
            listaEventos.style.overflow = "hidden";

            if (existeEventoCentral) {
                const eventoTexto = document.createElement("span");
                const tituloEvento = String(
                    evento.tituloEvento ||
                    evento.titulo ||
                    ""
                ).trim();
                const tipoEvento = tiposAtividade[
                    evento.tipoAtividade
                ] || tiposAtividade.outra_atividade;

                eventoTexto.textContent = tituloEvento
                    ? `${tipoEvento} · ${tituloEvento}`
                    : tipoEvento;
                eventoTexto.style.overflow = "hidden";
                eventoTexto.style.textOverflow = "ellipsis";
                eventoTexto.style.whiteSpace = "nowrap";
                listaEventos.appendChild(eventoTexto);

                if (frequenciaSalva) {
                    const chamada = document.createElement("span");
                    const totalPresentes = Array.isArray(
                        evento.presentes
                    )
                        ? evento.presentes.length
                        : 0;
                    const totalFaltas = Array.isArray(
                        evento.faltas
                    )
                        ? evento.faltas.length
                        : 0;
                    const totalJustificados = Array.isArray(
                        evento.justificados
                    )
                        ? evento.justificados.length
                        : 0;

                    chamada.textContent =
                        `Chamada · P ${totalPresentes} · A ${totalFaltas} · J ${totalJustificados}`;
                    chamada.style.color = "#8ff0ce";
                    chamada.style.overflow = "hidden";
                    chamada.style.textOverflow = "ellipsis";
                    chamada.style.whiteSpace = "nowrap";
                    listaEventos.appendChild(chamada);
                } else if (
                    String(
                        evento.eventoCentralStatus ||
                        evento.status ||
                        "ativo"
                    ).trim().toLowerCase() === "cancelado"
                ) {
                    const cancelado = document.createElement("span");
                    cancelado.textContent = "Evento cancelado";
                    cancelado.style.color = "#ff9b9b";
                    listaEventos.appendChild(cancelado);
                }
            }

            celula.appendChild(numero);
            celula.appendChild(listaEventos);

            celula.addEventListener(
                "click",
                () => {
                    calendario.dataset.diaSelecionado = dataId;
                    renderizarCalendario();

                    if (!existeEventoCentral) {
                        return;
                    }

                    if (
                        String(
                            evento.eventoCentralStatus ||
                            evento.status ||
                            "ativo"
                        ).trim().toLowerCase() === "cancelado"
                    ) {
                        return;
                    }

                    abrirChamada(dataId, evento);
                }
            );
            calendario.appendChild(celula);
        }
    };



    voltarMes.addEventListener(
        "click",
        async () => {
            mesAtual = new Date(
                mesAtual.getFullYear(),
                mesAtual.getMonth() - 1,
                1
            );
            renderizarCalendario();
        }
    );

    avancarMes.addEventListener(
        "click",
        async () => {
            mesAtual = new Date(
                mesAtual.getFullYear(),
                mesAtual.getMonth() + 1,
                1
            );
            renderizarCalendario();
        }
    );

    try {
        await carregarMembros();
        await carregarEventos();
        renderizarCalendario();
    } catch (erro) {
        console.error(
            "Erro ao iniciar calendário de frequência:",
            erro
        );
        status.textContent =
            "Não foi possível carregar o calendário.";
    }
}



async function abrirPainelUnidade() {
    const username = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (!username || !banco) {
        return;
    }

    fecharPainelUnidade();

    try {
        const usuarioSnap = await banco
            .collection("usuarios")
            .where("username", "==", username)
            .limit(1)
            .get();

        if (usuarioSnap.empty) {
            window.alert(
                "Não foi possível localizar seu perfil."
            );
            return;
        }

        const dadosUsuario = usuarioSnap.docs[0].data() || {};
        const normalizarCargoPainel = valor => String(
            valor || ""
        )
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[()]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const cargoFuncao = normalizarCargoPainel(
            dadosUsuario.cargoFuncao ||
            dadosUsuario.funcao ||
            ""
        );
        const cargoNome = normalizarCargoPainel(
            dadosUsuario.cargo
        );
        const ehSecretarioClube =
            cargoFuncao === "secretario_clube" ||
            cargoFuncao === "secretario do clube" ||
            cargoNome === "secretario do clube" ||
            (
                cargoNome.includes("secretario") &&
                cargoNome.includes("clube")
            );
        const ehSecretarioUnidade =
            cargoFuncao === "secretario_unidade" ||
            cargoFuncao === "secretario de unidade" ||
            cargoNome === "secretario de unidade" ||
            (
                cargoNome.includes("secretario") &&
                cargoNome.includes("unidade")
            );
        const ehConselheiroUnidade =
            cargoFuncao === "conselheiro_unidade" ||
            cargoFuncao === "conselheiro de unidade" ||
            cargoNome === "conselheiro de unidade" ||
            (
                cargoNome.includes("conselheiro") &&
                cargoNome.includes("unidade")
            );
        const nomeUnidade = String(
            dadosUsuario.unidade || ""
        ).trim();
        if (
            (ehSecretarioUnidade || ehConselheiroUnidade) &&
            !nomeUnidade
        ) {
            window.alert(
                ehConselheiroUnidade
                    ? "O Conselheiro(a) de Unidade precisa estar vinculado a uma unidade."
                    : "O Secretário(a) de Unidade precisa estar vinculado a uma unidade."
            );
            return;
        }


        let dadosUnidade = {};
        if (nomeUnidade) {
            const unidadeIdBusca = criarIdUnidadeParaPainel(
                nomeUnidade
            );
            let unidadeSnap = await banco
                .collection("unidades")
                .doc(unidadeIdBusca)
                .get();

            if (unidadeSnap.exists) {
                dadosUnidade = unidadeSnap.data() || {};
            } else {
                unidadeSnap = await banco
                    .collection("unidades")
                    .where("nome", "==", nomeUnidade)
                    .limit(1)
                    .get();
                if (!unidadeSnap.empty) {
                    dadosUnidade = unidadeSnap.docs[0].data() || {};
                }
            }
        }

        let dadosConfiguracao = {};
        try {
            const configuracaoSnap = await banco
                .collection("configuracoes")
                .doc("geral")
                .get();
            dadosConfiguracao = configuracaoSnap.exists
                ? configuracaoSnap.data() || {}
                : {};
        } catch (erroConfiguracao) {
            console.warn(
                "Não foi possível carregar a identidade do clube:",
                erroConfiguracao
            );
        }

        const nomeClubeExibicao = String(
            dadosUnidade.nomeClube ||
            dadosUnidade.clube ||
            dadosConfiguracao.nomeClube ||
            "Clube Guardiões"
        ).trim();
        const nomeExibicao = ehSecretarioClube
            ? nomeClubeExibicao
            : String(
                dadosUnidade.nome || nomeUnidade
            ).trim();
        const fotoUnidade = String(
            dadosUnidade.fotoUrl ||
            window.AVATAR_USUARIO_PADRAO ||
            ""
        );
        const fotoClube = String(
            dadosConfiguracao.logoAppUrl ||
            dadosConfiguracao.logoUrl ||
            window.AVATAR_USUARIO_PADRAO ||
            ""
        );
        const fotoIdentidade = ehSecretarioClube
            ? fotoClube
            : fotoUnidade;
        const unidadeId = nomeUnidade
            ? criarIdUnidadeParaPainel(nomeUnidade)
            : "";

        const painel = document.createElement("div");
        const cabecalho = document.createElement("div");
        const identidade = document.createElement("div");
        const logo = document.createElement("img");
        const textos = document.createElement("div");
        const titulo = document.createElement("strong");
        const subtitulo = document.createElement("span");
        const fechar = document.createElement("button");
        const conteudo = document.createElement("div");

        painel.id = "modal-painel-unidade";
        painel.style.position = "fixed";
        painel.style.inset = "0";
        painel.style.zIndex = "2147483640";
        painel.style.display = "flex";
        painel.style.flexDirection = "column";
        painel.style.overflowY = "auto";
        painel.style.background = "#000";
        painel.style.color = "#fff";

        cabecalho.style.position = "sticky";
        cabecalho.style.top = "0";
        cabecalho.style.zIndex = "1";
        cabecalho.style.display = "flex";
        cabecalho.style.alignItems = "center";
        cabecalho.style.justifyContent = "space-between";
        cabecalho.style.gap = "12px";
        cabecalho.style.padding = "12px 16px";
        cabecalho.style.background = "#080808";
        cabecalho.style.borderBottom = "1px solid #262626";

        identidade.style.display = "flex";
        identidade.style.alignItems = "center";
        identidade.style.gap = "10px";
        identidade.style.minWidth = "0";

        logo.src = fotoIdentidade;
        logo.alt = ehSecretarioClube
            ? `Logo de ${nomeClubeExibicao}`
            : `Logo da unidade ${nomeExibicao}`;
        logo.style.width = "44px";
        logo.style.height = "44px";
        logo.style.flex = "0 0 44px";
        logo.style.objectFit = "cover";
        logo.style.borderRadius = "12px";
        logo.style.border = "1px solid #26384a";
        logo.onerror = () => {
            logo.onerror = null;
            logo.src = window.AVATAR_USUARIO_PADRAO;
        };

        textos.style.display = "flex";
        textos.style.flexDirection = "column";
        textos.style.gap = "3px";
        textos.style.minWidth = "0";

        titulo.textContent = ehSecretarioClube
            ? "Painel do Clube"
            : nomeExibicao;
        titulo.style.fontSize = "16px";
        titulo.style.overflow = "hidden";
        titulo.style.textOverflow = "ellipsis";
        titulo.style.whiteSpace = "nowrap";

        subtitulo.textContent = ehSecretarioClube
            ? "Secretário(a) do Clube"
            : ehSecretarioUnidade
                ? "Secretário(a) de Unidade"
                : ehConselheiroUnidade
                    ? "Conselheiro(a) de Unidade"
                    : "Painel da unidade";
        subtitulo.style.color = "#8e8e8e";
        subtitulo.style.fontSize = "12px";

        fechar.type = "button";
        fechar.textContent = "×";
        fechar.setAttribute(
            "aria-label",
            "Fechar painel"
        );
        fechar.style.width = "38px";
        fechar.style.height = "38px";
        fechar.style.border = "1px solid #3a3a3a";
        fechar.style.borderRadius = "10px";
        fechar.style.background = "transparent";
        fechar.style.color = "#fff";
        fechar.style.fontSize = "24px";
        fechar.style.cursor = "pointer";
        fechar.addEventListener(
            "click",
            fecharPainelUnidade
        );

        conteudo.style.width = "min(100%, 760px)";
        conteudo.style.margin = "0 auto";
        conteudo.style.padding = "18px 16px 40px";
        conteudo.style.boxSizing = "border-box";

        const cartaoUnidade = document.createElement("div");
        const molduraLogo = document.createElement("div");
        const logoCartao = document.createElement("img");
        const tituloUnidade = document.createElement("strong");
        const nomeClube = document.createElement("span");
        const identificacao = document.createElement("small");

        cartaoUnidade.style.display = "flex";
        cartaoUnidade.style.flexDirection = "column";
        cartaoUnidade.style.alignItems = "center";
        cartaoUnidade.style.justifyContent = "center";
        cartaoUnidade.style.gap = "10px";
        cartaoUnidade.style.minHeight = "230px";
        cartaoUnidade.style.padding = "28px 18px";
        cartaoUnidade.style.marginBottom = "18px";
        cartaoUnidade.style.border = "1px solid #2f3336";
        cartaoUnidade.style.borderRadius = "16px";
        cartaoUnidade.style.background = "#121212";
        cartaoUnidade.style.boxSizing = "border-box";
        cartaoUnidade.style.textAlign = "center";

        molduraLogo.style.display = "flex";
        molduraLogo.style.alignItems = "center";
        molduraLogo.style.justifyContent = "center";
        molduraLogo.style.width = "112px";
        molduraLogo.style.height = "112px";
        molduraLogo.style.padding = "8px";
        molduraLogo.style.boxSizing = "border-box";
        molduraLogo.style.border = "1px solid #3a3a3a";
        molduraLogo.style.borderRadius = "18px";
        molduraLogo.style.background = "#0a0a0a";

        logoCartao.src = fotoIdentidade;
        logoCartao.alt = logo.alt;
        logoCartao.style.width = "100%";
        logoCartao.style.height = "100%";
        logoCartao.style.objectFit = "contain";
        logoCartao.style.borderRadius = "12px";
        logoCartao.onerror = () => {
            logoCartao.onerror = null;
            logoCartao.src = window.AVATAR_USUARIO_PADRAO;
        };

        tituloUnidade.textContent = ehSecretarioClube
            ? nomeClubeExibicao.toUpperCase()
            : `UNIDADE ${nomeExibicao.toUpperCase()}`;
        tituloUnidade.style.color = "#fff";
        tituloUnidade.style.fontSize = "18px";
        tituloUnidade.style.letterSpacing = ".5px";
        tituloUnidade.style.lineHeight = "1.25";

        nomeClube.textContent = ehSecretarioClube
            ? "Calendário central de eventos"
            : nomeClubeExibicao;
        nomeClube.style.color = "#d7d9db";
        nomeClube.style.fontSize = "15px";
        nomeClube.style.fontWeight = "600";

        identificacao.textContent = ehSecretarioClube
            ? "Eventos compartilhados com as unidades"
            : ehSecretarioUnidade
                ? "Frequência e relatórios da unidade"
                : "Área da unidade";
        identificacao.style.color = "#8e8e8e";
        identificacao.style.fontSize = "11px";

        molduraLogo.appendChild(logoCartao);
        cartaoUnidade.appendChild(molduraLogo);
        cartaoUnidade.appendChild(tituloUnidade);
        cartaoUnidade.appendChild(nomeClube);
        cartaoUnidade.appendChild(identificacao);
        conteudo.appendChild(cartaoUnidade);

        if (ehSecretarioClube) {
            const tituloFuncoes = document.createElement("h2");
            tituloFuncoes.textContent = "Administração do calendário central";
            tituloFuncoes.style.margin = "18px 0 10px";
            tituloFuncoes.style.fontSize = "16px";
            conteudo.appendChild(tituloFuncoes);
            await renderizarPainelSecretarioClubeEventos(
                conteudo,
                banco,
                username
            );
        } else if (ehSecretarioUnidade) {
            const tituloFuncoes = document.createElement("h2");
            tituloFuncoes.textContent = "Responsabilidades do secretário(a)";
            tituloFuncoes.style.margin = "18px 0 10px";
            tituloFuncoes.style.fontSize = "16px";
            const aviso = document.createElement("p");
            aviso.textContent =
                "A frequência e os relatórios pertencem à unidade. Os eventos são definidos no calendário central do clube.";
            aviso.style.color = "#a8a8a8";
            aviso.style.fontSize = "13px";
            aviso.style.lineHeight = "1.5";
            conteudo.appendChild(tituloFuncoes);
            conteudo.appendChild(aviso);
            await renderizarPainelSecretarioFrequencia(
                conteudo,
                unidadeId,
                nomeExibicao,
                banco,
                username
            );
        } else if (ehConselheiroUnidade) {
            const tituloFuncoes = document.createElement("h2");
            tituloFuncoes.textContent =
                "Responsabilidades do Conselheiro(a)";
            tituloFuncoes.style.margin = "18px 0 10px";
            tituloFuncoes.style.fontSize = "16px";
            const aviso = document.createElement("p");
            aviso.textContent =
                "Este painel pertence exclusivamente à sua unidade. A criação de eventos e o fluxo de relatórios da unidade serão exibidos aqui.";
            aviso.style.color = "#a8a8a8";
            aviso.style.fontSize = "13px";
            aviso.style.lineHeight = "1.5";
            conteudo.appendChild(tituloFuncoes);
            conteudo.appendChild(aviso);
        } else {

            const vazio = document.createElement("p");
            vazio.textContent =
                "Nenhuma função adicional foi liberada para este cargo ainda.";
            vazio.style.margin = "14px 0 0";
            vazio.style.color = "#8e8e8e";
            vazio.style.fontSize = "13px";
            vazio.style.textAlign = "center";
            conteudo.appendChild(vazio);
        }

        identidade.appendChild(logo);
        identidade.appendChild(textos);
        textos.appendChild(titulo);
        textos.appendChild(subtitulo);
        cabecalho.appendChild(identidade);
        cabecalho.appendChild(fechar);
        painel.appendChild(cabecalho);
        painel.appendChild(conteudo);
        document.body.appendChild(painel);
    } catch (erro) {
        console.error(
            "Erro ao abrir Painel da Unidade:",
            erro
        );
        window.alert(
            "Não foi possível abrir o painel agora."
        );
    }
}


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
        const avatarPadrao = window.AVATAR_USUARIO_PADRAO;
    const painelUnidadeAcesso = document.getElementById(
        "perfil-painel-unidade-acesso"
    );
    const botaoPainelUnidade = document.getElementById(
        "btn-painel-unidade"
    );
    const subtituloPainelUnidade = document.getElementById(
        "btn-painel-unidade-subtitulo"
    );

    if (painelUnidadeAcesso) {
        painelUnidadeAcesso.style.display = "none";
    }
    if (botaoPainelUnidade) {
        botaoPainelUnidade.style.display = "none";
    }

    mudarSubTabPerfil("publicacoes");


    if (tipoUsuario === "admin") {
        if (nomeEl) nomeEl.textContent = "Administrador";
        if (cargoEl) cargoEl.textContent = "Liderança Geral";
        if (unidadeEl) unidadeEl.textContent = "Geral";
        if (nascimentoEl) nascimentoEl.textContent = "Nascido em: --/--/----";
        if (avatarEl) avatarEl.src = avatarPadrao;
        if (contadorEl) contadorEl.textContent = "∞";
        if (classesEl) classesEl.textContent = "• Classe: Administrador Geral";
        if (especialidadesEl) especialidadesEl.textContent = "Acesso Irrestrito";
        if (mestradosEl) mestradosEl.textContent = "Acesso Irrestrito";
        if (gridEl) gridEl.style.display = "none";
        if (vazioEl) vazioEl.style.display = "block";
        return;
    }

    if (!username || !window.ClubeDB || !window.ClubeDB.textoDB) {
        return;
    }

    try {
        const banco = window.ClubeDB.textoDB;
        const usuarioAuthAtual = window.ClubeDB.loginDB
            ? window.ClubeDB.loginDB.currentUser
            : null;

        let snapshotUsuario = await banco
            .collection("usuarios")
            .where("username", "==", username)
            .limit(1)
            .get();

        if (
            snapshotUsuario.empty &&
            usuarioAuthAtual &&
            usuarioAuthAtual.uid
        ) {
            const documentoPorUid = await banco
                .collection("usuarios")
                .doc(usuarioAuthAtual.uid)
                .get();

            if (documentoPorUid.exists) {
                snapshotUsuario = {
                    empty: false,
                    docs: [documentoPorUid]
                };
            }
        }

        if (
            snapshotUsuario.empty &&
            usuarioAuthAtual &&
            usuarioAuthAtual.email
        ) {
            const usernameDoEmail = String(
                usuarioAuthAtual.email
            )
                .split("@")[0]
                .trim()
                .toLowerCase();

            if (
                usernameDoEmail &&
                usernameDoEmail !== String(username || "")
                    .trim()
                    .toLowerCase()
            ) {
                snapshotUsuario = await banco
                    .collection("usuarios")
                    .where("username", "==", usernameDoEmail)
                    .limit(1)
                    .get();
            }
        }

        if (snapshotUsuario.empty) {
            if (nomeEl) {
                nomeEl.textContent = username || "Usuário";
            }
            if (cargoEl) {
                cargoEl.textContent = "Membro";
            }
            if (unidadeEl) {
                unidadeEl.textContent = "Sem Unidade";
            }
            if (nascimentoEl) {
                nascimentoEl.textContent = "Nascido em: --/--/----";
            }
            if (avatarEl) {
                avatarEl.src = avatarPadrao;
            }
            if (vazioEl) {
                vazioEl.style.display = "block";
                vazioEl.textContent =
                    "Não foi possível localizar os dados deste perfil.";
            }
            return;
        }

        const dados = snapshotUsuario.docs[0].data() || {};
        const usernameCanonico = String(
            dados.username || ""
        ).trim().toLowerCase();

        if (
            usernameCanonico &&
            usernameCanonico !== String(username || "")
                .trim()
                .toLowerCase()
        ) {
            localStorage.setItem(
                "usernameLogado",
                usernameCanonico
            );
        }

        const usuarioFirebase = window.ClubeDB.loginDB
            ? window.ClubeDB.loginDB.currentUser
            : null;

        if (nomeEl) nomeEl.textContent = dados.nomeReal || dados.username || username;
        if (cargoEl) cargoEl.textContent = dados.cargo || "Membro";
        if (unidadeEl) unidadeEl.textContent = dados.unidade || "Sem Unidade";

        const cargoFuncaoPerfil = String(
            dados.cargoFuncao ||
            dados.funcao ||
            ""
        ).trim().toLowerCase();
        const cargoNomePerfil = String(
            dados.cargo || ""
        ).trim().toLowerCase();
        const cargoTextoVisivel = String(
            cargoEl ? cargoEl.textContent : ""
        ).trim().toLowerCase();
        const normalizarCargoPerfil = valor => String(
            valor || ""
        )
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[()]/g, "")
            .replace(/\s+/g, " ")
            .trim();
        const funcaoPerfilNormalizada =
            normalizarCargoPerfil(cargoFuncaoPerfil);
        const cargoPerfilNormalizado =
            normalizarCargoPerfil(cargoNomePerfil);
        const cargoTextoVisivelNormalizado =
            normalizarCargoPerfil(cargoTextoVisivel);
        const ehSecretarioClubePerfil =
            funcaoPerfilNormalizada === "secretario_clube" ||
            funcaoPerfilNormalizada.includes(
                "secretario do clube"
            ) ||
            (
                cargoPerfilNormalizado.includes("secretario") &&
                cargoPerfilNormalizado.includes("clube")
            ) ||
            (
                cargoTextoVisivelNormalizado.includes("secretario") &&
                cargoTextoVisivelNormalizado.includes("clube")
            );
        const ehSecretarioUnidadePerfil =
            funcaoPerfilNormalizada === "secretario_unidade" ||
            funcaoPerfilNormalizada.includes(
                "secretario de unidade"
            ) ||
            (
                cargoPerfilNormalizado.includes("secretario") &&
                cargoPerfilNormalizado.includes("unidade")
            ) ||
            (
                cargoTextoVisivelNormalizado.includes("secretario") &&
                cargoTextoVisivelNormalizado.includes("unidade")
            );
        const podeAbrirPainel = Boolean(
            dados.unidade ||
            ehSecretarioClubePerfil
        );

        if (podeAbrirPainel && botaoPainelUnidade) {
            botaoPainelUnidade.style.setProperty(
                "display",
                "block",
                "important"
            );

            if (dados.unidade) {
                botaoPainelUnidade.setAttribute(
                    "data-unidade",
                    String(dados.unidade)
                );
            } else {
                botaoPainelUnidade.removeAttribute(
                    "data-unidade"
                );
            }

            if (subtituloPainelUnidade) {
                subtituloPainelUnidade.textContent =
                    ehSecretarioClubePerfil
                        ? "Calendário central do clube"
                        : ehSecretarioUnidadePerfil
                            ? "Frequência e relatórios da unidade"
                            : "Informações e atividades da unidade";
            }

            if (painelUnidadeAcesso) {
                painelUnidadeAcesso.style.setProperty(
                    "display",
                    "block",
                    "important"
                );
            }
        }






        if (nascimentoEl) {
            if (dados.dataNascimento) {
                const partesData = String(dados.dataNascimento).split("-");
                nascimentoEl.textContent = "Nascido em: " +
                    (partesData[2] || "--") + "/" +
                    (partesData[1] || "--") + "/" +
                    (partesData[0] || "--");
            } else {
                nascimentoEl.textContent = "Nascido em: --/--/----";
            }
        }

        if (avatarEl) {
    let fotoPerfil = dados.fotoUrl ? dados.fotoUrl : avatarPadrao;
    if (fotoPerfil && fotoPerfil !== avatarPadrao) {
        fotoPerfil += (fotoPerfil.includes("?") ? "&" : "?") + "v=" + Date.now();
    }
    avatarEl.onerror = function () { this.onerror = null; this.src = avatarPadrao; };
    avatarEl.src = fotoPerfil;
}

        const classes = Array.isArray(dados.classesConcluidas) ? dados.classesConcluidas : [];
        const especialidades = Array.isArray(dados.especialidades) ? dados.especialidades : [];
        const mestrados = Array.isArray(dados.mestrados) ? dados.mestrados : [];

        if (contadorEl) {
            contadorEl.textContent = String(
                classes.length + especialidades.length + mestrados.length
            );
        }

        if (tClasses) tClasses.textContent = "🎒 Classes Regulares (" + classes.length + ")";
        if (classesEl) {
            if (classes.length > 0) {
                classesEl.innerHTML = classes.map(function (classe) {
                    return "<div>• " + escaparHtml(classe) + "</div>";
                }).join("");
            } else {
                classesEl.textContent = "• Classe Vinculada: " +
                    (dados.tipo === "Desbravador" ? "Classe Regular" : "Classe de Líder");
            }
        }

        if (tEspecialidades) {
            tEspecialidades.textContent = "🏅 Especialidades Adquiridas (" + especialidades.length + ")";
        }

        if (especialidadesEl) {
            if (especialidades.length > 0) {
                especialidadesEl.innerHTML = especialidades.map(function (especialidade) {
                    return "<span style=\"background:#262626;color:#fff;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:500;white-space:normal;word-break:break-word;display:inline-block;margin:2px;\">🎖️ " +
                        escaparHtml(especialidade) +
                        "</span>";
                }).join("");
            } else {
                especialidadesEl.textContent = "Nenhuma especialidade validada.";
            }
        }

        if (tMestrados) {
            tMestrados.textContent = "🏆 Mestrados Adquiridos (" + mestrados.length + ")";
        }

        if (mestradosEl) {
            if (mestrados.length > 0) {
                mestradosEl.innerHTML = mestrados.map(function (mestrado) {
                    return "<span style=\"background:#1e3a1e;color:#fff;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:500;white-space:normal;word-break:break-word;display:inline-block;margin:2px;border:1px solid #2e5a2e;\">🏆 " +
                        escaparHtml(mestrado) +
                        "</span>";
                }).join("");
            } else {
                mestradosEl.textContent = "Nenhum mestrado concluído ainda.";
            }
        }

        let snapshotPublicacoes = { empty: true, docs: [] };

        if (usuarioFirebase && usuarioFirebase.uid) {
            snapshotPublicacoes = await banco
                .collection("publicacoes")
                .where("autorId", "==", usuarioFirebase.uid)
                .get();
        }

        if (snapshotPublicacoes.empty) {
            snapshotPublicacoes = await banco
                .collection("publicacoes")
                .where("autorUsername", "==", username)
                .get();
        }

        if (gridEl) {
            gridEl.innerHTML = "";
        }

        if (!snapshotPublicacoes.empty && gridEl) {
            const publicacoesOrdenadas = snapshotPublicacoes.docs.slice().sort(function (a, b) {
                const dataA = a.data().criadoEm;
                const dataB = b.data().criadoEm;

                const tempoA = dataA && typeof dataA.toMillis === "function"
                    ? dataA.toMillis()
                    : (dataA && dataA.seconds ? dataA.seconds * 1000 : 0);

                const tempoB = dataB && typeof dataB.toMillis === "function"
                    ? dataB.toMillis()
                    : (dataB && dataB.seconds ? dataB.seconds * 1000 : 0);

                return tempoB - tempoA;
            });

            gridEl.style.display = "grid";
            gridEl.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
            gridEl.style.gap = "2px";
            gridEl.style.width = "100%";

            gridEl.innerHTML = publicacoesOrdenadas.map(function (documento) {
                const publicacao = documento.data() || {};
                const idPublicacao = escaparHtml(documento.id);
                const texto = escaparHtml(publicacao.texto || "Publicação");
                const fileId = publicacao.telegramFileId || "";

                let conteudo = `
                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:#121212;color:#fff;font-size:12px;line-height:1.35;text-align:left;white-space:pre-wrap;overflow:hidden;">
                        ${texto}
                    </div>
                `;

                if (fileId) {
                    const urlMidia = escaparHtml(criarUrlMidiaTelegram(fileId));

                    if (publicacao.tipoMidia === "video") {
                        conteudo = `
                            <video
                                src="${urlMidia}"
                                muted
                                playsinline
                                preload="metadata"
                                style="width:100%;height:100%;object-fit:cover;"
                            ></video>
                            <span style="position:absolute;right:8px;top:8px;background:rgba(0,0,0,.65);color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;">▶</span>
                        `;
                    } else {
                        conteudo = `
                            <img
                                src="${urlMidia}"
                                alt="Publicação"
                                loading="lazy"
                                style="width:100%;height:100%;object-fit:cover;"
                            >
                        `;
                    }
                }

                return `
                    <button
                        type="button"
                        onclick="abrirPublicacaoDoPerfil('${idPublicacao}')"
                        aria-label="Abrir publicação"
                        style="position:relative;display:block;aspect-ratio:1;overflow:hidden;border:0;padding:0;background:#121212;cursor:pointer;"
                    >
                        ${conteudo}
                    </button>
                `;
            }).join("");

            if (vazioEl) {
                vazioEl.style.display = "none";
            }
        } else {
            if (gridEl) {
                gridEl.style.display = "none";
            }

            if (vazioEl) {
                vazioEl.style.display = "block";
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar dados do perfil:", erro);

        if (nomeEl && nomeEl.textContent === "Carregando...") {
            nomeEl.textContent = username || "Usuário";
        }

        if (cargoEl && cargoEl.textContent === "Carregando...") {
            cargoEl.textContent = "Membro";
        }

        if (unidadeEl && unidadeEl.textContent === "Carregando...") {
            unidadeEl.textContent = "Sem Unidade";
        }

        if (nascimentoEl && nascimentoEl.textContent === "Carregando...") {
            nascimentoEl.textContent = "Nascido em: --/--/----";
        }

        if (avatarEl && !avatarEl.getAttribute("src")) {
            avatarEl.src = avatarPadrao;
        }

        if (gridEl) {
            gridEl.innerHTML = "";
            gridEl.style.display = "none";
        }

        if (vazioEl) {
            vazioEl.style.display = "block";
            vazioEl.textContent =
                "Não foi possível carregar as publicações agora.";
        }
    }
}


// Alternar sub-abas do próprio perfil (Publicações vs Conquistas)
function mudarSubTabPerfil(subAba) {
    const abaPubs = document.getElementById("perfil-secao-publicacoes");
    const abaConq = document.getElementById("perfil-secao-conquistas");
    const tabPubsBtn = document.getElementById("tab-perfil-publicacoes");
    const tabConqBtn = document.getElementById("tab-perfil-conquistas");

    if (subAba === "publicacoes") {
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
    } else if (subAba === "conquistas") {
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

async function abrirPublicacaoDoPerfil(idPublicacao) {
    if (!idPublicacao || !window.ClubeDB || !window.ClubeDB.textoDB) {
        return;
    }

    const modalAnterior = document.getElementById("modal-publicacao-perfil");

    if (modalAnterior) {
        modalAnterior.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-publicacao-perfil";
    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:10001;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
        box-sizing:border-box;
        background:rgba(0,0,0,.82);
    `;

    modal.innerHTML = `
        <div style="position:relative;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;background:#000;border:1px solid #262626;border-radius:12px;">
            <button
                type="button"
                aria-label="Fechar publicação"
                style="position:sticky;top:10px;float:right;z-index:2;margin:10px 10px -45px 0;width:34px;height:34px;border:0;border-radius:50%;background:rgba(0,0,0,.72);color:#fff;font-size:24px;cursor:pointer;"
            >×</button>
            <div id="conteudo-modal-publicacao-perfil" style="min-height:180px;display:flex;align-items:center;justify-content:center;color:#8e8e8e;">
                Carregando publicação...
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const fechar = function () {
        modal.remove();
        document.removeEventListener("keydown", fecharComEscape);
    };

    const fecharComEscape = function (evento) {
        if (evento.key === "Escape") {
            fechar();
        }
    };

    modal.querySelector("button").onclick = fechar;

    modal.addEventListener("click", function (evento) {
        if (evento.target === modal) {
            fechar();
        }
    });

    document.addEventListener("keydown", fecharComEscape);

    try {
        const documento = await window.ClubeDB.textoDB
            .collection("publicacoes")
            .doc(idPublicacao)
            .get();

        if (!documento.exists) {
            throw new Error("Esta publicação não existe mais.");
        }

        const conteudo = document.getElementById("conteudo-modal-publicacao-perfil");

        if (conteudo) {
            conteudo.innerHTML = criarCardPublicacao(documento);
        }
    } catch (erro) {
        console.error("Erro ao abrir publicação do perfil:", erro);

        const conteudo = document.getElementById("conteudo-modal-publicacao-perfil");

        if (conteudo) {
            conteudo.innerHTML = `
                <div style="padding:30px;text-align:center;color:#ff6b6b;">
                    Não foi possível carregar esta publicação.
                </div>
            `;
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

                // 3. Atualizando a foto correta em todas as publicações já feitas pelo usuário
try {
    const pubsSnapshot = await window.ClubeDB.textoDB
        .collection("publicacoes")
        .where("autorUsername", "==", username)
        .get();

    if (!pubsSnapshot.empty) {
        const batch = window.ClubeDB.textoDB.batch();

        const avatarFinal =
            normalizarUrlPublicacao(novaUrl) ||
            window.AVATAR_USUARIO_PADRAO;

        pubsSnapshot.docs.forEach(docPub => {
            batch.update(docPub.ref, {
                autorFotoUrl: avatarFinal
            });
        });

        await batch.commit();
    }
} catch (errPubs) {
    console.error(
        "Erro ao atualizar avatar nas publicações do feed:",
        errPubs
    );
}

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

            // Retorna o avatar das publicações no feed para o padrão global do site
try {
    const pubsSnapshot = await window.ClubeDB.textoDB
        .collection("publicacoes")
        .where("autorUsername", "==", username)
        .get();

    if (!pubsSnapshot.empty) {
        const batch = window.ClubeDB.textoDB.batch();

        pubsSnapshot.docs.forEach(docPub => {
            batch.update(docPub.ref, {
                autorFotoUrl: window.AVATAR_USUARIO_PADRAO
            });
        });

        await batch.commit();
    }
} catch (errPubs) {
    console.error(
        "Erro ao remover avatar das publicações do feed:",
        errPubs
    );
}

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
async function atualizarIdentidadePWA(logoAppUrl) {
    const linkManifest = document.querySelector(
        'link[rel="manifest"]'
    );
    const appleTouchIcon = document.getElementById(
        "app-touch-icon"
    );
    const logoPersonalizada = String(
        logoAppUrl || ""
    ).trim();

    if (appleTouchIcon) {
        appleTouchIcon.href = logoPersonalizada ||
            "icons/icon-192x192.png";
    }

    if (!linkManifest) {
        return;
    }

    if (!linkManifest.dataset.manifestoOriginalHref) {
        linkManifest.dataset.manifestoOriginalHref =
            linkManifest.href;
    }

    if (!logoPersonalizada) {
        if (window._manifestoPwaBlobUrl) {
            URL.revokeObjectURL(
                window._manifestoPwaBlobUrl
            );
            window._manifestoPwaBlobUrl = null;
        }

        linkManifest.href =
            linkManifest.dataset.manifestoOriginalHref;
        return;
    }

    try {
        const resposta = await fetch(
            linkManifest.dataset.manifestoOriginalHref,
            { cache: "no-store" }
        );

        if (!resposta.ok) {
            throw new Error(
                `Manifesto retornou HTTP ${resposta.status}.`
            );
        }

        const manifesto = await resposta.json();
        manifesto.icons = [
            {
                src: logoPersonalizada,
                type: "image/png",
                sizes: "192x192",
                purpose: "any"
            },
            {
                src: logoPersonalizada,
                type: "image/png",
                sizes: "192x192",
                purpose: "maskable"
            },
            {
                src: logoPersonalizada,
                type: "image/png",
                sizes: "512x512",
                purpose: "any"
            }
        ];

        const manifestoBlob = new Blob(
            [JSON.stringify(manifesto)],
            { type: "application/manifest+json" }
        );

        if (window._manifestoPwaBlobUrl) {
            URL.revokeObjectURL(
                window._manifestoPwaBlobUrl
            );
        }

        window._manifestoPwaBlobUrl = URL.createObjectURL(
            manifestoBlob
        );
        linkManifest.href = window._manifestoPwaBlobUrl;
    } catch (erro) {
        console.warn(
            "Não foi possível atualizar a logo do manifesto PWA:",
            erro
        );
    }
}

async function carregarLogoClubeConfig() {
    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        const doc = await docRef.get();
        if (doc.exists) {
            const dados = doc.data();

            // 1. Aplica Logo do Site
            const logoImg = document.getElementById("site-logo-img");
            const logoTexto = document.getElementById("site-logo-texto");

            if (dados.logoUrl && logoImg) {
                logoImg.src = dados.logoUrl;
                logoImg.style.display = "inline-block";

                if (logoTexto) {
                    logoTexto.style.display = "none";
                }

                const previa = document.getElementById("previa-logo-site");
                if (previa) {
                    previa.src = dados.logoUrl;
                }
            }

            // 2. Aplica Logo do App/PWA
            const logoAppImg = document.getElementById("app-logo-img");

            if (dados.logoAppUrl && logoAppImg) {
                logoAppImg.src = dados.logoAppUrl;

                const previaApp = document.getElementById("previa-logo-app");
                if (previaApp) {
                    previaApp.src = dados.logoAppUrl;
                }
            }

            await atualizarIdentidadePWA(
                dados.logoAppUrl || ""
            );

            // 3. Aplica Favicon
            if (dados.faviconUrl) {
                let fav = document.getElementById("favicon-site");

                if (!fav) {
                    fav = document.createElement("link");
                    fav.rel = "icon";
                    fav.id = "favicon-site";
                    document.head.appendChild(fav);
                }

                fav.href = dados.faviconUrl;

                const previaFav = document.getElementById("previa-favicon");
                if (previaFav) {
                    previaFav.src = dados.faviconUrl;
                }
            }

            // 4. Aplica o avatar padrão dos usuários
            if (dados.avatarPadraoUrl) {
                window.AVATAR_USUARIO_PADRAO = dados.avatarPadraoUrl;

                const previaAvatar = document.getElementById("previa-avatar-padrao");
                if (previaAvatar) {
                    previaAvatar.src = dados.avatarPadraoUrl;
                }
            }

            // 5. Reaplica o tamanho salvo da logo após o F5
            const tamanhoLogo = Number(dados.logoTamanho);

            if (
                Number.isFinite(tamanhoLogo) &&
                tamanhoLogo > 0 &&
                logoImg
            ) {
                logoImg.style.height = `${tamanhoLogo}px`;
                logoImg.style.maxHeight = `${tamanhoLogo}px`;
                logoImg.style.width = "auto";
                logoImg.style.maxWidth = "250px";

                const slider = document.getElementById("logo-tamanho-slider");

                if (slider) {
                    slider.value = String(tamanhoLogo);
                }
            }
        }
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
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
    // Mapeamento exato dos IDs do seu HTML
    let inputId = "";
    let btnId = "";
    let campoBanco = "";

    if (tipo === 'site') {
        inputId = "logo-site-file";
        btnId = "btn-salvar-logo-site";
        campoBanco = "logoUrl";
    } else if (tipo === 'app') {
        inputId = "logo-app-file";
        btnId = "btn-salvar-logo-app";
        campoBanco = "logoAppUrl";
    } else if (tipo === 'favicon') {
        inputId = "favicon-file";
        btnId = "btn-salvar-favicon";
        campoBanco = "faviconUrl";
    } else if (tipo === 'avatar_padrao') {
        inputId = "avatar_padrao-file";
        btnId = "btn-salvar-avatar-padrao";
        campoBanco = "avatarPadraoUrl";
    }

    const fileInput = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    const arquivo = fileInput ? fileInput.files[0] : null;

    if (!arquivo) {
        alert("Por favor, selecione uma imagem primeiro!");
        return;
    }

    try {
        if (btn) { btn.disabled = true; btn.textContent = "Salvando..."; }

        // Faz o upload usando o seu sistema interno do ClubeDB
        const res = await window.ClubeDB.acoesAdmin.uploadFoto(arquivo);
        const urlFinal = res.url || res.secure_url || res;

        if (urlFinal) {
            await window.ClubeDB.textoDB.collection("configuracoes").doc("geral").set({
                [campoBanco]: urlFinal,
                [campoBanco.replace("Url", "IdPublico")]: res.public_id || ""
            }, { merge: true });

            alert("Avatar padrão atualizado com sucesso! 🛡️");
            carregarLogoClubeConfig(); // Recarrega para aplicar a mudança
        }
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Salvar Avatar"; }
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
    const nome = tipo === 'favicon' ? 'a miniatura' : (tipo === 'avatar_padrao' ? 'o avatar padrão' : `a logo do ${tipo}`);
    if (!confirm(`Tem certeza que deseja remover ${nome}?`)) return;

    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        const doc = await docRef.get();
        
        const campoUrl = tipo === 'site' ? "logoUrl" : (tipo === 'app' ? "logoAppUrl" : (tipo === 'favicon' ? "faviconUrl" : "avatarPadraoUrl"));
        const campoId = tipo === 'site' ? "logoIdPublico" : (tipo === 'app' ? "logoAppIdPublico" : (tipo === 'favicon' ? "faviconIdPublico" : "avatarPadraoIdPublico"));

        if (doc.exists) {
            const dados = doc.data();
            const idPublicoAntigo = dados[campoId];
            if (idPublicoAntigo && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                try { await window.ClubeDB.acoesAdmin.excluirFoto(idPublicoAntigo); } catch(e){}
            }
        }

        const atualizacao = {};
        atualizacao[campoUrl] = "";
        atualizacao[campoId] = "";
        await docRef.set(atualizacao, { merge: true });

        alert("Removido com sucesso.");
        if (tipo === 'avatar_padrao') {
            window.AVATAR_PADRAO_SITE = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
            const previa = document.getElementById("previa-avatar-padrao" );
            if (previa) previa.src = window.AVATAR_PADRAO_SITE;
        } else {
            usarTextoPadraoLogo(tipo);
        }
    } catch (e) {
        alert(`Erro ao remover: ` + e.message);
    }
}


async function desvincularPushDaContaAtual() {
    const usuarioFirebase = window.ClubeDB &&
        window.ClubeDB.loginDB &&
        window.ClubeDB.loginDB.currentUser;
    const username = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    try {
        if (usuarioFirebase && username) {
            const idToken = await usuarioFirebase.getIdToken(true);
            const requisicoes = [
                fetch(
                    `${WORKER_NOTIFICACOES_URL}/push/unsubscribe`,
                    {
                        method: "POST",
                        keepalive: true,
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                            username,
                            removerTodos: true
                        })
                    }
                ),
                fetch(
                    `${WORKER_NOTIFICACOES_URL}/push/presence`,
                    {
                        method: "POST",
                        keepalive: true,
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                            username,
                            visivel: false,
                            chatId: ""
                        })
                    }
                )
            ];

            await Promise.allSettled(requisicoes);
        }
    } catch (erro) {
        console.warn(
            "Não foi possível desvincular o Push no logout:",
            erro
        );
    } finally {
        localStorage.removeItem(
            "webPushAssinaturaAtiva"
        );
        localStorage.removeItem(
            "webPushEndpoint"
        );
        localStorage.removeItem(
            "webPushUsuarioAtivo"
        );
    }
}


// Limpa a sessão
async function fazerLogoutSessao() {
    await desvincularPushDaContaAtual();

    if (window._unsubscribeNotificacoesGerais) {
        window._unsubscribeNotificacoesGerais();
        window._unsubscribeNotificacoesGerais = null;
    }

    if (window._unsubscribeGlobalMensagens) {
        window._unsubscribeGlobalMensagens();
        window._unsubscribeGlobalMensagens = null;
    }

    window._listenerNotificacoesGeraisAtivo = false;
    window._listenerNotificacoesGeraisUsuario = "";
    window._listenerGlobalMensagensAtivo = false;
    window._listenerGlobalMensagensUsuario = "";

    if (typeof fecharPainelNotificacoes === "function") {
        fecharPainelNotificacoes();
    }

    if (window._timerAlertaNotificacaoGeral) {
        clearTimeout(
            window._timerAlertaNotificacaoGeral
        );
        window._timerAlertaNotificacaoGeral = null;
    }

    const alertaNotificacaoGeral = document.getElementById(
        "alerta-notificacao-geral"
    );

    if (alertaNotificacaoGeral) {
        alertaNotificacaoGeral.remove();
    }

    usuarioChatDestino = null;
    window._chatIdAtivo = null;
    sincronizarEstadoChatComServiceWorker();

    // Remove completamente os dados da sessão atual
    localStorage.removeItem("sessaoAdminLogado");
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("usernameLogado");

    // Limpa os dados visuais do perfil anterior
    const avatarPadrao = window.AVATAR_PADRAO_SITE ||
        "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
    const avatarEl = document.getElementById(
        "perfil-usuario-avatar"
     );
    const nomeEl = document.getElementById(
        "perfil-usuario-nome"
    );
    const cargoEl = document.getElementById(
        "perfil-usuario-cargo"
    );
    const unidadeEl = document.getElementById(
        "perfil-usuario-unidade-status"
    );
    const nascimentoEl = document.getElementById(
        "perfil-usuario-nascimento"
    );
    const contadorEl = document.getElementById(
        "perfil-usuario-conquistas-status"
    );
    const classesEl = document.getElementById(
        "perfil-conquistas-classes"
    );
    const especialidadesEl = document.getElementById(
        "perfil-conquistas-especialidades"
    );
    const mestradosEl = document.getElementById(
        "perfil-conquistas-mestrados"
    );
    const tClasses = document.getElementById(
        "titulo-conquistas-classes"
    );
    const tEspecialidades = document.getElementById(
        "titulo-conquistas-especialidades"
    );
    const tMestrados = document.getElementById(
        "titulo-conquistas-mestrados"
    );
    const gridEl = document.getElementById(
        "perfil-usuario-grid"
    );
    const vazioEl = document.getElementById(
        "perfil-publicacoes-vazio"
    );

    if (avatarEl) avatarEl.src = avatarPadrao;
    if (nomeEl) nomeEl.textContent = "Carregando...";
    if (cargoEl) cargoEl.textContent = "Cargo";
    if (unidadeEl) unidadeEl.textContent = "-";
    if (nascimentoEl) {
        nascimentoEl.textContent =
            "Nascido em: --/--/----";
    }
    if (contadorEl) contadorEl.textContent = "0";
    if (classesEl) {
        classesEl.textContent =
            "Nenhuma classe concluída.";
    }
    if (especialidadesEl) {
        especialidadesEl.textContent =
            "Nenhuma especialidade validada.";
    }
    if (mestradosEl) {
        mestradosEl.textContent =
            "Nenhum mestrado concluído ainda.";
    }
    if (tClasses) {
        tClasses.textContent =
            "🎒 Classes Regulares (0)";
    }
    if (tEspecialidades) {
        tEspecialidades.textContent =
            "🏅 Especialidades Adquiridas (0)";
    }
    if (tMestrados) {
        tMestrados.textContent =
            "🏆 Mestrados Adquiridos (0)";
    }
    if (gridEl) {
        gridEl.innerHTML = "";
        gridEl.style.display = "none";
    }
    if (vazioEl) {
        vazioEl.textContent =
            "Nenhuma publicação encontrada.";
        vazioEl.style.display = "block";
    }

    // Encerra a sessão do Firebase
    if (window.ClubeDB && window.ClubeDB.loginDB) {
        window.ClubeDB.loginDB
            .signOut()
            .catch(err => console.log(
                "Erro ao encerrar sessão: ",
                err
            ));
    }

    // Retorna para a tela de login
    const telaAdmin = document.getElementById(
        "tela-admin"
    );
    const telaSite = document.getElementById(
        "tela-site"
    );
    const telaLogin = document.getElementById(
        "tela-login"
    );

    if (telaAdmin) telaAdmin.style.display = "none";
    if (telaSite) telaSite.style.display = "none";
    if (telaLogin) telaLogin.style.display = "flex";
}



// Controle das abas do menu
let usuariosNotificacaoGeral = [];
let carregamentoNotificacaoGeralEmAndamento = null;

function normalizarTextoNotificacaoGeral(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function obterUsuariosNotificacaoGeral() {
    return Array.isArray(window._usuariosNotificacaoGeral)
        ? window._usuariosNotificacaoGeral
        : usuariosNotificacaoGeral;
}

async function carregarNotificacoesGeraisUsuarios() {
    const resumo = document.getElementById(
        "notificacao-geral-resumo"
    );

    if (window._usuariosNotificacaoGeralCarregado) {
        atualizarInterfaceNotificacaoGeral();
        return;
    }

    if (carregamentoNotificacaoGeralEmAndamento) {
        return carregamentoNotificacaoGeralEmAndamento;
    }

    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        if (resumo) {
            resumo.textContent =
                "Banco de dados ainda não foi inicializado.";
        }
        return;
    }

    if (resumo) {
        resumo.textContent =
            "Carregando usuários cadastrados...";
    }

    carregamentoNotificacaoGeralEmAndamento = (async () => {
        try {
            const snapshot = await window.ClubeDB.textoDB
                .collection("usuarios")
                .get();

            usuariosNotificacaoGeral = snapshot.docs
                .map(doc => {
                    const dados = doc.data() || {};
                    const username = String(
                        dados.username || ""
                    ).trim().toLowerCase();

                    return {
                        id: doc.id,
                        username,
                        nomeReal: String(
                            dados.nomeReal || username
                        ).trim(),
                        tipo: String(
                            dados.tipo || ""
                        ).trim(),
                        cargo: String(
                            dados.cargo || ""
                        ).trim(),
                        unidade: String(
                            dados.unidade || ""
                        ).trim()
                    };
                })
                .filter(usuario => usuario.username)
                .sort((a, b) => {
                    return a.nomeReal.localeCompare(
                        b.nomeReal,
                        "pt-BR",
                        { sensitivity: "base" }
                    );
                });

            window._usuariosNotificacaoGeral =
                usuariosNotificacaoGeral;
            window._usuariosNotificacaoGeralCarregado = true;

            atualizarInterfaceNotificacaoGeral();
        } catch (erro) {
            console.error(
                "Erro ao carregar usuários das notificações:",
                erro
            );

            if (resumo) {
                resumo.textContent =
                    "Não foi possível carregar os usuários. " +
                    (erro.message || "Tente novamente.");
            }
        } finally {
            carregamentoNotificacaoGeralEmAndamento = null;
        }
    })();

    return carregamentoNotificacaoGeralEmAndamento;
}

function preencherFiltroNotificacaoGeral() {
    const publico = document.getElementById(
        "notificacao-geral-publico"
    );
    const filtro = document.getElementById(
        "notificacao-geral-filtro"
    );

    if (!publico || !filtro) {
        return;
    }

    const usuarios = obterUsuariosNotificacaoGeral();
    const campo = publico.value === "unidade"
        ? "unidade"
        : "cargo";
    const valores = Array.from(
        new Set(
            usuarios
                .map(usuario => usuario[campo])
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const valorAnterior = filtro.value;
    filtro.innerHTML = "";

    const opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent =
        campo === "unidade"
            ? "Selecione a unidade"
            : "Selecione o cargo";
    filtro.appendChild(opcaoInicial);

    valores.forEach(valor => {
        const opcao = document.createElement("option");
        opcao.value = valor;
        opcao.textContent = valor;
        filtro.appendChild(opcao);
    });

    if (valores.includes(valorAnterior)) {
        filtro.value = valorAnterior;
    }
}

function renderizarListaUsuariosNotificacaoGeral() {
    const lista = document.getElementById(
        "notificacao-geral-lista-usuarios"
    );

    if (!lista) {
        return;
    }

    const usuarios = obterUsuariosNotificacaoGeral();

    if (!usuarios.length) {
        lista.innerHTML =
            "<span style=\"color:#aaa;\">Nenhum usuário encontrado.</span>";
        return;
    }

    const selecionados = new Set(
        Array.from(
            lista.querySelectorAll(
                "input[data-notificacao-usuario]:checked"
            )
        ).map(input => input.value)
    );

    lista.innerHTML = usuarios.map(usuario => {
        const marcado = selecionados.has(usuario.username)
            ? " checked"
            : "";
        const descricao = [
            usuario.cargo,
            usuario.unidade
        ].filter(Boolean).join(" · ");

        return `
            <label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:7px;background:#222;cursor:pointer;">
                <input type="checkbox" data-notificacao-usuario value="${escaparHtml(usuario.username)}"${marcado} onchange="atualizarResumoDestinatarios()">
                <span style="display:flex;flex-direction:column;gap:2px;">
                    <strong style="color:#fff;">${escaparHtml(usuario.nomeReal)}</strong>
                    <small style="color:#999;">@${escaparHtml(usuario.username)}${descricao ? " · " + escaparHtml(descricao) : ""}</small>
                </span>
            </label>
        `;
    }).join("");
}

function obterDestinatariosNotificacaoGeral() {
    const publico = document.getElementById(
        "notificacao-geral-publico"
    );
    const filtro = document.getElementById(
        "notificacao-geral-filtro"
    );
    const usuarios = obterUsuariosNotificacaoGeral();

    if (!publico) {
        return [];
    }

    const tipo = publico.value;
    const valorFiltro = normalizarTextoNotificacaoGeral(
        filtro && filtro.value
    );

    if (tipo === "todos") {
        return usuarios.map(usuario => usuario.username);
    }

    if (tipo === "lideranca") {
        return usuarios
            .filter(usuario => {
                return normalizarTextoNotificacaoGeral(
                    usuario.tipo
                ) === "lideranca";
            })
            .map(usuario => usuario.username);
    }

    if (tipo === "desbravadores") {
        return usuarios
            .filter(usuario => {
                return normalizarTextoNotificacaoGeral(
                    usuario.tipo
                ) === "desbravador";
            })
            .map(usuario => usuario.username);
    }

    if (tipo === "unidade" || tipo === "cargo") {
        return usuarios
            .filter(usuario => {
                return normalizarTextoNotificacaoGeral(
                    usuario[tipo]
                ) === valorFiltro;
            })
            .map(usuario => usuario.username);
    }

    if (tipo === "selecionados") {
        const lista = document.getElementById(
            "notificacao-geral-lista-usuarios"
        );

        return lista
            ? Array.from(
                lista.querySelectorAll(
                    "input[data-notificacao-usuario]:checked"
                )
            ).map(input => input.value)
            : [];
    }

    return [];
}

function atualizarResumoDestinatarios() {
    const resumo = document.getElementById(
        "notificacao-geral-resumo"
    );

    if (!resumo) {
        return;
    }

    const quantidade = obterDestinatariosNotificacaoGeral()
        .length;

    resumo.textContent = quantidade
        ? `${quantidade} usuário(s) receberão esta notificação.`
        : "Nenhum destinatário selecionado.";
}

function atualizarInterfaceNotificacaoGeral() {
    const publico = document.getElementById(
        "notificacao-geral-publico"
    );
    const filtroContainer = document.getElementById(
        "notificacao-geral-filtro-container"
    );
    const selecionadosContainer = document.getElementById(
        "notificacao-geral-selecionados-container"
    );

    if (!publico) {
        return;
    }

    const exigeFiltro =
        publico.value === "unidade" ||
        publico.value === "cargo";
    const exigeSelecao = publico.value === "selecionados";

    if (filtroContainer) {
        filtroContainer.style.display = exigeFiltro
            ? "block"
            : "none";
    }

    if (selecionadosContainer) {
        selecionadosContainer.style.display = exigeSelecao
            ? "block"
            : "none";
    }

    if (exigeFiltro) {
        preencherFiltroNotificacaoGeral();
    }

    if (exigeSelecao) {
        renderizarListaUsuariosNotificacaoGeral();
    }

    atualizarResumoDestinatarios();
}

function alternarSelecaoTodosNotificacaoGeral() {
    const lista = document.getElementById(
        "notificacao-geral-lista-usuarios"
    );

    if (!lista) {
        return;
    }

    const caixas = Array.from(
        lista.querySelectorAll(
            "input[data-notificacao-usuario]"
        )
    );
    const todosMarcados = caixas.length > 0 &&
        caixas.every(caixa => caixa.checked);

    caixas.forEach(caixa => {
        caixa.checked = !todosMarcados;
    });

    atualizarResumoDestinatarios();
}

function visualizarNotificacaoGeralAdmin() {
    const titulo = document.getElementById(
        "notificacao-geral-titulo"
    );
    const mensagem = document.getElementById(
        "notificacao-geral-mensagem"
    );
    const preview = document.getElementById(
        "notificacao-geral-preview"
    );
    const previewTitulo = document.getElementById(
        "notificacao-geral-preview-titulo"
    );
    const previewMensagem = document.getElementById(
        "notificacao-geral-preview-mensagem"
    );

    if (!titulo || !mensagem || !preview) {
        return;
    }

    const tituloValor = titulo.value.trim();
    const mensagemValor = mensagem.value.trim();

    if (!tituloValor || !mensagemValor) {
        alert("Preencha o título e a mensagem antes de visualizar.");
        return;
    }

    if (previewTitulo) {
        previewTitulo.textContent = tituloValor;
    }

    if (previewMensagem) {
        previewMensagem.textContent = mensagemValor;
    }

    preview.style.display = "block";
}
async function salvarNotificacaoGeralNoFirestore(
    titulo,
    mensagem,
    destinatarios
) {
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (
        !banco ||
        typeof banco.collection !== "function" ||
        typeof banco.batch !== "function"
    ) {
        throw new Error(
            "O banco de notificações ainda não está disponível."
        );
    }

    const usuarios = Array.from(
        new Set(
            (Array.isArray(destinatarios)
                ? destinatarios
                : []
            )
                .map(destinatario => String(
                    destinatario || ""
                ).trim().toLowerCase())
                .filter(Boolean)
        )
    );

    if (!usuarios.length) {
        return 0;
    }

    const tituloSeguro = String(
        titulo || ""
    ).trim();
    const mensagemSegura = String(
        mensagem || ""
    ).trim();
    const limitePorLote = 450;
    let quantidadeSalva = 0;

    for (
        let inicio = 0;
        inicio < usuarios.length;
        inicio += limitePorLote
    ) {
        const usuariosDoLote = usuarios.slice(
            inicio,
            inicio + limitePorLote
        );
        const lote = banco.batch();

        usuariosDoLote.forEach(username => {
            const referencia = banco
                .collection("notificacoes_gerais")
                .doc(username)
                .collection("itens")
                .doc();

            lote.set(referencia, {
                titulo: tituloSeguro,
                corpo: mensagemSegura,
                timestamp:
                    firebase.firestore.FieldValue.serverTimestamp(),
                lida: false,
                tipo: "geral",
                destinatario: username
            });
        });

        await lote.commit();
        quantidadeSalva += usuariosDoLote.length;
    }

    return quantidadeSalva;
}

function mostrarAlertaNotificacaoGeral(notificacao) {
    if (!notificacao) {
        return;
    }

    const alertaAnterior = document.getElementById(
        "alerta-notificacao-geral"
    );

    if (alertaAnterior) {
        alertaAnterior.remove();
    }

    const alerta = document.createElement("div");
    const conteudo = document.createElement("div");
    const titulo = document.createElement("strong");
    const corpo = document.createElement("div");
    const acoes = document.createElement("div");
    const abrir = document.createElement("button");
    const fechar = document.createElement("button");

    alerta.id = "alerta-notificacao-geral";
    alerta.setAttribute("role", "status");
    alerta.setAttribute("aria-live", "polite");
    alerta.style.position = "fixed";
    alerta.style.top = "calc(76px + env(safe-area-inset-top))";
    alerta.style.left = "16px";
    alerta.style.right = "16px";
    alerta.style.maxWidth = "420px";
    alerta.style.margin = "0 auto";
    alerta.style.display = "flex";
    alerta.style.alignItems = "flex-start";
    alerta.style.gap = "12px";
    alerta.style.padding = "14px 15px";
    alerta.style.boxSizing = "border-box";
    alerta.style.background = "#18212a";
    alerta.style.border = "1px solid #0095f6";
    alerta.style.borderRadius = "12px";
    alerta.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.45)";
    alerta.style.zIndex = "2147483002";

    conteudo.style.flex = "1";
    conteudo.style.minWidth = "0";

    titulo.textContent = String(
        notificacao.titulo || "Nova notificação"
    );
    titulo.style.display = "block";
    titulo.style.color = "#fff";
    titulo.style.fontSize = "14px";
    titulo.style.lineHeight = "1.3";

    corpo.textContent = String(
        notificacao.corpo || "Você recebeu uma notificação geral."
    );
    corpo.style.marginTop = "4px";
    corpo.style.color = "#d7d9db";
    corpo.style.fontSize = "13px";
    corpo.style.lineHeight = "1.4";
    corpo.style.whiteSpace = "pre-wrap";
    corpo.style.wordBreak = "break-word";

    acoes.style.display = "flex";
    acoes.style.flexDirection = "column";
    acoes.style.alignItems = "flex-end";
    acoes.style.gap = "8px";

    abrir.type = "button";
    abrir.textContent = "Ver";
    abrir.style.border = "none";
    abrir.style.background = "transparent";
    abrir.style.color = "#58b7ff";
    abrir.style.fontSize = "12px";
    abrir.style.fontWeight = "700";
    abrir.style.cursor = "pointer";
    abrir.style.padding = "0";

    fechar.type = "button";
    fechar.textContent = "×";
    fechar.setAttribute(
        "aria-label",
        "Fechar alerta de notificação"
    );
    fechar.style.border = "none";
    fechar.style.background = "transparent";
    fechar.style.color = "#fff";
    fechar.style.fontSize = "22px";
    fechar.style.lineHeight = "18px";
    fechar.style.cursor = "pointer";
    fechar.style.padding = "0";

    const removerAlerta = () => {
        if (window._timerAlertaNotificacaoGeral) {
            clearTimeout(
                window._timerAlertaNotificacaoGeral
            );
            window._timerAlertaNotificacaoGeral = null;
        }
        alerta.remove();
    };

    abrir.addEventListener("click", () => {
        removerAlerta();
        abrirPainelNotificacoes();
    });

    fechar.addEventListener("click", removerAlerta);

    conteudo.appendChild(titulo);
    conteudo.appendChild(corpo);
    acoes.appendChild(abrir);
    acoes.appendChild(fechar);
    alerta.appendChild(conteudo);
    alerta.appendChild(acoes);
    document.body.appendChild(alerta);

    window._timerAlertaNotificacaoGeral =
        setTimeout(removerAlerta, 8000);
}

function configurarCliqueExternoPainelNotificacoes() {
    if (window._cliqueExternoNotificacoesConfigurado) {
        return;
    }

    window._cliqueExternoNotificacoesConfigurado = true;

    document.addEventListener("click", evento => {
        const painel = document.getElementById(
            "painel-notificacoes-header"
        );
        const botao = document.getElementById(
            "btn-notificacoes-header"
        );

        if (
            !painel ||
            painel.style.display !== "flex"
        ) {
            return;
        }

        if (
            painel.contains(evento.target) ||
            (botao && botao.contains(evento.target))
        ) {
            return;
        }

        fecharPainelNotificacoes();
    });
}

function iniciarListenerNotificacoesGerais() {
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    configurarCliqueExternoPainelNotificacoes();

    if (!usernameLogado) {
        return;
    }

    if (
        !banco ||
        typeof banco.collection !== "function"
    ) {
        clearTimeout(
            window._timerListenerNotificacoesGerais
        );
        window._timerListenerNotificacoesGerais =
            setTimeout(
                iniciarListenerNotificacoesGerais,
                500
            );
        return;
    }

    if (
        window._listenerNotificacoesGeraisAtivo &&
        window._listenerNotificacoesGeraisUsuario ===
            usernameLogado &&
        window._unsubscribeNotificacoesGerais
    ) {
        return;
    }

    if (window._unsubscribeNotificacoesGerais) {
        window._unsubscribeNotificacoesGerais();
        window._unsubscribeNotificacoesGerais = null;
    }

    window._listenerNotificacoesGeraisAtivo = true;
    window._listenerNotificacoesGeraisUsuario =
        usernameLogado;
    window._notificacoesGeraisAtuais = [];
    window._notificacoesGeraisIdsConhecidos = new Set();

    let primeiraLeitura = true;

    const referencia = banco
        .collection("notificacoes_gerais")
        .doc(usernameLogado)
        .collection("itens");

    const unsubscribe = referencia.onSnapshot(
        snapshot => {
            const lista = [];

            snapshot.forEach(documento => {
                const dados = documento.data() || {};
                const tipo = String(
                    dados.tipo || "geral"
                ).trim().toLowerCase();

                if (tipo !== "geral") {
                    return;
                }

                lista.push({
                    id: documento.id,
                    ...dados
                });
            });

            lista.sort((primeiro, segundo) => {
                const valorPrimeiro =
                    primeiro.timestamp &&
                    typeof primeiro.timestamp.toMillis ===
                        "function"
                        ? primeiro.timestamp.toMillis()
                        : 0;
                const valorSegundo =
                    segundo.timestamp &&
                    typeof segundo.timestamp.toMillis ===
                        "function"
                        ? segundo.timestamp.toMillis()
                        : 0;

                return valorSegundo - valorPrimeiro;
            });

            const idsNovos = lista.filter(notificacao => {
                return !primeiraLeitura &&
                    !window._notificacoesGeraisIdsConhecidos.has(
                        notificacao.id
                    ) &&
                    notificacao.lida !== true;
            });

            window._notificacoesGeraisIdsConhecidos =
                new Set(
                    lista.map(notificacao => notificacao.id)
                );

            window._notificacoesGeraisAtuais = lista;

            idsNovos.slice(0, 3).forEach(
                mostrarAlertaNotificacaoGeral
            );

            primeiraLeitura = false;

            const naoLidas = lista.filter(
                notificacao => notificacao.lida !== true
            ).length;

            atualizarBadgeNotificacoesHeader(naoLidas);
            renderizarListaNotificacoesHeader(lista);
        },
        erro => {
            console.error(
                "Erro ao observar notificações gerais:",
                erro
            );
        }
    );

    window._unsubscribeNotificacoesGerais = () => {
        unsubscribe();
        window._listenerNotificacoesGeraisAtivo = false;
        window._listenerNotificacoesGeraisUsuario = "";
        window._notificacoesGeraisAtuais = [];
        window._notificacoesGeraisIdsConhecidos = new Set();
        atualizarBadgeNotificacoesHeader(0);
        renderizarListaNotificacoesHeader([]);
        fecharPainelNotificacoes();
    };
}


function atualizarBadgeNotificacoesHeader(total) {
    const badge = document.getElementById(
        "badge-notificacoes-header"
    );

    if (!badge) {
        return;
    }

    const quantidade = Math.max(0, Number(total) || 0);

    badge.textContent = quantidade > 99
        ? "99+"
        : String(quantidade);
    badge.style.display = quantidade > 0
        ? "block"
        : "none";
}

function formatarDataNotificacaoGeral(valor) {
    let data = null;

    if (
        valor &&
        typeof valor.toDate === "function"
    ) {
        data = valor.toDate();
    } else if (valor instanceof Date) {
        data = valor;
    } else if (
        typeof valor === "string" ||
        typeof valor === "number"
    ) {
        data = new Date(valor);
    }

    if (
        !data ||
        Number.isNaN(data.getTime())
    ) {
        return "Agora";
    }

    return data.toLocaleString(
        "pt-BR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}

function renderizarListaNotificacoesHeader(lista) {
    const container = document.getElementById(
        "lista-notificacoes-header"
    );
    const estadoVazio = document.getElementById(
        "estado-vazio-notificacoes-header"
    );

    if (!container || !estadoVazio) {
        return;
    }

    container.innerHTML = "";

    if (!Array.isArray(lista) || !lista.length) {
        estadoVazio.style.display = "block";
        return;
    }

    estadoVazio.style.display = "none";

    lista.forEach(notificacao => {
        const item = document.createElement("article");
        const cabecalho = document.createElement("div");
        const titulo = document.createElement("strong");
        const corpo = document.createElement("div");
        const rodape = document.createElement("div");
        const data = document.createElement("span");
        const excluir = document.createElement("button");

        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "8px";
        item.style.padding = "13px 15px";
        item.style.borderBottom = "1px solid #2f3336";
        item.style.borderLeft = notificacao.lida === true
            ? "3px solid transparent"
            : "3px solid #0095f6";
        item.style.background = notificacao.lida === true
            ? "#121212"
            : "#18212a";
        item.style.cursor = "pointer";
        item.setAttribute(
            "data-notificacao-id",
            String(notificacao.id || "")
        );

        cabecalho.style.display = "flex";
        cabecalho.style.alignItems = "flex-start";
        cabecalho.style.justifyContent = "space-between";
        cabecalho.style.gap = "10px";

        titulo.textContent = String(
            notificacao.titulo || "Notificação"
        );
        titulo.style.color = "#fff";
        titulo.style.fontSize = "14px";
        titulo.style.lineHeight = "1.3";

        corpo.textContent = String(
            notificacao.corpo || ""
        );
        corpo.style.color = "#d7d9db";
        corpo.style.fontSize = "13px";
        corpo.style.lineHeight = "1.45";
        corpo.style.whiteSpace = "pre-wrap";
        corpo.style.wordBreak = "break-word";

        rodape.style.display = "flex";
        rodape.style.alignItems = "center";
        rodape.style.justifyContent = "space-between";
        rodape.style.gap = "10px";

        data.textContent = formatarDataNotificacaoGeral(
            notificacao.timestamp
        );
        data.style.color = "#8e8e8e";
        data.style.fontSize = "11px";

        excluir.type = "button";
        excluir.textContent = "Excluir";
        excluir.style.border = "none";
        excluir.style.background = "transparent";
        excluir.style.color = "#ff6b6b";
        excluir.style.fontSize = "11px";
        excluir.style.fontWeight = "600";
        excluir.style.cursor = "pointer";
        excluir.style.padding = "3px 0";
        excluir.addEventListener("click", evento => {
            evento.stopPropagation();
            excluirNotificacao(notificacao.id);
        });

        cabecalho.appendChild(titulo);
        rodape.appendChild(data);
        rodape.appendChild(excluir);
        item.appendChild(cabecalho);
        item.appendChild(corpo);
        item.appendChild(rodape);

        item.addEventListener("click", () => {
            marcarNotificacaoComoLida(notificacao.id);
        });

        container.appendChild(item);
    });
}

function obterReferenciaNotificacoesGeraisUsuario() {
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();
    const banco = window.ClubeDB &&
        window.ClubeDB.textoDB;

    if (
        !usernameLogado ||
        !banco ||
        typeof banco.collection !== "function"
    ) {
        return null;
    }

    return banco
        .collection("notificacoes_gerais")
        .doc(usernameLogado)
        .collection("itens");
}

async function marcarNotificacaoComoLida(docId) {
    const id = String(docId || "").trim();
    const referencia =
        obterReferenciaNotificacoesGeraisUsuario();

    if (!id || !referencia) {
        return;
    }

    try {
        await referencia.doc(id).set(
            {
                lida: true
            },
            {
                merge: true
            }
        );
    } catch (erro) {
        console.error(
            "Erro ao marcar notificação geral como lida:",
            erro
        );
    }
}

async function excluirNotificacao(docId) {
    const id = String(docId || "").trim();
    const referencia =
        obterReferenciaNotificacoesGeraisUsuario();
    const usernameLogado = String(
        localStorage.getItem("usernameLogado") || ""
    ).trim().toLowerCase();

    if (!id || !referencia || !usernameLogado) {
        window.alert(
            "Não foi possível identificar a conta atual para excluir esta notificação."
        );
        return;
    }

    try {
        const documento = referencia.doc(id);
        await documento.delete();

        const listaAtual = Array.isArray(
            window._notificacoesGeraisAtuais
        )
            ? window._notificacoesGeraisAtuais
            : [];
        const novaLista = listaAtual.filter(
            notificacao => String(
                notificacao.id || ""
            ) !== id
        );

        window._notificacoesGeraisAtuais = novaLista;
        atualizarBadgeNotificacoesHeader(
            novaLista.filter(
                notificacao => notificacao.lida !== true
            ).length
        );
        renderizarListaNotificacoesHeader(novaLista);
    } catch (erro) {
        const codigo = String(
            erro && erro.code ||
            "sem-codigo"
        );
        const mensagem = String(
            erro && erro.message ||
            erro ||
            "Falha desconhecida."
        );

        console.error(
            "Erro ao excluir notificação geral:",
            {
                codigo,
                mensagem,
                usernameLogado,
                docId: id
            }
        );

        window.alert(
            `Não foi possível excluir a notificação.\n\n` +
            `Código: ${codigo}\n` +
            `Detalhes: ${mensagem}`
        );
    }
}


async function limparTodasNotificacoes() {
    const referencia =
        obterReferenciaNotificacoesGeraisUsuario();

    if (!referencia) {
        return;
    }

    const confirmar = window.confirm(
        "Deseja apagar todas as suas notificações gerais?"
    );

    if (!confirmar) {
        return;
    }

    try {
        const snapshot = await referencia.get();
        const documentos = snapshot.docs || [];
        const limitePorLote = 450;

        for (
            let inicio = 0;
            inicio < documentos.length;
            inicio += limitePorLote
        ) {
            const lote = window.ClubeDB.textoDB.batch();
            const documentosDoLote = documentos.slice(
                inicio,
                inicio + limitePorLote
            );

            documentosDoLote.forEach(documento => {
                lote.delete(documento.ref);
            });

            if (documentosDoLote.length) {
                await lote.commit();
            }
        }

        window._notificacoesGeraisAtuais = [];
        atualizarBadgeNotificacoesHeader(0);
        renderizarListaNotificacoesHeader([]);
    } catch (erro) {
        console.error(
            "Erro ao limpar notificações gerais:",
            erro
        );
        window.alert(
            "Não foi possível limpar suas notificações. " +
            "Verifique sua conexão e tente novamente."
        );
    }
}


function fecharPainelNotificacoes() {
    const painel = document.getElementById(
        "painel-notificacoes-header"
    );
    const botao = document.getElementById(
        "btn-notificacoes-header"
    );

    if (painel) {
        painel.style.display = "none";
        painel.setAttribute("aria-hidden", "true");
    }

    if (botao) {
        botao.setAttribute("aria-expanded", "false");
    }
}

function abrirPainelNotificacoes() {
    const painel = document.getElementById(
        "painel-notificacoes-header"
    );
    const botao = document.getElementById(
        "btn-notificacoes-header"
    );

    if (!painel) {
        return;
    }

    const estaAberto = painel.style.display === "flex";

    if (estaAberto) {
        fecharPainelNotificacoes();
        return;
    }

    painel.style.display = "flex";
    painel.setAttribute("aria-hidden", "false");

    if (botao) {
        botao.setAttribute("aria-expanded", "true");
    }
}

async function purgarRegistrosPushAntigosAdmin() {
    if (
        localStorage.getItem("usuarioLogado") !==
        "admin"
    ) {
        window.alert(
            "Somente o administrador pode executar esta limpeza."
        );
        return;
    }

    const usuarioFirebase = window.ClubeDB &&
        window.ClubeDB.loginDB &&
        window.ClubeDB.loginDB.currentUser;

    if (!usuarioFirebase) {
        window.alert(
            "A sessão do administrador não está disponível."
        );
        return;
    }

    const confirmar = window.confirm(
        "Esta ação removerá os registros Push antigos de todas as contas. " +
        "As notificações internas não serão apagadas. " +
        "Depois, cada usuário deverá abrir o site novamente para registrar o dispositivo. " +
        "Deseja continuar?"
    );

    if (!confirmar) {
        return;
    }

    const botao = document.getElementById(
        "btn-limpar-push-antigos"
    );

    if (botao) {
        botao.disabled = true;
        botao.textContent = "Limpando registros Push...";
        botao.style.opacity = "0.65";
    }

    try {
        const idToken = await usuarioFirebase.getIdToken(
            true
        );
        const resposta = await fetch(
            `${WORKER_NOTIFICACOES_URL}/push/admin-purge`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    confirmacao: "LIMPAR_PUSH_ANTIGOS"
                })
            }
        );
        const corpo = await resposta.text();
        let dados = {};

        try {
            dados = corpo ? JSON.parse(corpo) : {};
        } catch (erroJSON) {
            throw new Error(
                "O Worker devolveu uma resposta inválida."
            );
        }

        if (!resposta.ok || dados.ok !== true) {
            throw new Error(
                dados.erro ||
                `O Worker recusou a limpeza (HTTP ${resposta.status}).`
            );
        }

        window.alert(
            "Limpeza concluída. " +
            `${Number(dados.usuariosRemovidos || 0)} registro(s) de Push e ` +
            `${Number(dados.presencasRemovidas || 0)} presença(s) foram removidos. ` +
            "Os usuários deverão abrir o site novamente para registrar o dispositivo."
        );
    } catch (erro) {
        console.error(
            "Erro ao limpar registros Push antigos:",
            erro
        );
        window.alert(
            erro.message ||
            "Não foi possível limpar os registros Push antigos."
        );
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent =
                "Limpar registros Push antigos";
            botao.style.opacity = "1";
        }
    }
}

let envioNotificacaoGeralEmAndamento = false;





async function enviarNotificacaoGeralAdmin() {
    const status = document.getElementById(
        "notificacao-geral-status"
    );
    const tituloEl = document.getElementById(
        "notificacao-geral-titulo"
    );
    const mensagemEl = document.getElementById(
        "notificacao-geral-mensagem"
    );
    const botao = document.querySelector(
        'button[onclick="enviarNotificacaoGeralAdmin()"]'
    );

    if (envioNotificacaoGeralEmAndamento) {
        return;
    }

    if (
        localStorage.getItem("usuarioLogado") !== "admin"
    ) {
        if (status) {
            status.style.color = "#ff6b6b";
            status.textContent =
                "Somente o administrador pode enviar notificações gerais.";
        }
        return;
    }

    const usuarioFirebase = window.ClubeDB &&
        window.ClubeDB.loginDB &&
        window.ClubeDB.loginDB.currentUser;

    if (!usuarioFirebase) {
        if (status) {
            status.style.color = "#ff6b6b";
            status.textContent =
                "A sessão do administrador não está disponível.";
        }
        return;
    }

    const titulo = tituloEl
        ? tituloEl.value.trim()
        : "";
    const mensagem = mensagemEl
        ? mensagemEl.value.trim()
        : "";
    const destinatarios =
        typeof obterDestinatariosNotificacaoGeral ===
            "function"
            ? obterDestinatariosNotificacaoGeral()
            : [];

    if (!titulo || !mensagem) {
        if (status) {
            status.style.color = "#ff6b6b";
            status.textContent =
                "Preencha o título e a mensagem.";
        }
        return;
    }

    if (!destinatarios.length) {
        if (status) {
            status.style.color = "#ff6b6b";
            status.textContent =
                "Selecione pelo menos um destinatário.";
        }
        return;
    }

    const confirmar = window.confirm(
        `Enviar esta notificação para ${destinatarios.length} usuário(s)?`
    );

    if (!confirmar) {
        return;
    }

    envioNotificacaoGeralEmAndamento = true;

    if (botao) {
        botao.disabled = true;
        botao.style.opacity = "0.65";
        botao.textContent = "Enviando...";
    }

    if (status) {
        status.style.color = "#8e8e8e";
        status.textContent =
            "Enviando a notificação para os dispositivos registrados...";
    }

    try {
        const idToken = await usuarioFirebase.getIdToken(true);
        const resposta = await fetch(
            `${WORKER_NOTIFICACOES_URL}/push/admin-send`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    titulo,
                    mensagem,
                    destinatarios
                })
            }
        );

        const corpo = await resposta.text();
        let dados = {};

        try {
            dados = corpo ? JSON.parse(corpo) : {};
        } catch (erroJSON) {
            throw new Error(
                "O Worker devolveu uma resposta inválida."
            );
        }

        if (!resposta.ok || dados.ok !== true) {
            throw new Error(
                dados.erro ||
                `O Worker recusou o envio (HTTP ${resposta.status}).`
            );
        }

        const enviados = Number(
            dados.dispositivosNotificados || 0
        );
        const comDispositivo = Number(
            dados.destinatariosComDispositivo || 0
        );
        const falhas = Number(dados.falhas || 0);
        let quantidadeSalva = 0;
        let erroPersistencia = null;

        try {
            quantidadeSalva =
                await salvarNotificacaoGeralNoFirestore(
                    titulo,
                    mensagem,
                    destinatarios
                );
        } catch (erroFirestore) {
            erroPersistencia = erroFirestore;
            console.error(
                "O Push foi enviado, mas a notificação não foi salva no centro interno:",
                erroFirestore
            );
        }

        if (status) {
            if (erroPersistencia) {
                status.style.color = "#ffb44d";
                status.textContent =
                    "O Push foi processado, mas não foi possível salvar a notificação dentro do app. Verifique as regras do Firestore antes de reenviar.";
            } else if (enviados) {
                status.style.color = "#5edc8a";
                status.textContent =
                    `Notificação enviada para ${enviados} dispositivo(s), de ${comDispositivo} usuário(s) com Push ativo${falhas ? `; falhas: ${falhas}.` : "."} Também foi salva no centro do app para ${quantidadeSalva} usuário(s).`;
            } else {
                status.style.color = "#5edc8a";
                status.textContent =
                    `Notificação salva no centro do app para ${quantidadeSalva} usuário(s), mas nenhum destinatário possui um dispositivo registrado para receber Push.`;
            }
        }
    } catch (erro) {
        console.error(
            "Erro ao enviar notificação geral:",
            erro
        );

        if (status) {
            status.style.color = "#ff6b6b";
            status.textContent =
                erro.message ||
                "Não foi possível enviar a notificação.";
        }
    } finally {
        envioNotificacaoGeralEmAndamento = false;

        if (botao) {
            botao.disabled = false;
            botao.style.opacity = "1";
            botao.textContent = "Enviar notificação";
        }
    }
}


function mudarAbaAdmin(idAbaDestino) {
    const conteudos = document.querySelectorAll(".conteudo-aba");
    conteudos.forEach(aba => {
        aba.style.display = "none";
    });

    const botoes = document.querySelectorAll(".aba-item");
    botoes.forEach(btn => {
        btn.classList.remove("ativa");
    });

    const alvo = document.getElementById(idAbaDestino);
    if (alvo) {
        alvo.style.display = "flex";
        alvo.style.flexDirection = "column";
    }

    const botaoClicado = Array.from(botoes).find(btn => {
        const acao = btn.getAttribute("onclick") || "";
        return acao.includes(idAbaDestino);
    });

    if (botaoClicado) {
        botaoClicado.classList.add("ativa");
    }

    // Carrega os cargos somente quando a aba de cargos é aberta.
    // A chave de fechamento abaixo é obrigatória para impedir erro de sintaxe.
    if (idAbaDestino === "aba-cargos") {
        carregarCargosAdmin();
    }

    // Carrega a gestão de conquistas somente quando a aba é aberta.
    if (idAbaDestino === "aba-conquistas-gestao") {
        carregarUsuariosParaGestaoConquistas();
    }

    if (idAbaDestino === "aba-notificacoes-gerais") {
        carregarNotificacoesGeraisUsuarios();
        atualizarInterfaceNotificacaoGeral();
    }
}



function controlarExibicaoSelecaoUnidade() {
    const tipoSelecionado = document.getElementById("membro-tipo").value;
    const campoUnidade = document.getElementById("membro-unidade-vinculo");
    const selectCargo = document.getElementById("membro-cargo");
    const cargoSelecionado = cargosAdminCache.find(
        cargo => cargo.id === (selectCargo ? selectCargo.value : "")
    );
    const funcaoCargo = String(
        cargoSelecionado ? cargoSelecionado.funcao : ""
    ).trim().toLowerCase();
    const ehConselheiroUnidade =
        funcaoCargo === "conselheiro_unidade" ||
        funcaoCargo === "conselheiro de unidade";

    if (!campoUnidade) {
        return;
    }

    const deveMostrarUnidade =
        tipoSelecionado !== "Liderança" ||
        ehConselheiroUnidade;

    campoUnidade.style.display = deveMostrarUnidade
        ? "block"
        : "none";

    if (!deveMostrarUnidade) {
        campoUnidade.value = "";
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
    const selectCriacao = document.getElementById("membro-unidade-vinculo");
    const selectEdicao = document.getElementById("edit-membro-unidade-vinculo");

    if (container) {
        container.innerHTML = "<p style='color:#aaa;'>Carregando unidades...</p>";
    }

    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        if (container) {
            container.innerHTML = "<p style='color:#ff6b6b;'>Banco de dados ainda não foi inicializado. Tente novamente.</p>";
        }
        return;
    }

    try {
        const snapshot = await window.ClubeDB.textoDB
            .collection("unidades")
            .get();

        const selects = [selectCriacao, selectEdicao].filter(Boolean);
        const valoresAnteriores = selects.map(select => select.value);

        selects.forEach(select => {
            select.innerHTML = '<option value="">Selecione a Unidade...</option>';
        });

        if (container) {
            container.innerHTML = "";
        }

        if (snapshot.empty) {
            if (container) {
                container.innerHTML = "<p style='color:#aaa;'>Nenhuma unidade cadastrada.</p>";
            }
            return;
        }

        snapshot.forEach((doc, indice) => {
            const dados = doc.data() || {};
            const nome = String(dados.nome || "").trim();
            const fotoUrl = dados.fotoUrl || "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

            if (!nome ) {
                return;
            }

            selects.forEach(select => {
                const option = document.createElement("option");
                option.value = nome;
                option.textContent = nome;
                select.appendChild(option);
            });

            if (container) {
                const item = document.createElement("div");
                item.className = "item-unidade";
                item.style.cssText = "text-align:center;margin-bottom:20px;border:1px solid #444;padding:10px;border-radius:8px;";

                const imagem = document.createElement("img");
                imagem.src = fotoUrl;
                imagem.alt = "Foto da unidade";
                imagem.style.cssText = "width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:10px;";

                const titulo = document.createElement("div");
                titulo.textContent = nome;
                titulo.style.cssText = "font-weight:bold;margin-bottom:10px;";

                const botoes = document.createElement("div");
                botoes.style.cssText = "display:flex;gap:5px;";

                const botaoEditar = document.createElement("button");
                botaoEditar.type = "button";
                botaoEditar.textContent = "✏️ Editar";
                botaoEditar.style.flex = "1";
                botaoEditar.style.padding = "5px";
                botaoEditar.addEventListener("click", () => {
                    iniciarEdicaoUnidade(
                        doc.id,
                        nome,
                        dados.fotoIdPublico || ""
                    );
                });

                const botaoApagar = document.createElement("button");
                botaoApagar.type = "button";
                botaoApagar.textContent = "🗑️ Apagar";
                botaoApagar.style.cssText = "flex:1;padding:5px;background:#ff4d4d;color:white;border:none;";
                botaoApagar.addEventListener("click", () => {
                    deletarUnidadeComFoto(
                        doc.id,
                        dados.fotoIdPublico || ""
                    );
                });

                botoes.appendChild(botaoEditar);
                botoes.appendChild(botaoApagar);
                item.appendChild(imagem);
                item.appendChild(titulo);
                item.appendChild(botoes);
                container.appendChild(item);
            }
        });

        selects.forEach((select, indice) => {
            const valorAnterior = valoresAnteriores[indice];

            if (
                valorAnterior &&
                Array.from(select.options).some(option => option.value === valorAnterior)
            ) {
                select.value = valorAnterior;
            }
        });
    } catch (erro) {
        console.error("Erro ao carregar unidades:", erro);

        if (container) {
            container.innerHTML = `
                <p style="color:#ff6b6b;">
                    Não foi possível carregar as unidades.  

                    <small>${escaparHtml(erro.message || "Erro desconhecido")}</small>
                </p>
                <button type="button" onclick="carregarUnidadesCadastradas()">
                    Tentar novamente
                </button>
            `;
        }
    }
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
// === LÓGICA DE GERENCIAMENTO DE CARGOS E MEMBROS ===
let cargosAdminCache = [];

function nomeFuncaoCargo(funcao) {
    const nomes = {
        nenhuma: "Nenhuma função adicional",
        secretario_unidade: "Secretário(a) de Unidade",
        secretario_clube: "Secretário(a) do Clube",
        conselheiro_unidade: "Conselheiro(a) de Unidade"
    };
    return nomes[funcao] || "Função personalizada";
}

async function renderizarPainelSecretarioClubeEventos(
    container,
    banco,
    usernameLogado
) {
    const secao = document.createElement("section");
    const titulo = document.createElement("h2");
    const descricao = document.createElement("p");
    const barraMes = document.createElement("div");
    const voltarMes = document.createElement("button");
    const avancarMes = document.createElement("button");
    const tituloMes = document.createElement("strong");
    const diasSemana = document.createElement("div");
    const calendario = document.createElement("div");
    const detalhe = document.createElement("div");
    const tiposBox = document.createElement("div");
    const status = document.createElement("p");
    const nomesMeses = [
        "JANEIRO",
        "FEVEREIRO",
        "MARÇO",
        "ABRIL",
        "MAIO",
        "JUNHO",
        "JULHO",
        "AGOSTO",
        "SETEMBRO",
        "OUTUBRO",
        "NOVEMBRO",
        "DEZEMBRO"
    ];
    const nomesDias = [
        "DOM",
        "SEG",
        "TER",
        "QUA",
        "QUI",
        "SEX",
        "SÁB"
    ];
    const tiposPadrao = [
        {
            id: "reuniao",
            nome: "Reunião",
            cor: "#58b7ff"
        },
        {
            id: "acao",
            nome: "Ação",
            cor: "#20c997"
        },
        {
            id: "acampamento",
            nome: "Acampamento",
            cor: "#f0ad4e"
        },
        {
            id: "agenda",
            nome: "Agenda",
            cor: "#bd8cff"
        },
        {
            id: "outra_atividade",
            nome: "Outra atividade",
            cor: "#a8a8a8"
        }
    ];
    let mesAtual = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
    );
    let diaSelecionado = "";
    let eventos = [];
    let tipos = [];

    const aplicarEstilo = (elemento, estilos, importantes = []) => {
        Object.entries(estilos).forEach(([propriedade, valor]) => {
            const propriedadeCss = String(
                propriedade
            ).replace(
                /[A-Z]/g,
                letra => `-${letra.toLowerCase()}`
            );
            const prioridade = importantes.some(item => {
                const itemCss = String(item).replace(
                    /[A-Z]/g,
                    letra => `-${letra.toLowerCase()}`
                );
                return item === propriedade ||
                    itemCss === propriedadeCss;
            })
                ? "important"
                : "";

            elemento.style.setProperty(
                propriedadeCss,
                valor,
                prioridade
            );
        });
    };

    const criarDataId = data => {
        return [
            data.getFullYear(),
            String(data.getMonth() + 1).padStart(2, "0"),
            String(data.getDate()).padStart(2, "0")
        ].join("-");
    };

    const formatarData = dataId => {
        const partes = String(dataId || "").split("-");
        return partes.length === 3
            ? `${partes[2]}/${partes[1]}/${partes[0]}`
            : String(dataId || "");
    };

    const normalizar = texto => String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const localizarTipo = evento => {
        const id = String(
            evento && (evento.tipoId || evento.tipo) || ""
        ).trim();
        return tipos.find(tipo => tipo.id === id) || {
            id: id || "outra_atividade",
            nome: String(
                evento && evento.tipoNome || "Outra atividade"
            ),
            cor: "#a8a8a8"
        };
    };

    const prepararBotao = (botao, principal = false, perigo = false) => {
        botao.type = "button";
        aplicarEstilo(botao, {
            display: "inline-flex",
            width: "auto",
            minWidth: "0",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 10px",
            border: "1px solid #3a3a3a",
            borderRadius: "8px",
            background: principal ? "#0095f6" : "#1c1c1c",
            color: principal
                ? "#fff"
                : perigo
                    ? "#ff8b8b"
                    : "#d7d9db",
            fontSize: "11px",
            fontWeight: principal ? "700" : "400",
            lineHeight: "1.2",
            cursor: "pointer",
            boxSizing: "border-box"
        }, [
            "display",
            "width",
            "background",
            "color"
        ]);
    };

    const prepararCampo = campo => {
        aplicarEstilo(campo, {
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 10px",
            border: "1px solid #3a3a3a",
            borderRadius: "8px",
            background: "#1c1c1c",
            color: "#fff",
            fontSize: "12px"
        }, [
            "display",
            "width",
            "background",
            "color"
        ]);
    };

    const criarLabel = (texto, campo) => {
        const label = document.createElement("label");
        const legenda = document.createElement("span");
        aplicarEstilo(label, {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            color: "#d7d9db",
            fontSize: "11px"
        }, ["display"]);
        legenda.textContent = texto;
        label.appendChild(legenda);
        label.appendChild(campo);
        return label;
    };

    const carregarTipos = async () => {
        const snapshot = await banco
            .collection("configuracoes_clube")
            .doc("tipos_eventos")
            .get();
        const dados = snapshot.exists
            ? snapshot.data() || {}
            : {};
        tipos = Array.isArray(dados.tipos)
            ? dados.tipos
                .filter(item => item && item.ativo !== false)
                .map(item => ({
                    id: String(item.id || "").trim(),
                    nome: String(item.nome || "").trim(),
                    cor: String(item.cor || "#a8a8a8").trim()
                }))
                .filter(item => item.id && item.nome)
            : [];
        if (!tipos.length) {
            tipos = tiposPadrao.map(item => ({
                ...item
            }));
        }
    };

    const salvarTipos = async () => {
        await banco
            .collection("configuracoes_clube")
            .doc("tipos_eventos")
            .set({
                tipos,
                atualizadoPor: usernameLogado,
                atualizadoEm:
                    firebase.firestore.FieldValue.serverTimestamp()
            }, {
                merge: true
            });
    };

    const carregarEventos = async () => {
        const [eventosSnapshot, unidadesSnapshot, usuariosSnapshot] =
            await Promise.all([
                banco
                    .collection("eventos_clube")
                    .get(),
                banco
                    .collection("unidades")
                    .get(),
                banco
                    .collection("usuarios")
                    .get()
            ]);
        const usuariosPorUsername = new Map();

        usuariosSnapshot.forEach(documento => {
            const dados = documento.data() || {};
            const username = String(
                dados.username || ""
            ).trim().toLowerCase();

            if (username) {
                usuariosPorUsername.set(username, {
                    username,
                    nome: String(
                        dados.nomeReal || username
                    ).trim(),
                    cargo: String(
                        dados.cargo || "Participante"
                    ).trim(),
                    fotoUrl: String(
                        dados.fotoUrl || ""
                    ).trim()
                });
            }
        });

        const frequenciasPorData = new Map();

        await Promise.all(
            unidadesSnapshot.docs.map(async unidadeDocumento => {
                const unidadeDados =
                    unidadeDocumento.data() || {};
                const unidadeId = unidadeDocumento.id;
                const nomeUnidade = String(
                    unidadeDados.nome ||
                    unidadeDados.nomeUnidade ||
                    unidadeId
                ).trim();
                const registrosSnapshot = await banco
                    .collection("frequencias_unidades")
                    .doc(unidadeId)
                    .collection("registros")
                    .get();

                registrosSnapshot.forEach(registroDocumento => {
                    const dados = registroDocumento.data() || {};
                    const data = String(
                        dados.data || registroDocumento.id || ""
                    ).trim();

                    if (!data) {
                        return;
                    }

                    const statusPorMembro =
                        dados.statusPorMembro || {};
                    const justificativasPorMembro =
                        dados.justificativasPorMembro || {};
                    const frequencia = {
                        id: registroDocumento.id,
                        data,
                        unidadeId,
                        unidade: String(
                            dados.unidade || nomeUnidade
                        ).trim(),
                        presentes: Array.isArray(
                            dados.presentes
                        )
                            ? dados.presentes
                                .map(username => String(
                                    username || ""
                                ).trim().toLowerCase())
                                .filter(Boolean)
                            : [],
                        faltas: Array.isArray(
                            dados.faltas
                        )
                            ? dados.faltas
                                .map(username => String(
                                    username || ""
                                ).trim().toLowerCase())
                                .filter(Boolean)
                            : [],
                        justificados: Array.isArray(
                            dados.justificados
                        )
                            ? dados.justificados
                                .map(username => String(
                                    username || ""
                                ).trim().toLowerCase())
                                .filter(Boolean)
                            : [],
                        statusPorMembro,
                        justificativasPorMembro,
                        atualizadoEm: dados.atualizadoEm || null
                    };
                    const listaAtual = frequenciasPorData.get(data) || [];
                    listaAtual.push(frequencia);
                    frequenciasPorData.set(data, listaAtual);
                });
            })
        );

        eventos = eventosSnapshot.docs.map(documento => {
            const dados = documento.data() || {};
            const data = String(
                dados.data || ""
            ).trim();
            const frequencias = frequenciasPorData.get(data) || [];

            return {
                id: documento.id,
                ...dados,
                data,
                frequencias,
                totalFrequencias: frequencias.length,
                totalPresentes: frequencias.reduce(
                    (total, frequencia) => {
                        return total + frequencia.presentes.length;
                    },
                    0
                ),
                totalFaltas: frequencias.reduce(
                    (total, frequencia) => {
                        return total +
                            frequencia.faltas.length +
                            frequencia.justificados.length;
                    },
                    0
                ),
                totalJustificados: frequencias.reduce(
                    (total, frequencia) => {
                        return total +
                            frequencia.justificados.length;
                    },
                    0
                ),
                usuariosPorUsername
            };
        });
    };


    const mostrarErro = (mensagem, erro) => {
        console.error(mensagem, erro);
        window.alert(mensagem);
    };

    const renderizarCalendario = () => {
        calendario.innerHTML = "";
        tituloMes.textContent =
            `${nomesMeses[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;

        const primeiroDia = new Date(
            mesAtual.getFullYear(),
            mesAtual.getMonth(),
            1
        ).getDay();
        const totalDias = new Date(
            mesAtual.getFullYear(),
            mesAtual.getMonth() + 1,
            0
        ).getDate();
        const hojeId = criarDataId(new Date());

        for (let indice = 0; indice < primeiroDia; indice += 1) {
            const vazio = document.createElement("div");
            aplicarEstilo(vazio, {
                minHeight: "76px"
            });
            calendario.appendChild(vazio);
        }

        for (let dia = 1; dia <= totalDias; dia += 1) {
            const data = new Date(
                mesAtual.getFullYear(),
                mesAtual.getMonth(),
                dia
            );
            const dataId = criarDataId(data);
            const eventosDoDia = eventos.filter(evento => {
                return String(evento.data || "") === dataId;
            });
            const celula = document.createElement("button");
            const numero = document.createElement("strong");
            const lista = document.createElement("span");

            prepararBotao(celula);
            aplicarEstilo(celula, {
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "flex-start",
                gap: "4px",
                width: "auto",
                minWidth: "0",
                minHeight: "76px",
                padding: "6px 4px",
                border: dataId === diaSelecionado
                    ? "2px solid #0095f6"
                    : dataId === hojeId
                        ? "1px solid #58b7ff"
                        : "1px solid #262626",
                borderRadius: "6px",
                background: dataId === diaSelecionado
                    ? "#123d60"
                    : eventosDoDia.length
                        ? "#172b3b"
                        : "#121212",
                color: "#fff",
                textAlign: "left",
                lineHeight: "1.2",
                cursor: "pointer",
                boxSizing: "border-box"
            }, [
                "display",
                "width",
                "background",
                "color"
            ]);

            numero.textContent = dataId === hojeId
                ? `${dia} · HOJE`
                : String(dia);
            aplicarEstilo(numero, {
                display: "block",
                color: dataId === diaSelecionado
                    ? "#8dccff"
                    : dataId === hojeId
                        ? "#58b7ff"
                        : "#d7d9db",
                fontSize: "11px",
                fontWeight: "700"
            }, ["display", "color"]);

            aplicarEstilo(lista, {
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                width: "100%",
                minWidth: "0",
                color: dataId === diaSelecionado
                    ? "#d9efff"
                    : "#d7d9db",
                fontSize: "9px",
                lineHeight: "1.2",
                overflow: "hidden"
            }, [
                "display",
                "width",
                "color"
            ]);

            eventosDoDia.slice(0, 2).forEach(evento => {
                const item = document.createElement("span");
                const tipo = localizarTipo(evento);
                item.textContent = tipo.nome;
                item.title = evento.titulo || tipo.nome;
                aplicarEstilo(item, {
                    display: "block",
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                }, ["display", "width"]);
                lista.appendChild(item);
            });

            if (eventosDoDia.length > 2) {
                const mais = document.createElement("span");
                mais.textContent = `+ ${eventosDoDia.length - 2} evento(s)`;
                mais.style.color = "#8e8e8e";
                lista.appendChild(mais);
            }

            celula.appendChild(numero);
            celula.appendChild(lista);
            celula.addEventListener(
                "click",
                () => {
                    diaSelecionado = dataId;
                    renderizarCalendario();
                    renderizarDetalhe();
                }
            );
            calendario.appendChild(celula);
        }
    };

    const abrirFormularioEvento = eventoAtual => {
        const formulario = document.createElement("form");
        const tituloFormulario = document.createElement("strong");
        const data = document.createElement("input");
        const tipo = document.createElement("select");
        const tituloEvento = document.createElement("input");
        const descricaoEvento = document.createElement("textarea");
        const situacao = document.createElement("select");
        const acoes = document.createElement("div");
        const fechar = document.createElement("button");
        const salvar = document.createElement("button");

        aplicarEstilo(formulario, {
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            padding: "14px",
            border: "1px solid #26384a",
            borderRadius: "12px",
            background: "#0d0d0d"
        }, ["display"]);

        tituloFormulario.textContent = eventoAtual
            ? "Editar evento central"
            : "Novo evento central";
        tituloFormulario.style.fontSize = "14px";

        data.type = "date";
        data.value = eventoAtual && eventoAtual.data
            ? String(eventoAtual.data)
            : diaSelecionado || criarDataId(new Date());
        data.required = true;
        prepararCampo(data);

        tipos.forEach(item => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.nome;
            tipo.appendChild(option);
        });
        tipo.value = eventoAtual
            ? String(eventoAtual.tipoId || eventoAtual.tipo || "")
            : tipos[0]
                ? tipos[0].id
                : "reuniao";
        prepararCampo(tipo);

        tituloEvento.type = "text";
        tituloEvento.placeholder = "Título do evento";
        tituloEvento.value = eventoAtual
            ? String(eventoAtual.titulo || "")
            : "";
        tituloEvento.required = true;
        tituloEvento.maxLength = 160;
        prepararCampo(tituloEvento);

        descricaoEvento.rows = 3;
        descricaoEvento.placeholder =
            "Descrição ou orientações do evento (opcional)";
        descricaoEvento.value = eventoAtual
            ? String(eventoAtual.descricao || "")
            : "";
        descricaoEvento.style.resize = "vertical";
        prepararCampo(descricaoEvento);

        const ativo = document.createElement("option");
        const cancelado = document.createElement("option");
        ativo.value = "ativo";
        ativo.textContent = "Evento ativo";
        cancelado.value = "cancelado";
        cancelado.textContent = "Evento cancelado";
        situacao.appendChild(ativo);
        situacao.appendChild(cancelado);
        situacao.value = eventoAtual &&
            eventoAtual.status === "cancelado"
            ? "cancelado"
            : "ativo";
        prepararCampo(situacao);

        aplicarEstilo(acoes, {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexWrap: "wrap"
        }, ["display"]);
        prepararBotao(fechar);
        fechar.textContent = "Fechar";
        prepararBotao(salvar, true);
        salvar.type = "submit";
        salvar.textContent = eventoAtual
            ? "Salvar alterações"
            : "Criar evento";

        formulario.appendChild(tituloFormulario);
        formulario.appendChild(criarLabel("Data", data));
        formulario.appendChild(criarLabel("Tipo de evento", tipo));
        formulario.appendChild(criarLabel("Título", tituloEvento));
        formulario.appendChild(criarLabel("Descrição", descricaoEvento));
        formulario.appendChild(criarLabel("Situação", situacao));
        acoes.appendChild(fechar);
        acoes.appendChild(salvar);
        formulario.appendChild(acoes);
        detalhe.appendChild(formulario);

        fechar.addEventListener(
            "click",
            () => formulario.remove()
        );
        formulario.addEventListener(
            "submit",
            async eventoSubmit => {
                eventoSubmit.preventDefault();
                const dataValor = String(data.value || "").trim();
                const tipoValor = String(tipo.value || "").trim();
                const tituloValor = String(
                    tituloEvento.value || ""
                ).trim();
                const tipoSelecionado = tipos.find(item => {
                    return item.id === tipoValor;
                }) || tiposPadrao[0];

                if (!dataValor || !tipoValor || !tituloValor) {
                    window.alert(
                        "Informe a data, o tipo e o título do evento."
                    );
                    return;
                }

                salvar.disabled = true;
                salvar.textContent = "Salvando...";
                const dadosEvento = {
                    data: dataValor,
                    tipoId: tipoSelecionado.id,
                    tipoNome: tipoSelecionado.nome,
                    titulo: tituloValor,
                    descricao: String(
                        descricaoEvento.value || ""
                    ).trim(),
                    status: situacao.value === "cancelado"
                        ? "cancelado"
                        : "ativo",
                    atualizadoPor: usernameLogado,
                    atualizadoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    if (eventoAtual && eventoAtual.id) {
                        await banco
                            .collection("eventos_clube")
                            .doc(eventoAtual.id)
                            .set(dadosEvento, {
                                merge: true
                            });
                    } else {
                        await banco
                            .collection("eventos_clube")
                            .add({
                                ...dadosEvento,
                                criadoPor: usernameLogado,
                                criadoEm:
                                    firebase.firestore.FieldValue.serverTimestamp()
                            });
                    }
                    diaSelecionado = dataValor;
                    await carregarEventos();
                    formulario.remove();
                    renderizarCalendario();
                    renderizarDetalhe();
                    status.textContent = "Evento salvo com sucesso.";
                } catch (erro) {
                    mostrarErro(
                        "Não foi possível salvar o evento. Verifique as regras do Firestore.",
                        erro
                    );
                    salvar.disabled = false;
                    salvar.textContent = eventoAtual
                        ? "Salvar alterações"
                        : "Criar evento";
                }
            }
        );
    };

    const abrirRelatorioOficial = async eventoAtual => {
        const painelRelatorio = document.createElement("section");
        const topo = document.createElement("div");
        const titulo = document.createElement("h3");
        const fechar = document.createElement("button");
        const resumo = document.createElement("div");
        const formulario = document.createElement("div");
        const acoes = document.createElement("div");
        const salvar = document.createElement("button");
        const cancelar = document.createElement("button");
        const relatorioRef = banco
            .collection("relatorios_clube")
            .doc(eventoAtual.id);
        let relatorioAtual = {};

        const totalPresentes = Array.isArray(
            eventoAtual.presentes
        )
            ? eventoAtual.presentes.length
            : 0;
        const totalFaltas = Array.isArray(
            eventoAtual.faltas
        )
            ? eventoAtual.faltas.length
            : 0;
        const totalJustificados = Array.isArray(
            eventoAtual.justificados
        )
            ? eventoAtual.justificados.length
            : 0;
        const totalAusencias =
            totalFaltas + totalJustificados;

        const criarCampo = (
            rotulo,
            nome,
            tipo = "textarea",
            valor = ""
        ) => {
            const grupo = document.createElement("label");
            const texto = document.createElement("span");
            const campo = document.createElement(
                tipo === "textarea"
                    ? "textarea"
                    : "input"
            );

            texto.textContent = rotulo;
            texto.style.display = "block";
            texto.style.marginBottom = "5px";
            texto.style.color = "#cfd6dc";
            texto.style.fontSize = "11px";
            texto.style.fontWeight = "700";

            campo.name = nome;
            campo.value = String(valor || "");
            campo.style.width = "100%";
            campo.style.boxSizing = "border-box";
            campo.style.padding = "10px";
            campo.style.border = "1px solid #334351";
            campo.style.borderRadius = "8px";
            campo.style.background = "#0d1115";
            campo.style.color = "#fff";
            campo.style.fontSize = "12px";
            campo.style.fontFamily = "inherit";

            if (tipo === "textarea") {
                campo.rows = 4;
                campo.style.resize = "vertical";
            }

            grupo.style.display = "block";
            grupo.style.marginBottom = "11px";
            grupo.appendChild(texto);
            grupo.appendChild(campo);
            formulario.appendChild(grupo);
            return campo;
        };

        const criarIndicador = (rotulo, valor, cor) => {
            const indicador = document.createElement("div");
            const numero = document.createElement("strong");
            const texto = document.createElement("span");

            indicador.style.flex = "1 1 120px";
            indicador.style.minWidth = "110px";
            indicador.style.padding = "10px";
            indicador.style.border = `1px solid ${cor}`;
            indicador.style.borderRadius = "8px";
            indicador.style.background = "#101820";

            numero.textContent = String(valor);
            numero.style.display = "block";
            numero.style.color = cor;
            numero.style.fontSize = "19px";

            texto.textContent = rotulo;
            texto.style.display = "block";
            texto.style.marginTop = "2px";
            texto.style.color = "#a8a8a8";
            texto.style.fontSize = "10px";

            indicador.appendChild(numero);
            indicador.appendChild(texto);
            resumo.appendChild(indicador);
        };

        const frequenciasPorUnidade = [];
        const dataEventoRelatorio = String(
            eventoAtual.data || ""
        ).trim();

        const carregarFrequenciasDoEvento = async () => {
            if (!dataEventoRelatorio) {
                return;
            }

            const unidadesSnap = await banco
                .collection("frequencias_unidades")
                .get();

            await Promise.all(
                unidadesSnap.docs.map(async unidadeDocumento => {
                    const registroSnap = await unidadeDocumento.ref
                        .collection("registros")
                        .doc(dataEventoRelatorio)
                        .get();

                    if (!registroSnap.exists) {
                        return;
                    }

                    const dadosFrequencia =
                        registroSnap.data() || {};
                    const presentes = Array.isArray(
                        dadosFrequencia.presentes
                    )
                        ? dadosFrequencia.presentes
                        : [];
                    const faltas = Array.isArray(
                        dadosFrequencia.faltas
                    )
                        ? dadosFrequencia.faltas
                        : [];
                    const justificados = Array.isArray(
                        dadosFrequencia.justificados
                    )
                        ? dadosFrequencia.justificados
                        : [];

                    frequenciasPorUnidade.push({
                        unidadeId: unidadeDocumento.id,
                        unidade: String(
                            dadosFrequencia.unidade ||
                            unidadeDocumento.id
                        ).trim(),
                        presentes,
                        faltas,
                        justificados,
                        ausenciasTotais:
                            faltas.length + justificados.length,
                        statusPorMembro:
                            dadosFrequencia.statusPorMembro ||
                            {},
                        justificativasPorMembro:
                            dadosFrequencia.justificativasPorMembro ||
                            {},
                        atualizadoPor: String(
                            dadosFrequencia.atualizadoPor ||
                            ""
                        ).trim()
                    });
                })
            );
        };

        try {
            const relatorioSnap = await relatorioRef.get();
            relatorioAtual = relatorioSnap.exists
                ? relatorioSnap.data() || {}
                : {};
            await carregarFrequenciasDoEvento();
        } catch (erro) {
            console.error(
                "Erro ao carregar relatório do evento:",
                erro
            );
            window.alert(
                "Não foi possível carregar o relatório deste evento."
            );
            return;
        }


        painelRelatorio.style.display = "flex";
        painelRelatorio.style.flexDirection = "column";
        painelRelatorio.style.gap = "12px";
        painelRelatorio.style.marginTop = "12px";
        painelRelatorio.style.padding = "15px";
        painelRelatorio.style.border = "1px solid #2e7dff";
        painelRelatorio.style.borderRadius = "12px";
        painelRelatorio.style.background = "#101820";

        topo.style.display = "flex";
        topo.style.alignItems = "center";
        topo.style.gap = "8px";

        titulo.textContent = "Relatório oficial da reunião";
        titulo.style.flex = "1";
        titulo.style.margin = "0";
        titulo.style.color = "#fff";
        titulo.style.fontSize = "16px";

        fechar.type = "button";
        fechar.textContent = "×";
        fechar.style.width = "32px";
        fechar.style.height = "32px";
        fechar.style.border = "1px solid #52606d";
        fechar.style.borderRadius = "8px";
        fechar.style.background = "#1b232b";
        fechar.style.color = "#fff";
        fechar.style.fontSize = "20px";
        fechar.style.cursor = "pointer";
        fechar.addEventListener(
            "click",
            () => painelRelatorio.remove()
        );

        topo.appendChild(titulo);
        topo.appendChild(fechar);
        painelRelatorio.appendChild(topo);

        const identificacao = document.createElement("p");
        identificacao.textContent =
            `${eventoAtual.titulo || "Evento"} · ${formatarData(eventoAtual.data)}`;
        identificacao.style.margin = "0";
        identificacao.style.color = "#a8a8a8";
        identificacao.style.fontSize = "12px";
        painelRelatorio.appendChild(identificacao);

        resumo.style.display = "flex";
        resumo.style.flexWrap = "wrap";
        resumo.style.gap = "7px";
        criarIndicador(
            "Presentes",
            totalPresentes,
            "#65e6bf"
        );
        criarIndicador(
            "Ausências totais",
            totalAusencias,
            "#ffb45c"
        );
        criarIndicador(
            "Justificados",
            totalJustificados,
            "#58b7ff"
        );
        painelRelatorio.appendChild(resumo);

        const painelAssinatura = document.createElement("section");
        const tituloAssinatura = document.createElement("h4");
        const descricaoAssinatura = document.createElement("p");
        const areaAssinatura = document.createElement("div");
        const imagemAssinatura = document.createElement("img");
        const estadoAssinatura = document.createElement("p");
        const botaoAssinar = document.createElement("button");
        const usernameAssinaturaRelatorio = String(
            localStorage.getItem("usernameLogado") || ""
        ).trim().toLowerCase();
        let assinaturaAprovadaRelatorio = null;

        painelAssinatura.style.display = "flex";
        painelAssinatura.style.flexDirection = "column";
        painelAssinatura.style.gap = "8px";
        painelAssinatura.style.marginTop = "4px";
        painelAssinatura.style.padding = "12px";
        painelAssinatura.style.border = "1px solid #596b7a";
        painelAssinatura.style.borderRadius = "10px";
        painelAssinatura.style.background = "#0d1115";

        tituloAssinatura.textContent = "Assinatura digital";
        tituloAssinatura.style.margin = "0";
        tituloAssinatura.style.color = "#fff";
        tituloAssinatura.style.fontSize = "13px";

        descricaoAssinatura.textContent =
            "A assinatura abaixo foi cadastrada e aprovada pelo administrador.";
        descricaoAssinatura.style.margin = "0";
        descricaoAssinatura.style.color = "#a8a8a8";
        descricaoAssinatura.style.fontSize = "11px";

        areaAssinatura.style.display = "flex";
        areaAssinatura.style.alignItems = "center";
        areaAssinatura.style.justifyContent = "center";
        areaAssinatura.style.minHeight = "90px";
        areaAssinatura.style.padding = "8px";
        areaAssinatura.style.border = "1px dashed #52606d";
        areaAssinatura.style.borderRadius = "8px";
        areaAssinatura.style.background = "#fff";
        areaAssinatura.style.boxSizing = "border-box";

        imagemAssinatura.alt = "Assinatura digital aprovada";
        imagemAssinatura.style.maxWidth = "100%";
        imagemAssinatura.style.maxHeight = "80px";
        imagemAssinatura.style.objectFit = "contain";
        imagemAssinatura.style.display = "none";
        areaAssinatura.appendChild(imagemAssinatura);

        estadoAssinatura.style.margin = "0";
        estadoAssinatura.style.color = "#a8a8a8";
        estadoAssinatura.style.fontSize = "11px";
        estadoAssinatura.textContent = "Carregando assinatura aprovada...";

        botaoAssinar.type = "button";
        botaoAssinar.textContent = "Assinar relatório";
        botaoAssinar.style.width = "100%";
        botaoAssinar.style.padding = "11px";
        botaoAssinar.style.border = "none";
        botaoAssinar.style.borderRadius = "8px";
        botaoAssinar.style.background = "#20c997";
        botaoAssinar.style.color = "#071b16";
        botaoAssinar.style.fontWeight = "700";
        botaoAssinar.style.cursor = "pointer";
        botaoAssinar.disabled = true;

        painelAssinatura.appendChild(tituloAssinatura);
        painelAssinatura.appendChild(descricaoAssinatura);
        painelAssinatura.appendChild(areaAssinatura);
        painelAssinatura.appendChild(estadoAssinatura);
        painelAssinatura.appendChild(botaoAssinar);
        painelRelatorio.appendChild(painelAssinatura);

        if (usernameAssinaturaRelatorio) {
            const assinaturaSnap = await banco
                .collection("assinaturas_usuarios")
                .doc(usernameAssinaturaRelatorio)
                .get();

            if (assinaturaSnap.exists) {
                const dadosAssinatura = assinaturaSnap.data() || {};
                const pngUrl = String(
                    dadosAssinatura.pngUrl ||
                    dadosAssinatura.url ||
                    ""
                ).trim();

                if (pngUrl) {
                    assinaturaAprovadaRelatorio = {
                        username: usernameAssinaturaRelatorio,
                        pngUrl
                    };
                    imagemAssinatura.src = pngUrl;
                    imagemAssinatura.style.display = "block";
                    botaoAssinar.disabled = false;

                    const assinaturaRegistrada =
                        relatorioAtual.assinaturasDigitais &&
                        relatorioAtual.assinaturasDigitais[
                            usernameAssinaturaRelatorio
                        ];

                    if (assinaturaRegistrada) {
                        estadoAssinatura.textContent =
                            "Você já assinou este relatório. É possível atualizar o registro da assinatura.";
                        botaoAssinar.textContent =
                            "Atualizar minha assinatura";
                    } else {
                        estadoAssinatura.textContent =
                            "Sua assinatura está pronta para ser aplicada.";
                    }
                } else {
                    estadoAssinatura.textContent =
                        "A assinatura aprovada não possui uma URL válida.";
                }
            } else {
                estadoAssinatura.textContent =
                    "O administrador ainda não cadastrou uma assinatura para este usuário.";
            }
        } else {
            estadoAssinatura.textContent =
                "Não foi possível identificar o usuário autenticado.";
        }

        botaoAssinar.addEventListener(
            "click",
            async () => {
                if (
                    !assinaturaAprovadaRelatorio ||
                    !usernameAssinaturaRelatorio
                ) {
                    return;
                }

                botaoAssinar.disabled = true;
                botaoAssinar.textContent = "Salvando assinatura...";

                try {
                    const assinaturasDigitais = {
                        ...(relatorioAtual.assinaturasDigitais || {}),
                        [usernameAssinaturaRelatorio]: {
                            username: usernameAssinaturaRelatorio,
                            pngUrl: assinaturaAprovadaRelatorio.pngUrl,
                            assinadoEm:
                                firebase.firestore.FieldValue.serverTimestamp()
                        }
                    };

                    await relatorioRef.set({
                        assinaturasDigitais
                    }, {
                        merge: true
                    });

                    relatorioAtual.assinaturasDigitais =
                        assinaturasDigitais;
                    estadoAssinatura.textContent =
                        "Assinatura aplicada a este relatório com sucesso.";
                    botaoAssinar.textContent =
                        "Assinatura aplicada";
                } catch (erro) {
                    console.error(
                        "Erro ao aplicar assinatura no relatório:",
                        erro
                    );
                    estadoAssinatura.textContent =
                        "Não foi possível aplicar a assinatura. Verifique sua conexão e as regras do Firestore.";
                    botaoAssinar.disabled = false;
                    botaoAssinar.textContent =
                        "Tentar assinar novamente";
                }
            }
        );

        const avisoAutomatico = document.createElement("p");
        avisoAutomatico.textContent =
            "Os indicadores de frequência são preenchidos automaticamente a partir das chamadas das unidades.";
        avisoAutomatico.style.margin = "0";
        avisoAutomatico.style.color = "#8e9aa5";
        avisoAutomatico.style.fontSize = "10px";
        const consolidado = document.createElement("section");
        const tituloConsolidado = document.createElement("h4");
        const listaFrequencias = document.createElement("div");

        consolidado.style.display = "flex";
        consolidado.style.flexDirection = "column";
        consolidado.style.gap = "8px";
        consolidado.style.marginTop = "4px";
        consolidado.style.padding = "12px";
        consolidado.style.border = "1px solid #26384a";
        consolidado.style.borderRadius = "10px";
        consolidado.style.background = "#0d1115";

        tituloConsolidado.textContent =
            "Frequência consolidada das unidades";
        tituloConsolidado.style.margin = "0";
        tituloConsolidado.style.color = "#fff";
        tituloConsolidado.style.fontSize = "13px";

        listaFrequencias.style.display = "flex";
        listaFrequencias.style.flexDirection = "column";
        listaFrequencias.style.gap = "6px";

        if (!frequenciasPorUnidade.length) {
            const vazio = document.createElement("p");
            vazio.textContent =
                "Nenhuma unidade lançou frequência para este evento ainda.";
            vazio.style.margin = "0";
            vazio.style.color = "#8e9aa5";
            vazio.style.fontSize = "11px";
            listaFrequencias.appendChild(vazio);
        }

        frequenciasPorUnidade
            .sort((a, b) => a.unidade.localeCompare(
                b.unidade,
                "pt-BR"
            ))
            .forEach(frequencia => {
                const cardUnidade = document.createElement("article");
                const cabecalhoUnidade =
                    document.createElement("strong");
                const resumoUnidade = document.createElement("div");
                const presentesTexto =
                    document.createElement("span");
                const ausenciasTexto =
                    document.createElement("span");
                const justificadasTexto =
                    document.createElement("span");

                cardUnidade.style.display = "flex";
                cardUnidade.style.flexDirection = "column";
                cardUnidade.style.gap = "7px";
                cardUnidade.style.padding = "10px";
                cardUnidade.style.border = "1px solid #26384a";
                cardUnidade.style.borderRadius = "8px";
                cardUnidade.style.background = "#101820";

                cabecalhoUnidade.textContent =
                    frequencia.unidade || "Unidade sem nome";
                cabecalhoUnidade.style.color = "#fff";
                cabecalhoUnidade.style.fontSize = "12px";

                resumoUnidade.style.display = "flex";
                resumoUnidade.style.flexWrap = "wrap";
                resumoUnidade.style.gap = "6px";

                presentesTexto.textContent =
                    `Presentes: ${frequencia.presentes.length}`;
                presentesTexto.style.color = "#65e6bf";
                presentesTexto.style.fontSize = "11px";

                ausenciasTexto.textContent =
                    `Ausências: ${frequencia.ausenciasTotais}`;
                ausenciasTexto.style.color = "#ffb45c";
                ausenciasTexto.style.fontSize = "11px";

                justificadasTexto.textContent =
                    `Justificadas: ${frequencia.justificados.length}`;
                justificadasTexto.style.color = "#58b7ff";
                justificadasTexto.style.fontSize = "11px";

                resumoUnidade.appendChild(presentesTexto);
                resumoUnidade.appendChild(ausenciasTexto);
                resumoUnidade.appendChild(justificadasTexto);
                cardUnidade.appendChild(cabecalhoUnidade);
                cardUnidade.appendChild(resumoUnidade);
                listaFrequencias.appendChild(cardUnidade);
            });

        consolidado.appendChild(tituloConsolidado);
        consolidado.appendChild(listaFrequencias);
        painelRelatorio.appendChild(consolidado);


        const statusGrupo = document.createElement("label");
        const statusTexto = document.createElement("span");
        const status = document.createElement("select");
        statusTexto.textContent = "Status do relatório";
        statusTexto.style.display = "block";
        statusTexto.style.marginBottom = "5px";
        statusTexto.style.color = "#cfd6dc";
        statusTexto.style.fontSize = "11px";
        statusTexto.style.fontWeight = "700";
        status.innerHTML = `
            <option value="rascunho">Rascunho</option>
            <option value="em_revisao">Em revisão</option>
            <option value="finalizado">Finalizado</option>
        `;
        status.value = relatorioAtual.status || "rascunho";
        status.style.width = "100%";
        status.style.padding = "10px";
        status.style.border = "1px solid #334351";
        status.style.borderRadius = "8px";
        status.style.background = "#0d1115";
        status.style.color = "#fff";
        statusGrupo.appendChild(statusTexto);
        statusGrupo.appendChild(status);
        formulario.appendChild(statusGrupo);

        criarCampo(
            "Local da reunião",
            "local",
            "input",
            relatorioAtual.local
        );
        criarCampo(
            "Horário",
            "horario",
            "input",
            relatorioAtual.horario
        );
        criarCampo(
            "Cronograma da reunião",
            "cronograma",
            "textarea",
            relatorioAtual.cronograma
        );
        criarCampo(
            "Devocional e mensagem",
            "devocional",
            "textarea",
            relatorioAtual.devocional
        );
        criarCampo(
            "Classes e especialidades",
            "classesEspecialidades",
            "textarea",
            relatorioAtual.classesEspecialidades
        );
        criarCampo(
            "Ordem unida e atividades práticas",
            "ordemUnida",
            "textarea",
            relatorioAtual.ordemUnida
        );
        criarCampo(
            "Visitantes",
            "visitantes",
            "textarea",
            relatorioAtual.visitantes
        );
        criarCampo(
            "Ocorrências e observações",
            "ocorrencias",
            "textarea",
            relatorioAtual.ocorrencias
        );
        criarCampo(
            "Patrimônio e materiais",
            "patrimonio",
            "textarea",
            relatorioAtual.patrimonio
        );
        criarCampo(
            "Observações administrativas",
            "administrativo",
            "textarea",
            relatorioAtual.administrativo
        );

        acoes.style.display = "flex";
        acoes.style.flexWrap = "wrap";
        acoes.style.gap = "7px";

        salvar.type = "button";
        salvar.textContent = "Salvar rascunho";
        salvar.style.flex = "1 1 180px";
        salvar.style.padding = "11px";
        salvar.style.border = "none";
        salvar.style.borderRadius = "8px";
        salvar.style.background = "#2e7dff";
        salvar.style.color = "#fff";
        salvar.style.fontWeight = "700";
        salvar.style.cursor = "pointer";

        cancelar.type = "button";
        cancelar.textContent = "Fechar relatório";
        cancelar.style.flex = "1 1 150px";
        cancelar.style.padding = "11px";
        cancelar.style.border = "1px solid #52606d";
        cancelar.style.borderRadius = "8px";
        cancelar.style.background = "#1b232b";
        cancelar.style.color = "#fff";
        cancelar.style.cursor = "pointer";
        cancelar.addEventListener(
            "click",
            () => painelRelatorio.remove()
        );

        salvar.addEventListener(
            "click",
            async () => {
                const campos = {};
                formulario.querySelectorAll(
                    "input[name], textarea[name]"
                ).forEach(campo => {
                    campos[campo.name] =
                        String(campo.value || "").trim();
                });

                salvar.disabled = true;
                salvar.textContent = "Salvando...";

                try {
                    await relatorioRef.set({
                        ...relatorioAtual,
                        ...campos,
                        eventoId: eventoAtual.id,
                        data: eventoAtual.data,
                        tituloEvento: eventoAtual.titulo || "",
                        tipoEvento: eventoAtual.tipo || "",
                        frequenciaConsolidada: {
                            presentes: totalPresentes,
                            ausenciasTotais: totalAusencias,
                            justificados: totalJustificados
                        },
                        status: status.value,
                        criadoPor:
                            relatorioAtual.criadoPor ||
                            usernameLogado,
                        atualizadoPor: usernameLogado,
                        atualizadoEm:
                            firebase.firestore.FieldValue.serverTimestamp(),
                        versao: Number(
                            relatorioAtual.versao || 1
                        )
                    }, {
                        merge: true
                    });

                    window.alert(
                        "Rascunho do relatório salvo com sucesso."
                    );
                    painelRelatorio.remove();
                } catch (erro) {
                    console.error(
                        "Erro ao salvar relatório do evento:",
                        erro
                    );
                    window.alert(
                        "Não foi possível salvar o relatório. Verifique as regras do Firestore."
                    );
                } finally {
                    salvar.disabled = false;
                    salvar.textContent = "Salvar rascunho";
                }
            }
        );

        acoes.appendChild(salvar);
        acoes.appendChild(cancelar);
        painelRelatorio.appendChild(formulario);
        painelRelatorio.appendChild(acoes);
        detalhe.appendChild(painelRelatorio);
        painelRelatorio.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    };


    const renderizarDetalhe = () => {
        detalhe.innerHTML = "";
        aplicarEstilo(detalhe, {
            display: diaSelecionado ? "flex" : "none"
        }, ["display"]);
        if (!diaSelecionado) {
            return;
        }

        const topo = document.createElement("div");
        const tituloDia = document.createElement("strong");
        const novoEvento = document.createElement("button");
        const eventosDoDia = eventos.filter(evento => {
            return String(evento.data || "") === diaSelecionado;
        });
        aplicarEstilo(topo, {
            display: "flex",
            alignItems: "center",
            gap: "8px"
        }, ["display"]);
        tituloDia.textContent =
            `Eventos de ${formatarData(diaSelecionado)}`;
        tituloDia.style.flex = "1";
        prepararBotao(novoEvento, true);
        novoEvento.textContent = "+ Novo evento";
        novoEvento.addEventListener(
            "click",
            () => abrirFormularioEvento(null)
        );
        topo.appendChild(tituloDia);
        topo.appendChild(novoEvento);
        detalhe.appendChild(topo);

        if (!eventosDoDia.length) {
            const vazio = document.createElement("p");
            vazio.textContent =
                "Nenhum evento registrado neste dia.";
            vazio.style.color = "#8e8e8e";
            vazio.style.fontSize = "12px";
            detalhe.appendChild(vazio);
        }

        eventosDoDia.forEach(evento => {
            const tipo = localizarTipo(evento);
            const card = document.createElement("article");
            const cabecalho = document.createElement("div");
            const nome = document.createElement("strong");
            const etiqueta = document.createElement("span");
            const texto = document.createElement("p");
            const acoes = document.createElement("div");
            const acoesChamada = document.createElement("div");
            const editar = document.createElement("button");
            const alternar = document.createElement("button");
            const apagar = document.createElement("button");
            const relatorio = document.createElement("button");
            const verChamada = document.createElement("button");
            const resumoFrequencia = document.createElement("div");
            const frequencias = Array.isArray(
                evento.frequencias
            )
                ? evento.frequencias
                : [];
            const totalPresentes = Number(
                evento.totalPresentes || 0
            );
            const totalAusentes = Number(
                evento.totalFaltas || 0
            );
            const totalJustificados = Number(
                evento.totalJustificados || 0
            );

            aplicarEstilo(card, {
                display: "block",
                padding: "12px",
                border: `1px solid ${tipo.cor}`,
                borderRadius: "10px",
                background: "#121212"
            }, ["display", "background"]);
            aplicarEstilo(cabecalho, {
                display: "flex",
                alignItems: "center",
                gap: "8px"
            }, ["display"]);
            nome.textContent = evento.titulo || tipo.nome;
            nome.style.flex = "1";
            etiqueta.textContent = evento.status === "cancelado"
                ? "CANCELADO"
                : tipo.nome;
            etiqueta.style.color = evento.status === "cancelado"
                ? "#ff7b7b"
                : tipo.cor;
            etiqueta.style.fontSize = "9px";
            etiqueta.style.fontWeight = "700";
            texto.textContent = evento.descricao ||
                "Sem descrição adicional.";
            texto.style.margin = "7px 0 10px";
            texto.style.color = "#a8a8a8";
            texto.style.fontSize = "11px";
            texto.style.whiteSpace = "pre-wrap";

            aplicarEstilo(acoes, {
                display: "flex",
                gap: "6px",
                flexWrap: "wrap"
            }, ["display"]);
            aplicarEstilo(acoesChamada, {
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                width: "100%",
                marginTop: "8px"
            }, ["display", "width"]);
            aplicarEstilo(resumoFrequencia, {
                display: "none",
                flexDirection: "column",
                gap: "8px",
                width: "100%",
                padding: "10px",
                border: "1px solid #26384a",
                borderRadius: "9px",
                background: "#0d1620",
                boxSizing: "border-box"
            }, ["display", "width"]);

            prepararBotao(editar);
            editar.textContent = "Editar";
            prepararBotao(alternar);
            alternar.textContent = evento.status === "cancelado"
                ? "Reativar"
                : "Cancelar evento";
            alternar.style.color = evento.status === "cancelado"
                ? "#65e6bf"
                : "#f0ad4e";
            prepararBotao(apagar, false, true);
            apagar.textContent = "Apagar";
            prepararBotao(relatorio, true);
            relatorio.textContent = "Criar relatório oficial";
            relatorio.style.color = "#65e6bf";
            prepararBotao(verChamada, true);
            verChamada.textContent = frequencias.length
                ? `Ver chamada · P ${totalPresentes} · A ${totalAusentes} · J ${totalJustificados}`
                : "Ver chamada · Nenhuma lançada";
            verChamada.style.width = "100%";

            const criarGrupoResumo = (
                tituloGrupo,
                usernames,
                corGrupo,
                justificativasPorMembro
            ) => {
                const grupo = document.createElement("div");
                const tituloGrupoElemento =
                    document.createElement("strong");
                const pessoas = document.createElement("div");

                aplicarEstilo(grupo, {
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    padding: "8px",
                    border: `1px solid ${corGrupo}`,
                    borderRadius: "8px",
                    background: "#121212"
                }, ["display"]);
                tituloGrupoElemento.textContent =
                    `${tituloGrupo} (${usernames.length})`;
                tituloGrupoElemento.style.color = corGrupo;
                tituloGrupoElemento.style.fontSize = "11px";
                pessoas.style.display = "flex";
                pessoas.style.flexDirection = "column";
                pessoas.style.gap = "4px";

                if (!usernames.length) {
                    const vazio = document.createElement("small");
                    vazio.textContent = "Nenhum participante";
                    vazio.style.color = "#8e8e8e";
                    pessoas.appendChild(vazio);
                }

                usernames.forEach(username => {
                    const pessoaDados = evento.usuariosPorUsername &&
                        typeof evento.usuariosPorUsername.get ===
                            "function"
                        ? evento.usuariosPorUsername.get(username)
                        : null;
                    const linha = document.createElement("div");
                    const avatar = document.createElement("img");
                    const textoPessoa = document.createElement("div");
                    const nomePessoa = document.createElement("strong");
                    const detalhePessoa = document.createElement("small");

                    aplicarEstilo(linha, {
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        padding: "5px",
                        borderRadius: "7px",
                        background: "#1a1a1a"
                    }, ["display"]);
                    avatar.src = pessoaDados && pessoaDados.fotoUrl
                        ? pessoaDados.fotoUrl
                        : window.AVATAR_USUARIO_PADRAO;
                    avatar.alt = pessoaDados && pessoaDados.nome
                        ? `Foto de ${pessoaDados.nome}`
                        : `Foto de ${username}`;
                    aplicarEstilo(avatar, {
                        width: "30px",
                        height: "30px",
                        flex: "0 0 30px",
                        objectFit: "cover",
                        borderRadius: "50%"
                    }, ["width", "height", "flex"]);
                    avatar.onerror = () => {
                        avatar.onerror = null;
                        avatar.src = window.AVATAR_USUARIO_PADRAO;
                    };
                    textoPessoa.style.display = "flex";
                    textoPessoa.style.flexDirection = "column";
                    textoPessoa.style.gap = "2px";
                    nomePessoa.textContent = pessoaDados &&
                        pessoaDados.nome
                        ? pessoaDados.nome
                        : username;
                    nomePessoa.style.color = "#fff";
                    nomePessoa.style.fontSize = "11px";
                    detalhePessoa.textContent =
                        pessoaDados && pessoaDados.cargo
                            ? pessoaDados.cargo
                            : username;
                    detalhePessoa.style.color = "#8e8e8e";
                    detalhePessoa.style.fontSize = "9px";
                    textoPessoa.appendChild(nomePessoa);
                    textoPessoa.appendChild(detalhePessoa);
                    linha.appendChild(avatar);
                    linha.appendChild(textoPessoa);

                    const justificativa = String(
                        justificativasPorMembro &&
                        justificativasPorMembro[username] ||
                        ""
                    ).trim();
                    if (justificativa) {
                        const justificativaTexto =
                            document.createElement("small");
                        justificativaTexto.textContent =
                            `Justificativa: ${justificativa}`;
                        justificativaTexto.style.color = "#f0ad4e";
                        justificativaTexto.style.fontSize = "10px";
                        justificativaTexto.style.marginLeft = "37px";
                        linha.style.flexWrap = "wrap";
                        linha.appendChild(justificativaTexto);
                    }
                    pessoas.appendChild(linha);
                });

                grupo.appendChild(tituloGrupoElemento);
                grupo.appendChild(pessoas);
                return grupo;
            };

            verChamada.addEventListener(
                "click",
                () => {
                    const aberto = resumoFrequencia.style.display ===
                        "flex";
                    if (aberto) {
                        resumoFrequencia.style.display = "none";
                        verChamada.textContent = frequencias.length
                            ? `Ver chamada · P ${totalPresentes} · A ${totalAusentes} · J ${totalJustificados}`
                            : "Ver chamada · Nenhuma lançada";
                        return;
                    }

                    resumoFrequencia.innerHTML = "";
                    const tituloResumo = document.createElement("strong");
                    tituloResumo.textContent = frequencias.length
                        ? `Frequência registrada — ${frequencias.length} unidade(s)`
                        : "Nenhuma chamada lançada para este evento";
                    tituloResumo.style.color = "#fff";
                    tituloResumo.style.fontSize = "12px";
                    resumoFrequencia.appendChild(tituloResumo);

                    frequencias.forEach(frequencia => {
                        const unidade = document.createElement("strong");
                        const presentes = document.createElement("div");
                        const ausentes = document.createElement("div");
                        const justificados = document.createElement("div");
                        const faltasTotais =
                            frequencia.faltas.length +
                            frequencia.justificados.length;

                        unidade.textContent =
                            `${frequencia.unidade} · P ${frequencia.presentes.length} · A ${faltasTotais} · J ${frequencia.justificados.length}`;
                        unidade.style.color = "#58b7ff";
                        unidade.style.fontSize = "11px";
                        presentes.appendChild(
                            criarGrupoResumo(
                                "Presentes",
                                frequencia.presentes,
                                "#20c997",
                                {}
                            )
                        );
                        ausentes.appendChild(
                            criarGrupoResumo(
                                "Ausentes não justificados",
                                frequencia.faltas,
                                "#ff7b7b",
                                {}
                            )
                        );
                        justificados.appendChild(
                            criarGrupoResumo(
                                "Justificados",
                                frequencia.justificados,
                                "#f0ad4e",
                                frequencia.justificativasPorMembro
                            )
                        );
                        resumoFrequencia.appendChild(unidade);
                        resumoFrequencia.appendChild(presentes);
                        resumoFrequencia.appendChild(ausentes);
                        resumoFrequencia.appendChild(justificados);
                    });

                    resumoFrequencia.style.display = "flex";
                    verChamada.textContent = "Ocultar chamada";
                }
            );

            editar.addEventListener(
                "click",
                () => abrirFormularioEvento(evento)
            );
            alternar.addEventListener(
                "click",
                async () => {
                    const novoStatus = evento.status === "cancelado"
                        ? "ativo"
                        : "cancelado";
                    const confirmar = window.confirm(
                        novoStatus === "cancelado"
                            ? "Marcar este evento como cancelado?"
                            : "Reativar este evento?"
                    );
                    if (!confirmar) {
                        return;
                    }
                    try {
                        await banco
                            .collection("eventos_clube")
                            .doc(evento.id)
                            .set({
                                status: novoStatus,
                                atualizadoPor: usernameLogado,
                                atualizadoEm:
                                    firebase.firestore.FieldValue.serverTimestamp()
                            }, {
                                merge: true
                            });
                        await carregarEventos();
                        renderizarCalendario();
                        renderizarDetalhe();
                    } catch (erro) {
                        mostrarErro(
                            "Não foi possível alterar o evento.",
                            erro
                        );
                    }
                }
            );
            apagar.addEventListener(
                "click",
                async () => {
                    if (!window.confirm(
                        "Apagar definitivamente este evento?"
                    )) {
                        return;
                    }
                    try {
                        await banco
                            .collection("eventos_clube")
                            .doc(evento.id)
                            .delete();
                        await carregarEventos();
                        renderizarCalendario();
                        renderizarDetalhe();
                    } catch (erro) {
                        mostrarErro(
                            "Não foi possível apagar o evento.",
                            erro
                        );
                    }
                }
            );
            relatorio.addEventListener(
                "click",
                () => abrirRelatorioOficial(evento)
            );

            cabecalho.appendChild(nome);
            cabecalho.appendChild(etiqueta);
            acoes.appendChild(editar);
            acoes.appendChild(alternar);
            acoes.appendChild(apagar);
            acoes.appendChild(relatorio);
            acoesChamada.appendChild(verChamada);
            acoesChamada.appendChild(resumoFrequencia);
            card.appendChild(cabecalho);
            card.appendChild(texto);
            card.appendChild(acoes);
            card.appendChild(acoesChamada);
            detalhe.appendChild(card);

        });
    };


    const renderizarTipos = () => {
        tiposBox.innerHTML = "";
        const topo = document.createElement("div");
        const tituloTipos = document.createElement("strong");
        const novaTag = document.createElement("button");
        const lista = document.createElement("div");

        aplicarEstilo(topo, {
            display: "flex",
            alignItems: "center",
            gap: "8px"
        }, ["display"]);
        tituloTipos.textContent = "Tipos de evento";
        tituloTipos.style.flex = "1";
        prepararBotao(novaTag);
        novaTag.textContent = "+ Nova tag";
        novaTag.addEventListener(
            "click",
            async () => {
                const nome = String(window.prompt(
                    "Nome da nova tag de evento:"
                ) || "").trim();
                if (!nome) {
                    return;
                }
                const base = normalizar(nome)
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "") || "tipo";
                tipos.push({
                    id: `${base}-${Date.now()}`,
                    nome,
                    cor: "#a8a8a8"
                });
                try {
                    await salvarTipos();
                    renderizarTipos();
                    status.textContent = "Tag criada com sucesso.";
                } catch (erro) {
                    mostrarErro("Não foi possível criar a tag.", erro);
                }
            }
        );
        aplicarEstilo(lista, {
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "8px"
        }, ["display"]);

        tipos.forEach(tipo => {
            const linha = document.createElement("div");
            const nome = document.createElement("span");
            const editar = document.createElement("button");
            const apagar = document.createElement("button");
            aplicarEstilo(linha, {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 8px",
                border: "1px solid #262626",
                borderRadius: "8px",
                background: "#121212"
            }, ["display", "background"]);
            nome.textContent = tipo.nome;
            nome.style.flex = "1";
            nome.style.color = tipo.cor;
            prepararBotao(editar);
            editar.textContent = "Editar";
            prepararBotao(apagar, false, true);
            apagar.textContent = "Apagar";
            editar.addEventListener(
                "click",
                async () => {
                    const novoNome = String(window.prompt(
                        "Novo nome da tag:",
                        tipo.nome
                    ) || "").trim();
                    if (!novoNome) {
                        return;
                    }
                    tipo.nome = novoNome;
                    try {
                        await salvarTipos();
                        renderizarTipos();
                        renderizarDetalhe();
                    } catch (erro) {
                        mostrarErro("Não foi possível editar a tag.", erro);
                    }
                }
            );
            apagar.addEventListener(
                "click",
                async () => {
                    if (!window.confirm(
                        `Apagar a tag “${tipo.nome}”? Os eventos existentes serão preservados.`
                    )) {
                        return;
                    }
                    tipos = tipos.filter(item => item.id !== tipo.id);
                    try {
                        await salvarTipos();
                        renderizarTipos();
                        renderizarDetalhe();
                    } catch (erro) {
                        mostrarErro("Não foi possível apagar a tag.", erro);
                    }
                }
            );
            linha.appendChild(nome);
            linha.appendChild(editar);
            linha.appendChild(apagar);
            lista.appendChild(linha);
        });
        topo.appendChild(tituloTipos);
        topo.appendChild(novaTag);
        tiposBox.appendChild(topo);
        tiposBox.appendChild(lista);
    };

    secao.id = "secao-calendario-clube-eventos";
    aplicarEstilo(secao, {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: "0",
        maxWidth: "100%",
        boxSizing: "border-box",
        gap: "10px",
        marginTop: "22px"
    }, [
        "display",
        "flex-direction",
        "width",
        "min-width",
        "max-width",
        "box-sizing",
        "gap",
        "margin-top"
    ]);
    titulo.textContent = "Controle de eventos do clube";
    titulo.style.margin = "0";
    titulo.style.fontSize = "17px";
    descricao.textContent =
        "O calendário é compartilhado com as unidades. Somente o Secretário(a) do Clube registra e administra os eventos.";
    descricao.style.margin = "0";
    descricao.style.color = "#8e8e8e";
    descricao.style.fontSize = "12px";
    descricao.style.lineHeight = "1.45";

    aplicarEstilo(barraMes, {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minWidth: "0",
        gap: "8px",
        padding: "8px 0",
        boxSizing: "border-box"
    }, [
        "display",
        "flex-direction",
        "width",
        "min-width",
        "gap",
        "box-sizing"
    ]);
    prepararBotao(voltarMes);
    prepararBotao(avancarMes);
    voltarMes.textContent = "‹";
    avancarMes.textContent = "›";
    aplicarEstilo(voltarMes, {
        width: "36px",
        minWidth: "36px",
        height: "36px",
        flex: "0 0 36px",
        padding: "0",
        fontSize: "18px"
    }, [
        "width",
        "min-width",
        "height",
        "flex"
    ]);
    aplicarEstilo(avancarMes, {
        width: "36px",
        minWidth: "36px",
        height: "36px",
        flex: "0 0 36px",
        padding: "0",
        fontSize: "18px"
    }, [
        "width",
        "min-width",
        "height",
        "flex"
    ]);
    aplicarEstilo(tituloMes, {
        display: "block",
        flex: "1 1 auto",
        minWidth: "0",
        color: "#fff",
        fontSize: "14px",
        textAlign: "center"
    }, [
        "display",
        "flex",
        "min-width"
    ]);

    aplicarEstilo(diasSemana, {
        display: "grid",
        width: "100%",
        minWidth: "0",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gridAutoFlow: "row",
        gap: "3px",
        boxSizing: "border-box"
    }, [
        "display",
        "width",
        "min-width",
        "grid-template-columns",
        "grid-auto-flow",
        "gap",
        "box-sizing"
    ]);
    nomesDias.forEach(nomeDia => {
        const celula = document.createElement("div");
        celula.textContent = nomeDia;
        aplicarEstilo(celula, {
            display: "block",
            width: "auto",
            minWidth: "0",
            padding: "6px 2px",
            color: "#8e8e8e",
            fontSize: "9px",
            fontWeight: "700",
            textAlign: "center",
            boxSizing: "border-box"
        }, [
            "display",
            "width",
            "min-width",
            "box-sizing"
        ]);
        diasSemana.appendChild(celula);
    });

    aplicarEstilo(calendario, {
        display: "grid",
        width: "100%",
        minWidth: "0",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gridAutoFlow: "row",
        gridAutoRows: "minmax(76px, auto)",
        alignItems: "stretch",
        gap: "3px",
        padding: "3px",
        boxSizing: "border-box",
        border: "1px solid #262626",
        borderRadius: "12px",
        background: "#0b0b0b"
    }, [
        "display",
        "width",
        "min-width",
        "grid-template-columns",
        "grid-auto-flow",
        "grid-auto-rows",
        "align-items",
        "gap",
        "box-sizing",
        "background"
    ]);

    aplicarEstilo(detalhe, {
        display: "none",
        flexDirection: "column",
        width: "100%",
        minWidth: "0",
        boxSizing: "border-box",
        gap: "10px",
        marginTop: "10px",
        padding: "14px",
        border: "1px solid #26384a",
        borderRadius: "12px",
        background: "#101820"
    }, [
        "display",
        "flex-direction",
        "width",
        "min-width",
        "box-sizing",
        "gap",
        "background"
    ]);

    aplicarEstilo(tiposBox, {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: "0",
        boxSizing: "border-box",
        gap: "8px",
        marginTop: "12px",
        padding: "12px",
        border: "1px solid #262626",
        borderRadius: "12px",
        background: "#101010"
    }, [
        "display",
        "flex-direction",
        "width",
        "min-width",
        "box-sizing",
        "gap",
        "background"
    ]);
    status.style.margin = "0";
    status.style.color = "#65e6bf";
    status.style.fontSize = "11px";
    status.style.textAlign = "center";

    barraMes.appendChild(voltarMes);
    barraMes.appendChild(tituloMes);
    barraMes.appendChild(avancarMes);
    secao.appendChild(titulo);
    secao.appendChild(descricao);
    secao.appendChild(barraMes);
    secao.appendChild(diasSemana);
    secao.appendChild(calendario);
    secao.appendChild(detalhe);
    secao.appendChild(tiposBox);
    secao.appendChild(status);
    container.appendChild(secao);

    voltarMes.addEventListener(
        "click",
        () => {
            mesAtual = new Date(
                mesAtual.getFullYear(),
                mesAtual.getMonth() - 1,
                1
            );
            diaSelecionado = "";
            renderizarCalendario();
            renderizarDetalhe();
        }
    );
    avancarMes.addEventListener(
        "click",
        () => {
            mesAtual = new Date(
                mesAtual.getFullYear(),
                mesAtual.getMonth() + 1,
                1
            );
            diaSelecionado = "";
            renderizarCalendario();
            renderizarDetalhe();
        }
    );

    try {
        const usuarioSnap = await banco
            .collection("usuarios")
            .where("username", "==", usernameLogado)
            .limit(1)
            .get();
        const dadosUsuario = usuarioSnap.empty
            ? {}
            : usuarioSnap.docs[0].data() || {};
        const normalizarCargoCalendario = valor => String(
            valor || ""
        )
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[()]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const cargoFuncao = normalizarCargoCalendario(
            dadosUsuario.cargoFuncao ||
            dadosUsuario.funcao ||
            ""
        );
        const cargoNome = normalizarCargoCalendario(
            dadosUsuario.cargo
        );
        const ehSecretarioClube =
            cargoFuncao === "secretario_clube" ||
            cargoFuncao === "secretario do clube" ||
            cargoNome === "secretario do clube" ||
            (
                cargoNome.includes("secretario") &&
                cargoNome.includes("clube")
            );

        if (!ehSecretarioClube) {
            secao.innerHTML = "";
            const bloqueado = document.createElement("p");
            bloqueado.textContent =
                "Este calendário é exclusivo do Secretário(a) do Clube.";
            bloqueado.style.color = "#8e8e8e";
            bloqueado.style.fontSize = "12px";
            secao.appendChild(bloqueado);
            return;
        }


        await carregarTipos();
        await carregarEventos();
        renderizarCalendario();
        renderizarTipos();
    } catch (erro) {
        console.error(
            "Erro ao carregar calendário central:",
            erro
        );
        status.textContent =
            "Não foi possível carregar o calendário central.";
    }
}





async function carregarCargosAdmin() {
    if (!window.ClubeDB || !window.ClubeDB.textoDB) return;

    try {
        const snapshot = await window.ClubeDB.textoDB.collection("cargos").orderBy("nome").get();
        cargosAdminCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const selects = [
            document.getElementById("membro-cargo"),
            document.getElementById("edit-membro-cargo")
        ];

        selects.forEach(select => {
            if (!select) return;
            const valorAtual = select.value;
            select.innerHTML = '<option value="">Selecionar Cargo...</option>';

            cargosAdminCache.forEach(cargo => {
                const option = document.createElement("option");
                option.value = cargo.id;
                option.textContent = cargo.nome;
                select.appendChild(option);
            });

            if (cargosAdminCache.some(cargo => cargo.id === valorAtual)) {
                select.value = valorAtual;
            }
        });

        const lista = document.getElementById("lista-cargos-render");
        if (!lista) return;

        if (!cargosAdminCache.length) {
            lista.innerHTML = '<p style="color:#aaa;">Nenhum cargo cadastrado.</p>';
            return;
        }

        lista.innerHTML = "";
        cargosAdminCache.forEach(cargo => {
            const item = document.createElement("div");
            item.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:10px;background:#2b2b2b;border-radius:8px;";
            item.innerHTML = `
                <div style="flex:1;">
                    <strong>${escaparHtml(cargo.nome)}</strong>
                    <div style="color:#aaa;font-size:12px;margin-top:4px;">${escaparHtml(cargo.descricao || "Sem descrição")}</div>
                    <div style="color:#58a6ff;font-size:12px;margin-top:4px;">${escaparHtml(nomeFuncaoCargo(cargo.funcao))}</div>
                </div>
                <button type="button" data-editar-cargo="${cargo.id}" style="padding:6px 10px;">✏️ Editar</button>
                <button type="button" data-apagar-cargo="${cargo.id}" style="padding:6px 10px;background:#ff4d4d;color:#fff;border:0;border-radius:4px;">🗑️ Apagar</button>
            `;

            item.querySelector("[data-editar-cargo]").addEventListener("click", () => editarCargoAdmin(cargo.id));
            item.querySelector("[data-apagar-cargo]").addEventListener("click", () => apagarCargoAdmin(cargo.id));
            lista.appendChild(item);
        });
    } catch (erro) {
        console.error("Erro ao carregar cargos:", erro);
        const lista = document.getElementById("lista-cargos-render");
        if (lista) lista.innerHTML = `<p style="color:#ff4d4d;">Erro ao carregar cargos: ${escaparHtml(erro.message)}</p>`;
    }
}

async function salvarCargoAdmin() {
    const id = document.getElementById("cargo-admin-id").value;
    const nome = document.getElementById("cargo-admin-nome").value.trim();
    const descricao = document.getElementById("cargo-admin-descricao").value.trim();
    const funcao = document.getElementById("cargo-admin-funcao").value;

    if (!nome) {
        alert("Informe o nome do cargo.");
        return;
    }

    try {
        const dados = {
            nome,
            descricao,
            funcao,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };
        const colecao = window.ClubeDB.textoDB.collection("cargos");

        if (id) {
            await colecao.doc(id).update(dados);
            alert("Cargo atualizado com sucesso!");
        } else {
            await colecao.add({ ...dados, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
            alert("Cargo criado com sucesso!");
        }

        limparFormularioCargoAdmin();
        carregarCargosAdmin();
    } catch (erro) {
        console.error("Erro ao salvar cargo:", erro);
        alert("Erro ao salvar cargo: " + erro.message);
    }
}

function editarCargoAdmin(id) {
    const cargo = cargosAdminCache.find(item => item.id === id);
    if (!cargo) return;

    document.getElementById("cargo-admin-id").value = cargo.id;
    document.getElementById("cargo-admin-nome").value = cargo.nome || "";
    document.getElementById("cargo-admin-descricao").value = cargo.descricao || "";
    document.getElementById("cargo-admin-funcao").value = cargo.funcao || "nenhuma";
    document.getElementById("btn-salvar-cargo").textContent = "Salvar Alterações";
}

function limparFormularioCargoAdmin() {
    document.getElementById("cargo-admin-id").value = "";
    document.getElementById("cargo-admin-nome").value = "";
    document.getElementById("cargo-admin-descricao").value = "";
    document.getElementById("cargo-admin-funcao").value = "nenhuma";
    document.getElementById("btn-salvar-cargo").textContent = "Criar Cargo";
}

async function apagarCargoAdmin(id) {
    const cargo = cargosAdminCache.find(item => item.id === id);
    if (!cargo) return;

    if (!confirm(`Apagar o cargo "${cargo.nome}"? Os membros já cadastrados não serão apagados.`)) return;

    try {
        await window.ClubeDB.textoDB.collection("cargos").doc(id).delete();
        alert("Cargo apagado com sucesso!");
        carregarCargosAdmin();
    } catch (erro) {
        console.error("Erro ao apagar cargo:", erro);
        alert("Erro ao apagar cargo: " + erro.message);
    }
}

function atualizarFuncaoCargoSelecionado(idSelect, idPreview) {
    const select = document.getElementById(idSelect);
    const preview = document.getElementById(idPreview);
    if (!select || !preview) return;

    const cargo = cargosAdminCache.find(
        item => item.id === select.value
    );
    preview.textContent = cargo
        ? nomeFuncaoCargo(cargo.funcao)
        : "Nenhuma função adicional associada.";

    if (idSelect === "membro-cargo") {
        controlarExibicaoSelecaoUnidade();
    }

    if (idSelect === "edit-membro-cargo") {
        controlarExibicaoSelecaoUnidadeEdicao();
    }
}



async function salvarNovoMembroAdmin() {
    const username = document.getElementById("membro-username").value.trim().toLowerCase();
    const senha = document.getElementById("membro-senha").value;
    const nomeReal = document.getElementById("membro-nome-real").value.trim();
    const tipo = document.getElementById("membro-tipo").value;
    const unidade = document.getElementById("membro-unidade-vinculo").value;
    const cargoId = document.getElementById("membro-cargo").value;
    const cargoSelecionado = cargosAdminCache.find(cargo => cargo.id === cargoId);
    const dataNascimento = document.getElementById("membro-nascimento").value;
    const fotoInput = document.getElementById("membro-foto");
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;

    if (!username || !senha || !nomeReal || !cargoId || !dataNascimento) {
        alert("Preencha todos os campos obrigatórios do membro!");
        return;
    }

    if (tipo === "Desbravador" && !unidade) {
        alert("Desbravadores precisam obrigatoriamente estar vinculados a uma unidade!");
        return;
    }

    if (!window.ClubeDB || !window.ClubeDB.acoesAdmin) {
        alert("O sistema administrativo ainda não está disponível.");
        return;
    }

    const dadosMembro = {
        username,
        senha,
        nomeReal,
        tipo,
        unidade,
        cargoId,
        cargo: cargoSelecionado ? cargoSelecionado.nome : "",
        cargoFuncao: cargoSelecionado ? cargoSelecionado.funcao : "nenhuma",
        dataNascimento
    };

    const botao = document.querySelector("#aba-membros .formulario-admin button[type='button']");

    try {
        if (botao) {
            botao.disabled = true;
            botao.textContent = "⏳ Cadastrando...";
        }

        await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
        alert(`🎉 Membro ${nomeReal} cadastrado com sucesso!`);

        document.getElementById("membro-username").value = "";
        document.getElementById("membro-senha").value = "";
        document.getElementById("membro-nome-real").value = "";
        document.getElementById("membro-tipo").value = "Desbravador";
        document.getElementById("membro-unidade-vinculo").value = "";
        document.getElementById("membro-cargo").value = "";
        document.getElementById("membro-nascimento").value = "";
        if (fotoInput) fotoInput.value = "";

        document.getElementById("previa-membro-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        atualizarFuncaoCargoSelecionado("membro-cargo", "membro-funcao-preview" );
        carregarMembrosCadastrados();
    } catch (erro) {
        console.error("Erro ao cadastrar membro:", erro);
        alert("Erro ao cadastrar membro: " + erro.message);
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = "Cadastrar Membro";
        }
    }
}


// Controle global de edição de usuários
let idMembroSendoEditado = null;

async function carregarMembrosCadastrados() {
    const abaMembros = document.getElementById("aba-membros");

    if (!abaMembros) {
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

    container.innerHTML = "<p style='color:#aaa;'>Buscando membros no servidor...</p>";

    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        container.innerHTML = "<p style='color:#ff6b6b;'>Banco de dados ainda não foi inicializado. Tente novamente.</p>";
        return;
    }

    try {
        const snapshot = await window.ClubeDB.textoDB
            .collection("usuarios")
            .get();

        if (snapshot.empty) {
            container.innerHTML = "<p style='color:#aaa;'>Nenhum membro cadastrado ainda.</p>";
            return;
        }

        container.innerHTML = "<h3 style='margin-bottom:15px;'>Membros Cadastrados</h3>";

        snapshot.forEach(doc => {
            const membro = doc.data() || {};
            const id = doc.id;
            let foto = membro.fotoUrl || window.AVATAR_USUARIO_PADRAO;
if (membro.fotoUrl && membro.fotoUrl !== window.AVATAR_USUARIO_PADRAO) {
    foto += (foto.includes("?") ? "&" : "?") + "v=" + Date.now();
}

            const card = document.createElement("div" );
            card.className = "item-membro";
            card.style.cssText = "display:flex;align-items:center;gap:15px;margin-bottom:15px;padding:10px;background:#2b2b2b;border-radius:8px;";

            card.innerHTML = `
                <img src="${escaparHtml(foto)}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${escaparHtml(membro.nomeReal || "Sem Nome")}</div>
                    <div style="font-size:12px;color:#aaa;">
                        ${escaparHtml(membro.cargo || "Sem cargo")} |
                        ${escaparHtml(membro.unidade || "Sem unidade")}
                    </div>
                </div>
                <button type="button" data-editar-membro="${escaparHtml(id)}" style="padding:5px 10px;font-size:12px;cursor:pointer;border-radius:4px;border:none;">
                    ✏️ Editar
                </button>
                <button type="button" data-apagar-membro="${escaparHtml(id)}" style="padding:5px 10px;font-size:12px;background:#ff4d4d;color:white;border:none;border-radius:4px;cursor:pointer;">
                    🗑️ Apagar
                </button>
            `;

            const botaoEditar = card.querySelector("[data-editar-membro]");
            const botaoApagar = card.querySelector("[data-apagar-membro]");

            if (botaoEditar) {
                botaoEditar.addEventListener("click", () => prepararEdicaoMembro(id));
            }

            if (botaoApagar) {
                botaoApagar.addEventListener("click", () => {
                    deletarMembro(id, membro.fotoIdPublico || "");
                });
            }

            container.appendChild(card);
        });
    } catch (erro) {
        console.error("Erro ao carregar membros:", erro);

        container.innerHTML = `
            <p style="color:#ff6b6b;">
                Não foi possível carregar os membros.  

                <small>${escaparHtml(erro.message || "Erro desconhecido")}</small>
            </p>
            <button type="button" onclick="carregarMembrosCadastrados()">
                Tentar novamente
            </button>
        `;
    }
}





async function deletarMembro(id, idFoto) {
    const banco = window.ClubeDB && window.ClubeDB.textoDB
        ? window.ClubeDB.textoDB
        : null;

    if (!banco || !id) {
        alert("Não foi possível identificar o membro para apagar.");
        return;
    }

    const usuarioLogado = window.ClubeDB &&
        window.ClubeDB.loginDB
        ? window.ClubeDB.loginDB.currentUser
        : null;

    if (usuarioLogado && usuarioLogado.uid === id) {
        alert("Por segurança, você não pode apagar a própria conta enquanto estiver logado nela.");
        return;
    }

    const referenciaMembro = banco.collection("usuarios").doc(id);

    try {
        const documentoMembro = await referenciaMembro.get();

        if (!documentoMembro.exists) {
            alert("Este membro já não existe no banco de dados.");
            await carregarMembrosCadastrados();
            return;
        }

        const membro = documentoMembro.data() || {};
        const username = String(membro.username || "").trim();
        const nomeMembro = membro.nomeReal || username || "este membro";
        const fotoIdFinal = idFoto || membro.fotoIdPublico || "";

        if (!confirm(
            `Tem certeza que deseja apagar ${nomeMembro}?\n\n` +
            "Os progressos e solicitações de aprovação desse membro também serão removidos."
        )) {
            return;
        }

        const apagarConsultaEmLotes = async consulta => {
            while (true) {
                const resultado = await consulta.limit(400).get();

                if (resultado.empty) {
                    return;
                }

                const lote = banco.batch();

                resultado.docs.forEach(documento => {
                    lote.delete(documento.ref);
                });

                await lote.commit();
            }
        };

        if (username) {
            const colecoesVinculadas = [
                "progresso_especialidades",
                "progresso_mestrados",
                "progresso_classes",
                "pendencias_aprovacao"
            ];

            for (const colecao of colecoesVinculadas) {
                await apagarConsultaEmLotes(
                    banco
                        .collection(colecao)
                        .where("usuario", "==", username)
                );
            }
        }

        await referenciaMembro.delete();

        if (
            fotoIdFinal &&
            fotoIdFinal !== "undefined" &&
            window.ClubeDB.acoesAdmin &&
            typeof window.ClubeDB.acoesAdmin.excluirFoto === "function"
        ) {
            try {
                await window.ClubeDB.acoesAdmin.excluirFoto(fotoIdFinal);
            } catch (erroFoto) {
                console.warn(
                    "O membro foi apagado, mas a foto não pôde ser removida:",
                    erroFoto
                );
            }
        }

        alert(`Membro ${nomeMembro} apagado com sucesso.`);
        await carregarMembrosCadastrados();

    } catch (erro) {
        console.error("Erro ao apagar membro:", erro);
        alert(
            "Não foi possível apagar o membro. Erro: " +
            (erro.message || "desconhecido")
        );
    }
}

async function prepararEdicaoMembro(id) {
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    if (tipoUsuario !== "admin") {
        alert("Somente o administrador pode alterar assinaturas.");
        return;
    }

    if (!window.ClubeDB || !window.ClubeDB.textoDB) return;

    try {
        const documento = await window.ClubeDB.textoDB
            .collection("usuarios")
            .doc(id)
            .get();

        if (!documento.exists) {
            alert("Membro não encontrado.");
            return;
        }

        const dados = documento.data() || {};

        await carregarUnidadesCadastradas();
        await carregarCargosAdmin();

        document.getElementById("edit-membro-id").value = id;
        document.getElementById("edit-membro-nome-real").value = dados.nomeReal || "";

        const campoNomeAssinatura = document.getElementById(
            "edit-membro-nome-assinatura"
        );
        const campoCargoAssinatura = document.getElementById(
            "edit-membro-cargo-assinatura"
        );

        if (campoNomeAssinatura) {
            campoNomeAssinatura.value =
                dados.nomeAssinatura ||
                dados.nomeReal ||
                "";
        }

        if (campoCargoAssinatura) {
            campoCargoAssinatura.value =
                dados.cargoAssinatura ||
                dados.cargo ||
                "";
        }

        document.getElementById("edit-membro-username").value = dados.username || "";

        // O campo vazio significa: manter a senha atual.
        // A senha antiga não é exibida nem apagada.
        const campoSenha = document.getElementById("edit-membro-senha");
        campoSenha.value = "";
        campoSenha.placeholder = "Deixe em branco para manter a senha atual";

        document.getElementById("edit-membro-tipo").value = dados.tipo || "Desbravador";
        document.getElementById("edit-membro-unidade-vinculo").value = dados.unidade || "";
        document.getElementById("edit-membro-nascimento").value = dados.dataNascimento || "";

        const cargoSelect = document.getElementById("edit-membro-cargo");
        const cargoAtual = cargosAdminCache.find(cargo => cargo.id === dados.cargoId) ||
            cargosAdminCache.find(cargo => cargo.nome === dados.cargo);

        if (cargoSelect) {
            cargoSelect.value = cargoAtual ? cargoAtual.id : "";
        }

        atualizarFuncaoCargoSelecionado(
            "edit-membro-cargo",
            "edit-membro-funcao-preview"
        );

        document.getElementById("edit-previa-membro-img").src =
            dados.fotoUrl || "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";

        const assinaturaPreview = document.getElementById(
            "edit-previa-assinatura-png"
         );
        const assinaturaVazia = document.getElementById(
            "edit-previa-assinatura-vazia"
        );
        const assinaturaInput = document.getElementById(
            "edit-membro-assinatura-png"
        );

        if (assinaturaPreview) {
            assinaturaPreview.removeAttribute("src");
            assinaturaPreview.style.display = "none";
        }

        if (assinaturaVazia) {
            assinaturaVazia.style.display = "block";
        }

        if (assinaturaInput) {
            assinaturaInput.value = "";
            assinaturaInput.onchange = () => {
                const arquivo = assinaturaInput.files &&
                    assinaturaInput.files[0];

                if (!arquivo) {
                    return;
                }

                if (
                    arquivo.type !== "image/png" &&
                    !arquivo.name.toLowerCase().endsWith(".png")
                ) {
                    alert("A assinatura precisa ser um arquivo PNG.");
                    assinaturaInput.value = "";
                    return;
                }

                const leitor = new FileReader();
                leitor.onload = evento => {
                    if (assinaturaPreview) {
                        assinaturaPreview.src = evento.target.result;
                        assinaturaPreview.style.display = "block";
                    }

                    if (assinaturaVazia) {
                        assinaturaVazia.style.display = "none";
                    }
                };
                leitor.readAsDataURL(arquivo);
            };
        }

        const usernameAssinatura = String(
            dados.username || ""
        ).trim().toLowerCase();

        if (usernameAssinatura) {
            const assinaturaDocumento = await window.ClubeDB.textoDB
                .collection("assinaturas_usuarios")
                .doc(usernameAssinatura)
                .get();

            if (assinaturaDocumento.exists) {
                const dadosAssinatura = assinaturaDocumento.data() || {};
                const urlAssinatura = String(
                    dadosAssinatura.pngUrl ||
                    dadosAssinatura.url ||
                    ""
                ).trim();

                if (urlAssinatura && assinaturaPreview) {
                    assinaturaPreview.src = urlAssinatura;
                    assinaturaPreview.style.display = "block";

                    if (assinaturaVazia) {
                        assinaturaVazia.style.display = "none";
                    }
                }
            }
        }

        controlarExibicaoSelecaoUnidadeEdicao( );

        document.getElementById("edit-membro-foto").value = "";
        document.getElementById("modal-edicao-membro").style.display = "block";
    } catch (erro) {
        console.error("Erro ao abrir edição:", erro);
        alert("Não foi possível carregar os dados do membro: " + erro.message);
    }
}



function fecharModalEdicaoMembro() {
    const modal = document.getElementById("modal-edicao-membro");
    if (modal) modal.style.display = "none";
}

function controlarExibicaoSelecaoUnidadeEdicao() {
    const tipo = document.getElementById("edit-membro-tipo").value;
    const campo = document.getElementById("edit-membro-unidade-vinculo");
    const selectCargo = document.getElementById("edit-membro-cargo");
    const cargoSelecionado = cargosAdminCache.find(
        cargo => cargo.id === (selectCargo ? selectCargo.value : "")
    );
    const funcaoCargo = String(
        cargoSelecionado ? cargoSelecionado.funcao : ""
    ).trim().toLowerCase();
    const ehConselheiroUnidade =
        funcaoCargo === "conselheiro_unidade" ||
        funcaoCargo === "conselheiro de unidade";

    if (!campo) {
        return;
    }

    const deveMostrarUnidade =
        tipo !== "Liderança" ||
        ehConselheiroUnidade;

    campo.style.display = deveMostrarUnidade
        ? "block"
        : "none";

    if (!deveMostrarUnidade) {
        campo.value = "";
    }
}


async function salvarEdicaoMembroAdmin() {
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    if (tipoUsuario !== "admin") {
        alert("Somente o administrador pode cadastrar ou alterar assinaturas.");
        return;
    }

    const id = document.getElementById("edit-membro-id").value;
    const cargoId = document.getElementById("edit-membro-cargo").value;
    const cargoSelecionado = cargosAdminCache.find(cargo => cargo.id === cargoId);
    const fotoInput = document.getElementById("edit-membro-foto");
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;
    const assinaturaInput = document.getElementById(
        "edit-membro-assinatura-png"
    );
    const arquivoAssinatura = assinaturaInput
        ? assinaturaInput.files[0]
        : null;
    const senhaDigitada = document.getElementById("edit-membro-senha").value.trim();

    const campoNomeAssinatura = document.getElementById(
        "edit-membro-nome-assinatura"
    );
    const campoCargoAssinatura = document.getElementById(
        "edit-membro-cargo-assinatura"
    );

    const nomeAssinaturaDigitado = campoNomeAssinatura
        ? String(campoNomeAssinatura.value || "").trim()
        : "";
    const cargoAssinaturaDigitado = campoCargoAssinatura
        ? String(campoCargoAssinatura.value || "").trim()
        : "";

    const dadosBasicos = {
        nomeReal: String(
            document.getElementById("edit-membro-nome-real").value || ""
        ).trim(),
        nomeAssinatura: nomeAssinaturaDigitado,
        cargoAssinatura: cargoAssinaturaDigitado,
        username: String(
            document.getElementById("edit-membro-username").value || ""
        ).trim().toLowerCase(),
        tipo: document.getElementById("edit-membro-tipo").value,
        unidade: document.getElementById("edit-membro-unidade-vinculo").value,
        cargoId,
        cargo: cargoSelecionado ? cargoSelecionado.nome : "",
        cargoFuncao: cargoSelecionado ? cargoSelecionado.funcao : "nenhuma",
        dataNascimento: document.getElementById("edit-membro-nascimento").value
    };



    if (
        !id ||
        !dadosBasicos.nomeReal ||
        !dadosBasicos.username ||
        !cargoId ||
        !dadosBasicos.dataNascimento
    ) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    if (dadosBasicos.tipo === "Desbravador" && !dadosBasicos.unidade) {
        alert("Desbravadores precisam obrigatoriamente estar vinculados a uma unidade!");
        return;
    }

    if (
        arquivoAssinatura &&
        arquivoAssinatura.type !== "image/png" &&
        !arquivoAssinatura.name.toLowerCase().endsWith(".png")
    ) {
        alert("A assinatura precisa ser um arquivo PNG.");
        return;
    }

    try {
        const referencia = window.ClubeDB.textoDB
            .collection("usuarios")
            .doc(id);

        const documentoAtual = await referencia.get();

        if (!documentoAtual.exists) {
            alert("Membro não encontrado.");
            return;
        }

        const dadosAtuais = documentoAtual.data() || {};
        const senhaAtual = dadosAtuais.senha || "";
        const usernameAntigo = String(
            dadosAtuais.username || ""
        ).trim().toLowerCase();
        const usernameNovo = dadosBasicos.username;

        // Se o administrador digitou uma nova senha, ela substitui a antiga.
        // Se deixou vazio, a senha existente é mantida.
        const senhaFinal = senhaDigitada || senhaAtual;

        if (!senhaFinal) {
            alert("Este usuário não possui uma senha cadastrada. Informe uma senha para continuar.");
            return;
        }

        let urlAssinaturaNova = "";

        if (arquivoAssinatura) {
            urlAssinaturaNova = await subirImagemParaNuvem(
                arquivoAssinatura
            );

            if (!urlAssinaturaNova) {
                throw new Error(
                    "Não foi possível enviar a assinatura PNG para o servidor de imagens."
                );
            }
        }

        const dadosAtualizados = {
            ...dadosBasicos,
            senha: senhaFinal
        };

        if (
            arquivoFoto &&
            window.ClubeDB.acoesAdmin &&
            typeof window.ClubeDB.acoesAdmin.uploadFoto === "function"
        ) {
            const dadosFotoNova = await window.ClubeDB.acoesAdmin.uploadFoto(
                arquivoFoto
            );

            const dadosComFoto = {
                ...dadosAtualizados,
                fotoUrl: dadosFotoNova.url || "",
                fotoIdPublico: dadosFotoNova.idPublico || ""
            };

            await referencia.update(dadosComFoto);
        } else {
            await referencia.update(dadosAtualizados);
        }


        const assinaturaNovaRef = window.ClubeDB.textoDB
            .collection("assinaturas_usuarios")
            .doc(usernameNovo);
        const assinaturaAntigaRef = usernameAntigo
            ? window.ClubeDB.textoDB
                .collection("assinaturas_usuarios")
                .doc(usernameAntigo)
            : null;

        if (urlAssinaturaNova) {
            await assinaturaNovaRef.set({
                username: usernameNovo,
                pngUrl: urlAssinaturaNova,
                nomeAssinatura:
                    dadosBasicos.nomeAssinatura ||
                    dadosBasicos.nomeReal,
                cargoAssinatura:
                    dadosBasicos.cargoAssinatura ||
                    dadosBasicos.cargo ||
                    "Responsável",
                nomeUsuario: dadosBasicos.nomeReal,
                atualizadoPor: localStorage.getItem(
                    "usernameLogado"
                ) || "admin",
                atualizadoEm:
                    firebase.firestore.FieldValue.serverTimestamp()
            }, {
                merge: true
            });

            if (
                assinaturaAntigaRef &&
                usernameAntigo &&
                usernameAntigo !== usernameNovo
            ) {
                await assinaturaAntigaRef.delete();
            }
        } else if (
            assinaturaAntigaRef &&
            usernameAntigo &&
            usernameAntigo !== usernameNovo
        ) {
            const assinaturaAntigaSnap = await assinaturaAntigaRef.get();

            if (assinaturaAntigaSnap.exists) {
                await assinaturaNovaRef.set({
                    ...assinaturaAntigaSnap.data(),
                    username: usernameNovo,
                    nomeAssinatura:
                        dadosBasicos.nomeAssinatura ||
                        dadosBasicos.nomeReal,
                    cargoAssinatura:
                        dadosBasicos.cargoAssinatura ||
                        dadosBasicos.cargo ||
                        "Responsável",
                    nomeUsuario: dadosBasicos.nomeReal,
                    atualizadoPor: localStorage.getItem(
                        "usernameLogado"
                    ) || "admin",
                    atualizadoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                }, {
                    merge: true
                });
                await assinaturaAntigaRef.delete();
            }
        }

        const assinaturaAtualSnap = await assinaturaNovaRef.get();
        const assinaturaAtual = assinaturaAtualSnap.exists
            ? assinaturaAtualSnap.data() || {}
            : {};

        if (
            urlAssinaturaNova ||
            assinaturaAtualSnap.exists
        ) {
            await assinaturaNovaRef.set({
                ...assinaturaAtual,
                username: usernameNovo,
                ...(urlAssinaturaNova
                    ? { pngUrl: urlAssinaturaNova }
                    : {}),
                nomeAssinatura:
                    nomeAssinaturaDigitado ||
                    dadosBasicos.nomeReal,
                cargoAssinatura:
                    cargoAssinaturaDigitado ||
                    dadosBasicos.cargo ||
                    "Responsável",
                nomeUsuario: dadosBasicos.nomeReal,
                atualizadoPor: localStorage.getItem(
                    "usernameLogado"
                ) || "admin",
                atualizadoEm:
                    firebase.firestore.FieldValue.serverTimestamp()
            }, {
                merge: true
            });
        }


        alert(`🎉 Membro ${dadosAtualizados.nomeReal} atualizado com sucesso!`);
        fecharModalEdicaoMembro();
        await carregarMembrosCadastrados();
    } catch (erro) {
        console.error("Erro ao salvar edição:", erro);
        alert("Erro ao atualizar membro: " + erro.message);
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
            window.cacheMestrados =
                snapMestrados.docs.map(doc => {
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
            window.cacheClasses =
                snapClasses.docs.map(doc => {
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
    /*
     * Fecha somente a checklist.
     *
     * A tela que já estava aberta por baixo é preservada:
     * - "Ver" mantém o usuário no catálogo e na categoria atual.
     * - "Continuar" mantém o usuário em Especialidades em andamento.
     */
    modal.remove();
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
    /*
     * Fecha somente a checklist do mestrado.
     *
     * A tela que estava aberta por baixo será preservada:
     * - "Ver" mantém o usuário no catálogo e na categoria atual.
     * - "Continuar" mantém o usuário em Mestrados em andamento.
     */
    modal.remove();
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
    /*
     * Fecha somente a checklist da classe.
     *
     * A tela que estava aberta por baixo será preservada:
     * - "Ver" mantém o usuário no catálogo e na categoria atual.
     * - "Continuar" mantém o usuário em Classes em andamento.
     */
    modal.remove();
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

        const cacheAtual = Array.isArray(window[config.cache])
            ? window[config.cache]
            : [];

        const itemNoCache = cacheAtual.find(
            item => String(item.id) === id
        );

        const itemSnapshot = await itemRef.get();

        const dadosItem = itemSnapshot.exists
            ? itemSnapshot.data() || {}
            : {};

        const nomeItem = String(
            dadosItem.nome ||
            (itemNoCache && itemNoCache.nome) ||
            ""
        ).trim();

        /*
         * As especialidades existentes em especialidades-dados.js
         * são importadas novamente quando o site carrega.
         *
         * Por isso, ao excluir uma especialidade, também salvamos
         * um registro na coleção "especialidades_excluidas".
         *
         * Esse registro impede que o importador recrie a
         * especialidade depois de atualizar a página.
         */
        if (tipo === "especialidades") {
            if (!nomeItem) {
                throw new Error(
                    "Não foi possível identificar o nome da especialidade. A exclusão foi cancelada para impedir que ela volte após atualizar a página."
                );
            }

            const normalizarNomeEspecialidade = valor =>
                String(valor || "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, " ");

            const nomeNormalizado =
                normalizarNomeEspecialidade(nomeItem);

            const exclusaoRef = db
                .collection("especialidades_excluidas")
                .doc(encodeURIComponent(nomeNormalizado));

            /*
             * A exclusão da especialidade e o registro de bloqueio
             * acontecem juntos em um único lote.
             *
             * Assim, não existe o risco de apagar a especialidade
             * sem registrar que ela não deve ser importada novamente.
             */
            const loteExclusaoCatalogo = db.batch();

            loteExclusaoCatalogo.delete(itemRef);

            loteExclusaoCatalogo.set(
                exclusaoRef,
                {
                    nome: nomeItem,
                    nomeNormalizado: nomeNormalizado,
                    itemIdOriginal: id,
                    excluidoEm:
                        firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    merge: true
                }
            );

            await loteExclusaoCatalogo.commit();
        } else {
            await itemRef.delete();
        }

        const [snapProgressos, snapPendencias] = await Promise.all([
            db.collection(config.progresso)
                .where("itemId", "==", id)
                .get(),

            db.collection("pendencias_aprovacao")
                .where("itemId", "==", id)
                .where("colecaoOrigem", "==", config.progresso)
                .get()
        ]);

        const apagarEmLotes = async docs => {
            if (!docs || docs.length === 0) {
                return;
            }

            for (
                let inicio = 0;
                inicio < docs.length;
                inicio += 450
            ) {
                const lote = db.batch();
                const grupo = docs.slice(inicio, inicio + 450);

                grupo.forEach(doc => {
                    lote.delete(doc.ref);
                });

                await lote.commit();
            }
        };

        await apagarEmLotes([...snapProgressos.docs]);
        await apagarEmLotes([...snapPendencias.docs]);

        window[config.cache] = cacheAtual.filter(
            item => String(item.id) !== id
        );

        fecharModalGerenciarItem();

        if (tipo === "especialidades") {
            if (
                window.categoriaAtualEspecialidades &&
                !window.cacheEspecialidades.some(
                    item =>
                        (
                            item.categoria ||
                            item.area ||
                            "Geral"
                        ) === window.categoriaAtualEspecialidades
                )
            ) {
                window.categoriaAtualEspecialidades = null;
            }

            renderizarCatalogoEspecialidades(
                window.cacheEspecialidades,
                true
            );

            if (
                typeof carregarEspecialidadesEmAndamento ===
                "function"
            ) {
                await carregarEspecialidadesEmAndamento();
            }
        } else if (tipo === "mestrados") {
            if (
                window.categoriaAtualMestrados &&
                !window.cacheMestrados.some(
                    item =>
                        (
                            item.categoria ||
                            item.area ||
                            "Mestrado"
                        ) === window.categoriaAtualMestrados
                )
            ) {
                window.categoriaAtualMestrados = null;
            }

            renderizarCatalogoMestrados(
                window.cacheMestrados,
                true
            );

            if (
                typeof carregarMestradosEmAndamento ===
                "function"
            ) {
                await carregarMestradosEmAndamento();
            }
        } else if (tipo === "classes") {
            if (
                window.categoriaAtualClasses &&
                !window.cacheClasses.some(
                    item =>
                        (
                            item.categoria ||
                            "Classe"
                        ) === window.categoriaAtualClasses
                )
            ) {
                window.categoriaAtualClasses = null;
            }

            renderizarCatalogoClasses(
                window.cacheClasses,
                true
            );

            if (
                typeof carregarClassesEmAndamento ===
                "function"
            ) {
                await carregarClassesEmAndamento();
            }
        }

        alert(
            `${
                config.nome.charAt(0).toUpperCase() +
                config.nome.slice(1)
            } excluído com sucesso.`
        );
    } catch (erro) {
        console.error(
            `Erro ao excluir ${config.nome}:`,
            erro
        );

        alert(
            `Não foi possível excluir o ${config.nome}.\n\n${
                erro.message || "Erro desconhecido."
            }`
        );
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

// =====================================================
// CRIADOR DE PUBLICAÇÕES — ETAPA VISUAL
// =====================================================

let urlPreviaPublicacaoAtual = null;

function abrirCriadorPublicacao() {
    const modal =
        document.getElementById("modal-criar-publicacao");

    const textarea =
        document.getElementById("publicacao-texto");

    const avatarCriador =
        document.getElementById("criador-publicacao-avatar");

    const usernameLogado =
        localStorage.getItem("usernameLogado");

    if (!modal) {
        console.error(
            "O modal #modal-criar-publicacao não foi encontrado."
        );

        return;
    }

    /*
     * LÓGICA SÊNIOR: Sincroniza a foto do autor em tempo real ao abrir o modal,
     * buscando diretamente na coleção de usuários para garantir que apareça.
     */
    if (
        avatarCriador &&
        usernameLogado &&
        window.ClubeDB &&
        window.ClubeDB.textoDB
    ) {
        // Fallback imediato para evitar imagem vazia
        avatarCriador.src = avatarCriador.src || window.AVATAR_USUARIO_PADRAO;

        window.ClubeDB.textoDB
            .collection("usuarios")
            .where("username", "==", usernameLogado)
            .limit(1)
            .get()
            .then((snap) => {
                if (!snap.empty) {
                    const dados = snap.docs[0].data() || {};
                    const foto = normalizarUrlPublicacao(dados.fotoUrl || dados.foto) || window.AVATAR_USUARIO_PADRAO;
                    avatarCriador.src = foto;
                }
            })
            .catch((err) => {
                console.error("Erro ao carregar avatar no modal:", err);
            });
    }

    modal.style.display =
        "flex";

    atualizarCriadorPublicacao();

    /*
     * Aguarda o modal aparecer antes de focar.
     */
    setTimeout(() => {
        if (textarea) {
            textarea.focus();
        }
    }, 50);
}



function fecharCriadorPublicacao() {
    const modal =
        document.getElementById("modal-criar-publicacao");

    const textarea =
        document.getElementById("publicacao-texto");

    const inputArquivo =
        document.getElementById("publicacao-arquivo");

    const previa =
        document.getElementById("publicacao-previa-midia");

    const tipoMidia =
        document.getElementById("publicacao-tipo-midia");

    if (modal) {
        modal.style.display =
            "none";
    }

    if (textarea) {
        textarea.value =
            "";
    }

    if (inputArquivo) {
        inputArquivo.value =
            "";
    }

    if (previa) {
        previa.innerHTML =
            "";

        previa.style.display =
            "none";
    }

    if (tipoMidia) {
        tipoMidia.textContent =
            "";
    }

    /*
     * Libera a URL temporária criada pelo navegador.
     */
    if (urlPreviaPublicacaoAtual) {
        URL.revokeObjectURL(
            urlPreviaPublicacaoAtual
        );

        urlPreviaPublicacaoAtual =
            null;
    }

    atualizarCriadorPublicacao();
}


function selecionarMidiaPublicacao() {
    const input =
        document.getElementById("publicacao-arquivo");

    if (input) {
        input.click();
    }
}


function mostrarPreviaMidiaPublicacao(input) {
    const arquivo =
        input.files &&
        input.files[0];

    const previa =
        document.getElementById("publicacao-previa-midia");

    const tipoMidia =
        document.getElementById("publicacao-tipo-midia");

    if (
        !arquivo ||
        !previa
    ) {
        atualizarCriadorPublicacao();
        return;
    }

    const ehImagem =
        arquivo.type.startsWith("image/");

    const ehVideo =
        arquivo.type.startsWith("video/");

    if (
        !ehImagem &&
        !ehVideo
    ) {
        alert(
            "Selecione uma imagem ou um vídeo."
        );

        input.value =
            "";

        atualizarCriadorPublicacao();
        return;
    }

    /*
     * Remove a URL temporária anterior.
     */
    if (urlPreviaPublicacaoAtual) {
        URL.revokeObjectURL(
            urlPreviaPublicacaoAtual
        );
    }

    urlPreviaPublicacaoAtual =
        URL.createObjectURL(arquivo);

    if (ehImagem) {
        previa.innerHTML = `
            <button
                type="button"
                onclick="removerMidiaPublicacao()"
                aria-label="Remover mídia"
                style="
                    position:absolute;
                    top:10px;
                    right:10px;
                    z-index:2;
                    width:34px;
                    height:34px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    padding:0;
                    border:none;
                    border-radius:50%;
                    background:rgba(0,0,0,0.75);
                    color:#fff;
                    font-size:18px;
                    cursor:pointer;
                "
            >
                ✕
            </button>

            <img
                src="${urlPreviaPublicacaoAtual}"
                alt="Prévia da imagem selecionada"
            >
        `;
    } else {
        previa.innerHTML = `
            <button
                type="button"
                onclick="removerMidiaPublicacao()"
                aria-label="Remover mídia"
                style="
                    position:absolute;
                    top:10px;
                    right:10px;
                    z-index:2;
                    width:34px;
                    height:34px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    padding:0;
                    border:none;
                    border-radius:50%;
                    background:rgba(0,0,0,0.75);
                    color:#fff;
                    font-size:18px;
                    cursor:pointer;
                "
            >
                ✕
            </button>

            <video
                src="${urlPreviaPublicacaoAtual}"
                controls
                playsinline
            ></video>
        `;
    }

    previa.style.display =
        "block";

    if (tipoMidia) {
        tipoMidia.textContent =
            ehImagem
                ? "Imagem selecionada"
                : "Vídeo selecionado";
    }

    atualizarCriadorPublicacao();
}


function removerMidiaPublicacao() {
    const input =
        document.getElementById("publicacao-arquivo");

    const previa =
        document.getElementById("publicacao-previa-midia");

    const tipoMidia =
        document.getElementById("publicacao-tipo-midia");

    if (input) {
        input.value =
            "";
    }

    if (previa) {
        previa.innerHTML =
            "";

        previa.style.display =
            "none";
    }

    if (tipoMidia) {
        tipoMidia.textContent =
            "";
    }

    if (urlPreviaPublicacaoAtual) {
        URL.revokeObjectURL(
            urlPreviaPublicacaoAtual
        );

        urlPreviaPublicacaoAtual =
            null;
    }

    atualizarCriadorPublicacao();
}


function atualizarCriadorPublicacao() {
    const textarea =
        document.getElementById("publicacao-texto");

    const inputArquivo =
        document.getElementById("publicacao-arquivo");

    const contador =
        document.getElementById("publicacao-contador");

    const btnPublicar =
        document.getElementById("btn-confirmar-publicacao");

    const texto =
        textarea
            ? textarea.value
            : "";

    const possuiArquivo =
        Boolean(
            inputArquivo &&
            inputArquivo.files &&
            inputArquivo.files.length > 0
        );

    if (contador) {
        contador.textContent =
            `${texto.length}/500`;
    }

    if (btnPublicar) {
        btnPublicar.disabled =
            texto.trim().length === 0 &&
            !possuiArquivo;
    }
}


// =====================================================
// PUBLICAÇÕES — INTEGRAÇÃO FIRESTORE + TELEGRAM
// =====================================================

/*
 * Escapa texto antes de colocá-lo dentro de HTML.
 * Isso evita que o texto digitado pelo usuário seja
 * interpretado como código HTML.
 */
function escaparHtml(valor) {
    return String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
 * Garante que uma URL exibida pelo site seja HTTP/HTTPS.
 */
function normalizarUrlPublicacao(url) {
    const valor =
        String(url || "").trim();

    if (
        valor.startsWith("https://") ||
        valor.startsWith("http://")
    ) {
        return valor;
    }

    return "";
}


/*
 * Converte o Timestamp do Firestore para uma
 * apresentação amigável no Feed.
 */
function formatarDataPublicacao(valor) {
    try {
        let data = null;

        if (
            valor &&
            typeof valor.toDate === "function"
        ) {
            data = valor.toDate();

        } else if (
            valor instanceof Date
        ) {
            data = valor;

        } else if (
            typeof valor === "string" ||
            typeof valor === "number"
        ) {
            data = new Date(valor);
        }

        if (
            !data ||
            Number.isNaN(data.getTime())
        ) {
            return "agora";
        }

        const agora =
            new Date();

        const diferenca =
            agora.getTime() -
            data.getTime();

        const segundos =
            Math.floor(
                diferenca / 1000
            );

        if (segundos < 60) {
            return "agora";
        }

        const minutos =
            Math.floor(
                segundos / 60
            );

        if (minutos < 60) {
            return `há ${minutos} min`;
        }

        const horas =
            Math.floor(
                minutos / 60
            );

        if (horas < 24) {
            return `há ${horas} h`;
        }

        const dias =
            Math.floor(
                horas / 24
            );

        if (dias < 7) {
            return `há ${dias} d`;
        }

        return data.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    } catch (erro) {
        console.error(
            "Erro ao formatar data:",
            erro
        );

        return "agora";
    }
}


/*
 * Monta a URL pública usada para visualizar
 * uma mídia armazenada no Telegram.
 *
 * Exemplo:
 *
 * Telegram
 *     ↓
 * telegramFileId
 *     ↓
 * Cloudflare Worker /media
 *     ↓
 * navegador
 */
function criarUrlMidiaTelegram(
    telegramFileId
) {
    if (!telegramFileId) {
        return "";
    }

    return (
        PUBLICACOES_WORKER_URL +
        "/media?file_id=" +
        encodeURIComponent(
            telegramFileId
        )
    );
}


/*
 * Busca os dados do autor no Firestore.
 *
 * Para o admin, como ele não necessariamente possui
 * documento na coleção "usuarios", usamos dados fixos.
 *
 * Para membros, usamos o documento correspondente
 * ao username logado.
 */
async function obterDadosAutorPublicacao() {
    const usernameLogado =
        localStorage.getItem(
            "usernameLogado"
        );

    const tipoUsuario =
        localStorage.getItem(
            "usuarioLogado"
        );

    const usuarioFirebase =
        window.ClubeDB &&
        window.ClubeDB.loginDB
            ? window.ClubeDB.loginDB.currentUser
            : null;

    const dadosAutor = {
        uid:
            usuarioFirebase
                ? usuarioFirebase.uid
                : "",

        username:
            usernameLogado ||
            "usuario",

        nome:
            usernameLogado ||
            "Membro",

        cargo:
            "Membro",

        fotoUrl:
            "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png"
    };

    /*
     * Dados padrão do administrador.
     */
    if (
        tipoUsuario === "admin"
    ) {
        dadosAutor.uid =
            usuarioFirebase
                ? usuarioFirebase.uid
                : "admin";

        dadosAutor.username =
            "admin";

        dadosAutor.nome =
            "Administrador";

        dadosAutor.cargo =
            "Liderança Geral";

        return dadosAutor;
    }

    if (!usernameLogado) {
        return dadosAutor;
    }

    try {
        const snapshot =
            await window.ClubeDB.textoDB
                .collection("usuarios")
                .where(
                    "username",
                    "==",
                    usernameLogado
                )
                .limit(1)
                .get();

        if (
            !snapshot.empty
        ) {
            const dados =
                snapshot.docs[0].data();

            dadosAutor.nome =
                dados.nomeReal ||
                dados.username ||
                usernameLogado;

            dadosAutor.username =
                dados.username ||
                usernameLogado;

            dadosAutor.cargo =
                dados.cargo ||
                dados.tipo ||
                "Membro";

            dadosAutor.fotoUrl =
                normalizarUrlPublicacao(
                    dados.fotoUrl
                ) ||
                dadosAutor.fotoUrl;
        }

    } catch (erro) {
        console.warn(
            "Não foi possível carregar os dados do autor:",
            erro
        );
    }

    return dadosAutor;
}


/*
 * Renderiza uma publicação individual.
 */
function criarCardPublicacao(
    doc,
    avatarAtualizado = ""
) {
    const dados =
        doc.data() || {};

    const autorNome =
        escaparHtml(
            dados.autorNome ||
            dados.autorUsername ||
            "Membro"
        );

    const autorUsername =
        escaparHtml(
            dados.autorUsername ||
            "usuario"
        );

    const autorCargo =
        escaparHtml(
            dados.autorCargo ||
            "Membro"
        );

    /*
     * Prioridade:
     *
     * 1. Foto atual encontrada na coleção "usuarios".
     * 2. Foto armazenada na publicação.
     * 3. Avatar padrão configurado pelo clube.
     */
    const avatar =
        normalizarUrlPublicacao(
            avatarAtualizado
        ) ||
        normalizarUrlPublicacao(
            dados.autorFotoUrl
        ) ||
        window.AVATAR_USUARIO_PADRAO;

    const texto =
        escaparHtml(
            dados.texto || ""
        );

    const dataPublicacao =
        formatarDataPublicacao(
            dados.criadoEm
        );

    const quantidadeCurtidas =
        Number(
            dados.curtidas || 0
        );

    const usernameLogado =
        localStorage.getItem("usernameLogado") || "";

    const curtidoresArray =
        dados.curtidores ||
        dados.curtidasArray ||
        [];

    const usuarioJaCurtiu =
        usernameLogado &&
        curtidoresArray.includes(usernameLogado);

    const classeCurtido =
        usuarioJaCurtiu
            ? "feed-x-curtido"
            : "";

    const iconeCoracao =
        usuarioJaCurtiu
            ? "♥"
            : "♡";

    const quantidadeComentarios =
        Number(
            dados.comentarios || 0
        );

    const quantidadeVisualizacoes =
        Number(
            dados.visualizacoes || 0
        );

    let blocoMidia = "";

    /*
     * Se existir uma mídia do Telegram,
     * ela será exibida através do Worker.
     */
    if (dados.telegramFileId) {
        const urlMidia =
            criarUrlMidiaTelegram(
                dados.telegramFileId
            );

        if (
            dados.tipoMidia ===
            "imagem"
        ) {
            blocoMidia = `
                <div class="feed-x-midia">
                    <img
                        src="${escaparHtml(urlMidia)}"
                        alt="Imagem da publicação de ${autorNome}"
                        loading="lazy"
                    >
                </div>
            `;

        } else if (
            dados.tipoMidia ===
            "video"
        ) {
            blocoMidia = `
                <div class="feed-x-midia">
                    <video
                        src="${escaparHtml(urlMidia)}"
                        controls
                        playsinline
                        preload="metadata"
                    ></video>
                </div>
            `;
        }
    }

    /*
     * Caso seja uma publicação somente de texto,
     * não cria espaço vazio para mídia.
     */
    return `
        <article
            class="feed-x-post"
            data-publicacao-id="${escaparHtml(doc.id)}"
        >

            <img
                class="feed-x-avatar"
                src="${escaparHtml(avatar)}"
                alt="Foto de ${autorNome}"
                loading="lazy"
                onerror="this.onerror=null;this.src='${escaparHtml(window.AVATAR_USUARIO_PADRAO)}';"
            >

            <div class="feed-x-conteudo">

                <div class="feed-x-autor">

                    <span
                        class="feed-x-nome"
                        title="${autorNome}"
                    >
                        ${autorNome}
                    </span>

                    <span
                        class="feed-x-username"
                        title="@${autorUsername}"
                    >
                        @${autorUsername}
                    </span>

                    <span class="feed-x-data">
                        · ${dataPublicacao}
                    </span>

                </div>

                ${
    autorCargo
        ? `
            <div class="feed-x-cargo">
                ${autorCargo}
            </div>
        `
        : ""
}

${
    texto
        ? `
            <div
                class="feed-x-texto"
                style="
                    text-align: left;
                    margin-left: 0;
                    padding-left: 0;
                "
            >
                ${texto}
            </div>
        `
        : ""
}

                ${blocoMidia}

                <div class="feed-x-acoes">

                    <button
                        type="button"
                        class="feed-x-acao feed-x-acao-comentar"
                        data-acao="comentarios"
                        data-publicacao-id="${escaparHtml(doc.id)}"
                        aria-label="Comentar"
                        onclick="abrirComentariosPublicacao('${escaparHtml(doc.id)}')"
                    >
                        <span class="feed-x-icone">💬</span>

                        <span class="feed-x-contador">
                            ${quantidadeComentarios}
                        </span>
                    </button>

                    <button
                        type="button"
                        class="feed-x-acao feed-x-acao-curtir ${classeCurtido}"
                        data-acao="curtida"
                        data-publicacao-id="${escaparHtml(doc.id)}"
                        aria-label="Curtir"
                        onclick="curtirPublicacao('${escaparHtml(doc.id)}', this)"
                    >
                        <span class="feed-x-icone feed-x-coracao">
                            ${iconeCoracao}
                        </span>

                        <span class="feed-x-contador">
                            ${quantidadeCurtidas}
                        </span>
                    </button>

                </div>

            </div>

        </article>
    `;
}


/*
 * Carrega o Feed real do Firestore.
 */
async function carregarPublicacoesFeed() {
    const container = document.getElementById("feed-publicacoes-lista");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div style="padding:30px 20px;text-align:center;color:#71767b;font-size:14px;">
            Carregando publicações...
        </div>
    `;

    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        container.innerHTML = `
            <div style="padding:40px 20px;text-align:center;color:#ff6b6b;font-size:14px;">
                Banco de dados ainda não foi inicializado.

                <button
                    type="button"
                    onclick="carregarPublicacoesFeed()"
                    style="margin-top:12px;padding:8px 16px;border:none;border-radius:999px;background:#1d9bf0;color:#fff;cursor:pointer;font-weight:600;"
                >
                    Tentar novamente
                </button>
            </div>
        `;
        return;
    }

    try {
        const snapshot = await window.ClubeDB.textoDB
            .collection("publicacoes")
            .limit(100)
            .get();

        const documentos = snapshot.docs.slice().sort((a, b) => {
            const dadosA = a.data() || {};
            const dadosB = b.data() || {};

            const dataA =
                dadosA.criadoEm &&
                typeof dadosA.criadoEm.toMillis === "function"
                    ? dadosA.criadoEm.toMillis()
                    : 0;

            const dataB =
                dadosB.criadoEm &&
                typeof dadosB.criadoEm.toMillis === "function"
                    ? dadosB.criadoEm.toMillis()
                    : 0;

            return dataB - dataA;
        });

        if (!documentos.length) {
            container.innerHTML = `
                <div style="padding:50px 20px;text-align:center;color:#71767b;font-size:14px;">
                    Ainda não há publicações.

                    <span style="display:block;margin-top:6px;font-size:13px;">
                        Seja o primeiro a publicar!
                    </span>
                </div>
            `;
            return;
        }

        /*
         * =====================================================
         * SINCRONIZAÇÃO DOS AVATARES DO FEED
         * =====================================================
         *
         * As publicações antigas podem possuir uma foto antiga
         * gravada no documento da publicação.
         *
         * Aqui buscamos a foto ATUAL dos autores diretamente
         * na coleção "usuarios".
         *
         * Dessa forma:
         *
         * 1. Usuário sem foto -> avatar padrão.
         * 2. Usuário com foto -> foto atual.
         * 3. Foto alterada -> feed mostra a nova foto.
         * 4. Publicações antigas também são corrigidas visualmente.
         */

        const usernames = [
            ...new Set(
                documentos
                    .map(doc => {
                        const dados = doc.data() || {};
                        return String(dados.autorUsername || "")
                            .trim()
                            .toLowerCase();
                    })
                    .filter(Boolean)
            )
        ];

        const avataresAtuais = new Map();

        /*
         * Firestore possui limite para consultas "in".
         * Por segurança, dividimos os usuários em blocos de 10.
         */
        const tamanhoBloco = 10;

        for (let i = 0; i < usernames.length; i += tamanhoBloco) {
            const bloco = usernames.slice(i, i + tamanhoBloco);

            if (!bloco.length) continue;

            const usuariosSnapshot = await window.ClubeDB.textoDB
                .collection("usuarios")
                .where("username", "in", bloco)
                .get();

            usuariosSnapshot.forEach(docUsuario => {
                const dadosUsuario = docUsuario.data() || {};

                const username = String(
                    dadosUsuario.username || ""
                )
                    .trim()
                    .toLowerCase();

                if (!username) return;

                const fotoAtual =
                    normalizarUrlPublicacao(
                        dadosUsuario.fotoUrl
                    ) || window.AVATAR_USUARIO_PADRAO;

                avataresAtuais.set(
                    username,
                    fotoAtual
                );
            });
        }

        /*
         * Renderiza cada publicação utilizando a foto atual
         * do usuário quando ela estiver disponível.
         */
        container.innerHTML = documentos
            .map(doc => {
                const dados = doc.data() || {};

                const usernameAutor = String(
                    dados.autorUsername || ""
                )
                    .trim()
                    .toLowerCase();

                const avatarAtual =
                    avataresAtuais.get(usernameAutor) ||
                    window.AVATAR_USUARIO_PADRAO;

                return criarCardPublicacao(
                    doc,
                    avatarAtual
                );
            })
            .join("");

    } catch (erro) {
        console.error("Erro ao carregar publicações:", erro);

        container.innerHTML = `
            <div style="padding:40px 20px;text-align:center;color:#ff6b6b;font-size:14px;">
                Não foi possível carregar as publicações.

                <small>
                    ${escaparHtml(
                        erro.message || "Erro desconhecido"
                    )}
                </small>

                <button
                    type="button"
                    onclick="carregarPublicacoesFeed()"
                    style="margin-top:12px;padding:8px 16px;border:none;border-radius:999px;background:#1d9bf0;color:#fff;cursor:pointer;font-weight:600;"
                >
                    Tentar novamente
                </button>
            </div>
        `;
    }
}


/*
 * Publica uma nova publicação.
 *
 * Fluxo:
 *
 * 1. Valida o usuário Firebase.
 * 2. Cria o documento da publicação no Firestore.
 * 3. Se houver mídia:
 *      Site
 *        ↓
 *      Cloudflare Worker
 *        ↓
 *      Telegram
 * 4. Salva o telegramFileId no Firestore.
 * 5. Recarrega o Feed.
 */
async function publicarPublicacao() {
    const btnPublicar = document.getElementById("btn-confirmar-publicacao");
    const textarea = document.getElementById("publicacao-texto");
    const inputArquivo = document.getElementById("publicacao-arquivo");

    const texto = textarea ? textarea.value.trim() : "";
    const arquivo = inputArquivo && inputArquivo.files && inputArquivo.files.length > 0
        ? inputArquivo.files[0]
        : null;

    if (!texto && !arquivo) {
        alert("Escreva algo ou adicione uma foto/vídeo.");
        return;
    }

    let usuarioFirebase = window.ClubeDB && window.ClubeDB.loginDB
        ? window.ClubeDB.loginDB.currentUser
        : null;

    if (
        !usuarioFirebase &&
        window.ClubeDB &&
        window.ClubeDB.loginDB &&
        typeof window.ClubeDB.loginDB.onAuthStateChanged === "function"
    ) {
        usuarioFirebase = await new Promise((resolver) => {
            let finalizado = false;
            let temporizador;

            const encerrar = (usuario) => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(temporizador);
                resolver(usuario || null);
            };

            temporizador = setTimeout(
                () => encerrar(null),
                10000
            );

            window.ClubeDB.loginDB.onAuthStateChanged(encerrar);
        });
    }

    if (!usuarioFirebase) {
        alert(
            "Sua sessão do Firebase ainda não foi carregada ou expirou. Recarregue a página e faça login novamente."
        );
        return;
    }

    if (arquivo) {
        const ehImagem = arquivo.type.startsWith("image/");
        const ehVideo =
            arquivo.type === "video/mp4" ||
            /\.mp4$/i.test(arquivo.name);

        if (!ehImagem && !ehVideo) {
            alert("Selecione uma imagem ou um vídeo MP4.");
            return;
        }

        if (
            ehImagem &&
            arquivo.size > 10 * 1024 * 1024
        ) {
            alert("A imagem deve ter no máximo 10 MB.");
            return;
        }

        if (
            ehVideo &&
            arquivo.size > 20 * 1024 * 1024
        ) {
            alert("O vídeo deve ter no máximo 20 MB.");
            return;
        }
    }

    let referenciaPublicacao = null;

    try {
        if (btnPublicar) {
            btnPublicar.disabled = true;
            btnPublicar.textContent = "Publicando...";
        }

        const autor = await obterDadosAutorPublicacao();

        referenciaPublicacao = await window.ClubeDB.textoDB
            .collection("publicacoes")
            .add({
                autorId: autor.uid,
                autorUsername: autor.username,
                autorNome: autor.nome,
                autorCargo: autor.cargo,
                autorFotoUrl: autor.fotoUrl,
                texto: texto,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                status: "processando",
                tipoMidia: null,
                telegramFileId: "",
                telegramFileUniqueId: "",
                telegramMessageId: null,
                mimeType: "",
                nomeOriginal: "",
                tamanhoBytes: 0,
                largura: null,
                altura: null,
                duracao: null,
                curtidas: 0,
                comentarios: 0,
                visualizacoes: 0
            });

        let dadosMidia = null;

        if (arquivo) {
            const idToken = await usuarioFirebase.getIdToken(true);
            const formData = new FormData();

            formData.append(
                "arquivo",
                arquivo,
                arquivo.name
            );

            formData.append(
                "texto",
                texto
            );

            formData.append(
                "autorUsername",
                autor.username
            );

            const controlador = new AbortController();
            const temporizador = setTimeout(
                () => controlador.abort(),
                60000
            );

            let respostaWorker;
            let resultadoWorker;

            try {
                respostaWorker = await fetch(
                    PUBLICACOES_WORKER_URL + "/upload",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${idToken}`
                        },
                        body: formData,
                        cache: "no-store",
                        signal: controlador.signal
                    }
                );
            } finally {
                clearTimeout(temporizador);
            }

            const textoResposta =
                await respostaWorker.text();

            try {
                resultadoWorker = textoResposta
                    ? JSON.parse(textoResposta)
                    : {};
            } catch (erroJSON) {
                resultadoWorker = {
                    ok: false,
                    erro:
                        textoResposta ||
                        "Resposta inválida do Worker."
                };
            }

            if (
                !respostaWorker.ok ||
                !resultadoWorker.ok ||
                !resultadoWorker.midia
            ) {
                throw new Error(
                    resultadoWorker.erro ||
                    resultadoWorker.error ||
                    `Falha no upload: HTTP ${respostaWorker.status}`
                );
            }

            dadosMidia = resultadoWorker.midia;
        }

        await referenciaPublicacao.update({
            status: "publicada",
            tipoMidia: dadosMidia ? dadosMidia.tipo : null,
            telegramFileId: dadosMidia
                ? dadosMidia.telegramFileId
                : "",
            telegramFileUniqueId: dadosMidia
                ? dadosMidia.telegramFileUniqueId
                : "",
            telegramMessageId: dadosMidia
                ? dadosMidia.telegramMessageId
                : null,
            mimeType: dadosMidia
                ? dadosMidia.mimeType
                : "",
            nomeOriginal: dadosMidia
                ? dadosMidia.nomeOriginal
                : "",
            tamanhoBytes: dadosMidia
                ? dadosMidia.tamanhoBytes
                : 0,
            largura: dadosMidia
                ? dadosMidia.largura
                : null,
            altura: dadosMidia
                ? dadosMidia.altura
                : null,
            duracao: dadosMidia
                ? dadosMidia.duracao
                : null
        });

        fecharCriadorPublicacao();
        await carregarPublicacoesFeed();
        alert("Publicação criada com sucesso!");
    } catch (erro) {
        console.error("Erro ao publicar:", erro);

        if (referenciaPublicacao) {
            try {
                await referenciaPublicacao.update({
                    status: "erro",
                    erroPublicacao:
                        erro.message ||
                        "Erro desconhecido.",
                    atualizadoEm:
                        firebase.firestore.FieldValue
                            .serverTimestamp()
                });
            } catch (erroAtualizacao) {
                console.error(
                    "Não foi possível atualizar o status da publicação:",
                    erroAtualizacao
                );
            }
        }

        alert(
            "Não foi possível publicar: " +
            (
                erro.message ||
                "Erro desconhecido."
            )
        );
    } finally {
        if (btnPublicar) {
            btnPublicar.disabled = false;
            btnPublicar.textContent = "Publicar";
        }
    }
}



/*
 * =====================================================
 * CURTIDAS E COMENTÁRIOS DAS PUBLICAÇÕES
 * =====================================================
 */

async function obterUsuarioInteracaoPublicacao() {
    let usuario =
        window.ClubeDB &&
        window.ClubeDB.loginDB
            ? window.ClubeDB.loginDB.currentUser
            : null;

    if (
        !usuario &&
        window.ClubeDB &&
        window.ClubeDB.loginDB &&
        typeof window.ClubeDB.loginDB.onAuthStateChanged ===
            "function"
    ) {
        usuario = await new Promise((resolver) => {
            let finalizado = false;
            let temporizador;

            const concluir = (usuarioAtual) => {
                if (finalizado) {
                    return;
                }

                finalizado = true;
                clearTimeout(temporizador);
                resolver(usuarioAtual || null);
            };

            temporizador = setTimeout(
                () => concluir(null),
                10000
            );

            window.ClubeDB.loginDB.onAuthStateChanged(
                concluir
            );
        });
    }

    if (!usuario) {
        throw new Error(
            "Sua sessão expirou. Faça login novamente."
        );
    }

    return usuario;
}


/* =================================================================
   SISTEMA DE CURTIDAS OTIMIZADO (SEM QUOTA EXCEEDED + PONTOS + PERSISTÊNCIA)
   ================================================================= */
window.lockCurtidas = window.lockCurtidas || {};

async function curtirPublicacao(idPublicacao, botao) {
    if (!idPublicacao || !botao) return;

    if (
        botao.dataset.processando === "true" ||
        window.lockCurtidas[idPublicacao]
    ) {
        return;
    }

    const usuario =
        window.ClubeDB &&
        window.ClubeDB.loginDB
            ? window.ClubeDB.loginDB.currentUser
            : null;

    if (!usuario) {
        alert("Sua sessão expirou. Faça login novamente.");
        return;
    }

    const usernameLogado =
        localStorage.getItem("usernameLogado") ||
        usuario.uid;

    const banco =
        window.ClubeDB &&
        window.ClubeDB.textoDB
            ? window.ClubeDB.textoDB
            : null;

    if (!banco) {
        alert("Não foi possível conectar ao banco de dados.");
        return;
    }

    botao.dataset.processando = "true";
    window.lockCurtidas[idPublicacao] = true;

    const referenciaPublicacao =
        banco
            .collection("publicacoes")
            .doc(idPublicacao);

    const contador =
        botao.querySelector(".feed-x-contador");

    const coracao =
        botao.querySelector(".feed-x-coracao");

    const totalVisual =
        parseInt(
            contador
                ? contador.textContent || "0"
                : "0",
            10
        );

    const estadoVisualAnterior =
        botao.classList.contains("feed-x-curtido");

    try {

        const docSnap =
            await referenciaPublicacao.get();

        if (!docSnap.exists) {
            throw new Error(
                "Publicação não encontrada."
            );
        }

        const dadosPub =
            docSnap.data() || {};

        /*
         * =====================================================
         * COMPATIBILIDADE COM PUBLICAÇÕES ANTIGAS
         * =====================================================
         *
         * Algumas publicações antigas possuem:
         *
         * curtidas: ["usuario1", "usuario2"]
         *
         * enquanto as novas possuem:
         *
         * curtidas: 2
         * curtidores: ["usuario1", "usuario2"]
         *
         * Aqui normalizamos os dois formatos.
         */

        let curtidores = [];

        if (Array.isArray(dadosPub.curtidores)) {

            curtidores =
                [...dadosPub.curtidores];

        } else if (Array.isArray(dadosPub.curtidas)) {

            /*
             * Publicação antiga:
             * o próprio campo "curtidas"
             * era o array de usuários.
             */
            curtidores =
                [...dadosPub.curtidas];
        }

        const usuarioJaCurtiu =
            curtidores.includes(
                usernameLogado
            );

        const novoEstado =
            !usuarioJaCurtiu;

        /*
         * =====================================================
         * ATUALIZAÇÃO VISUAL IMEDIATA
         * =====================================================
         */

        if (novoEstado) {

            botao.classList.add(
                "feed-x-curtido",
                "feed-x-animando"
            );

            if (coracao) {
                coracao.textContent = "♥";
            }

            if (contador) {
                contador.textContent =
                    Math.max(
                        0,
                        totalVisual + 1
                    );
            }

            setTimeout(() => {
                botao.classList.remove(
                    "feed-x-animando"
                );
            }, 400);

        } else {

            botao.classList.remove(
                "feed-x-curtido"
            );

            if (coracao) {
                coracao.textContent = "♡";
            }

            if (contador) {
                contador.textContent =
                    Math.max(
                        0,
                        totalVisual - 1
                    );
            }
        }

        /*
         * =====================================================
         * MONTA A NOVA LISTA DE CURTIDORES
         * =====================================================
         */

        let novosCurtidores;

        if (novoEstado) {

            novosCurtidores =
                curtidores.includes(usernameLogado)
                    ? curtidores
                    : [
                        ...curtidores,
                        usernameLogado
                    ];

        } else {

            novosCurtidores =
                curtidores.filter(
                    usuario =>
                        usuario !== usernameLogado
                );
        }

        /*
         * =====================================================
         * NOVA QUANTIDADE DE CURTIDAS
         * =====================================================
         */

        const novaQuantidade =
            novosCurtidores.length;

        /*
         * =====================================================
         * SALVA NO FIRESTORE
         * =====================================================
         *
         * Sempre salvamos o formato correto:
         *
         * curtidas   = número
         * curtidores = array de usuários
         *
         * Isso também converte automaticamente as
         * publicações antigas que ainda possuem
         * curtidas como array.
         */

        await referenciaPublicacao.update({

            curtidas:
                novaQuantidade,

            curtidores:
                novosCurtidores
        });

    } catch (erro) {

        console.error(
            "Erro ao processar curtida:",
            erro
        );

        /*
         * =====================================================
         * ROLLBACK VISUAL
         * =====================================================
         */

        if (contador) {
            contador.textContent =
                totalVisual;
        }

        if (estadoVisualAnterior) {

            botao.classList.add(
                "feed-x-curtido"
            );

            if (coracao) {
                coracao.textContent =
                    "♥";
            }

        } else {

            botao.classList.remove(
                "feed-x-curtido"
            );

            if (coracao) {
                coracao.textContent =
                    "♡";
            }
        }

        alert(
            "Não foi possível registrar a curtida. Tente novamente."
        );

    } finally {

        setTimeout(() => {

            botao.dataset.processando =
                "false";

            window.lockCurtidas[
                idPublicacao
            ] = false;

        }, 800);
    }
}



async function abrirComentariosPublicacao(
    idPublicacao
) {
    if (!idPublicacao) {
        return;
    }

   const modalPublicacaoPerfil =
    document.getElementById(
        "modal-publicacao-perfil"
    );

    if (modalPublicacaoPerfil) {
        modalPublicacaoPerfil.remove();
    }

    const modalAnterior = document.getElementById(
        "modal-comentarios-publicacao"
    );

    if (modalAnterior) {
        modalAnterior.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-comentarios-publicacao";
    modal.className = "feed-x-modal-reels";

    modal.innerHTML = `
        <div class="feed-x-reels-card" role="dialog" aria-modal="true" aria-label="Comentários da publicação">
            <div class="feed-x-reels-midia" id="feed-x-reels-midia">
                <div class="feed-x-reels-carregando">Carregando publicação...</div>
            </div>

            <section class="feed-x-reels-comentarios">
                <header class="feed-x-reels-header">
                    <strong>Comentários</strong>
                    <button type="button" class="feed-x-reels-fechar" aria-label="Fechar">×</button>
                </header>

                <div class="feed-x-reels-lista" id="feed-x-reels-lista">
                    <div class="feed-x-reels-carregando">Carregando comentários...</div>
                </div>

                <form class="feed-x-reels-form" id="feed-x-reels-form">
                    <img
                        class="feed-x-reels-avatar"
                        id="feed-x-reels-avatar-usuario"
                        src="${escaparHtml(window.AVATAR_USUARIO_PADRAO)}"
                        alt="Seu avatar"
                    >

                    <input
                        class="feed-x-reels-input"
                        id="feed-x-reels-input"
                        type="text"
                        maxlength="500"
                        autocomplete="off"
                        placeholder="Adicione um comentário..."
                    >

                    <button
                        class="feed-x-reels-enviar"
                        type="submit"
                    >
                        Publicar
                    </button>
                </form>
            </section>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add("feed-x-modal-aberto");

    const fechar = () => {
        modal.remove();
        document.body.classList.remove("feed-x-modal-aberto");
    };

    modal.querySelector(".feed-x-reels-fechar").onclick = fechar;

    modal.addEventListener("click", (evento) => {
        if (evento.target === modal) {
            fechar();
        }
    });

    const banco = window.ClubeDB.textoDB;

    const referenciaPublicacao = banco
        .collection("publicacoes")
        .doc(idPublicacao);

    const midiaEl = modal.querySelector(
        "#feed-x-reels-midia"
    );

    const listaEl = modal.querySelector(
        "#feed-x-reels-lista"
    );

    const inputEl = modal.querySelector(
        "#feed-x-reels-input"
    );

    const formEl = modal.querySelector(
        "#feed-x-reels-form"
    );

    const enviarEl = modal.querySelector(
        ".feed-x-reels-enviar"
    );

    const avatarUsuarioEl = modal.querySelector(
        "#feed-x-reels-avatar-usuario"
    );

    try {
        /*
         * =====================================================
         * FOTO ATUAL DO USUÁRIO LOGADO
         * =====================================================
         */
        try {
            const usuarioAtual =
                window.ClubeDB &&
                window.ClubeDB.loginDB
                    ? window.ClubeDB.loginDB.currentUser
                    : null;

            if (usuarioAtual) {
                const usernameLogado =
                    localStorage.getItem(
                        "usernameLogado"
                    );

                let usuarioSnap = null;

                if (usernameLogado) {
                    usuarioSnap = await banco
                        .collection("usuarios")
                        .where(
                            "username",
                            "==",
                            usernameLogado
                        )
                        .limit(1)
                        .get();
                }

                let fotoUsuario =
                    "";

                if (
                    usuarioSnap &&
                    !usuarioSnap.empty
                ) {
                    const dadosUsuario =
                        usuarioSnap.docs[0].data() || {};

                    fotoUsuario =
                        normalizarUrlPublicacao(
                            dadosUsuario.fotoUrl
                        );
                }

                const avatarFinal =
                    fotoUsuario ||
                    window.AVATAR_USUARIO_PADRAO;

                avatarUsuarioEl.src =
                    avatarFinal;

                avatarUsuarioEl.onerror =
                    function () {
                        this.onerror = null;
                        this.src =
                            window.AVATAR_USUARIO_PADRAO;
                    };
            }
        } catch (erroAvatarUsuario) {
            console.error(
                "Erro ao carregar avatar do usuário nos comentários:",
                erroAvatarUsuario
            );

            avatarUsuarioEl.src =
                window.AVATAR_USUARIO_PADRAO;
        }

        /*
         * =====================================================
         * PUBLICAÇÃO
         * =====================================================
         */
        const documento =
            await referenciaPublicacao.get();

        if (!documento.exists) {
            throw new Error(
                "Esta publicação não existe mais."
            );
        }

        const dados =
            documento.data() || {};

        const autor =
            escaparHtml(
                dados.autorNome ||
                dados.autorUsername ||
                "Membro"
            );

        const texto =
            escaparHtml(
                dados.texto || ""
            );

        let blocoMidia = "";

        if (dados.telegramFileId) {
            const urlMidia =
                escaparHtml(
                    criarUrlMidiaTelegram(
                        dados.telegramFileId
                    )
                );

            if (
                dados.tipoMidia ===
                "video"
            ) {
                blocoMidia = `
                    <video
                        class="feed-x-reels-video"
                        src="${urlMidia}"
                        controls
                        playsinline
                        preload="metadata"
                    ></video>
                `;
            } else {
                blocoMidia = `
                    <img
                        class="feed-x-reels-imagem"
                        src="${urlMidia}"
                        alt="Publicação de ${autor}"
                    >
                `;
            }
        } else {
            blocoMidia = `
                <div class="feed-x-reels-texto-sem-midia">
                    ${texto || "Publicação sem mídia"}
                </div>
            `;
        }

        midiaEl.innerHTML = `
            ${blocoMidia}
            <div class="feed-x-reels-legenda">
                <strong>${autor}</strong>
                ${dados.telegramFileId && texto ? `<span>${texto}</span>` : ""}
            </div>
        `;

        /*
         * =====================================================
         * COMENTÁRIOS
         * =====================================================
         */
        const comentarios =
            await referenciaPublicacao
                .collection("comentarios")
                .orderBy("criadoEm", "asc")
                .get();

        if (comentarios.empty) {
            listaEl.innerHTML = `
                <div class="feed-x-reels-vazio">
                    <strong>Nenhum comentário ainda</strong>
                    <span>Seja o primeiro a comentar.</span>
                </div>
            `;
        } else {

            /*
             * =================================================
             * BUSCA DAS FOTOS ATUAIS DOS AUTORES
             * =================================================
             *
             * Não usamos mais somente
             * comentario.autorFotoUrl.
             *
             * Isso permite que comentários antigos
             * acompanhem a foto atual do usuário.
             */
            const usernamesComentarios = [
                ...new Set(
                    comentarios.docs
                        .map(docComentario => {
                            const comentario =
                                docComentario.data() || {};

                            return String(
                                comentario.autorUsername || ""
                            )
                                .trim()
                                .toLowerCase();
                        })
                        .filter(Boolean)
                )
            ];

            const avataresAtuais =
                new Map();

            const tamanhoBloco =
                10;

            for (
                let i = 0;
                i < usernamesComentarios.length;
                i += tamanhoBloco
            ) {
                const bloco =
                    usernamesComentarios.slice(
                        i,
                        i + tamanhoBloco
                    );

                if (!bloco.length) {
                    continue;
                }

                const usuariosSnapshot =
                    await banco
                        .collection("usuarios")
                        .where(
                            "username",
                            "in",
                            bloco
                        )
                        .get();

                usuariosSnapshot.forEach(
                    docUsuario => {
                        const dadosUsuario =
                            docUsuario.data() || {};

                        const username =
                            String(
                                dadosUsuario.username ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        if (!username) {
                            return;
                        }

                        const fotoAtual =
                            normalizarUrlPublicacao(
                                dadosUsuario.fotoUrl
                            ) ||
                            window.AVATAR_USUARIO_PADRAO;

                        avataresAtuais.set(
                            username,
                            fotoAtual
                        );
                    }
                );
            }

            listaEl.innerHTML =
                comentarios.docs
                    .map(docComentario => {

                        const comentario =
                            docComentario.data() || {};

                        const nome =
                            escaparHtml(
                                comentario.autorNome ||
                                comentario.autorUsername ||
                                "Membro"
                            );

                        const username =
                            escaparHtml(
                                comentario.autorUsername ||
                                "usuario"
                            );

                        const usernameNormalizado =
                            String(
                                comentario.autorUsername ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        const textoComentario =
                            escaparHtml(
                                comentario.texto ||
                                ""
                            );

                        /*
                         * Prioridade:
                         *
                         * 1. Foto atual do usuário.
                         * 2. Foto salva no comentário.
                         * 3. Avatar padrão.
                         */
                        const avatar =
                            avataresAtuais.get(
                                usernameNormalizado
                            ) ||
                            normalizarUrlPublicacao(
                                comentario.autorFotoUrl
                            ) ||
                            window.AVATAR_USUARIO_PADRAO;

                        return `
                            <article class="feed-x-reels-comentario">

                                <img
                                    class="feed-x-reels-avatar"
                                    src="${escaparHtml(avatar)}"
                                    alt="Foto de ${nome}"
                                    onerror="this.onerror=null;this.src='${escaparHtml(window.AVATAR_USUARIO_PADRAO)}';"
                                >

                                <div class="feed-x-reels-comentario-corpo">

                                    <div class="feed-x-reels-comentario-nome">
                                        <strong>${nome}</strong>
                                        <span>@${username}</span>
                                    </div>

<div
    class="feed-x-reels-comentario-texto"
    style="
        display: block !important;
        width: 100% !important;
        margin: 2px 0 0 0 !important;
        padding: 0 !important;
        text-align: left !important;
        align-self: flex-start !important;
        justify-self: flex-start !important;
    "
>${textoComentario}</div>

                                </div>

                            </article>
                        `;
                    })
                    .join("");
        }

        setTimeout(() => {
            inputEl.focus({
                preventScroll: true
            });
        }, 100);

    } catch (erro) {

        console.error(
            "Erro ao carregar comentários:",
            erro
        );

        midiaEl.innerHTML = "";

        listaEl.innerHTML = `
            <div class="feed-x-reels-erro">
                Não foi possível carregar esta publicação.
            </div>
        `;
    }

    /*
     * =====================================================
     * PUBLICAR COMENTÁRIO
     * =====================================================
     */
        formEl.addEventListener(
        "submit",
        async (evento) => {

            evento.preventDefault();

            const textoComentario =
                inputEl.value.trim();

            if (
                !textoComentario ||
                enviarEl.disabled
            ) {
                return;
            }

            const usuario =
                window.ClubeDB &&
                window.ClubeDB.loginDB
                    ? window.ClubeDB.loginDB.currentUser
                    : null;

            if (!usuario) {
                alert(
                    "Sua sessão expirou. Faça login novamente."
                );
                return;
            }

            enviarEl.disabled = true;
            enviarEl.textContent =
                "Enviando...";

            try {

                const autorComentario =
                    await obterDadosAutorPublicacao();

                /*
                 * Sempre salva a foto atual do usuário.
                 */
                const avatarComentario =
                    normalizarUrlPublicacao(
                        avatarUsuarioEl &&
                        avatarUsuarioEl.src
                    ) ||
                    normalizarUrlPublicacao(
                        autorComentario.fotoUrl
                    ) ||
                    window.AVATAR_USUARIO_PADRAO;

                await referenciaPublicacao
                    .collection("comentarios")
                    .add({
                        uid: usuario.uid,
                        autorId:
                            autorComentario.uid,
                        autorNome:
                            autorComentario.nome,
                        autorUsername:
                            autorComentario.username,
                        autorFotoUrl:
                            avatarComentario,
                        texto:
                            textoComentario,
                        criadoEm:
                            firebase.firestore.FieldValue
                                .serverTimestamp()
                    });

                await referenciaPublicacao.update({
                    comentarios:
                        firebase.firestore.FieldValue.increment(
                            1
                        )
                });

                const card =
                    document.querySelector(
                        `.feed-x-post[data-publicacao-id="${idPublicacao}"]`
                    );

                const contador =
                    card
                        ? card.querySelector(
                            '[data-acao="comentarios"] .feed-x-contador'
                        )
                        : null;

                if (contador) {
                    contador.textContent =
                        String(
                            Number(
                                contador.textContent ||
                                0
                            ) + 1
                        );
                }

                /*
                 * =====================================================
                 * ADICIONA O NOVO COMENTÁRIO DIRETAMENTE NA LISTA
                 * =====================================================
                 */

                const estadoVazio =
                    listaEl.querySelector(
                        ".feed-x-reels-vazio"
                    );

                if (estadoVazio) {
                    estadoVazio.remove();
                }

                const novoComentario =
                    document.createElement("article");

                novoComentario.className =
                    "feed-x-reels-comentario";

                const nomeComentario =
                    escaparHtml(
                        autorComentario.nome ||
                        autorComentario.username ||
                        "Membro"
                    );

                const usernameComentario =
                    escaparHtml(
                        autorComentario.username ||
                        "usuario"
                    );

                const textoComentarioHtml =
                    escaparHtml(
                        textoComentario
                    );

                novoComentario.innerHTML = `
                    <img
                        class="feed-x-reels-avatar"
                        src="${escaparHtml(avatarComentario)}"
                        alt="Foto de ${nomeComentario}"
                    >

                    <div class="feed-x-reels-comentario-corpo">

                        <div class="feed-x-reels-comentario-nome">
                            <strong>${nomeComentario}</strong>
                            <span>@${usernameComentario}</span>
                        </div>

                        <div
                            class="feed-x-reels-comentario-texto"
                            style="
                                display: block !important;
                                width: 100% !important;
                                margin: 2px 0 0 0 !important;
                                padding: 0 !important;
                                text-align: left !important;
                                align-self: flex-start !important;
                                justify-self: flex-start !important;
                            "
                        >${textoComentarioHtml}</div>

                    </div>
                `;

                listaEl.appendChild(
                    novoComentario
                );

                /*
                 * Mantém a lista posicionada no comentário recém-publicado.
                 */
                listaEl.scrollTop =
                    listaEl.scrollHeight;

                /*
                 * Limpa o campo e mantém o modal aberto.
                 */
                inputEl.value = "";

                enviarEl.disabled =
                    false;

                enviarEl.textContent =
                    "Publicar";

                inputEl.focus({
                    preventScroll: true
                });

            } catch (erro) {

                console.error(
                    "Erro ao publicar comentário:",
                    erro
                );

                alert(
                    erro.message ||
                    "Não foi possível publicar o comentário."
                );

                enviarEl.disabled =
                    false;

                enviarEl.textContent =
                    "Publicar";
            }
        }
    );
}