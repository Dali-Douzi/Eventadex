# Eventadex — Multi-Tenant Event Registration Platform

A MERN-stack SaaS platform for creating and managing event registrations. Supports multiple organizations, custom branded registration pages, Stripe payments, QR-based check-in, and badge printing.

---

## Architecture

| App | Port | Purpose |
|---|---|---|
| `client-master` | 3000 | Platform owner — manage organizations & lookup data |
| `client-admin` | 3001 | Event organizer — event setup, registrants, check-in, badges |
| `client-user` | 3002 | Attendees — public registration form |
| `server` | 5000 | Express REST API + MongoDB |

---

## Prerequisites

- **Node.js** v20+ and **npm** v10+
- **MongoDB** — either:
  - [MongoDB Atlas](https://www.mongodb.com/atlas) free tier (recommended, no local install), **or**
  - [MongoDB Community Server](https://www.mongodb.com/try/download/community) installed locally
- **Git**
- *(Optional)* **Stripe** account for payment features

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/event-registration.git
cd event-registration
```

### 2. Install all dependencies

```bash
npm install
```

This installs dependencies for all four workspaces (`server`, `client-master`, `client-admin`, `client-user`) in one step.

### 3. Configure environment variables

```bash
cp .env.production.example server/.env
```

Open `server/.env` and fill in the required values (at minimum `MONGO_URI`, `JWT_SECRET`, and `EMAIL_*` SMTP settings).

### 4. Start everything in development mode

```bash
npm run dev
```

This uses `concurrently` to start the Express server (with `nodemon`) and all three Vite dev servers simultaneously.

| URL | App |
|---|---|
| http://localhost:3000 | Platform Admin |
| http://localhost:3001 | Event Admin |
| http://localhost:3002 | Registration Form |
| http://localhost:5000/api/health | API health check |

---

## Seeding the Master User

The platform requires one master (super-admin) account to create organizations.

```bash
cd server
node scripts/seedMaster.js
```

This creates the master user defined by `MASTER_EMAIL` / `MASTER_PASSWORD` in your `.env` (defaults to `admin@eventadex.io` / `Admin123!` if not set).

> **Important:** Change the default credentials immediately after first login.

---

## Environment Variables Reference

See [`.env.production.example`](.env.production.example) for a full list with comments. Key variables:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | ✅ | Token lifetime (e.g. `7d`) |
| `CLIENT_MASTER_URL` | ✅ | Origin of the Platform Admin app |
| `CLIENT_ADMIN_URL` | ✅ | Origin of the Event Admin app |
| `CLIENT_USER_URL` | ✅ | Origin of the Registration app |
| `STRIPE_SECRET_KEY` | Optional | Required only when payment is enabled |
| `SMTP_HOST` | ✅ | SMTP server for confirmation emails |
| `SMTP_PORT` | ✅ | SMTP port (587 or 465) |
| `SMTP_USER` | ✅ | SMTP username |
| `SMTP_PASS` | ✅ | SMTP password |
| `EMAIL_FROM` | ✅ | Sender address for emails |

---

## Production Deployment (no Docker — pm2 + serve)

This is the recommended way to run the app. No Docker required.

### 1. One-time global tool install

```bash
npm run setup
# installs pm2 (process manager) and serve (static file server) globally
```

### 2. Create `server/.env`

```bash
cp .env.example server/.env
```

Edit `server/.env` and fill in at minimum:

| Variable | Value |
|---|---|
| `MONGO_URI` | MongoDB Atlas URI **or** `mongodb://localhost:27017/eventadex` |
| `JWT_SECRET` | Any long random string |
| `EMAIL_*` | Your SMTP credentials |

> **MongoDB options:**
> - **Recommended:** [MongoDB Atlas free tier](https://www.mongodb.com/atlas) — sign up, create a free cluster, copy the connection string.
> - **Local:** Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and use `mongodb://localhost:27017/eventadex`.

### 3. Install dependencies

```bash
npm install
```

### 4. Build the React apps

```bash
npm run build:all
```

Compiled bundles are written to `client-*/dist/`.

### 5. Start everything

```bash
npm run start:prod
```

Or on Windows, just double-click **`start.bat`**.

| URL | App |
|---|---|
| http://localhost:3000 | Platform Admin |
| http://localhost:3001 | Event Admin |
| http://localhost:3002 | Registration Form |
| http://localhost:5000/api/health | API health check |

### 6. Seed the master user (first run only)

```bash
npm run seed:master --workspace=server
```

### 7. Useful commands

```bash
npm run logs      # tail logs from all 4 processes
npm run status    # show pm2 process status table
npm run restart   # restart all processes (e.g. after .env change)
npm run stop      # stop all processes
```

---

## Available npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | **Development** — start all 4 services with hot-reload |
| `npm run dev:server` | Start Express server only (nodemon) |
| `npm run dev:master` | Start client-master Vite dev server only |
| `npm run dev:admin` | Start client-admin Vite dev server only |
| `npm run dev:user` | Start client-user Vite dev server only |
| `npm run build:all` | Build all 3 React apps for production |
| `npm run install:all` | Install all workspace dependencies |
| `npm run setup` | One-time install of pm2 and serve globally |
| `npm run start:prod` | **Production** — launch all 4 processes via pm2 |
| `npm run stop` | Stop all pm2-managed processes |
| `npm run restart` | Restart all pm2-managed processes |
| `npm run logs` | Tail live logs from all processes |
| `npm run status` | Show pm2 process status table |

---

## Project Structure

```
event-registration/
├── server/                  Express API
│   ├── controllers/
│   ├── middleware/          errorHandler, validate, rateLimits
│   ├── models/
│   ├── routes/
│   ├── scripts/             seedMaster.js
│   ├── uploads/             Uploaded logos (volume-mounted in Docker)
│   ├── Dockerfile
│   └── index.js
├── client-master/           Platform Admin (React + Vite)
├── client-admin/            Event Admin (React + Vite)
├── client-user/             Registration Form (React + Vite)
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env.production.example
└── package.json             Workspace root
```

---

## Key Features

- **Multi-tenant**: Each organization gets its own slug-based registration URL and isolated data.
- **Custom branding**: Logo, colors, header/footer text, custom form fields.
- **Dynamic forms**: Drag-and-drop field configuration with lookup-driven dropdowns.
- **Stripe payments**: Opt-in per event with server-side amount validation.
- **QR check-in**: Real-time check-in/check-out with QR scanner support.
- **Badge printing**: 85 × 54 mm print-ready badges via browser `window.print()`.
- **Confirmation emails**: Automated emails with inline QR code on registration.
- **Rate limiting**: 10 registration attempts / IP / 15 min to prevent abuse.
- **Input validation**: `express-validator` on all mutation routes.
