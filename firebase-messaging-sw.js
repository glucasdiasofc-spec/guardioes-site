importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js" );
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js" );

firebase.initializeApp({
    apiKey: "AIzaSyClBlFwrHzom9tFIIuo3eORTn5xqy3wSKY",
    authDomain: "guardioesdbv-firebase.firebaseapp.com",
    projectId: "guardioesdbv-firebase",
    storageBucket: "guardioesdbv-firebase.firebasestorage.app",
    messagingSenderId: "362596177413",
    appId: "1:362596177413:web:8088eb72dc554c788a6e6c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {};
    const dados = payload.data || {};

    const titulo = notification.title || dados.title || "Nova mensagem";
    const opcoes = {
        body: notification.body || dados.body || "Você recebeu uma nova mensagem.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: dados.chatId || "mensagem-chat",
        renotify: true,
        data: {
            url: dados.url || "/index.html",
            chatId: dados.chatId || ""
        }
    };

    return self.registration.showNotification(titulo, opcoes);
});

self.addEventListener("notificationclick", event => {
    event.notification.close();

    const destino = event.notification.data &&
        event.notification.data.url
        ? event.notification.data.url
        : "/index.html";

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(lista => {
            for (const cliente of lista) {
                if ("focus" in cliente) {
                    return cliente.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(destino);
            }

            return undefined;
        })
    );
});