# Hashnode Platform

A Pure MERN blogging platform for publishing and discovering developer articles.

## Features

- JWT and bcrypt authentication
- Draft and published articles with ownership protection
- Public feed, title search, tags, pagination, and Markdown code highlighting
- Public profiles, reactions, comments, bookmarks, and follows
- Dashboard, editor, settings, and light/dark/system themes

## Architecture

- `server/`: Node.js, Express, Mongoose, and MongoDB API
- `client/`: React and Vite single-page application
- `server/models/`: MongoDB data models
- `server/controllers/` and `server/routes/`: API behavior and routing
- `client/src/`: pages, components, context, and the shared Axios client

## Local setup

Requirements: Node.js 20+, npm, and MongoDB.

1. Copy `server/.env.example` to `server/.env` and set local values.
2. Copy `client/.env.example` to `client/.env` if the API is not at `http://localhost:5000`.
3. Install dependencies:

```bash
cd server && npm ci
cd ../client && npm ci
```

Run the API and frontend in separate terminals:

```bash
cd server
npm start
```

```bash
cd client
npm run dev
```

The API listens on `PORT` (default `5000`) and the Vite development server defaults to `5173`.

## Environment variables

### Backend (`server/.env`)

- `PORT`: HTTP port, normally supplied by the hosting platform
- `MONGO_URI`: MongoDB connection string; use a separate database for tests
- `JWT_SECRET`: long, random secret used to sign authentication tokens
- `CORS_ORIGIN`: comma-separated allowed frontend origins, such as `https://app.example.com`

### Frontend (`client/.env`)

- `VITE_API_URL`: public base URL of the deployed backend API, without a trailing route

Never commit `.env` files, credentials, JWT secrets, or database connection strings containing credentials.

## Testing and builds

Backend tests use an isolated database configured by `MONGO_TEST_URI` when provided, otherwise `mongodb://127.0.0.1:27017/hashnode_test`:

```bash
cd server
npm test
```

Check backend syntax:

```bash
cd server
find . -path './node_modules' -prune -o -path './test' -prune -o -name '*.js' -print0 | xargs -0 -n1 node --check
```

Build the frontend for production:

```bash
cd client
npm run build
```

The production frontend output is `client/dist`. The backend production start command is `npm start`.

## API overview

- `GET /api/health`
- `/api/auth`: registration, login, and current-user session
- `/api/posts`: owned post CRUD, public feed, articles, reactions, bookmarks, and comments
- `/api/tags`: public tags and authenticated tag creation
- `/api/users`: profiles, settings, bookmarks, and follow relationships

## Deployment configuration

Use a standard frontend host for the built `client/dist` directory and a backend host that runs `npm start` from `server/`.

Configure `VITE_API_URL` to the backend's HTTPS URL. Configure backend `PORT`, `MONGO_URI`, `JWT_SECRET`, and `CORS_ORIGIN` in the hosting provider's secret/environment settings. MongoDB must be reachable from the backend host and should use network allowlisting, TLS, and a least-privilege database user.

No provider, deployed URL, or infrastructure is assumed by this repository.
