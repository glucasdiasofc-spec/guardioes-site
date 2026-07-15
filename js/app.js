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
    
    const loginSalvo = localStorage.getItem("sessaoAdminLogado");
    const tipoUsuario = localStorage.getItem("usuarioLogado");

    if (loginSalvo === "true") {
        document.getElementById("tela-login").style.display = "none";
        
        if (tipoUsuario === "admin") {
            document.getElementById("tela-admin").style.display = "flex";
            carregarUnidadesCadastradas(); 
            carregarMembrosCadastrados();
        } else {
            irParaSite();
        }
    }
});

// Executa o login do administrador
async function executarLoginMembro() {    
    const usuarioInput = document.getElementById("login-username").value.trim();
    const senhaInput = document.getElementById("login-senha").value;
    const erroDisplay = document.getElementById("erro-login");

    if (erroDisplay) erroDisplay.textContent = "Validando...";

    // 1. Acesso do Admin
    if (usuarioInput === "admin" && senhaInput === "Alcopoes1") {
        localStorage.setItem("sessaoAdminLogado", "true");
        localStorage.setItem("usuarioLogado", "admin");
        
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";

        carregarUnidadesCadastradas();
        carregarMembrosCadastrados();
        return;
    }

    // 2. Acesso via Firebase Auth para membros comuns
    try {
        const emailFirebase = `${usuarioInput.toLowerCase()}@guardioesdbv.com`;
        await window.ClubeDB.loginDB.signInWithEmailAndPassword(emailFirebase, senhaInput);
        
        localStorage.setItem("sessaoAdminLogado", "true");
        localStorage.setItem("usuarioLogado", "membro");
        
        document.getElementById("tela-login").style.display = "none";
        
        // Membros comuns vão direto para o site!
        irParaSite();
        
    } catch (erro) {
        console.error("Erro de login:", erro);
        if (erroDisplay) erroDisplay.textContent = "Usuário ou senha incorretos.";
    }
}

// Direciona o fluxo para a tela de visualização do site
function irParaSite() {
    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-site").style.display = "flex";
    
    const tipoUsuario = localStorage.getItem("usuarioLogado");
    const btnVoltar = document.getElementById("btn-voltar-painel");
    if (btnVoltar) {
        if (tipoUsuario === "admin") {
            btnVoltar.style.display = "block";
        } else {
            btnVoltar.style.display = "none";
        }
    }
}

// Retorna para o Painel do Administrador
function irParaPainel() {
    document.getElementById("tela-site").style.display = "none";
    document.getElementById("tela-admin").style.display = "flex";
    
    carregarUnidadesCadastradas();
    carregarMembrosCadastrados();
}

// Limpa a sessão
function fazerLogoutSessao() {
    localStorage.removeItem("sessaoAdminLogado");
    localStorage.removeItem("usuarioLogado");
    
    if (window.ClubeDB && window.ClubeDB.loginDB) {
        window.ClubeDB.loginDB.signOut().catch(err => console.log("Signout efetuado: ", err));
    }

    document.getElementById("tela-admin").style.display = "none";
    document.getElementById("tela-site").style.display = "none";
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
    const menuSelecao = document.getElementById("membro-unidade-vinculo");
    if (container) container.innerHTML = "";
    if (menuSelecao) menuSelecao.innerHTML = '<option value="">Selecione a Unidade...</option>';
    const snapshot = await window.ClubeDB.textoDB.collection("unidades").get();
    snapshot.forEach(doc => {
        const d = doc.data();
        const id = doc.id;
        const urlFoto = d.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';

        if (container) {
            container.innerHTML += `
                <div class="item-unidade" style="text-align: center; margin-bottom: 20px; border: 1px solid #444; padding: 10px; border-radius: 8px;">
                    <img src="${urlFoto}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">
                    <div style="font-weight: bold; margin-bottom: 10px;">${d.nome}</div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="iniciarEdicaoUnidade('${id}', '${d.nome}', '${d.fotoIdPublico || ''}')" style="flex: 1; padding: 5px;">✏️ Editar</button>
                        <button onclick="deletarUnidadeComFoto('${id}', '${d.fotoIdPublico || ''}')" style="flex: 1; padding: 5px; background:#ff4d4d; color:white; border:none;">🗑️ Apagar</button>
                    </div>
                </div>`;
        }
        if (menuSelecao) menuSelecao.innerHTML += `<option value="${d.nome}">${d.nome}</option>`;
    });
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
            btn.textContent = idMembroSendoEditado ? "⏳ Salvando..." : "⏳ Cadastrando...";
        }

        if (window.ClubeDB) {
            if (idMembroSendoEditado) {
                // Se enviou nova foto, reprocessa tudo. Se não, atualiza apenas os textos preservando a foto atual
                if (arquivoFoto && window.ClubeDB.acoesAdmin) {
                    await window.ClubeDB.textoDB.collection("usuarios").doc(idMembroSendoEditado).delete();
                    await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
                } else {
                    await window.ClubeDB.textoDB.collection("usuarios").doc(idMembroSendoEditado).update(dadosMembro);
                }   
                alert(`🎉 Membro ${nomeReal} atualizado com sucesso!`);
                idMembroSendoEditado = null; 
            } else {
                await window.ClubeDB.acoesAdmin.cadastrarMembro(dadosMembro, arquivoFoto);
                alert(`🎉 Membro ${nomeReal} cadastrado com sucesso!`);
            }
            
            document.getElementById("membro-username").value = "";
            document.getElementById("membro-senha").value = "";
            document.getElementById("membro-nome-real").value = "";
            document.getElementById("membro-cargo").value = "";
            document.getElementById("membro-nascimento").value = "";
            if (fotoInput) fotoInput.value = "";
            document.getElementById("previa-membro-img").src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
            
            carregarMembrosCadastrados();
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

// Controle global de edição de usuários
let idMembroSendoEditado = null;

async function carregarMembrosCadastrados() {
    console.log("Iniciando busca de membros no banco...");
    
    // Tenta encontrar a área da aba de membros de várias formas possíveis
    let abaMembros = document.getElementById("aba-membros") || document.getElementById("membros");
    
    // Se o ID for diferente, procura o container através do campo de nome que sabemos que existe
    if (!abaMembros) {
        const inputNome = document.getElementById("membro-nome-real");
        if (inputNome) abaMembros = inputNome.parentElement;
    }

    if (!abaMembros) {
        console.error("Erro: Não encontrei onde desenhar a lista no HTML (ID da aba não encontrado).");
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
    
    container.innerHTML = "<p style='color: #aaa;'>Buscando membros no servidor...</p>";
    
    try {
        const snapshot = await window.ClubeDB.textoDB.collection("usuarios").get();
        console.log("Encontrei " + snapshot.size + " membro(s) no banco de dados.");
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='color: #aaa;'>Nenhum membro cadastrado ainda.</p>";
            return;
        }

        container.innerHTML = "<h3 style='margin-bottom:15px;'>Membros Cadastrados</h3>"; 
        
        snapshot.forEach(doc => {
            const m = doc.data();
            const id = doc.id;
            const urlFoto = m.fotoUrl || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png';

            container.innerHTML += `
                <div class="item-membro" style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: #2b2b2b; border-radius: 8px;">
                    <img src="${urlFoto}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${m.nomeReal || 'Sem Nome'}</div>
                        <div style="font-size: 12px; color: #aaa;">${m.cargo || 'Membro'} | ${m.unidade || 'Sem unidade'}</div>
                    </div>
                    <button onclick="prepararEdicaoMembro('${id}', ${JSON.stringify(m).replace(/"/g, '&quot;')})" style="padding: 5px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; border: none;">✏️ Editar</button>
                    <button onclick="deletarMembro('${id}', '${m.fotoIdPublico || ''}')" style="padding: 5px 10px; font-size: 12px; background: #ff4d4d; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ Apagar</button>
                </div>
            `;
        });
    } catch (erro) {
        console.error("Erro do Firebase:", erro);
        container.innerHTML = `<p style="color: #ff4d4d;">Erro ao carregar membros: ${erro.message}</p>`;
    }
}

function prepararEdicaoMembro(id, dados) {
    idMembroSendoEditado = id;
    
    document.getElementById("membro-username").value = dados.username || "";
    document.getElementById("membro-senha").value = dados.senha || "";
    document.getElementById("membro-nome-real").value = dados.nomeReal || "";
    document.getElementById("membro-tipo").value = dados.tipo || "Desbravador";
    
    controlarExibicaoSelecaoUnidade();
    const campoUnidade = document.getElementById("membro-unidade-vinculo");
    if (campoUnidade) campoUnidade.value = dados.unidade || "";
    
    document.getElementById("membro-cargo").value = dados.cargo || "";
    document.getElementById("membro-nascimento").value = dados.dataNascimento || "";
    
    if (dados.fotoUrl) {
        document.getElementById("previa-membro-img").src = dados.fotoUrl;
    }

    const btn = document.querySelector("#aba-membros button");
    if (btn) btn.textContent = "💾 Salvar Alterações do Membro";
    
    document.getElementById("aba-membros").scrollIntoView({ behavior: 'smooth' });
}

async function deletarMembro(id, idFoto) {
    if (!confirm("Tem certeza que deseja apagar este membro permanentemente?")) return;
    try {
        if (idFoto && idFoto !== "undefined" && window.ClubeDB.acoesAdmin.excluirFoto) {
            await window.ClubeDB.acoesAdmin.excluirFoto(idFoto);
        }
        await window.ClubeDB.textoDB.collection("usuarios").doc(id).delete();
        alert("Membro removido com sucesso!");
        carregarMembrosCadastrados();
    } catch (erro) {
        alert("Erro ao remover membro: " + erro.message);
    }
}