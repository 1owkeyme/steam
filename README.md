## Где-что находится

- _./src/lib_ - логика парсинга и query-building'a
- _./docker-compose.infrastructure.yml_ - compose инфраструктуры (postgres + grafana)
- _./migrations_ - миграции схемы данных

## Как запускать

1) `bun i`
2) `bun run prepare`
3) `tsx ./src/lib/file_to_execute.ts`