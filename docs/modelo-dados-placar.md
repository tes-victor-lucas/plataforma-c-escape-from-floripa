# Modelo de dados do placar

A tabela DynamoDB usa `pk` e `sk`. Resultados de versões ou modos diferentes nunca compartilham a mesma partição de ranking.

| Entidade | `pk` | `sk` | Persistência |
|---|---|---|---|
| Run ativa | `RUN#<runId>` | `META` | TTL de 24 h; removida em derrota/abandono |
| Run vencedora | `RUN#<runId>` | `META` | Permanente, com início/fim do servidor e detalhamento |
| Melhor resultado | `LEADERBOARD#<mode>#V<version>` | `PLAYER#<sub>` | Um item por jogador |

A atualização do melhor resultado é condicional: aceita pontuação maior ou, em empate, tempo menor. A consulta ordena por pontuação decrescente, tempo crescente e data de conclusão crescente.

A fórmula de pontuação v2 armazena `dungeonsCompleted` na run vencedora e
`dungeonPoints` no detalhamento calculado pela Lambda. Cada conclusão vale 1.000
pontos, limitada às duas dungeons disponíveis na campanha.
