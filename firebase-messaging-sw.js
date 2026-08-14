let estadoChatAtivo = {
    chatId: "",
    visivel: false
};

self.addEventListener("message", event => {
    const dados = event && event.data;

    if (!dados || dados.type !== "CHAT_STATE") {
        return;
    }

    estadoChatAtivo = {
        chatId: String(dados.chatId || ""),
        visivel: dados.visivel === true
    };
});

self.addEventListener("push", event => {
    event.waitUntil((async () => {
        if (!event.data) {
            return;
        }

        let payload = {};

        try {
            payload = event.data.json();
        } catch (erroJSON) {
            payload = {
                body: event.data.text()
            };
        }

        const dados = payload.data || payload || {};
        const notificacao = payload.notification || {};
        const chatId = String(dados.chatId || "");
        const messageId = String(dados.messageId || "");
        const remetente = String(dados.remetente || "");

        if (estadoChatAtivo.visivel) {
            return;
        }

        const clientes = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

        const existeJanelaVisivel = clientes.some(cliente => {
            return cliente.visibilityState === "visible";
        });

        if (existeJanelaVisivel) {
            return;
        }

        const titulo =
            notificacao.title ||
            dados.title ||
            "Nova mensagem";

        const corpo =
            notificacao.body ||
            dados.body ||
            "Você recebeu uma nova mensagem.";

        const tag = messageId
            ? `mensagem-${messageId}`
            : `mensagem-${chatId || Date.now()}`;

        await self.registration.showNotification(
            titulo,
            {
                body: corpo,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                tag,
                renotify: true,
                data: {
                    url: dados.url || "/index.html",
                    chatId,
                    remetente,
                    messageId
                }
            }
        );
    })());
});

self.addEventListener("notificationclick", event => {
    event.notification.close();

    const dados = event.notification.data || {};
    const chatId = String(dados.chatId || "");
    const remetente = String(dados.remetente || "");

    const origem = new URL(
        dados.url || "/index.html",
        self.location.origin
    );

    if (remetente) {
        origem.searchParams.set(
            "openChatUser",
            remetente
        );
    }

    if (chatId) {
        origem.searchParams.set(
            "openChatId",
            chatId
        );
    }

    const destino =
        origem.pathname +
        origem.search +
        origem.hash;

    event.waitUntil(
        self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(async lista => {
            for (const cliente of lista) {
                if (
                    "postMessage" in cliente &&
                    "focus" in cliente
                ) {
                    cliente.postMessage({
                        type: "OPEN_CHAT_NOTIFICATION",
                        chatId,
                        remetente
                    });
                    return cliente.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(destino);
            }

            return undefined;
        })
    );
});