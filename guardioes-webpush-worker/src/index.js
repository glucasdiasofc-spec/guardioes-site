import webpush from "web-push";

const LIMITE_IMAGEM = 10 * 1024 * 1024;
const LIMITE_VIDEO = 20 * 1024 * 1024;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: cabecalhosCORS()
            });
        }

        try {
            if (
                request.method === "GET" &&
                url.pathname === "/health"
            ) {
                return responderJSON({
                    ok: true,
                    servico: "guardioes-publicacoes"
                });
            }

            if (
                request.method === "POST" &&
                url.pathname === "/push/subscribe"
            ) {
                const usuario = await autorizarUpload(request, env);
                return await registrarAssinaturaPush(request, env, usuario);
            }

            if (
                request.method === "POST" &&
                url.pathname === "/push/unsubscribe"
            ) {
                const usuario = await autorizarUpload(request, env);
                return await removerAssinaturaPush(request, env, usuario);
            }

            if (
                request.method === "POST" &&
                url.pathname === "/push/presence"
            ) {
                const usuario = await autorizarUpload(request, env);
                return await atualizarPresencaPush(request, env, usuario);
            }

            if (
                request.method === "POST" &&
                url.pathname === "/push/send"
            ) {
                const usuario = await autorizarUpload(request, env);
                return await enviarPushProprio(request, env, usuario);
            }

            if (
                request.method === "POST" &&
                url.pathname === "/push/admin-send"
            ) {
                const usuario = await autorizarUpload(request, env);
                return await enviarNotificacaoGeral(
                    request,
                    env,
                    usuario
                );
            }

            if (
                request.method === "POST" &&
                url.pathname === "/upload"
            ) {
                const usuario =
                    await autorizarUpload(
                        request,
                        env
                    );

                return await enviarMidiaTelegram(
                    request,
                    env,
                    usuario
                );
            }

            if (
                request.method === "GET" &&
                url.pathname === "/media"
            ) {
                return await entregarMidiaTelegram(
                    request,
                    env,
                    ctx
                );
            }

            return responderJSON(
                {
                    ok: false,
                    erro: "Rota não encontrada."
                },
                404
            );

        } catch (erro) {
            console.error(
                "Erro no Worker:",
                erro
            );

            return responderJSON(
                {
                    ok: false,
                    erro:
                        erro.status === 500 ||
                        !erro.status
                            ? "Erro interno no servidor de publicações."
                            : erro.message
                },
                erro.status || 500
            );
        }
    }
};


function cabecalhosCORS() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
            "Authorization, Content-Type, X-Admin-Key",
        "Access-Control-Max-Age":
            "86400"
    };
}


function responderJSON(
    dados,
    status = 200
) {
    return new Response(
        JSON.stringify(dados),
        {
            status: status,
            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8",

                "Cache-Control":
                    "no-store",

                ...cabecalhosCORS()
            }
        }
    );
}


function criarErro(
    status,
    mensagem
) {
    const erro =
        new Error(mensagem);

    erro.status =
        status;

    return erro;
}


async function autorizarUpload(
    request,
    env
) {
    /*
     * O admin atual do seu site não entra pelo Firebase Auth.
     * Por isso, ele poderá usar uma chave administrativa
     * protegida no Worker.
     */
    const chaveAdmin =
        request.headers.get(
            "X-Admin-Key"
        );

    if (
        env.ADMIN_UPLOAD_KEY &&
        chaveAdmin ===
            env.ADMIN_UPLOAD_KEY
    ) {
        return {
            uid: "admin",
            username: "admin",
            modo: "admin"
        };
    }

    /*
     * Os membros comuns já entram pelo Firebase Auth.
     */
    const authorization =
        request.headers.get(
            "Authorization"
        ) || "";

    if (
        !authorization.startsWith(
            "Bearer "
        )
    ) {
        throw criarErro(
            401,
            "Usuário não autenticado."
        );
    }

    if (
        !env.FIREBASE_WEB_API_KEY
    ) {
        throw criarErro(
            500,
            "FIREBASE_WEB_API_KEY não foi configurada."
        );
    }

    const idToken =
        authorization
            .slice(7)
            .trim();

    const respostaFirebase =
        await fetch(
            "https://identitytoolkit.googleapis.com/v1/accounts:lookup" +
            `?key=${encodeURIComponent(
                env.FIREBASE_WEB_API_KEY
            )}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    idToken: idToken
                })
            }
        );

    const dadosFirebase =
        await respostaFirebase.json();

    const usuario =
        dadosFirebase.users &&
        dadosFirebase.users[0];

    if (
        !respostaFirebase.ok ||
        !usuario ||
        !usuario.localId ||
        usuario.disabled
    ) {
        throw criarErro(
            401,
            "Sessão Firebase inválida ou expirada."
        );
    }

    const email = String(
        usuario.email || ""
    ).trim().toLowerCase();
    const username = email.endsWith("@guardioesdbv.com")
        ? email.slice(0, -"@guardioesdbv.com".length)
        : "";

    return {
        uid: usuario.localId,
        username: normalizarUsername(username),
        modo: "firebase"
    };
}


async function enviarMidiaTelegram(
    request,
    env,
    usuario
 ) {
    const tokenTelegram = String(
        env.TELEGRAM_BOT_TOKEN || ""
    )
        .trim()
        .replace(/^bot/i, "");

    const chatIdTelegram = String(
        env.TELEGRAM_CHAT_ID || ""
    ).trim();

    if (!tokenTelegram || !chatIdTelegram) {
        throw criarErro(
            500,
            "Segredos do Telegram não configurados."
        );
    }

    if (!/^\d+:[A-Za-z0-9_-]+$/.test(tokenTelegram)) {
        throw criarErro(
            500,
            "TELEGRAM_BOT_TOKEN inválido. No segredo, informe somente o token bruto do BotFather, sem 'bot', aspas ou URL."
        );
    }

    const formulario = await request.formData();

    const arquivo = formulario.get("arquivo");

    const texto = String(
        formulario.get("texto") || ""
    ).trim();

    const username = String(
        formulario.get("autorUsername") || "usuario"
    ).trim();

    if (!(arquivo instanceof File)) {
        throw criarErro(
            400,
            "Nenhuma mídia foi enviada."
        );
    }

    const ehImagem = arquivo.type.startsWith("image/");

    const ehVideo =
        arquivo.type === "video/mp4" ||
        /\.mp4$/i.test(arquivo.name || "");

    if (!ehImagem && !ehVideo) {
        throw criarErro(
            415,
            "Envie uma imagem ou um vídeo MP4."
        );
    }

    if (
        ehImagem &&
        arquivo.size > 10 * 1024 * 1024
    ) {
        throw criarErro(
            413,
            "A imagem deve ter no máximo 10 MB."
        );
    }

    if (
        ehVideo &&
        arquivo.size > 20 * 1024 * 1024
    ) {
        throw criarErro(
            413,
            "O vídeo deve ter no máximo 20 MB."
        );
    }

    const metodo = ehImagem
        ? "sendPhoto"
        : "sendVideo";

    const campoArquivo = ehImagem
        ? "photo"
        : "video";

    const formTelegram = new FormData();

    formTelegram.append(
        "chat_id",
        chatIdTelegram
    );

    formTelegram.append(
        campoArquivo,
        arquivo,
        arquivo.name || (ehImagem ? "imagem" : "video.mp4")
    );

    formTelegram.append(
        "disable_notification",
        "true"
    );

    if (ehVideo) {
        formTelegram.append(
            "supports_streaming",
            "true"
        );
    }

    const autorLegenda = `@${username.replace(/^@/, "")}`;

    const legenda = [
        autorLegenda,
        texto
    ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 1024);

    if (legenda) {
        formTelegram.append(
            "caption",
            legenda
        );
    }

    const urlTelegram =
        `https://api.telegram.org/bot${tokenTelegram}/${metodo}`;

    const respostaTelegram = await fetch(
        urlTelegram,
        {
            method: "POST",
            body: formTelegram
        }
     );

    const textoTelegram =
        await respostaTelegram.text();

    let resultado;

    try {
        resultado = textoTelegram
            ? JSON.parse(textoTelegram)
            : {};
    } catch (erroJSON) {
        resultado = {
            ok: false,
            description:
                "Resposta inválida da API do Telegram."
        };
    }

    if (
        !respostaTelegram.ok ||
        !resultado.ok
    ) {
        console.error(
            "Telegram recusou a publicação:",
            {
                status: respostaTelegram.status,
                description: resultado.description,
                error_code: resultado.error_code
            }
        );

        if (
            respostaTelegram.status === 404 ||
            resultado.description === "Not Found"
        ) {
            throw criarErro(
                502,
                "Telegram retornou Not Found. Verifique se TELEGRAM_BOT_TOKEN contém somente o token bruto do BotFather e não começa com 'bot'."
            );
        }

        throw criarErro(
            502,
            resultado.description ||
            "O Telegram recusou a mídia."
        );
    }

    const mensagem = resultado.result;

    const midia = ehImagem
        ? mensagem.photo[mensagem.photo.length - 1]
        : mensagem.video;

    return responderJSON({
        ok: true,
        uid: usuario.uid,
        autenticacao: usuario.modo,
        midia: {
            tipo: ehImagem
                ? "imagem"
                : "video",
            telegramFileId: midia.file_id,
            telegramFileUniqueId:
                midia.file_unique_id || null,
            telegramMessageId:
                mensagem.message_id,
            mimeType: arquivo.type,
            nomeOriginal: arquivo.name,
            tamanhoBytes: arquivo.size,
            largura: midia.width || null,
            altura: midia.height || null,
            duracao: midia.duration || null
        }
    });
}


async function entregarMidiaTelegram(
    request,
    env,
    ctx
) {
    if (
        !env.TELEGRAM_BOT_TOKEN
    ) {
        throw criarErro(
            500,
            "Token do Telegram não configurado."
        );
    }

    const url =
        new URL(request.url);

    const fileId =
        url.searchParams.get(
            "file_id"
        );

    if (
        !fileId ||
        fileId.length > 500
    ) {
        throw criarErro(
            400,
            "file_id inválido."
        );
    }

    const cache =
        caches.default;

    const chaveCache =
        new Request(
            url.toString()
        );

    const respostaCache =
        await cache.match(
            chaveCache
        );

    if (respostaCache) {
        return respostaCache;
    }

    const respostaGetFile =
        await fetch(
            "https://api.telegram.org/bot" +
            env.TELEGRAM_BOT_TOKEN +
            "/getFile?file_id=" +
            encodeURIComponent(
                fileId
            )
        );

    const dadosGetFile =
        await respostaGetFile.json();

    if (
        !dadosGetFile.ok ||
        !dadosGetFile.result ||
        !dadosGetFile.result.file_path
    ) {
        throw criarErro(
            404,
            dadosGetFile.description ||
            "Mídia não encontrada."
        );
    }

    const respostaArquivo =
        await fetch(
            "https://api.telegram.org/file/bot" +
            env.TELEGRAM_BOT_TOKEN +
            "/" +
            dadosGetFile.result.file_path
        );

    if (
        !respostaArquivo.ok ||
        !respostaArquivo.body
    ) {
        throw criarErro(
            502,
            "Falha ao carregar a mídia do Telegram."
        );
    }

    const respostaFinal =
        new Response(
            respostaArquivo.body,
            {
                status: 200,

                headers: {
                    "Content-Type":
                        respostaArquivo.headers.get(
                            "Content-Type"
                        ) ||
                        "application/octet-stream",

                    "Cache-Control":
                        "public, max-age=86400, s-maxage=604800",

                    "Access-Control-Allow-Origin":
                        "*",

                    "X-Content-Type-Options":
                        "nosniff"
                }
            }
        );

    ctx.waitUntil(
        cache.put(
            chaveCache,
            respostaFinal.clone()
        )
    );

    return respostaFinal;
}


async function lerAssinaturasPush(env, username) {
    if (!env.PUSH_KV) {
        throw criarErro(500, "Binding PUSH_KV não configurado.");
    }

    const chave = `push:user:${normalizarUsername(username)}`;
    return await env.PUSH_KV.get(chave, "json") || [];
}

async function registrarAssinaturaPush(request, env, usuario) {
    if (!env.PUSH_KV) {
        throw criarErro(
            500,
            "Binding PUSH_KV não configurado."
        );
    }

    const dados = await request.json();
    const username = normalizarUsername(
        dados.username || ""
    );
    const subscription = dados.subscription;
    const endpoint = String(
        subscription && subscription.endpoint || ""
    ).trim();

    if (
        !username ||
        !subscription ||
        !endpoint ||
        !subscription.keys ||
        !subscription.keys.p256dh ||
        !subscription.keys.auth
    ) {
        throw criarErro(
            400,
            "Assinatura Web Push inválida ou incompleta."
        );
    }

    if (
        usuario.modo === "firebase" &&
        usuario.username &&
        username !== usuario.username
    ) {
        throw criarErro(
            403,
            "A assinatura deve ser registrada para o usuário autenticado."
        );
    }

    // Um mesmo navegador deve ficar vinculado somente à conta atualmente autenticada.
    await removerEndpointDeOutrasContas(
        env,
        username,
        endpoint
    );

    const assinaturas = await lerAssinaturasPush(
        env,
        username
    );
    const semMesmoEndpoint = assinaturas.filter(
        item => item && item.endpoint !== endpoint
    );

    semMesmoEndpoint.push({
        endpoint,
        expirationTime:
            subscription.expirationTime || null,
        keys: {
            p256dh: String(
                subscription.keys.p256dh || ""
            ),
            auth: String(
                subscription.keys.auth || ""
            )
        },
        uid: usuario.uid,
        atualizadoEm: new Date().toISOString()
    });

    if (semMesmoEndpoint.length > 20) {
        semMesmoEndpoint.splice(
            0,
            semMesmoEndpoint.length - 20
        );
    }

    await env.PUSH_KV.put(
        `push:user:${username}`,
        JSON.stringify(semMesmoEndpoint)
    );

    return responderJSON({
        ok: true,
        dispositivos: semMesmoEndpoint.length,
        endpointVinculado: endpoint
    });
}

async function removerEndpointDaConta(
    env,
    username,
    endpoint
) {
    const usuarioNormalizado = normalizarUsername(
        username
    );
    const endpointNormalizado = String(
        endpoint || ""
    ).trim();

    if (!usuarioNormalizado || !endpointNormalizado) {
        return 0;
    }

    const assinaturas = await lerAssinaturasPush(
        env,
        usuarioNormalizado
    );
    const restantes = assinaturas.filter(
        item => item && item.endpoint !== endpointNormalizado
    );
    const removidos = assinaturas.length - restantes.length;

    if (removidos > 0) {
        await env.PUSH_KV.put(
            `push:user:${usuarioNormalizado}`,
            JSON.stringify(restantes)
        );
    }

    return removidos;
}

async function removerTodasAssinaturasDaConta(
    env,
    username
) {
    const usuarioNormalizado = normalizarUsername(
        username
    );

    if (!usuarioNormalizado) {
        return 0;
    }

    const assinaturas = await lerAssinaturasPush(
        env,
        usuarioNormalizado
    );

    if (!assinaturas.length) {
        return 0;
    }

    await env.PUSH_KV.delete(
        `push:user:${usuarioNormalizado}`
    );

    return assinaturas.length;
}


async function removerEndpointDeOutrasContas(
    env,
    usernameAtual,
    endpoint
) {
    const atualNormalizado = normalizarUsername(
        usernameAtual
    );
    const endpointNormalizado = String(
        endpoint || ""
    ).trim();
    const prefixo = "push:user:";
    let cursor = undefined;

    do {
        const opcoes = { prefix: prefixo };

        if (cursor) {
            opcoes.cursor = cursor;
        }

        const pagina = await env.PUSH_KV.list(opcoes);
        const tarefas = pagina.keys
            .filter(chave => {
                const usernameConta = chave.name
                    .slice(prefixo.length);
                return usernameConta !== atualNormalizado;
            })
            .map(chave => {
                const usernameConta = chave.name
                    .slice(prefixo.length);
                return removerEndpointDaConta(
                    env,
                    usernameConta,
                    endpointNormalizado
                );
            });

        await Promise.all(tarefas);

        if (pagina.list_complete) {
            break;
        }

        cursor = pagina.cursor;
    } while (cursor);
}

async function removerAssinaturaPush(
    request,
    env,
    usuario
) {
    if (!env.PUSH_KV) {
        throw criarErro(
            500,
            "Binding PUSH_KV não configurado."
        );
    }

    const dados = await request.json();
    const username = normalizarUsername(
        dados.username || ""
    );
    const endpoint = String(
        dados.endpoint || ""
    ).trim();

    if (!username || !endpoint) {
        throw criarErro(
            400,
            "Usuário e endpoint são obrigatórios."
        );
    }

    if (
        usuario.modo === "firebase" &&
        usuario.username !== username
    ) {
        throw criarErro(
            403,
            "A assinatura deve ser removida da conta autenticada."
        );
    }

    const removidos = await removerEndpointDaConta(
        env,
        username,
        endpoint
    );

    return responderJSON({
        ok: true,
        removidos
    });
}

async function atualizarPresencaPush(request, env, usuario) {
    if (!env.PUSH_KV) {
        throw criarErro(500, "Binding PUSH_KV não configurado.");
    }

    const dados = await request.json();
    const username = normalizarUsername(dados.username || usuario.username || "");
    const visivel = dados.visivel === true;
    const chatId = String(dados.chatId || "").trim();

    if (!username) {
        throw criarErro(400, "Usuário da presença não informado.");
    }

    if (
        usuario.modo === "firebase" &&
        usuario.username &&
        username !== usuario.username
    ) {
        throw criarErro(
            403,
            "A presença deve ser atualizada para o usuário autenticado."
        );
    }

    const chave = `push:presence:${username}`;

    if (!visivel) {
        await env.PUSH_KV.delete(chave);
        return responderJSON({
            ok: true,
            visivel: false
        });
    }

    await env.PUSH_KV.put(
        chave,
        JSON.stringify({
            uid: usuario.uid,
            username,
            chatId,
            atualizadoEm: new Date().toISOString()
        }),
        { expirationTtl: 120 }
    );

    return responderJSON({
        ok: true,
        visivel: true,
        chatId
    });
}

async function enviarPushProprio(request, env, usuario) {
    if (!env.PUSH_KV) {
        throw criarErro(500, "Binding PUSH_KV não configurado.");
    }

    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
        throw criarErro(500, "Segredos VAPID não configurados.");
    }

    const dados = await request.json();
    const destinatario = normalizarUsername(dados.destinatario || "");
    const remetente = normalizarUsername(dados.remetente || "");
    const texto = String(dados.texto || "Nova mensagem").trim();
    const chatId = String(dados.chatId || "").trim();
    const messageId = String(dados.messageId || "").trim();

    if (!destinatario || !remetente || !texto || !chatId) {
        throw criarErro(
            400,
            "Destinatário, remetente, texto e chatId são obrigatórios."
        );
    }

    if (
        usuario.modo === "firebase" &&
        usuario.username &&
        remetente !== usuario.username
    ) {
        throw criarErro(
            403,
            "O remetente deve corresponder ao usuário autenticado."
        );
    }

    const presenca = await env.PUSH_KV.get(
        `push:presence:${destinatario}`,
        "json"
    );

    const deveSuprimirPorPresenca = Boolean(
        presenca &&
        presenca.visivel === true &&
        presenca.chatId === chatId
    );

    if (deveSuprimirPorPresenca) {
        return responderJSON({
            ok: true,
            enviados: 0,
            suprimido: true,
            motivo: presenca.chatId === chatId
                ? "Destinatário está na conversa ativa."
                : "Aplicativo do destinatário está visível."
        });
    }

    const assinaturas = await lerAssinaturasPush(env, destinatario);

    if (!assinaturas.length) {
        return responderJSON({
            ok: true,
            enviados: 0,
            motivo: "Destinatário sem dispositivos inscritos."
        });
    }

    webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );

    const titulo = remetente
        ? `Nova mensagem de ${remetente}`
        : "Nova mensagem";
    const corpo = texto.length > 160
        ? `${texto.slice(0, 157)}...`
        : texto;
    const expiradas = [];
    let enviados = 0;

    await Promise.all(assinaturas.map(async assinatura => {
        try {
            await webpush.sendNotification(
                assinatura,
                JSON.stringify({
                    title: titulo,
                    body: corpo,
                    chatId,
                    messageId,
                    remetente,
                    url: "/index.html"
                }),
                {
                    TTL: 86400,
                    urgency: "high"
                }
            );
            enviados += 1;
        } catch (erro) {
            const status = Number(erro.statusCode || 0);
            if (status === 404 || status === 410) {
                expiradas.push(assinatura.endpoint);
            } else {
                console.error("Falha ao enviar Web Push:", status, erro.message);
            }
        }
    }));

    if (expiradas.length) {
        const ativas = assinaturas.filter(
            assinatura => !expiradas.includes(assinatura.endpoint)
        );
        await env.PUSH_KV.put(
            `push:user:${destinatario}`,
            JSON.stringify(ativas)
        );
    }

    return responderJSON({
        ok: true,
        enviados,
        removidos: expiradas.length,
        remetente: usuario.uid
    });
}

async function enviarNotificacaoGeral(
    request,
    env,
    usuario
) {
    if (!env.PUSH_KV) {
        throw criarErro(
            500,
            "Binding PUSH_KV não configurado."
        );
    }

    if (
        !env.VAPID_PUBLIC_KEY ||
        !env.VAPID_PRIVATE_KEY ||
        !env.VAPID_SUBJECT
    ) {
        throw criarErro(
            500,
            "Segredos VAPID não configurados."
        );
    }

    if (
        !usuario ||
        usuario.modo !== "firebase" ||
        usuario.username !== "admin"
    ) {
        throw criarErro(
            403,
            "Somente o administrador pode enviar notificações gerais."
        );
    }

    const dados = await request.json();
    const titulo = String(
        dados.titulo || ""
    ).trim().slice(0, 80);
    const texto = String(
        dados.mensagem || ""
    ).trim().slice(0, 240);
    const destinatarios = Array.from(
        new Set(
            Array.isArray(dados.destinatarios)
                ? dados.destinatarios
                    .map(normalizarUsername)
                    .filter(Boolean)
                : []
        )
    ).slice(0, 500);

    if (!titulo || !texto) {
        throw criarErro(
            400,
            "Título e mensagem são obrigatórios."
        );
    }

    if (!destinatarios.length) {
        throw criarErro(
            400,
            "Nenhum destinatário foi selecionado."
        );
    }

    webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );

    const expiradasPorUsuario = new Map();
    let destinatariosComDispositivo = 0;
    let dispositivosNotificados = 0;
    let falhas = 0;

    await Promise.all(
        destinatarios.map(async destinatario => {
            const assinaturas = await lerAssinaturasPush(
                env,
                destinatario
            );

            if (!assinaturas.length) {
                return;
            }

            destinatariosComDispositivo += 1;
            const expiradas = [];

            await Promise.all(
                assinaturas.map(async assinatura => {
                    try {
                        await webpush.sendNotification(
                            assinatura,
                            JSON.stringify({
                                title: titulo,
                                body: texto,
                                tipo: "notificacao_geral",
                                chatId: "",
                                messageId: "",
                                remetente: "admin",
                                url: "/index.html"
                            }),
                            {
                                TTL: 86400,
                                urgency: "high"
                            }
                        );

                        dispositivosNotificados += 1;
                    } catch (erro) {
                        const status = Number(
                            erro.statusCode || 0
                        );

                        if (status === 404 || status === 410) {
                            expiradas.push(
                                assinatura.endpoint
                            );
                        } else {
                            falhas += 1;
                            console.error(
                                "Falha no push geral:",
                                destinatario,
                                status,
                                erro.message
                            );
                        }
                    }
                })
            );

            if (expiradas.length) {
                expiradasPorUsuario.set(
                    destinatario,
                    expiradas
                );
            }
        })
    );

    await Promise.all(
        Array.from(
            expiradasPorUsuario.entries()
        ).map(async ([destinatario, expiradas]) => {
            const assinaturas = await lerAssinaturasPush(
                env,
                destinatario
            );
            const ativas = assinaturas.filter(
                assinatura => !expiradas.includes(
                    assinatura.endpoint
                )
            );

            await env.PUSH_KV.put(
                `push:user:${destinatario}`,
                JSON.stringify(ativas)
            );
        })
    );

    return responderJSON({
        ok: true,
        destinatariosSolicitados: destinatarios.length,
        destinatariosComDispositivo,
        dispositivosNotificados,
        dispositivosExpirados: Array.from(
            expiradasPorUsuario.values()
        ).reduce(
            (total, endpoints) => total + endpoints.length,
            0
        ),
        falhas
    });
}

function normalizarUsername(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, "");
}
