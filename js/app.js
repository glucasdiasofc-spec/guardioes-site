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

    // === FUNÇÕES DE CRIAÇÃO E ENVIO DE FORMULÁRIOS DO PAINEL ===

// Captura os dados da tela e chama o banco de dados para salvar a unidade
async function salvarNovaUnidadeAdmin() {
    const nomeInput = document.getElementById("unidade-nome");
    const fotoInput = document.getElementById("unidade-foto");

    const nome = nomeInput.value.trim();
    const arquivoFoto = fotoInput.files[0];

    if (!nome) {
        alert("Por favor, digite o nome da unidade!");
        return;
    }

    try {
        console.log("⏳ Iniciando criação da unidade e upload da foto...");
        // Aciona o método global do nosso ClubeDB
        await window.ClubeDB.acoesAdmin.criarUnidade(nome, arquivoFoto);
        
        alert(`Unidade [${nome}] criada com sucesso!`);
        
        // Limpa os campos do formulário após o sucesso
        nomeInput.value = "";
        fotoInput.value = "";
    } catch (erro) {
        alert("Erro ao criar unidade: " + erro.message);
    }
}

// Captura os dados da tela e cadastra o usuário no Firebase Auth + Firestore
async function salvarNovoMembroAdmin() {
    const username = document.getElementById("membro-username").value.trim();
    const senha = document.getElementById("membro-senha").value;
    const nomeReal = document.getElementById("membro-nome-real").value.trim();
    const tipo = document.getElementById("membro-tipo").value;
    const unidade = document.getElementById("membro-unidade-vinculo").value;
    const cargo = document.getElementById("membro-cargo").value.trim();
    const dataNascimento = document.getElementById("membro-nascimento").value;
    const fotoInput = document.getElementById("membro-foto");
    const arquivoFoto = fotoInput.files[0];

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
        console.log(`⏳ Registrando o membro ${username}...`);
        await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
        
        alert(`Membro ${nomeReal} cadastrado com sucesso!`);
        
        // Limpa os campos do formulário
        document.getElementById("membro-username").value = "";
        document.getElementById("membro-senha").value = "";
        document.getElementById("membro-nome-real").value = "";
        document.getElementById("membro-cargo").value = "";
        document.getElementById("membro-nascimento").value = "";
        fotoInput.value = "";
    } catch (erro) {
        alert("Erro ao cadastrar membro: " + erro.message);
    }
}
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