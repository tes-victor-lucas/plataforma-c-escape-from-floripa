# Backend de pontuação

API serverless em Python para o placar do **Escape from Floripa**. O API Gateway HTTP API chama uma Lambda e os dados ficam em uma única tabela DynamoDB.

## Endpoints

- `POST /runs`: cria o relógio autoritativo da run no backend.
- `POST /runs/{runId}/victory`: encerra uma vitória, calcula a pontuação e atualiza o melhor resultado.
- `DELETE /runs/{runId}`: remove uma run ativa abandonada ou derrotada.
- `GET /leaderboard?mode=SINGLE_PLAYER&scoreVersion=1`: retorna o ranking ordenado.

O frontend usa o endereço exportado pelo Pulumi como `ESCAPE_FROM_FLORIPA_CONFIG.scoreApiUrl`. Runs ativas têm TTL de 24 horas. O registro vira permanente somente após uma vitória. Em produção, configure `pulumi config set requireAuthentication true`; os endpoints de escrita passam a exigir o JWT do Cognito e a Lambda usa `sub` como identidade.

## Testes

```bash
cd backend
python -m unittest discover -s tests
```
