/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

// Defina aqui a versão atual do deploy para checar no navegador se atualizou!
const VERSAO_ATUAL = "v1.0.4 - Login Permanente e Botões Corrigidos";

// Executa assim que a página termina de carregar no navegador
document.addEventListener("DOMContentLoaded", () => {
    const rodape = document.getElementById("versao-app-texto");
    if (rodape) {
        rodape.textContent = VERSAO_ATUAL;
    }
    
    // VERIFICAÇÃO DE LOGIN PERMANENTE:
    // Se o localStorage disser que o admin já estava logado, joga ele direto para o painel!
    const loginSalvo = localStorage.getItem("sessaoAdminLogado");
    if (loginSalvo === "true") {
        console.log("🔄 Sessão anterior restaurada automaticamente via localStorage.");
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
    }

    console.log(`🚀 Sistema rodando na versão: ${VERSAO_ATUAL}`);
});

// Executa o login do administrador local e salva a sessão
function executarLoginMembro() {
    const usuarioInput = document.getElementById("login-username").value.trim();
    const senhaInput = document.getElementById("login-senha").value;
    const erroDisplay = document.getElementById("erro-login");

    if (erroDisplay) erroDisplay.textContent = "";

    if (usuarioInput === "admin" && senhaInput === "Alcopoes1") {
        console.log("🔓 Acesso administrativo concedido.");
        
        // SALVA NA MEMÓRIA DO DISPOSITIVO: O login fica salvo aqui permanentemente
        localStorage.setItem("sessaoAdminLogado", "true");

        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";
    } else {
        if (erroDisplay) erroDisplay.textContent = "Usuário ou senha incorretos.";
    }
}

// Limpa a memória permanente ao deslogar
function fazerLogoutSessao() {
    // APAGA DA MEMÓRIA DO DISPOSITIVO: Força a precisar logar de novo
    localStorage.removeItem("sessaoAdminLogado");

    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-login").style.display = "flex";
    console.log("🔒 Sessão encerrada e localStorage limpo.");
}

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

// === INTERFACE DE REDE SOCIAL: PRÉ-VISUALIZAÇÃO DA FOTO EM TEMPO REAL ===
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

// === ENVIO DOS FORMULÁRIOS PARA O CORE ===
async function salvarNovaUnidadeAdmin() {
    console.log("🔘 Botão Criar Unidade clicado com sucesso!");
    const nomeInput = document.getElementById("unidade-nome");
    const fotoInput = document.getElementById("unidade-foto");

    if (!nomeInput) {
        console.error("❌ Elemento 'unidade-nome' não foi encontrado no HTML.");
        return;
    }
    
    const nome = nomeInput.value.trim();
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;

    if (!nome) {
        alert("Por favor, digite o nome da unidade!");
        return;
    }

    try {
        console.log("⏳ Iniciando comunicação com ClubeDB...");
        if (window.ClubeDB && window.ClubeDB.acoesAdmin) {
            await window.ClubeDB.acoesAdmin.criarUnidade(nome, arquivoFoto);
            alert(`Unidade [${nome}] criada com sucesso!`);
            
            nomeInput.value = "";
            if (fotoInput) fotoInput.value = "";
            document.getElementById("previa-unidade-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        } else {
            throw new Error("O núcleo de banco de dados (ClubeDB) não respondeu.");
        }
    } catch (erro) {
        alert("Erro ao criar unidade: " + erro.message);
    }
}

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
        if (window.ClubeDB && window.ClubeDB.acoesAdmin) {
            console.log(`⏳ Registrando o membro ${username}...`);
            await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
            alert(`Membro ${nomeReal} cadastrado com sucesso!`);
            
            document.getElementById("membro-username").value = "";
            document.getElementById("membro-senha").value = "";
            document.getElementById("membro-nome-real").value = "";
            document.getElementById("membro-cargo").value = "";
            document.getElementById("membro-nascimento").value = "";
            if (fotoInput) fotoInput.value = "";
            document.getElementById("previa-membro-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        }
    } catch (erro) {
        alert("Erro ao cadastrar membro: " + erro.message);
    }
}