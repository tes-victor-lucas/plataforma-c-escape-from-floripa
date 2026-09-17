# Casos de Uso — Plataforma C: Escape from Floripa

## 1. Objetivo

Este documento descreve os principais casos de uso do MVP de **Plataforma C: Escape from Floripa**, abrangendo a experiência do jogador e os recursos da plataforma web.

## 2. Atores

| Ator | Descrição |
|---|---|
| Visitante | Pessoa que acessa o jogo sem estar autenticada. |
| Jogador | Usuário autenticado que inicia e conclui partidas. |
| Administrador | Responsável por consultar informações operacionais da aplicação. |
| Provedor de autenticação | Serviço externo utilizado para autenticar usuários, como Google ou Apple. |
| Serviço de notificações | Serviço externo responsável pelo envio de e-mails e notificações. |

## 3. Casos de uso

| Código | Caso de uso | Ator principal |
|---|---|---|
| UC01 | Autenticar jogador | Visitante |
| UC02 | Iniciar nova run | Jogador |
| UC03 | Controlar personagem | Jogador |
| UC04 | Combater inimigos | Jogador |
| UC05 | Escolher melhoria | Jogador |
| UC06 | Pausar partida | Jogador |
| UC07 | Encerrar run por derrota | Sistema |
| UC08 | Reiniciar partida | Jogador |
| UC09 | Enfrentar chefe e vencer a partida | Jogador |
| UC10 | Consultar placar de líderes | Visitante |
| UC11 | Enviar notificações ao jogador | Sistema |
| UC12 | Registrar operação crítica | Sistema |
| UC13 | Consultar registros operacionais | Administrador |

---

## UC01 — Autenticar jogador

**Objetivo:** permitir que um visitante se autentique para registrar vitórias e aparecer no placar de líderes.

**Ator principal:** Visitante.

**Atores secundários:** Provedor de autenticação.

**Pré-condições:**

- O visitante acessou a aplicação web.
- Um provedor de autenticação está configurado.

**Fluxo principal:**

1. O visitante seleciona a opção de entrar.
2. O sistema apresenta os provedores de autenticação disponíveis.
3. O visitante escolhe um provedor.
4. O sistema redireciona o visitante para o provedor escolhido.
5. O visitante informa ou confirma suas credenciais.
6. O provedor valida a identidade do visitante.
7. O sistema cria ou atualiza o perfil do jogador.
8. O sistema inicia a sessão do jogador.
9. O sistema apresenta o menu principal com o jogador autenticado.

**Fluxos alternativos:**

- Se a autenticação for cancelada, o sistema retorna ao menu inicial sem iniciar uma sessão.
- Se o provedor recusar a autenticação, o sistema informa que não foi possível entrar e permite uma nova tentativa.

**Pós-condições:**

- O jogador possui uma sessão autenticada.
- O sistema registra a operação de autenticação.

## UC02 — Iniciar nova run

**Objetivo:** iniciar uma nova partida para o jogador.

**Ator principal:** Jogador.

**Pré-condições:**

- O jogador está no menu principal.
- O jogo foi carregado corretamente no navegador.

**Fluxo principal:**

1. O jogador seleciona a opção de iniciar uma nova run.
2. O sistema cria uma run temporária.
3. O sistema define os atributos iniciais do personagem.
4. O sistema carrega a primeira sala.
5. O sistema inicia o cronômetro da run.
6. O sistema exibe a interface da partida.

**Pós-condições:**

- Uma nova run está em andamento.
- O personagem está posicionado na primeira sala.
- O cronômetro está ativo.

## UC03 — Controlar personagem

**Objetivo:** permitir a movimentação do personagem pelas salas do jogo.

**Ator principal:** Jogador.

**Pré-condições:**

- Existe uma run em andamento.
- O personagem está vivo.
- A partida não está pausada.

**Fluxo principal:**

1. O jogador utiliza as teclas ou controles de movimentação.
2. O sistema identifica a direção desejada.
3. O sistema move o personagem pela sala.
4. O sistema atualiza a animação do personagem.
5. O sistema impede a passagem por paredes e objetos bloqueadores.

**Fluxos alternativos:**

- Se o personagem encontrar um obstáculo, o sistema bloqueia o deslocamento naquela direção.
- Se a partida estiver pausada, o sistema ignora os comandos de movimentação.

**Pós-condições:**

- A posição do personagem é atualizada na sala ativa.

## UC04 — Combater inimigos

**Objetivo:** permitir que o personagem enfrente os inimigos presentes na sala.

**Ator principal:** Jogador.

**Pré-condições:**

- Existe uma run em andamento.
- A sala possui inimigos ativos.
- O personagem está vivo.

**Fluxo principal:**

1. O sistema identifica os inimigos presentes na sala.
2. Os inimigos se movimentam em direção ao personagem conforme seu comportamento.
3. A arma ou habilidade equipada realiza ataques automáticos.
4. O sistema aplica dano aos inimigos atingidos.
5. Os inimigos atacam o personagem quando estiverem em alcance.
6. O sistema atualiza a vida do personagem e dos inimigos.
7. Quando a vida de um inimigo chega a zero, o sistema remove o inimigo da sala.
8. O sistema verifica se ainda existem inimigos ativos.

**Fluxos alternativos:**

- Se a vida do personagem chegar a zero, o sistema executa UC07 — Encerrar run por derrota.
- Se não houver mais inimigos ativos, o sistema executa UC05 — Escolher melhoria.

**Pós-condições:**

- Os inimigos derrotados são removidos.
- A vida dos participantes do combate é atualizada.

## UC05 — Escolher melhoria

**Objetivo:** permitir que o jogador fortaleça a build do personagem após concluir uma sala.

**Ator principal:** Jogador.

**Pré-condições:**

- Todos os inimigos da sala foram derrotados.
- O personagem está vivo.

**Fluxo principal:**

1. O sistema interrompe temporariamente a progressão da partida.
2. O sistema apresenta três cartas de melhoria.
3. O jogador analisa as opções disponíveis.
4. O jogador escolhe uma carta.
5. O sistema adiciona a melhoria à build atual.
6. O sistema atualiza os atributos, armas ou habilidades afetadas.
7. O sistema libera o acesso à próxima sala.

**Fluxos alternativos:**

- Se o jogador ainda não selecionar uma carta, o sistema mantém a tela de escolha aberta.
- Se ocorrer uma falha ao aplicar a melhoria, o sistema informa o erro e permite que o jogador escolha novamente.

**Pós-condições:**

- Uma melhoria foi adicionada à build temporária da run.
- A próxima sala fica disponível.

## UC06 — Pausar partida

**Objetivo:** permitir que o jogador interrompa temporariamente a partida.

**Ator principal:** Jogador.

**Pré-condições:**

- Existe uma run em andamento.
- A partida não está em uma tela de derrota ou vitória.

**Fluxo principal:**

1. O jogador seleciona a opção de pausa.
2. O sistema interrompe a movimentação, ataques e comportamentos dos inimigos.
3. O sistema exibe o menu de pausa.
4. O jogador seleciona a opção de continuar.
5. O sistema fecha o menu de pausa.
6. O sistema retoma a partida.

**Fluxos alternativos:**

- Se o jogador selecionar a opção de retornar ao menu, o sistema encerra a run sem registrar vitória.

**Pós-condições:**

- A partida é retomada ou a run é encerrada.

## UC07 — Encerrar run por derrota

**Objetivo:** encerrar a run quando o personagem perder toda a vida.

**Ator principal:** Sistema.

**Pré-condições:**

- Existe uma run em andamento.
- A vida do personagem chegou a zero.

**Fluxo principal:**

1. O sistema interrompe a partida.
2. O sistema para o cronômetro da run.
3. O sistema descarta a build e as melhorias obtidas na run.
4. O sistema registra a derrota para fins de auditoria.
5. O sistema exibe a tela de derrota.
6. O sistema oferece a opção de reiniciar ou retornar ao menu principal.

**Pós-condições:**

- A run é encerrada.
- Nenhuma melhoria daquela run é preservada para uma próxima partida.

## UC08 — Reiniciar partida

**Objetivo:** permitir que o jogador inicie uma nova run após uma derrota.

**Ator principal:** Jogador.

**Pré-condições:**

- A tela de derrota está sendo exibida.

**Fluxo principal:**

1. O jogador seleciona a opção de reiniciar.
2. O sistema descarta os dados temporários da run anterior.
3. O sistema executa UC02 — Iniciar nova run.

**Pós-condições:**

- Uma nova run é iniciada com atributos iniciais.
- Melhorias da run anterior não são reutilizadas.

## UC09 — Enfrentar chefe e vencer a partida

**Objetivo:** permitir que o jogador conclua uma run ao derrotar o chefe e alcançar a Plataforma C.

**Ator principal:** Jogador.

**Pré-condições:**

- O jogador concluiu as salas anteriores.
- A sala do chefe foi carregada.
- O personagem está vivo.

**Fluxo principal:**

1. O sistema apresenta o chefe da área.
2. O chefe executa comportamentos e ataques próprios.
3. O jogador combate o chefe utilizando sua build atual.
4. O sistema atualiza a vida do chefe e do personagem.
5. Quando a vida do chefe chega a zero, o sistema libera o caminho para a Plataforma C.
6. O jogador alcança a Plataforma C.
7. O sistema para o cronômetro da run.
8. O sistema registra a vitória e o tempo final da run.
9. O sistema atualiza o placar de líderes.
10. O sistema exibe a tela de vitória.

**Fluxos alternativos:**

- Se a vida do personagem chegar a zero, o sistema executa UC07 — Encerrar run por derrota.
- Se o jogador não estiver autenticado, o sistema exibe a vitória, mas solicita autenticação para registrar o resultado no placar.

**Pós-condições:**

- A run é concluída com vitória.
- O tempo da run é associado ao jogador autenticado.
- O ranking é atualizado em ordem crescente de tempo.

## UC10 — Consultar placar de líderes

**Objetivo:** permitir a consulta dos melhores tempos das runs concluídas.

**Ator principal:** Visitante.

**Pré-condições:**

- A aplicação está disponível.

**Fluxo principal:**

1. O visitante acessa a opção de placar de líderes.
2. O sistema consulta as runs concluídas com vitória.
3. O sistema ordena os resultados pelo menor tempo.
4. O sistema exibe a posição, o nome do jogador e o tempo da run.

**Fluxos alternativos:**

- Se não houver runs registradas, o sistema informa que ainda não existem resultados no placar.

**Pós-condições:**

- O visitante visualiza o ranking atualizado.

## UC11 — Enviar notificações ao jogador

**Objetivo:** notificar o jogador sobre eventos relevantes da plataforma.

**Ator principal:** Sistema.

**Atores secundários:** Serviço de notificações.

**Pré-condições:**

- O jogador autorizou o recebimento de notificações, quando aplicável.
- O serviço de notificações está configurado.

**Fluxo principal:**

1. O sistema identifica um evento relevante, como confirmação de cadastro ou registro de vitória.
2. O sistema prepara a mensagem de notificação.
3. O sistema solicita o envio ao serviço de notificações.
4. O serviço entrega a mensagem ao jogador.
5. O sistema registra o resultado do envio.

**Fluxos alternativos:**

- Se o envio falhar, o sistema registra a falha para análise posterior.

**Pós-condições:**

- A notificação é enviada ou a falha é registrada.

## UC12 — Registrar operação crítica

**Objetivo:** manter registros de segurança e rastreabilidade das operações críticas do sistema.

**Ator principal:** Sistema.

**Pré-condições:**

- Uma operação crítica foi executada, como autenticação, registro de vitória ou falha de envio de notificação.

**Fluxo principal:**

1. O sistema identifica a operação crítica.
2. O sistema registra data, horário, tipo de evento e usuário relacionado, quando disponível.
3. O sistema armazena o registro em local seguro.
4. O sistema disponibiliza o registro para consulta administrativa.

**Pós-condições:**

- A operação crítica possui um registro de auditoria.

## UC13 — Consultar registros operacionais

**Objetivo:** permitir que o administrador consulte registros de segurança e operação da aplicação.

**Ator principal:** Administrador.

**Pré-condições:**

- O administrador está autenticado e autorizado.
- Existem registros disponíveis.

**Fluxo principal:**

1. O administrador acessa a área de registros.
2. O sistema valida suas permissões.
3. O administrador seleciona filtros, como período, usuário ou tipo de evento.
4. O sistema consulta os registros compatíveis.
5. O sistema exibe os resultados.

**Fluxos alternativos:**

- Se o usuário não tiver permissão administrativa, o sistema bloqueia o acesso.
- Se não houver registros para os filtros selecionados, o sistema informa que nenhum resultado foi encontrado.

**Pós-condições:**

- O administrador visualiza os registros permitidos conforme suas permissões.

## 4. Rastreabilidade com os requisitos

| Caso de uso | Requisitos relacionados |
|---|---|
| UC01 — Autenticar jogador | RF18, RF19, RF20, RF21, RF22, RF23 |
| UC02 — Iniciar nova run | RF01, RF02, RF10, RF16 |
| UC03 — Controlar personagem | RF02 |
| UC04 — Combater inimigos | RF03, RF04, RF05, RF06, RF07 |
| UC05 — Escolher melhoria | RF08, RF09, RF11, RF16 |
| UC06 — Pausar partida | RF17 |
| UC07 — Encerrar run por derrota | RF14 |
| UC08 — Reiniciar partida | RF15 |
| UC09 — Enfrentar chefe e vencer a partida | RF12, RF13, RF30 |
| UC10 — Consultar placar de líderes | RF23, RF30 |
| UC11 — Enviar notificações ao jogador | RF25 |
| UC12 — Registrar operação crítica | RF26, RNF09 |
| UC13 — Consultar registros operacionais | RF26, RNF09 |
