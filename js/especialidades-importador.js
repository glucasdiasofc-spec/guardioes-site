// O código abaixo executa automaticamente ao carregar o site
window.addEventListener('load', async () => {
    const db = window.ClubeDB.textoDB;
    const ref = db.collection("especialidades");

    // 1. Verifica se já existem especialidades
    const snapshot = await ref.limit(1).get();

    if (snapshot.empty) {
        console.log("Banco vazio detectado. Iniciando carga automática...");
        
        // 2. Tenta importar a lista que está no outro arquivo
        if (typeof listaEspecialidadesParaImportar !== 'undefined') {
            for (const item of listaEspecialidadesParaImportar) {
                try {
                    await ref.add({
                        nome: item.nome,
                        categoria: item.categoria,
                        urlImagem: item.urlImagem,
                        descricao: item.descricao,
                        // Adicionando o campo requisitos para o frontend consumir
                        requisitos: item.requisitos || [], 
                        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (e) {
                    console.error("Erro ao importar", item.nome, e);
                }
            }
            console.log("Importação concluída com sucesso!");
        } else {
            console.error("Erro: A variável 'listaEspecialidadesParaImportar' não foi encontrada.");
        }
    } else {
        console.log("Banco já possui dados. Nenhuma ação necessária.");
    }
});