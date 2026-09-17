# Requisitos

Este documento descreve os requisitos do MVP de **Plataforma C: Escape from Floripa**.

## Requisitos funcionais

- **RF01:** O sistema deve apresentar uma tela inicial que permita iniciar uma nova partida.
- **RF02:** O jogador deve poder controlar livremente a movimentação do personagem em visão top-down.
- **RF03:** O personagem deve realizar ataques automaticamente conforme a arma ou habilidade equipada.
- **RF04:** O sistema deve disponibilizar de duas a três armas no MVP.
- **RF05:** O sistema deve conter inimigos comuns com comportamentos de movimentação, ataque, dano e morte.
- **RF06:** Os inimigos da sala ativa devem atacar o jogador durante o combate.
- **RF07:** O sistema deve controlar a vida do jogador, dos inimigos e aplicar dano durante os ataques.
- **RF08:** Ao finalizar uma sala, o jogador deve receber três opções de cartas de melhoria e escolher uma delas.
- **RF09:** A melhoria escolhida deve ser adicionada à build do personagem e alterar seus atributos ou ataques.
- **RF10:** O jogo deve ser composto por cinco a oito salas criadas manualmente, com ordem parcialmente variável entre partidas.
- **RF11:** O sistema deve exibir recompensas e conduzir o jogador à próxima sala após a conclusão do combate.
- **RF12:** Ao final da área, o jogador deve enfrentar um chefe com ataques diferentes dos inimigos comuns.
- **RF13:** Ao derrotar o chefe e chegar à Plataforma C, o sistema deve exibir a tela de vitória.
- **RF14:** Quando a vida do jogador chegar a zero, o sistema deve encerrar a run, remover a build e as melhorias obtidas e exibir a tela de derrota, sem persistir esses elementos para partidas futuras.
- **RF15:** O sistema deve permitir reiniciar uma partida após a derrota.
- **RF16:** Durante a partida, a interface deve exibir ao menos a barra de vida, indicadores de armas/habilidades e a tela de escolha de melhorias.
- **RF17:** O sistema deve oferecer um menu de pausa durante a partida.

## Requisitos funcionais obrigatórios de plataforma

- **RF18:** O sistema deve ser uma aplicação cliente-servidor sobre plataforma Web.
- **RF19:** O sistema deve ter uma aplicação a ser executada no navegador do cliente, o *frontend*, cujo código deve ser descarregado sob demanda.
- **RF20:** O sistema deve ter uma aplicação na nuvem, o *backend*, para atender às requisições do *frontend*.
- **RF21:** O sistema deve ter documentação de API RESTful para comunicação entre *frontend* e *backend*.
- **RF22:** O sistema deve ter acesso controlado por esquema de autenticação e autorização via provedores externos, como Google, Apple ou outros.
- **RF23:** O sistema deve possuir persistência de dados de usuários em banco de dados, incluindo os tempos das runs concluídas com vitória necessários para o placar de líderes.
- **RF24:** O sistema deve ter documentação de modelagem de dados e de arquitetura do sistema.
- **RF25:** O sistema deve ser capaz de enviar e-mails e notificações para os usuários.
- **RF26:** O sistema deve registrar todas as operações críticas dos usuários para posterior análise.
- **RF27:** O sistema deve possuir cenários de desenvolvimento e de produção.
- **RF28:** O sistema deve ser implantado na AWS com o uso de infraestrutura como código (IaC), priorizando os recursos abordados no curso AWS Foundations.
- **RF29:** O sistema deve ser implantado automaticamente em ambiente de produção com o uso de integração e entrega contínuas (CI/CD).
- **RF30:** O sistema deve cronometrar cada run e registrar o tempo das runs concluídas com vitória no placar de líderes, associando-o ao usuário autenticado e ordenando o ranking em ordem crescente de tempo.

## Requisitos não funcionais

A aplicação será publicada em nuvem utilizando recursos da AWS.

- **RNF01:** O sistema deve ter boa responsividade para as interações realizadas pelo usuário.
- **RNF02:** O sistema deve operar com baixa latência.
- **RNF03:** O sistema deve operar com o menor custo possível, sem comprometer os requisitos definidos.
- **RNF04:** O sistema deve proteger os dados dos usuários em trânsito, utilizando conexões seguras via HTTPS.
- **RNF05:** O sistema deve armazenar credenciais e dados sensíveis de forma segura, sem expô-los no código do *frontend* ou em repositórios de código.
- **RNF06:** O sistema deve respeitar as práticas de privacidade aplicáveis, incluindo a proteção dos dados pessoais dos usuários.
- **RNF07:** O sistema deve apresentar mensagens de erro claras e não expor detalhes internos da aplicação ao usuário.
- **RNF08:** O sistema deve funcionar nas versões atuais dos navegadores Google Chrome e Mozilla Firefox.
- **RNF09:** O sistema deve registrar logs de erros, autenticações e operações críticas para facilitar o monitoramento e a investigação de falhas.
- **RNF10:** O sistema deve permitir a realização de cópias de segurança dos dados persistidos e sua recuperação em caso de falha.
- **RNF11:** A aplicação deve ser estruturada de forma modular e documentada para facilitar sua manutenção e evolução.
- **RNF12:** O sistema deve ser capaz de suportar o aumento de usuários sem exigir alterações significativas em sua arquitetura.


