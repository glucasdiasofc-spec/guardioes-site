/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

const VERSAO_ATUAL = "v0.196.0 - versão alpha";

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

    /*
     * =====================================================
     * AUTENTICAÇÃO ÚNICA PELO FIREBASE AUTH
     * =====================================================
     *
     * Agora tanto o administrador quanto os membros
     * possuem uma sessão Firebase Authentication.
     *
     * Isso é importante porque o Cloudflare Worker
     * precisa validar o Firebase ID Token antes de
     * aceitar uma publicação.
     */

    try {
        /*
         * Administrador:
         *
         * O campo de login continua sendo:
         *
         * admin
         *
         * Mas a autenticação real acontece por:
         *
         * admin@guardioesdbv.com
         */
        const ehAdministrador =
            usuarioInput.toLowerCase() === "admin";

        const emailFirebase =
            ehAdministrador
                ? "admin@guardioesdbv.com"
                : `${usuarioInput.toLowerCase()}@guardioesdbv.com`;

        /*
         * Faz login real no Firebase Authentication.
         */
        await window.ClubeDB.loginDB
            .signInWithEmailAndPassword(
                emailFirebase,
                senhaInput
            );

        /*
         * Salva a sessão local utilizada
         * pelo restante do seu site.
         */
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
            ehAdministrador
                ? "admin"
                : usuarioInput.toLowerCase()
        );

        /*
         * Limpa os campos de login.
         */
        document.getElementById(
            "login-username"
        ).value = "";

        document.getElementById(
            "login-senha"
        ).value = "";

        /*
         * =====================================================
         * FLUXO DO ADMINISTRADOR
         * =====================================================
         */
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

        /*
         * =====================================================
         * FLUXO DOS MEMBROS
         * =====================================================
         *
         * O membro continua indo diretamente para o site.
         */
        document.getElementById(
            "tela-login"
        ).style.display = "none";

        irParaSite();

    } catch (erro) {

        console.error(
            "Erro de login:",
            erro
        );

        /*
         * Trata especificamente alguns erros comuns
         * para facilitar a identificação do problema.
         */
        if (
            erro &&
            erro.code ===
                "auth/user-not-found"
        ) {
            if (erroDisplay) {
                erroDisplay.textContent =
                    "Usuário não encontrado.";
            }

        } else if (
            erro &&
            erro.code ===
                "auth/wrong-password"
        ) {
            if (erroDisplay) {
                erroDisplay.textContent =
                    "Senha incorreta.";
            }

        } else if (
            erro &&
            erro.code ===
                "auth/invalid-credential"
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

    const estado = {
        total: 0,
        porChat: {},
        porContato: {},
        contatosPorChat: {},
        anteriores: {},
        inicializado: false
    };

    window._estadoContadoresMensagens = estado;
    window._listenerGlobalMensagensAtivo = true;
    window._listenerGlobalMensagensUsuario = usernameLogado;

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

                if (!badgeContato) return;

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
            snapshot.forEach(doc => {
                const dados = doc.data() || {};
                const usuarios = Array.isArray(dados.usuarios)
                    ? dados.usuarios
                    : [];
                const outro = usuarios.find(usuario => {
                    return String(usuario).trim().toLowerCase() !==
                        usernameLogado;
                });

                if (outro) {
                    estado.contatosPorChat[doc.id] = outro;
                }
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
        }, erro => {
            console.error("Erro ao observar contatos do chat:", erro);
        });

    const unsubscribeMensagens = window.ClubeDB.textoDB
        .collectionGroup("mensagens")
        .onSnapshot(snapshot => {
            const novasContagens = {};

            snapshot.forEach(doc => {
                const mensagem = doc.data() || {};
                const destinatario = String(
                    mensagem.destinatario || ""
                ).trim().toLowerCase();

                if (
                    destinatario !== usernameLogado ||
                    mensagem.lido === true
                ) {
                    return;
                }

                const chatRef = doc.ref.parent.parent;
                if (!chatRef) return;

                novasContagens[chatRef.id] =
                    (novasContagens[chatRef.id] || 0) + 1;
            });

            if (estado.inicializado) {
                Object.keys(novasContagens).forEach(chatId => {
                    const anterior = Number(
                        estado.anteriores[chatId] || 0
                    );
                    const atual = Number(novasContagens[chatId] || 0);

                    if (atual > anterior) {
                        mostrarNotificacaoNovaMensagem(
                            atual - anterior,
                            estado.contatosPorChat[chatId] || "",
                            chatId
                        );
                    }
                });
            }

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

    if (carregando) {
        carregando.style.display = "block";
    }
    if (vazio) {
        vazio.style.display = "none";
    }
    if (container) {
        container.style.display = "none";
    }

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

        if (divGrupos) {
            divGrupos.innerHTML = gruposChat
                .map(grupo => {
                    return criarCardGrupoChat(
                        grupo.id,
                        grupo.nome,
                        grupo.membros
                    );
                })
                .join("");
        }

        if (tituloGrupos) {
            tituloGrupos.style.display = gruposChat.length
                ? "block"
                : "none";
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
                        contato.fotoUrl
                    );
                })
                .join("");
            titulo.style.display = lista.length
                ? "block"
                : "none";

            return lista.length;
        };

        const total =
            gruposChat.length +
            renderizarGrupo(
                divSuporte,
                document.getElementById(
                    "titulo-msg-suporte"
                ),
                gruposIndividuais.suporte
            ) +
            renderizarGrupo(
                divLideranca,
                document.getElementById(
                    "titulo-msg-lideranca"
                ),
                gruposIndividuais.lideranca
            ) +
            renderizarGrupo(
                divUnidade,
                document.getElementById(
                    "titulo-msg-unidade"
                ),
                gruposIndividuais.unidade
            ) +
            renderizarGrupo(
                divOutras,
                document.getElementById(
                    "titulo-msg-outras"
                ),
                gruposIndividuais.outras
            );

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

async function criarGrupoChat() {
    const nomeEl = document.getElementById(
        "input-nome-grupo-chat"
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

    const participantes = Array.from(
        _participantesGrupoChatSelecionados
    ).filter(Boolean);

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
            usuarios: participantes,
            criadoPor: usernameLogado,
            criadoEm:
                firebase.firestore.FieldValue.serverTimestamp(),
            ultimoEnvio:
                firebase.firestore.FieldValue.serverTimestamp(),
            naoLidasPor
        });

        fecharModalCriarGrupoChat();
        window.alert("Grupo criado com sucesso.");
    } catch (erro) {
        console.error(
            "Erro ao criar grupo de chat:",
            erro
        );
        window.alert(
            "Não foi possível criar o grupo. Verifique sua conexão e tente novamente."
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
    quantidadeParticipantes
) {
    const id = String(chatId || "");
    const nome = String(
        nomeGrupo || "Grupo sem nome"
    );
    const quantidade = Number(
        quantidadeParticipantes || 0
    );

    return `
        <div
            data-group-chat-id="${id}"
            onclick="abrirSalaGrupoChat('${id}', '${nome.replace(/'/g, "\\'")}')"
            style="display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; transition: background-color 0.2s ease;"
        >
            <div style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; flex-shrink: 0; border-radius: 50%; background: #26384a; color: #58b7ff; font-size: 23px;">👥</div>
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

function criarCardContatoChat(username, nome, cargo, fotoUrl) {



    let img = fotoUrl || window.AVATAR_USUARIO_PADRAO;
    if (fotoUrl && fotoUrl !== window.AVATAR_USUARIO_PADRAO) {
        img += (img.includes("?") ? "&" : "?") + "v=" + Date.now();
    }
    return `
        <div data-chat-username="${username}" onclick="abrirSalaChat('${username}', '${nome}', '${cargo}', '${img}' )" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; transition: background-color 0.2s ease;">
            <img src="${img}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 1px solid #262626;">
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


function abrirSalaChat(usernameAlvo, nomeAlvo, cargoAlvo, fotoAlvo) {
    const usernameAlvoNormalizado = String(
        usernameAlvo || ""
    ).trim().toLowerCase();

    usuarioChatDestino = usernameAlvoNormalizado;

    const telaLista = document.getElementById("tela-lista-mensagens");
    const telaChat = document.getElementById("tela-sala-chat");
    const container = document.getElementById("chat-mensagens-container");
    const inputMsg = document.getElementById("input-nova-mensagem");
    const cabecalhoChat = document.getElementById("cabecalho-sala-chat");

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
            if (!container) return;

            container.innerHTML = "";

            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMinha = msg.remetente === meuUsername;
                const div = document.createElement("div");

                div.style.display = "flex";
                div.style.width = "100%";
                div.style.marginBottom = "8px";
                div.style.justifyContent = isMinha
                    ? "flex-end"
                    : "flex-start";

                const balao = document.createElement("div");
                balao.style.display = "flex";
                balao.style.flexDirection = "column";
                balao.style.gap = "4px";
                balao.style.textAlign = "left";

                const textoMensagem = document.createElement("div");
                textoMensagem.textContent = msg.texto || "";
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

                div.appendChild(balao);
                container.appendChild(div);
            });

            container.scrollTop = container.scrollHeight;
            marcarMensagensComoLidas(chatId, meuUsername);
            atualizarIndicadorAbaMensagens();
        });
}


let _salaGrupoAtiva = null;

async function abrirSalaGrupoChat(chatId, nomeGrupo) {
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
            participantes
        };

        abrirSalaChat(
            `__grupo__${id}`,
            _salaGrupoAtiva.nomeGrupo,
            `${participantes.length} participantes`,
            window.AVATAR_USUARIO_PADRAO
        );

        if (unsubscribeChatAtivo) {
            unsubscribeChatAtivo();
            unsubscribeChatAtivo = null;
        }

        const container = document.getElementById(
            "chat-mensagens-container"
        );
        const chatIdAtivo = id;
        window._chatIdAtivo = chatIdAtivo;
        sincronizarEstadoChatComServiceWorker();

        const renderizarMensagens = snapshot => {
            if (!container) {
                return;
            }

            container.innerHTML = "";

            snapshot.forEach(documento => {
                const mensagem = documento.data() || {};
                const minha = String(
                    mensagem.remetente || ""
                ).trim().toLowerCase() ===
                    usernameLogado;
                const linha = document.createElement("div");
                const balao = document.createElement("div");
                const texto = document.createElement("div");
                const horario = document.createElement("span");

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
        const snapshotUsuario = await banco
            .collection("usuarios")
            .where("username", "==", username)
            .limit(1)
            .get();

        if (snapshotUsuario.empty) {
            return;
        }

        const dados = snapshotUsuario.docs[0].data() || {};
        const usuarioFirebase = window.ClubeDB.loginDB
            ? window.ClubeDB.loginDB.currentUser
            : null;

        if (nomeEl) nomeEl.textContent = dados.nomeReal || dados.username || username;
        if (cargoEl) cargoEl.textContent = dados.cargo || "Membro";
        if (unidadeEl) unidadeEl.textContent = dados.unidade || "Sem Unidade";

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
        publicar: "Pode publicar no feed",
        gerenciar_membros: "Pode gerenciar membros",
        gerenciar_conquistas: "Pode gerenciar conquistas",
        gerenciar_unidades: "Pode gerenciar unidades",
        acesso_total: "Acesso administrativo total"
    };

    return nomes[funcao] || "Função personalizada";
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

    const cargo = cargosAdminCache.find(item => item.id === select.value);
    preview.textContent = cargo ? nomeFuncaoCargo(cargo.funcao) : "Nenhuma função adicional associada.";
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

    if (!campo) return;

    campo.style.display = tipo === "Liderança" ? "none" : "block";
    if (tipo === "Liderança") campo.value = "";
}

async function salvarEdicaoMembroAdmin() {
    const id = document.getElementById("edit-membro-id").value;
    const cargoId = document.getElementById("edit-membro-cargo").value;
    const cargoSelecionado = cargosAdminCache.find(cargo => cargo.id === cargoId);
    const fotoInput = document.getElementById("edit-membro-foto");
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;
    const senhaDigitada = document.getElementById("edit-membro-senha").value.trim();

    const dadosBasicos = {
        nomeReal: document.getElementById("edit-membro-nome-real").value.trim(),
        username: document.getElementById("edit-membro-username").value.trim().toLowerCase(),
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

        // Se o administrador digitou uma nova senha, ela substitui a antiga.
        // Se deixou vazio, a senha existente é mantida.
        const senhaFinal = senhaDigitada || senhaAtual;

        if (!senhaFinal) {
            alert("Este usuário não possui uma senha cadastrada. Informe uma senha para continuar.");
            return;
        }

        const dadosAtualizados = {
            ...dadosBasicos,
            senha: senhaFinal
        };

        if (arquivoFoto && window.ClubeDB.acoesAdmin && window.ClubeDB.acoesAdmin.cadastrarMembro) {
            const dadosComFoto = {
                ...dadosAtualizados,
                fotoUrl: dadosAtuais.fotoUrl || ""
            };

            await referencia.update(dadosComFoto);
            await window.ClubeDB.acoesAdmin.cadastrarMembro(
                dadosAtualizados,
                arquivoFoto
            );
        } else {
            await referencia.update(dadosAtualizados);
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