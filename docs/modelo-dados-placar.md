# Modelo de dados do placar

A tabela DynamoDB usa `pk` e `sk`. Resultados de versões ou modos diferentes nunca compartilham a mesma partição de ranking.

| Entidade | `pk` | `sk` | Persistência |
|---|---|---|---|
| Run ativa | `RUN#<runId>` | `META` | TTL de 24 h; removida em abandono e na derrota do multiplayer (a derrota solo mantém a run para recomeçar do checkpoint) |
| Run vencedora | `RUN#<runId>` | `META` | Permanente, com início/fim do servidor e detalhamento |
| Melhor resultado | `LEADERBOARD#<mode>#V<version>` | `PLAYER#<sub>` | Um item por jogador |

A atualização do melhor resultado é condicional: aceita pontuação maior ou, em empate, tempo menor. A consulta ordena por pontuação decrescente, tempo crescente e data de conclusão crescente.

A fórmula de pontuação v2 armazena `dungeonsCompleted` na run vencedora e
`dungeonPoints` no detalhamento calculado pela Lambda. Cada conclusão vale 1.000
pontos, limitada às duas dungeons disponíveis na campanha.

A fórmula v3 soma `arcadePoints`: 5.000 pontos quando `arcadeWon` é verdadeiro (vitória no
fliperama CAIXOTES do Mercado Público). O cliente também envia `pausedMs`, o tempo passado no
fliperama, e a Lambda desconta esse valor do tempo da run, com teto de 360.000 ms (duas tentativas
de três minutos). Os dois campos são declarados pelo cliente, como as mortes e as dungeons.

A fórmula v4 soma `topazPoints`: 2.000 pontos quando `topazAllCollected` é verdadeiro (o jogador
pegou os 14 topázios que o Golem de Topázio derruba no TICEN). Também é declarado pelo cliente.
