/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

// Defina aqui a versão atual do deploy para checar no navegador se atualizou!
const VERSAO_ATUAL = "v1.0.3 - Estilos e Prévias de Fotos Corrigidos";

// Executa assim que a página termina de carregar no navegador
document.addEventListener("DOMContentLoaded", () => {
    const rodape = document.getElementById("versao-app-texto");
    if (rodape) {
        rodape.textContent = VERSAO_ATUAL;
    }
    console.log(`🚀 Sistema rodando na versão: ${VERSAO_ATUAL}`);
});

// Executa o login temporário do administrador local
function executarLoginMembro() {
    const usuarioInput = document.getElementById("login-username").value.trim();
    const senhaInput = document.getElementById("login-senha").value;
    const erroDisplay = document.getElementById("erro-login");

    if (erroDisplay) erroDisplay.textContent = "";

    if (usuarioInput === "admin" && senhaInput === "Alcopoes1") {
        console.log("🔓 Acesso administrativo concedido.");
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";
    } else {
        if (erroDisplay) erroDisplay.textContent = "Usuário ou senha incorretos.";
    }
}

function fazerLogoutSessao() {
    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-login").style.display = "flex";
    console.log("🔒 Sessão encerrada.");
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
            imagemAlvo.src = e.target.result; // Troca o avatar cinza pela foto escolhida
        };
        leitor.readAsDataURL(arquivo);
    }
}

// === ENVIO DOS FORMULÁRIOS PARA O CORE ===
async function salvarNovaUnidadeAdmin() {
    const nomeInput = document.getElementById("unidade-nome");
    const fotoInput = document.getElementById("unidade-foto");

    if (!nomeInput) return;
    const nome = nomeInput.value.trim();
    const arquivoFoto = fotoInput ? fotoInput.files[0] : null;

    if (!nome) {
        alert("Por favor, digite o nome da unidade!");
        return;
    }

    try {
        console.log("⏳ Iniciando criação da unidade...");
        if (window.ClubeDB && window.ClubeDB.acoesAdmin) {
            await window.ClubeDB.acoesAdmin.criarUnidade(nome, arquivoFoto);
            alert(`Unidade [${nome}] criada com sucesso!`);
            
            nomeInput.value = "";
            if (fotoInput) fotoInput.value = "";
            // Reseta a foto da prévia para o avatar padrão
            document.getElementById("previa-unidade-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        } else {
            throw new Error("Core do banco de dados não encontrado.");
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