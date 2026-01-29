# Monorepo: FastAPI + React + Docker Compose

## Требования
- Docker + Docker Compose plugin

## Быстрый старт (Docker)
1) Скопируй пример переменных:
   - Windows: `copy .env.example .env`
   - macOS/Linux: `cp .env.example .env`
2) Запусти:
   - `docker compose up --build`

После запуска:
- Backend: http://localhost:8000/health
- Frontend: http://localhost:5173

## Переменные окружения
Файл `.env` лежит в корне проекта и используется для локального запуска.
Docker Compose читает `.env`, но для контейнера `backend` хост БД жёстко задан как `db`.

Обязательные:
- `DB_HOST` — хост базы (локально ставь `127.0.0.1`, внутри Docker для backend используется `db`)
- `DB_PORT` — порт БД (по умолчанию 5432)
- `DB_NAME` — имя базы
- `DB_USER` — пользователь
- `DB_PASSWORD` — пароль

Опциональные:
- `BACKEND_PORT` — порт на хосте для API (по умолчанию 8000)
- `FRONTEND_PORT` — порт на хосте для фронта (по умолчанию 5173)

## Миграции
Контейнер `backend` при старте выполняет:
- `alembic upgrade head`

Чтобы создать новую миграцию локально:
```
cd backend
uv run alembic revision --autogenerate -m "add something"
```

## Локальная разработка без Docker
### Backend (FastAPI + uv)
```
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### База в Docker (удобно для локального бэка)
Можно поднять только Postgres и подключаться к нему из локального Python:
```
docker compose up -d db
```
Порт БД проброшен по умолчанию (`5432:5432`), поэтому локально используй
`DB_HOST=127.0.0.1` в `.env`.

### Frontend (React + Vite)
```
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### Фронтенд + API/DB в фоне (удобно, если бэк не меняется)
Можно держать БД и API в Docker, а фронт развивать локально:
```
docker compose up -d db backend
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
API будет доступен на `http://localhost:8000`, фронт — на `http://localhost:5173`.

### Совместная локальная разработка (рекомендуется)
1) Поднять БД:
   - `docker compose up -d db`
2) Запустить backend:
   - `cd backend`
   - `uv sync`
   - `uv run alembic upgrade head`
   - `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3) Запустить frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev -- --host 0.0.0.0 --port 5173`

### Если нужен прокси API в Vite
Добавь в `frontend/vite.config.js`:
```
server: {
  host: true,
  port: 5173,
  proxy: {
    "/api": "http://localhost:8000",
  },
}
```
