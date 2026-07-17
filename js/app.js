/* =================================================================
   ARQUIVO: js/app.js
   LÓGICA: Controle de Interface, Prévias de Fotos e Validações
   ================================================================= */

const VERSAO_ATUAL = "v0.0.65 - versão de teste";

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
            carregarPendenciasAprovacaoAdmin();
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
        localStorage.setItem("usernameLogado", "admin");
        
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("tela-admin").style.display = "flex";
        
        document.getElementById("login-username").value = "";
        document.getElementById("login-senha").value = "";

        carregarUnidadesCadastradas();
        carregarMembrosCadastrados();
        carregarPendenciasAprovacaoAdmin();
        return;
    }

    // 2. Acesso via Firebase Auth para membros comuns
    try {
        const emailFirebase = `${usuarioInput.toLowerCase()}@guardioesdbv.com`;
        await window.ClubeDB.loginDB.signInWithEmailAndPassword(emailFirebase, senhaInput);
        
        localStorage.setItem("sessaoAdminLogado", "true");
        localStorage.setItem("usuarioLogado", "membro");
        localStorage.setItem("usernameLogado", usuarioInput.toLowerCase());
        
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
            btnVoltar.style.display = "inline-block";
        } else {
            btnVoltar.style.display = "none";
        }
    }
    
    // Sempre abre na aba do Feed ao entrar
    mudarSubAbaSite('feed');
}

// Retorna para o Painel do Administrador
function irParaPainel() {
    document.getElementById("tela-site").style.display = "none";
    document.getElementById("tela-admin").style.display = "flex";
    
    carregarUnidadesCadastradas();
    carregarMembrosCadastrados();
    carregarPendenciasAprovacaoAdmin();
}

// Alterna entre o Feed e o Perfil no App do Usuário
function mudarSubAbaSite(abaAlvo) {
    const feedAba = document.getElementById("sub-aba-feed");
    const perfilAba = document.getElementById("sub-aba-perfil");
    const espAba = document.getElementById("sub-aba-especialidades"); // Nova aba

    // Reseta todos
    if (feedAba) feedAba.style.display = "none";
    if (perfilAba) perfilAba.style.display = "none";
    if (espAba) espAba.style.display = "none";

    // Mostra o selecionado
    if (abaAlvo === "feed") {
        feedAba.style.display = "block";
        // ... (resto da lógica de opacidade dos botões)
    } else if (abaAlvo === "especialidades") {
        espAba.style.display = "block";
        carregarEspecialidades(); // Chama a função que criamos acima
    } else if (abaAlvo === "perfil") {
        perfilAba.style.display = "block";
        carregarPerfilDoUsuario();
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

    // Reset de sub-abas do perfil para iniciar na principal
    mudarSubTabPerfil('publicacoes');

    // Se for o admin visualizando o site
    if (tipoUsuario === "admin") {
        if (nomeEl) nomeEl.textContent = "Administrador";
        if (cargoEl) cargoEl.textContent = "Liderança Geral";
        if (unidadeEl) unidadeEl.textContent = "Geral";
        if (nascimentoEl) nascimentoEl.textContent = "Nascido em: --/--/----";
        if (avatarEl) avatarEl.src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
        if (contadorEl) contadorEl.textContent = "∞";
        
        if (classesEl) classesEl.innerHTML = "• Classe: Administrador Geral";
        if (especialidadesEl) especialidadesEl.innerHTML = "<span style='color: #8e8e8e;'>Acesso Irrestrito</span>";
        if (mestradosEl) mestradosEl.innerHTML = "<span style='color: #8e8e8e;'>Acesso Irrestrito</span>";
        if (gridEl) gridEl.style.display = "none";
        if (vazioEl) vazioEl.style.display = "block";
        return;
    }

    if (!username) return;

    try {
        const snapshot = await window.ClubeDB.textoDB.collection("usuarios").where("username", "==", username).get();
        if (!snapshot.empty) {
            const dados = snapshot.docs[0].data();
            
            if (nomeEl) nomeEl.textContent = dados.nomeReal || dados.username;
            if (cargoEl) cargoEl.textContent = dados.cargo || "Membro";
            if (unidadeEl) unidadeEl.textContent = dados.unidade || "Sem Unidade";
            
            if (dados.dataNascimento) {
                const [ano, mes, dia] = dados.dataNascimento.split("-");
                if (nascimentoEl) nascimentoEl.textContent = `Nascido em: ${dia}/${mes}/${ano}`;
            } else {
                if (nascimentoEl) nascimentoEl.textContent = "Nascido em: --/--/----";
            }

            if (dados.fotoUrl && avatarEl) {
                avatarEl.src = dados.fotoUrl;
            } else if (avatarEl) {
                avatarEl.src = "https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png";
            }

            // Cálculo dinâmico do contador centralizado de conquistas
            const qtdClasses = (dados.classesConcluidas || []).length;
            const qtdEspecialidades = (dados.especialidades || []).length;
            const qtdMestrados = (dados.mestrados || []).length;
            if (contadorEl) contadorEl.textContent = (qtdClasses + qtdEspecialidades + qtdMestrados);

            // Exibição condicional do Grid de Publicações
            if (dados.publicacoes && dados.publicacoes.length > 0) {
                if (gridEl) {
                    gridEl.style.display = "grid";
                    gridEl.innerHTML = dados.publicacoes.map(pubUrl => `
                        <div style="aspect-ratio: 1; background-color: #121212;">
                            <img src="${pubUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `).join("");
                }
                if (vazioEl) vazioEl.style.display = "none";
            } else {
                if (gridEl) gridEl.style.display = "none";
                if (vazioEl) vazioEl.style.display = "block";
            }

            // Renderização Detalhada: Classes Regulares
            if (tClasses) tClasses.textContent = `🎒 Classes Regulares (${qtdClasses})`;
            if (classesEl) {
                if (qtdClasses > 0) {
                    classesEl.innerHTML = dados.classesConcluidas.map(c => `• ${c}`).join("<br>");
                } else {
                    classesEl.innerHTML = `• Classe Vinculada: ${dados.tipo === 'Desbravador' ? 'Classe Regular' : 'Classe de Líder'}`;
                }
            }

            // Renderização Detalhada: Especialidades
            if (tEspecialidades) tEspecialidades.textContent = `🏅 Especialidades Adquiridas (${qtdEspecialidades})`;
            if (especialidadesEl) {
                if (qtdEspecialidades > 0) {
                    especialidadesEl.innerHTML = dados.especialidades.map(esp => `
                        <span style="background: #262626; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: nowrap;">
                            🎖️ ${esp}
                        </span>
                    `).join("");
                } else {
                    especialidadesEl.innerHTML = `
                        <span style="color: #8e8e8e; font-style: italic; font-size: 12px;">
                            Nenhuma especialidade validada. Envie itens para avaliação na aba de alvos!
                        </span>
                    `;
                }
            }

            // Renderização Detalhada: Mestrados
            if (tMestrados) tMestrados.textContent = `🏆 Mestrados Adquiridos (${qtdMestrados})`;
            if (mestradosEl) {
                if (qtdMestrados > 0) {
                    mestradosEl.innerHTML = dados.mestrados.map(mest => `
                        <span style="background: #1e3a1e; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: nowrap; border: 1px solid #2e5a2e;">
                            🏆 ${mest}
                        </span>
                    `).join("");
                } else {
                    mestradosEl.innerHTML = `
                        <span style="color: #8e8e8e; font-style: italic; font-size: 12px;">
                            Nenhum mestrado concluído ainda.
                        </span>
                    `;
                }
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

    if (subAba === 'publicacoes') {
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
    } else if (subAba === 'conquistas') {
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
async function carregarLogoClubeConfig() {
    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        const doc = await docRef.get();
        
        const logoImg = document.getElementById("site-logo-img");
        const logoTexto = document.getElementById("site-logo-texto");
        const sliderTamanho = document.getElementById("logo-tamanho-slider");

        if (doc.exists) {
            const dados = doc.data();
            
            // 1. Aplica a Imagem
            if (dados.logoUrl) {
                if (logoImg) {
                    logoImg.src = dados.logoUrl;
                    logoImg.style.display = "block";
                }
                if (logoTexto) logoTexto.style.display = "none";
                
                const previaAdmin = document.getElementById("previa-logo-clube");
                if (previaAdmin) previaAdmin.src = dados.logoUrl;
            } else {
                if (logoImg) logoImg.style.display = "none";
                if (logoTexto) logoTexto.style.display = "block";
                
                const previaAdmin = document.getElementById("previa-logo-clube");
                if (previaAdmin) previaAdmin.src = "";
            }

            // 2. Aplica o Tamanho Responsivo (Se o admin tiver salvo)
            if (dados.logoTamanho) {
                if (logoImg) {
                    logoImg.style.maxHeight = dados.logoTamanho + "px";
                    logoImg.style.height = dados.logoTamanho + "px";
                    logoImg.style.maxWidth = "250px";
                }
                if (sliderTamanho) {
                    sliderTamanho.value = dados.logoTamanho;
                }
            }
        } else {
            if (logoImg) logoImg.style.display = "none";
            if (logoTexto) logoTexto.style.display = "block";
        }
    } catch (error) {
        console.error("Erro ao carregar configurações da logo:", error);
    }
}

function usarTextoPadraoLogo() {
    const siteLogoImg = document.getElementById("site-logo-img");
    const siteLogoTexto = document.getElementById("site-logo-texto");
    const previaLogo = document.getElementById("previa-logo-clube");

    if (siteLogoImg) siteLogoImg.style.display = "none";
    if (siteLogoTexto) siteLogoTexto.style.display = "block";
    if (previaLogo) previaLogo.src = "";
}

async function salvarLogoClubeAdmin() {
    const fileInput = document.getElementById("logo-clube-file");
    const btn = document.getElementById("btn-salvar-logo");
    const arquivo = fileInput ? fileInput.files[0] : null;

    if (!arquivo) {
        alert("Selecione um arquivo de imagem para a logo!");
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Enviando...";
        }

        let urlLogo = "";
        let idPublicoLogo = "";

        if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadFoto === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadFoto(arquivo);
            urlLogo = res.url;
            idPublicoLogo = res.public_id;
        } else if (window.ClubeDB && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.uploadImagem === "function") {
            const res = await window.ClubeDB.acoesAdmin.uploadImagem(arquivo);
            urlLogo = res.url;
            idPublicoLogo = res.public_id;
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
                urlLogo = data.secure_url;
                idPublicoLogo = data.public_id;
            } else {
                throw new Error("Erro de conexão com o Cloudinary.");
            }
        }

        if (urlLogo) {
            const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
            const doc = await docRef.get();
            if (doc.exists) {
                const dados = doc.data();
                if (dados.logoIdPublico && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                    try {
                        await window.ClubeDB.acoesAdmin.excluirFoto(dados.logoIdPublico);
                    } catch (errExcluir) {
                        console.warn("Aviso ao limpar logo anterior:", errExcluir);
                    }
                }
            }

            // Proteção Máxima contra undefined usando o operador || ""
            await docRef.set({
                logoUrl: urlLogo || "",
                logoIdPublico: idPublicoLogo || ""
            }, { merge: true });

            alert("Logo do clube cadastrada com sucesso! 🛡️");
            carregarLogoClubeConfig();
            if (fileInput) fileInput.value = "";
        }
    } catch (e) {
        alert("Erro ao salvar logo: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Salvar Logo";
        }
    }
}

async function removerLogoClubeAdmin() {
    if (!confirm("Tem certeza que deseja usar o texto padrão ao invés de imagem?")) return;

    try {
        const docRef = window.ClubeDB.textoDB.collection("configuracoes").doc("geral");
        const doc = await docRef.get();
        if (doc.exists) {
            const dados = doc.data();
            if (dados.logoIdPublico && window.ClubeDB.acoesAdmin && typeof window.ClubeDB.acoesAdmin.excluirFoto === "function") {
                await window.ClubeDB.acoesAdmin.excluirFoto(dados.logoIdPublico);
            }
        }

        await docRef.set({
            logoUrl: "",
            logoIdPublico: ""
        }, { merge: true });

        alert("Logo personalizada removida.");
        usarTextoPadraoLogo();
    } catch (e) {
        alert("Erro ao remover logo: " + e.message);
    }
}

// Limpa a sessão
function fazerLogoutSessao() {
    localStorage.removeItem("sessaoAdminLogado");
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("usernameLogado");
    
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

// ==========================================
// CONTROLE DE TAMANHO DA LOGO
// ==========================================

// 1. Faz a logo crescer ou diminuir em tempo real ao arrastar a barra
window.alterarTamanhoLogoEmTempoReal = function(valor) {
    const logoImg = document.getElementById("site-logo-img");
    if (logoImg) {
        logoImg.style.maxHeight = valor + "px";
        logoImg.style.height = valor + "px";
        logoImg.style.maxWidth = "250px"; // Remove o limite antigo de largura para não achatar
    }
};

// 2. Salva o tamanho ideal no Firestore
window.salvarTamanhoLogoBD = async function() {
    try {
        const slider = document.getElementById("logo-tamanho-slider");
        const novoTamanho = slider.value;
        
        await window.ClubeDB.textoDB.collection("configuracoes").doc("geral").set({
            logoTamanho: novoTamanho
        }, { merge: true });
        
        alert("Tamanho da logo salvo com sucesso! 📏");
    } catch (error) {
        console.error("Erro ao salvar tamanho:", error);
        alert("Erro ao salvar tamanho da logo no banco de dados.");
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
async function carregarEspecialidades() {
    // Fecha todos os catálogos para garantir que o usuário caia na tela principal
    fecharCatalogoEspecialidades();
    fecharCatalogoMestrados();
    fecharCatalogoClasses();

    const username = localStorage.getItem("usernameLogado");
    if (!username) return;

    try {
                // 1. CARREGAR E RENDERIZAR ESPECIALIDADES
        if (window.cacheEspecialidades.length === 0) {
            // Prioridade Sênior: Se existe a lista local com os 500 itens, usamos ela para garantir a exibição imediata
            if (typeof listaEspecialidadesParaImportar !== "undefined" && listaEspecialidadesParaImportar.length > 0) {
                console.log("Carregando catálogo local de especialidades...");
                window.cacheEspecialidades = listaEspecialidadesParaImportar.map(item => ({
                    ...item,
                    id: String(item.id || item.nome),
                    categoria: item.area || item.categoria || "Geral",
                    urlImagem: item.logo || item.urlImagem,
                    requisitos: item.reqs || item.requisitos || []
                }));
            } else {
                try {
                    const snapEsp = await window.ClubeDB.textoDB.collection("especialidades").get();
                    if (!snapEsp.empty) {
                        window.cacheEspecialidades = snapEsp.docs.map(doc => ({ 
                            id: String(doc.id), 
                            ...doc.data(),
                            categoria: doc.data().categoria || doc.data().area,
                            urlImagem: doc.data().urlImagem || doc.data().logo
                        }));
                    }
                } catch (erro) {
                    console.error("Erro ao buscar especialidades no banco:", erro);
                }
            }
        }

        renderizarCatalogoEspecialidades(window.cacheEspecialidades);
        await carregarEspecialidadesEmAndamento();

        // 2. CARREGAR E RENDERIZAR MESTRADOS
        if (window.cacheMestrados.length === 0) {
            try {
                const snapMest = await window.ClubeDB.textoDB.collection("mestrados").get();
                if (!snapMest.empty) {
                    window.cacheMestrados = snapMest.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
                } else {
                    // Se não houver lista de mestrados no arquivo de dados, usamos um array vazio ou fallback
                    window.cacheMestrados = typeof listaMestradosParaImportar !== "undefined" ? 
                        listaMestradosParaImportar.map(m => ({ ...m, id: String(m.id) })) : (typeof fallbackMestrados !== 'undefined' ? fallbackMestrados : []);
                }
            } catch {
                window.cacheMestrados = typeof listaMestradosParaImportar !== "undefined" ? 
                    listaMestradosParaImportar.map(m => ({ ...m, id: String(m.id) })) : (typeof fallbackMestrados !== 'undefined' ? fallbackMestrados : []);
            }
        }
        renderizarCatalogoMestrados(window.cacheMestrados);
        await carregarMestradosEmAndamento();

        // 3. CARREGAR E RENDERIZAR CLASSES
        if (window.cacheClasses.length === 0) {
            try {
                const snapCl = await window.ClubeDB.textoDB.collection("classes").get();
                if (!snapCl.empty) {
                    window.cacheClasses = snapCl.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
                } else {
                    window.cacheClasses = typeof listaClassesParaImportar !== "undefined" ? 
                        listaClassesParaImportar.map(c => ({ ...c, id: String(c.id) })) : (typeof fallbackClasses !== 'undefined' ? fallbackClasses : []);
                }
            } catch {
                window.cacheClasses = typeof listaClassesParaImportar !== "undefined" ? 
                    listaClassesParaImportar.map(c => ({ ...c, id: String(c.id) })) : (typeof fallbackClasses !== 'undefined' ? fallbackClasses : []);
            }
        }
        renderizarCatalogoClasses(window.cacheClasses);
        await carregarClassesEmAndamento();

    } catch (erro) {
        console.error("Erro geral de carregamento:", erro);
    }
}


// ==========================================
// CONTROLE DE VISIBILIDADE DOS CATÁLOGOS
// ==========================================
function abrirCatalogoEspecialidades() {
    document.getElementById("tela-especialidades-andamento").style.display = "none";
    document.getElementById("tela-especialidades-catalogo").style.display = "block";
    document.getElementById("busca-especialidade").value = "";
    renderizarCatalogoEspecialidades(window.cacheEspecialidades);
}
function fecharCatalogoEspecialidades() {
    document.getElementById("tela-especialidades-catalogo").style.display = "none";
    document.getElementById("tela-especialidades-andamento").style.display = "block";
}

function abrirCatalogoMestrados() {
    document.getElementById("tela-especialidades-andamento").style.display = "none";
    document.getElementById("tela-mestrados-catalogo").style.display = "block";
    document.getElementById("busca-mestrado").value = "";
    renderizarCatalogoMestrados(window.cacheMestrados);
}
function fecharCatalogoMestrados() {
    document.getElementById("tela-mestrados-catalogo").style.display = "none";
    document.getElementById("tela-especialidades-andamento").style.display = "block";
}

function abrirCatalogoClasses() {
    document.getElementById("tela-especialidades-andamento").style.display = "none";
    document.getElementById("tela-classes-catalogo").style.display = "block";
    document.getElementById("busca-classe").value = "";
    renderizarCatalogoClasses(window.cacheClasses);
}
function fecharCatalogoClasses() {
    document.getElementById("tela-classes-catalogo").style.display = "none";
    document.getElementById("tela-especialidades-andamento").style.display = "block";
}


// ==========================================
// MECANISMO DE BUSCA LOCAL
// ==========================================
function pesquisarEspecialidadeLocal() {
    const termo = normalizarTextoBusca(document.getElementById("busca-especialidade").value);
    const filtrados = window.cacheEspecialidades.filter(e => 
        normalizarTextoBusca(e.nome).includes(termo) || normalizarTextoBusca(e.categoria || e.area).includes(termo)
    );
    renderizarCatalogoEspecialidades(filtrados);
}

function pesquisarMestradoLocal() {
    const termo = normalizarTextoBusca(document.getElementById("busca-mestrado").value);
    const filtrados = window.cacheMestrados.filter(m => 
        normalizarTextoBusca(m.nome).includes(termo) || normalizarTextoBusca(m.categoria || m.area).includes(termo)
    );
    renderizarCatalogoMestrados(filtrados);
}

function pesquisarClasseLocal() {
    const termo = normalizarTextoBusca(document.getElementById("busca-classe").value);
    const filtrados = window.cacheClasses.filter(c => 
        normalizarTextoBusca(c.nome).includes(termo) || normalizarTextoBusca(c.categoria).includes(termo)
    );
    renderizarCatalogoClasses(filtrados);
}


// ==========================================
// RENDERIZAÇÃO DOS CATÁLOGOS (AGRUPADOS)
// ==========================================
function renderizarCatalogoEspecialidades(lista) {
    const container = document.getElementById("lista-especialidades-container");
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = "<p style='color:8e8e8e;text-align:center;'>Nenhum resultado.</p>"; return; }

    const categorias = {};
    lista.forEach(item => {
        const cat = item.categoria || item.area || "Geral";
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(item);
    });

    container.innerHTML = Object.entries(categorias).map(([cat, itens]) => `
        <div>
            <h4 style="color:#007bff; font-size:12px; margin-bottom:8px; border-left:3px solid #007bff; padding-left:6px; text-transform:uppercase;">${cat}</h4>
            <div style="display:grid; gap:8px;">
                ${itens.map(e => `
                    <div style="background:#121212; border:1px solid #262626; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                            <img src="${e.urlImagem || e.logo || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                            <div style="min-width:0; flex:1;"><div style="font-weight:bold; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.nome}</div></div>
                        </div>
                        <button onclick="solicitarInicioEspecialidade('${e.id}', '${e.nome}')" style="flex-shrink:0; width:max-content; padding:6px 10px; background:#007bff; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">Começar</button>
                    </div>
                `).join("")}
            </div>
        </div>
    `).join("");
}

function renderizarCatalogoMestrados(lista) {
    const container = document.getElementById("lista-mestrados-container");
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = "<p style='color:8e8e8e;text-align:center;'>Nenhum resultado.</p>"; return; }

    const categorias = {};
    lista.forEach(item => {
        const cat = item.categoria || item.area || "Mestrado";
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(item);
    });

    container.innerHTML = Object.entries(categorias).map(([cat, itens]) => `
        <div>
            <h4 style="color:#28a745; font-size:12px; margin-bottom:8px; border-left:3px solid #28a745; padding-left:6px; text-transform:uppercase;">${cat}</h4>
            <div style="display:grid; gap:8px;">
                ${itens.map(m => `
                    <div style="background:#121212; border:1px solid #262626; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                            <img src="${m.urlImagem || m.logo || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                            <div style="min-width:0; flex:1;"><div style="font-weight:bold; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.nome}</div></div>
                        </div>
                        <button onclick="solicitarInicioMestrado('${m.id}', '${m.nome}')" style="flex-shrink:0; width:max-content; padding:6px 10px; background:#28a745; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">Começar</button>
                    </div>
                `).join("")}
            </div>
        </div>
    `).join("");
}

function renderizarCatalogoClasses(lista) {
    const container = document.getElementById("lista-classes-container");
    if (!container) return;
    if (lista.length === 0) { container.innerHTML = "<p style='color:8e8e8e;text-align:center;'>Nenhum resultado.</p>"; return; }

    const categorias = {};
    lista.forEach(item => {
        const cat = item.categoria || "Classe";
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(item);
    });

    container.innerHTML = Object.entries(categorias).map(([cat, itens]) => `
        <div>
            <h4 style="color:#ffc107; font-size:12px; margin-bottom:8px; border-left:3px solid #ffc107; padding-left:6px; text-transform:uppercase;">${cat}</h4>
            <div style="display:grid; gap:8px;">
                ${itens.map(c => `
                    <div style="background:#121212; border:1px solid #262626; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                            <img src="${c.urlImagem || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" onerror="this.src='https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                            <div style="min-width:0; flex:1;"><div style="font-weight:bold; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.nome}</div></div>
                        </div>
                        <button onclick="solicitarInicioClasse('${c.id}', '${c.nome}')" style="flex-shrink:0; width:max-content; padding:6px 10px; background:#ffc107; color:#121212; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">Começar</button>
                    </div>
                `).join("")}
            </div>
        </div>
    `).join("");
}


// ==========================================
// SALVAR NO FIRESTORE (AÇÃO "COMEÇAR")
// ==========================================
async function solicitarInicioEspecialidade(id, nome) {
    const username = localStorage.getItem("usernameLogado");
    if (!username) return alert("Por favor, faça login para iniciar.");

    // Busca a especialidade no cache para pegar os requisitos
    const especialidade = window.cacheEspecialidades.find(e => e.id === id);
    const requisitos = especialidade?.requisitos || ["Requisito 1 (Padrão)", "Requisito 2 (Padrão)"];

    // Cria o modal de checklist dinamicamente
    const modalChecklist = document.createElement("div");
    modalChecklist.id = "modal-checklist";
    modalChecklist.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; padding:20px; box-sizing:border-box; overflow-y:auto; color:#fff;";
    
    modalChecklist.innerHTML = `
        <h3>Checklist: ${nome}</h3>
        <div id="lista-requisitos" style="margin: 20px 0;">
            ${requisitos.map((req, i) => `
                <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
                    <input type="checkbox" class="req-check" style="width:20px; height:20px;"> ${req}
                </label>
            `).join("")}
        </div>
        <button id="btn-finalizar-checklist" disabled style="width:100%; padding:12px; background:#444; color:#fff; border:none; border-radius:8px; font-weight:bold;">Enviar para Avaliação</button>
        <button onclick="this.parentElement.remove()" style="width:100%; padding:10px; background:none; border:1px solid #444; color:#8e8e8e; margin-top:10px;">Cancelar</button>
    `;

    document.body.appendChild(modalChecklist);

    // Lógica do botão ativado
    const checks = modalChecklist.querySelectorAll(".req-check");
    const btnFinal = modalChecklist.querySelector("#btn-finalizar-checklist");
    
    checks.forEach(c => c.onchange = () => {
        const todosMarcados = Array.from(checks).every(i => i.checked);
        btnFinal.disabled = !todosMarcados;
        btnFinal.style.background = todosMarcados ? "#28a745" : "#444";
    });

    btnFinal.onclick = async () => {
        try {
            await window.ClubeDB.textoDB.collection("progresso_especialidades").doc(`${username}_${id}`).set({
                usuario: username,
                itemId: id,
                nome: nome,
                status: "em_andamento",
                requisitosConcluidos: true
            });
            alert(`Checklist de "${nome}" concluída! Enviando para avaliação...`);
            solicitarAprovacao('progresso_especialidades', id, nome, carregarEspecialidadesEmAndamento);
            modalChecklist.remove();
            fecharCatalogoEspecialidades();
        } catch (e) {
            alert("Erro ao salvar progresso.");
        }
    };
}

async function solicitarInicioMestrado(id, nome) {
    const username = localStorage.getItem("usernameLogado");
    if (!username) return alert("Por favor, faça login para iniciar.");

    try {
        await window.ClubeDB.textoDB.collection("progresso_mestrados").doc(`${username}_${id}`).set({
            usuario: username,
            itemId: id,
            nome: nome,
            status: "em_andamento"
        });
        alert(`Mestrado "${nome}" iniciado com sucesso!`);
        fecharCatalogoMestrados();
        carregarMestradosEmAndamento();
    } catch (e) {
        console.error("Erro ao iniciar mestrado:", e);
        alert("Ocorreu um erro ao salvar o progresso.");
    }
}

async function solicitarInicioClasse(id, nome) {
    const username = localStorage.getItem("usernameLogado");
    if (!username) return alert("Por favor, faça login para iniciar.");

    try {
        await window.ClubeDB.textoDB.collection("progresso_classes").doc(`${username}_${id}`).set({
            usuario: username,
            itemId: id,
            nome: nome,
            status: "em_andamento"
        });
        alert(`Classe "${nome}" iniciada com sucesso!`);
        fecharCatalogoClasses();
        carregarClassesEmAndamento();
    } catch (e) {
        console.error("Erro ao iniciar classe:", e);
        alert("Ocorreu um erro ao salvar o progresso.");
    }
}


// ==========================================
// LEITURA DO FIRESTORE (CARREGAR "EM ANDAMENTO")
// ==========================================
async function carregarEspecialidadesEmAndamento() {
    const container = document.getElementById("lista-especialidades-progresso-container");
    if (!container) return;
    const username = localStorage.getItem("usernameLogado");

    try {
        const snap = await window.ClubeDB.textoDB.collection("progresso_especialidades")
            .where("usuario", "==", username)
            .where("status", "==", "em_andamento").get();

        if (snap.empty) {
            container.innerHTML = `<p style="color:#8e8e8e; text-align:center; font-size:12px;">Você não tem especialidades ativas.</p>`;
            return;
        }

        const itens = snap.docs.map(doc => doc.data());
        container.innerHTML = itens.map(item => {
            const original = window.cacheEspecialidades.find(x => x.id === item.itemId) || {};
            return `
                <div style="background:#121212; border:1px solid #262626; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                        <img src="${original.urlImagem || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                        <div style="min-width:0; flex:1;">
                            <div style="font-weight:bold; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.nome}</div>
                            <div style="font-size:11px; color:#007bff; font-weight:bold;">Em Andamento</div>
                        </div>
                    </div>
                    <button onclick="solicitarAprovacao('progresso_especialidades', '${item.itemId}', '${item.nome}', carregarEspecialidadesEmAndamento)" style="flex-shrink:0; width:max-content; padding:6px 10px; background:#28a745; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">Avaliar</button>
                </div>
            `;
        }).join("");
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="color:#ff4d4d; text-align:center; font-size:11px;">Erro de carregamento.</p>`;
    }
}

async function carregarMestradosEmAndamento() {
    const container = document.getElementById("lista-mestrados-progresso-container");
    if (!container) return;
    const username = localStorage.getItem("usernameLogado");

    try {
        const snap = await window.ClubeDB.textoDB.collection("progresso_mestrados")
            .where("usuario", "==", username)
            .where("status", "==", "em_andamento").get();

        if (snap.empty) {
            container.innerHTML = `<p style="color:#8e8e8e; text-align:center; font-size:12px;">Você não tem mestrados ativos.</p>`;
            return;
        }

        const itens = snap.docs.map(doc => doc.data());
        container.innerHTML = itens.map(item => {
            const original = window.cacheMestrados.find(x => x.id === item.itemId) || {};
            return `
                <div style="background:#121212; border:1px solid #262626; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                        <img src="${original.urlImagem || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                        <div style="min-width:0; flex:1;">
                            <div style="font-weight:bold; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.nome}</div>
                            <div style="font-size:11px; color:#28a745; font-weight:bold;">Em Andamento</div>
                        </div>
                    </div>
                    <button onclick="solicitarAprovacao('progresso_mestrados', '${item.itemId}', '${item.nome}', carregarMestradosEmAndamento)" style="flex-shrink:0; width:max-content; padding:6px 10px; background:#28a745; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">Avaliar</button>
                </div>
            `;
        }).join("");
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="color:#ff4d4d; text-align:center; font-size:11px;">Erro de carregamento.</p>`;
    }
}

async function carregarClassesEmAndamento() {
    const container = document.getElementById("lista-classes-progresso-container");
    if (!container) return;
    const username = localStorage.getItem("usernameLogado");

    try {
        const snap = await window.ClubeDB.textoDB.collection("progresso_classes")
            .where("usuario", "==", username)
            .where("status", "==", "em_andamento").get();

        if (snap.empty) {
            container.innerHTML = `<p style="color:#8e8e8e; text-align:center; font-size:12px;">Você não tem classes ativas.</p>`;
            return;
        }

        const itens = snap.docs.map(doc => doc.data());
        container.innerHTML = itens.map(item => {
            const original = window.cacheClasses.find(x => x.id === item.itemId) || {};
            return `
                <div style="background:#121212; border:1px solid #262626; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                        <img src="${original.urlImagem || 'https://res.cloudinary.com/dkozbm1ik/image/upload/v1720640000/avatar-padrao.png'}" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0;">
                        <div style="min-width:0; flex:1;">
                            <div style="font-weight:bold; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.nome}</div>
                            <div style="font-size:11px; color:#ffc107; font-weight:bold;">Em Andamento</div>
                        </div>
                    </div>
                    <button onclick="solicitarAprovacao('progresso_classes', '${item.itemId}', '${item.nome}', carregarClassesEmAndamento)" style="flex-shrink:0; width:max-content; padding:6px 10px; background:#ffc107; color:#121212; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">Avaliar</button>
                </div>
            `;
        }).join("");
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="color:#ff4d4d; text-align:center; font-size:11px;">Erro de carregamento.</p>`;
    }
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

async function carregarPendenciasAprovacaoAdmin() {
    const container = document.getElementById("lista-aprovacoes-render");
    if (!container) return;
    
    container.innerHTML = "<p style='color: #aaa; text-align: center; font-size: 13px;'>Buscando solicitações...</p>";
    
    try {
        const snapshot = await window.ClubeDB.textoDB.collection("pendencias_aprovacao").where("status", "==", "pendente").get();
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: #8e8e8e;">
                    <div style="font-size: 28px; margin-bottom: 8px;">🎉</div>
                    <div style="font-weight: bold; color: #fff; font-size: 14px;">Tudo limpo por aqui!</div>
                    Nenhuma solicitação pendente no momento.
                </div>`;
            return;
        }
        
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const p = doc.data();
            const id = doc.id;
            
            let badgeCor = "#007bff";
            let icone = "🎯";
            let rotulo = "Especialidade";
            
            if (p.colecaoOrigem === "progresso_mestrados") {
                badgeCor = "#28a745";
                icone = "🏆";
                rotulo = "Mestrado";
            } else if (p.colecaoOrigem === "progresso_classes") {
                badgeCor = "#ffc107";
                icone = "🎒";
                rotulo = "Classe";
            }
            
            container.innerHTML += `
                <div style="background: #121212; border: 1px solid #262626; padding: 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-weight: bold; color: #fff; font-size: 14px; word-break: break-word;">${p.nomeItem}</div>
                            <div style="font-size: 12px; color: #a8a8a8; margin-top: 4px;">Membro: <span style="color: #0095f6; font-weight: 600;">@${p.usuario}</span></div>
                        </div>
                        <span style="background: ${badgeCor}; color: ${p.colecaoOrigem === 'progresso_classes' ? '#121212' : '#fff'}; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;">
                            ${icone} ${rotulo}
                        </span>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 4px;">
                        <button onclick="processarAprovacaoAdmin('${id}', true)" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; transition: filter 0.2s;">Conceder</button>
                        <button onclick="processarAprovacaoAdmin('${id}', false)" style="flex: 1; padding: 10px; background: #ff4d4d; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; transition: filter 0.2s;">Recusar</button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erro ao processar solicitações pendentes:", error);
        container.innerHTML = "<p style='color: #ff4d4d; text-align: center; font-size: 12px;'>Falha ao carregar aprovações do banco.</p>";
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
                nome: dadosPendencia.nomeItem,
                status: "em_andamento"
            });
            alert("Solicitação recusada. O item retornou ao progresso do desbravador.");
        }
        
        // Deleta o registro de pendência
        await docRef.delete();
        carregarPendenciasAprovacaoAdmin();
        
    } catch (e) {
        console.error("Erro crítico ao processar ação:", e);
        alert("Erro operacional ao atualizar registros: " + e.message);
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