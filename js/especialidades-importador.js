// O código abaixo executa automaticamente ao carregar o site
window.addEventListener('load', async () => {
    if (!window.ClubeDB || !window.ClubeDB.textoDB) {
        return console.warn(
            "Aguardando inicialização do Banco de Dados..."
        );
    }

    const db = window.ClubeDB.textoDB;

    const ref = db.collection("especialidades");

    const refExcluidas = db.collection(
        "especialidades_excluidas"
    );

    const normalizarNomeEspecialidade = valor =>
        String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

    console.log(
        "Verificando necessidade de atualização do catálogo..."
    );

    if (
        typeof listaEspecialidadesParaImportar ===
        "undefined"
    ) {
        console.error(
            "Erro: A variável 'listaEspecialidadesParaImportar' não foi encontrada."
        );

        return;
    }

    try {
        /*
         * Carrega simultaneamente:
         *
         * 1. As especialidades que existem atualmente.
         * 2. As especialidades que o administrador excluiu.
         */
        const [
            snapshotCatalogo,
            snapshotExcluidas
        ] = await Promise.all([
            ref.get(),
            refExcluidas.get()
        ]);

        const nomesExistentes = new Set(
            snapshotCatalogo.docs
                .map(doc =>
                    normalizarNomeEspecialidade(
                        doc.data().nome
                    )
                )
                .filter(Boolean)
        );

        const nomesExcluidos = new Set(
            snapshotExcluidas.docs
                .map(doc => {
                    const dados = doc.data() || {};

                    return normalizarNomeEspecialidade(
                        dados.nomeNormalizado ||
                        dados.nome
                    );
                })
                .filter(Boolean)
        );

        for (
            const item of listaEspecialidadesParaImportar
        ) {
            const nomeNormalizado =
                normalizarNomeEspecialidade(item.nome);

            if (!nomeNormalizado) {
                continue;
            }

            /*
             * A especialidade continua normalmente dentro do
             * especialidades-dados.js.
             *
             * Porém, se ela estiver registrada na coleção
             * "especialidades_excluidas", não será importada
             * novamente para o catálogo.
             */
            if (nomesExcluidos.has(nomeNormalizado)) {
                console.log(
                    "Especialidade ignorada porque foi excluída pelo administrador:",
                    item.nome
                );

                continue;
            }

            /*
             * Importa somente quando:
             *
             * 1. A especialidade não existe no catálogo.
             * 2. Ela não foi excluída pelo administrador.
             */
            if (!nomesExistentes.has(nomeNormalizado)) {
                await ref.add({
                    nome: item.nome,

                    categoria:
                        item.area ||
                        item.categoria ||
                        "Geral",

                    urlImagem:
                        item.logo ||
                        item.urlImagem ||
                        "",

                    descricao:
                        item.descricao ||
                        "",

                    requisitos:
                        item.reqs ||
                        item.requisitos ||
                        [],

                    origemId: String(
                        item.id || ""
                    ),

                    criadoEm: new Date()
                });

                /*
                 * Atualiza o Set imediatamente para impedir que
                 * especialidades duplicadas sejam importadas
                 * durante a mesma execução.
                 */
                nomesExistentes.add(nomeNormalizado);

                console.log(
                    "Importado com sucesso:",
                    item.nome
                );
            }
        }

        console.log(
            "Processo de sincronização de catálogo finalizado."
        );
    } catch (erro) {
        console.error(
            "Erro durante a sincronização do catálogo de especialidades:",
            erro
        );
    }
});
