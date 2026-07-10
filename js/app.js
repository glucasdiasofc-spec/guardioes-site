/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Alternância de Telas, Login Admin e Ações do Painel
   ================================================================= */

// Executa o login temporário do administrador local para validação sem expor senhas
function executarLoginMembro() {
    const usuarioInput = document.getElementById("login-username").value.trim();
    const senhaInput = document.getElementById("login-senha").value;
    const erroDisplay = document.getElementById("erro-login");

    erroDisplay.textContent = "";

    // Validação estrita baseada nas configurações combinadas do Admin
    if (usuarioInput === "admin" && senhaInput === "Alcopoes1") {
        console.log("🔓 Acesso administrativo concedido.");
        
        // Esconde a tela de login e exibe a central do Admin
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        // Limpa os campos por segurança
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";
    } else {
        erroDisplay.textContent = "Usuário ou senha incorretos.";
    }
}

// Retorna o aplicativo para o estado original de login
function fazerLogoutSessao() {
    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-login").style.display = "flex";
    console.log("🔒 Sessão encerrada.");
}

// Gerencia a troca visual das abas internas do painel admin sem reload
function mudarAbaAdmin(idAbaDestino) {
    // 1. Oculta todos os containers de abas
    const conteudos = document.querySelectorAll(".conteudo-aba");
    conteudos.forEach(aba => aba.style.display = "none");

    // 2. Remove a classe ativa de todos os botões de abas
    const botoes = document.querySelectorAll(".aba-item");
    botoes.forEach(btn => btn.classList.remove("ativa"));

    // 3. Exibe o container alvo e ativa o botão correto
    document.getElementById(idAbaDestino).style.display = "flex";
    document.getElementById(idAbaDestino).style.flexDirection = "column";
    
    // Procura o botão correto pelo evento do clique para marcar ativo
    const botaoClicado = Array.from(botoes).find(btn => btn.getAttribute("onclick").includes(idAbaDestino));
    if (botaoClicado) botaoClicado.classList.add("ativa");
}

// Oculta ou exibe o seletor de unidades baseado no cargo do membro
function controlarExibicaoSelecaoUnidade() {
    const tipoSelecionado = document.getElementById("membro-tipo").value;
    const campoUnidade = document.getElementById("membro-unidade-vinculo");

    if (tipoSelecionado === "Liderança") {
        campoUnidade.style.display = "none";
        campoUnidade.value = "";
    } else {
        campoUnidade.style.display = "block";
    }
}