Gestão de Frequência Acadêmica

Aplicação web front-end (SPA) desenvolvida para o gerenciamento de chamadas, controle de presença acadêmica e fluxo de justificativas de faltas, utilizando HTML5, CSS3, JavaScript (ES6+), Bootstrap 5 e LocalStorage.

Sobre o Projeto

O sistema de Gestão de Frequência Acadêmica centraliza a rotina de acompanhamento de frequência entre coordenação, professores e alunos. A plataforma permite cadastrar turmas, alunos e disciplinas, registrar diários de classe diários, calcular automaticamente percentuais de presença e gerenciar solicitações de justificativa com controle de prazos e sistema de créditos.

Nota: Este é um protótipo acadêmico demonstrativo. Todos os dados são fictícios e armazenados localmente no navegador do usuário via localStorage.

Funcionalidades Principais

Painel Geral (Dashboard)

Indicadores rápidos (KPIs): total de alunos matriculados, frequência geral da instituição, justificativas pendentes e alunos em estado de atenção (frequência abaixo de 75%).

Gráficos de barra com o percentual de frequência por disciplina.

Fila rápida para análise de justificativas pendentes.

CRUD Completo com Integridade Referencial

Turmas: Cadastro de turmas, turnos e semestres letivos.

Alunos: Gestão de matrículas, e-mails e vinculação a turmas (com bloqueio de exclusão caso haja histórico de chamada).

Disciplinas: Associação de professores, turmas e definição do prazo (em dias corridos) para envio de justificativas.

Diário de Frequência (Chamadas): Registro de aulas por data e conteúdo ministrado, com marcação individual ou em lote ("Marcar todos presentes").

Fluxo de Justificativas e Créditos

Justificativa Pessoal: Reserva 1 dos 6 créditos disponíveis por aluno até o parecer do professor (devolvido em caso de recusa).

Justificativa Documentada: Não consome créditos e permite anexar comprovantes em imagem (PNG, JPG ou WebP de até 400 KB) salvos em Base64.

Validação de Prazos: Bloqueio automático de solicitações fora do prazo estipulado pela disciplina.

Relatórios e Exportação

Tabela consolidada de aulas, presenças, faltas e situação por aluno e disciplina.

Exportação dos dados em formato CSV (compatível com Excel/UTF-8) e layout otimizado para impressão / PDF.

Estrutura de Arquivos

Frequencia-Academica/
├── LEIA-ME.md          # Documentação auxiliar do pacote
└── dist/
    ├── index.html      # Estrutura principal da SPA, imports do Bootstrap e modal nativo
    ├── styles.css      # Identidade visual customizada (tema Unex), responsividade e regras de impressão
    ├── core.js         # Módulo de regras de negócio puras, cálculos de frequência, prazos e seed
    └── app.js          # Controlador de interface, roteamento via #hash, CRUD e persistência no localStorage


Tecnologias Utilizadas

HTML5 Semântico: Estrutura acessível com uso do elemento nativo <dialog> para janelas modais.

CSS3: Variáveis CSS, Grid Layout, Flexbox, Media Queries para responsividade e @media print.

Bootstrap 5: Grid responsivo, tabelas, formulários, botões e alertas.

JavaScript Vanilla (ES6+): Arquitetura modular separando regras de negócio em core.js e manipulação de DOM em app.js.

Web Storage API (localStorage): Persistência local com tratamento de cota e rollback automático em caso de erro.

Como Executar

Por ser uma aplicação front-end estática sem dependências de compilação (build), basta seguir os passos abaixo:

Faça o download ou clone este repositório.

Acesse a pasta dist/ (ou a raiz do projeto, caso os arquivos estejam na pasta principal).

Abra o arquivo index.html diretamente em qualquer navegador moderno (Chrome, Edge, Firefox ou Safari).

Opcional: Caso utilize o VS Code, você pode rodar o projeto através da extensão Live Server.

Restaurar Dados: Caso queira reiniciar os registros de teste a qualquer momento, clique no botão "Restaurar demonstração" no rodapé do menu lateral.

Equipe Desenvolvedora

Projeto desenvolvido para a disciplina de Desenvolvimento Front-End (Curso de Sistemas de Informação):

Alexandre Bernades Queiroz

André Gustavo de Jesus Tavares

Kauan Soares Moura

Luis Henrique Gonçalves Araújo
