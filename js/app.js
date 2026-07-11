/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

const VERSAO_ATUAL = "v1.0.6 - Feedback Visual e Lista Dinâmica";

// Executa assim que a página termina de carregar no navegador
document.addEventListener("DOMContentLoaded", () => {
    const rodape = document.getElementById("versao-app-texto");
    if (rodape) {
        rodape.textContent = VERSAO_ATUAL;
    }
    
    // Verifica login salvo na memória
    const loginSalvo = localStorage.getItem("sessaoAdminLogado");
    if (loginSalvo === "true") {
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        // Puxa do banco e renderiza as unidades assim que logar!
        carregarUnidadesCadastradas(); 
    }
});

// Executa o login do administrador
function executarLoginMembro() {
    const usuarioInput = document.getElementById("login-username").value.trim();
    const senhaInput = document.getElementById("login-senha").value;
    const erroDisplay = document.getElementById("erro-login");

    if (erroDisplay) erroDisplay.textContent = "";

    if (usuarioInput === "admin" && senhaInput === "Alcopoes1") {
        localStorage.setItem("sessaoAdminLogado", "true");
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";

        // Puxa do banco e renderiza as unidades!
        carregarUnidadesCadastradas();
    } else {
        if (erroDisplay) erroDisplay.textContent = "Usuário ou senha incorretos.";
    }
}

// Limpa a sessão
function fazerLogoutSessao() {
    localStorage.removeItem("sessaoAdminLogado");
    document.getElementById("tela-admin").style.display = "none";
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

    if (!nome) {
        alert("Por favor, digite o nome da unidade!");
        return;
    }

    try {
        // UX: Trava o botão e avisa visualmente o usuário que está processando
        btn.disabled = true;
        btn.textContent = "⏳ Salvando unidade... Aguarde!";

        if (window.ClubeDB && window.ClubeDB.acoesAdmin) {
            await window.ClubeDB.acoesAdmin.criarUnidade(nome, arquivoFoto);
            
            alert(`🎉 Sucesso! Unidade [${nome}] criada!`);
            
            // Limpa os campos da tela
            nomeInput.value = "";
            if (fotoInput) fotoInput.value = "";
            document.getElementById("previa-unidade-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
            
            // Atualiza a lista renderizada para a nova unidade aparecer
            carregarUnidadesCadastradas();
        }
    } catch (erro) {
        alert("⚠️ Erro bloqueante: " + erro.message + "\n\nDICA: Ocorreu um travamento grave. Verifique as Regras do seu Firebase ou seu acesso à internet.");
    } finally {
        // UX: Destrava o botão aconteça o que acontecer
        btn.disabled = false;
        btn.textContent = "Criar Unidade";
    }
}

// NOVA FUNÇÃO: Renderiza os cartões físicos da unidade na tela
async function carregarUnidadesCadastradas() {
    const container = document.getElementById("lista-unidades-render");
    if (!container) return;

    container.innerHTML = "<p style='color: #aaa;'>Buscando unidades no banco de dados...</p>";

    try {
        if (window.ClubeDB && window.ClubeDB.textoDB) {
            const snapshot = await window.ClubeDB.textoDB.collection("unidades").get();
            
            if (snapshot.empty) {
                container.innerHTML = "<p style='color: #aaa;'>Nenhuma unidade cadastrada ainda.</p>";
                return;
            }

            container.innerHTML = ""; // Limpa a mensagem e inicia a plotagem
            snapshot.forEach(doc => {
                const dados = doc.data();
                const fotoExibicao = dados.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';
                
                container.innerHTML += `
                    <div style="display: flex; align-items: center; gap: 15px; background: #2b2b2b; padding: 10px; border-radius: 8px; border: 1px solid #444;">
                        <img src="${fotoExibicao}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #007bff;">
                        <span style="color: #fff; font-size: 16px; font-weight: bold;">${dados.nome}</span>
                    </div>
                `;
            });
        }
    } catch (erro) {
        container.innerHTML = `<p style="color: #ff4d4d;">⚠️ Erro de permissão. O Firebase bloqueou a leitura. Verifique as Regras do Firestore.</p>`;
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
            btn.textContent = "⏳ Cadastrando...";
        }

        if (window.ClubeDB && window.ClubeDB.acoesAdmin) {
            await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
            alert(`🎉 Membro ${nomeReal} cadastrado com sucesso!`);
            
            document.getElementById("membro-username").value = "";
            document.getElementById("membro-senha").value = "";
            document.getElementById("membro-nome-real").value = "";
            document.getElementById("membro-cargo").value = "";
            document.getElementById("membro-nascimento").value = "";
            if (fotoInput) fotoInput.value = "";
            document.getElementById("previa-membro-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
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