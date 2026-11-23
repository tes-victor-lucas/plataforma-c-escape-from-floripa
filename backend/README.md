# Backend de pontuação

API serverless em Python para o placar do **Escape from Floripa**. O API Gateway HTTP API chama uma Lambda por rota e os dados ficam em uma única tabela DynamoDB.

## Endpoints

| Rota | Lambda | O que faz |
|---|---|---|
| `POST /runs` | `start_run.py` | Cria o relógio autoritativo da run no backend |
| `POST /runs/{runId}/victory` | `finish_victory.py` | Encerra uma vitória, calcula a pontuação, atualiza o melhor resultado e manda o e-mail |
| `DELETE /runs/{runId}` | `discard_run.py` | Remove uma run ativa abandonada ou derrotada |
| `GET /leaderboard?mode=SINGLE_PLAYER` | `leaderboard.py` | Retorna o ranking ordenado |

`common.py` reúne tabela, identidade, respostas e log de auditoria, e `score.py` tem a fórmula. Cada Lambda é publicada só com o próprio arquivo, `common.py` e `score.py`.

Na fórmula v2, cada dungeon concluída concede 1.000 pontos. O frontend envia a
quantidade de dungeons concluídas e a Lambda recalcula o bônus antes de persistir
uma vitória.

O frontend usa o endereço exportado pelo Pulumi como `ESCAPE_FROM_FLORIPA_CONFIG.scoreApiUrl`. Runs ativas têm TTL de 24 horas. O registro vira permanente somente após uma vitória. Em produção, configure `pulumi config set requireAuthentication true`; os endpoints de escrita passam a exigir o ID token do Google (login do jogo) e a Lambda usa `sub` como identidade e `name` como nome no placar.

## Testes

```bash
python3 -m unittest discover -s backend/tests   # ou, dentro de backend/: -s tests
```
