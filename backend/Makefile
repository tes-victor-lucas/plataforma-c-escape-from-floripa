# Placar rodando localmente: DynamoDB Local no Docker e as Lambdas no `sam local`.
API := http://127.0.0.1:3000

.PHONY: api up wait-table leaderboard stop

## Sobe o banco e a API em http://127.0.0.1:3000 (Ctrl+C para parar a API).
api: up wait-table
	sam local start-api --env-vars env.json --docker-network sam-local

up:
	docker compose up -d

wait-table:
	@echo "Esperando a tabela ser criada..."
	@until docker compose logs create-table 2>/dev/null | grep -q 'TABELA CRIADA'; do sleep 1; done

leaderboard:
	curl -s "$(API)/leaderboard"
	@echo

stop:
	docker compose down
