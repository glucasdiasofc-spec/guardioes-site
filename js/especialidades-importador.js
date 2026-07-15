/**
 * Função para importar as especialidades para o Firestore.
 * Utiliza a variável global listaEspecialidadesParaImportar do arquivo especialidades-dados.js.
 */
async function rodarImportacaoEspecialidades() {
    console.log("Iniciando a importação das especialidades...");
    
    if (typeof listaEspecialidadesParaImportar === 'undefined' || !Array.isArray(listaEspecialidadesParaImportar)) {
        console.error("Erro: A variável 'listaEspecialidadesParaImportar' não foi encontrada ou não é um array.");
        return;
    }

    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        console.error("Erro: 'window.ClubeDB.textoDB' não está configurado.");
        return;
    }

    let sucessos = 0;
    let erros = 0;

    for (const especialidade of listaEspecialidadesParaImportar) {
        try {
            // Utilizando window.ClubeDB.textoDB para adicionar cada item à coleção "especialidades"
            // Assume-se que textoDB.add ou similar seja o método para inserção direta no Firestore
            // Como o prompt pede para iterar e adicionar, faremos a chamada para cada item
            await window.ClubeDB.textoDB("especialidades").add(especialidade);
            console.log(`Sucesso: Especialidade '${especialidade.nome}' importada.`);
            sucessos++;
        } catch (error) {
            console.error(`Erro ao importar '${especialidade.nome}':`, error);
            erros++;
        }
    }

    console.log(`Importação concluída! Sucessos: ${sucessos}, Erros: ${erros}.`);
}
