# Hashnode Platform

A Pure MERN blogging platform for publishing and discovering developer articles.

## Features

- JWT and bcrypt authentication
- Draft and published articles with ownership protection
- Public feed, title search, tags, pagination, and Markdown code highlighting
- Public profiles, reactions, comments, bookmarks, and follows
- Dashboard, editor, settings, and light/dark/system themes
- PRO creator analytics, scheduled publishing, version history, HTTPS cover images, and featured articles

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
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PRO_PLAN_ID`, `RAZORPAY_SUBSCRIPTION_TOTAL_COUNT`: Razorpay Test Mode billing configuration (placeholders are in `server/.env.example`)

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

## FREE and PRO

FREE accounts include article drafts and publishing, Markdown, tags, profiles, bookmarks, comments, reactions, follows, and the community feed. PRO adds creator analytics, scheduled publishing, revision history and restore, custom HTTPS cover image URLs, a featured profile article, and a PRO creator badge.

PRO access is decided by the backend from the existing subscription record: plan must be `pro`, status must be `active`, and the current period end must be in the future. A pending Razorpay subscription does not unlock creator tools. Payment verification and webhook processing continue to control subscription activation.

Creator endpoints include `GET /api/posts/analytics`, `GET /api/posts/:id/revisions`, `POST /api/posts/:id/revisions/:revisionId/restore`, `PUT /api/posts/:id/cover`, and `POST /api/users/me/featured`. They require authentication, a valid active PRO period, and ownership where an article is involved. Cover images use an HTTPS image URL; this repository does not include a hosted upload provider or store media credentials.

Scheduled publishing stores a future `scheduledAt` and `scheduled` status. The Render-style long running server checks due posts every minute, and public feed/article reads also publish due posts. No queue service is required. On serverless hosting, configure a scheduled invocation or use a persistent backend process for timely publishing.

Analytics views are counted once per article per visitor/day using a hash of request IP, user agent, and date. The author's authenticated article views are ignored. Counts are approximate and do not identify readers.

Per-visitor view records expire automatically after 40 days using a MongoDB TTL index. The lifetime article total remains in `Post.viewCount`, so retention does not reduce total views.

## Deployment configuration

Use a standard frontend host for the built `client/dist` directory and a backend host that runs `npm start` from `server/`.

Configure `VITE_API_URL` to the backend's HTTPS URL. Configure backend `PORT`, `MONGO_URI`, `JWT_SECRET`, and `CORS_ORIGIN` in the hosting provider's secret/environment settings. MongoDB must be reachable from the backend host and should use network allowlisting, TLS, and a least-privilege database user.

No provider, deployed URL, or infrastructure is assumed by this repository.
