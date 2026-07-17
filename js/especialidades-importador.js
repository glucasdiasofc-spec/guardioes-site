// O código abaixo executa automaticamente ao carregar o site
window.addEventListener('load', async () => {
    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        return console.warn("Aguardando inicialização do Banco de Dados...");
    }
    const db = window.ClubeDB.textoDB;
    const ref = db.collection("especialidades");

    console.log("Verificando necessidade de atualização do catálogo...");
    
    if (typeof listaEspecialidadesParaImportar !== 'undefined') {
        const snapshot = await ref.get();
        const nomesExistentes = snapshot.docs.map(doc => doc.data().nome);

        for (const item of listaEspecialidadesParaImportar) {
            // Só adiciona se o nome da especialidade não existir no banco
            if (!nomesExistentes.includes(item.nome)) {
                try {
                    await ref.add({
                        nome: item.nome,
                        categoria: item.area || item.categoria || "Geral",
                        urlImagem: item.logo || item.urlImagem,
                        descricao: item.descricao || "",
                        requisitos: item.reqs || item.requisitos || [], 
                        criadoEm: new Date()
                    });
                    console.log("Importado com sucesso:", item.nome);
                } catch (e) {
                    console.error("Erro ao importar", item.nome, e);
                }
            }
        }
        console.log("Processo de sincronização de catálogo finalizado.");
    } else {
        console.error("Erro: A variável 'listaEspecialidadesParaImportar' não foi encontrada.");
    }
});
