# TicketMaster Support Triage Platform

A real-time support ticketing platform featuring automated AI-driven triage (prioritization, categorization, draft replies) and dual-interface dashboards for customers and support agents.

---

## 1. Environment Variables

Create a `.env` file in the `server/` directory and configure the following variables:

```env
# Port on which the express backend server will run (default is 5000)
PORT=5000

# JSON Web Token secret key for signing user sessions
JWT_SECRET=supersecretkey

# Google Gemini API key for automated ticket triage and suggested replies.
# If not set, the platform will use a keyword-matching fallback system.
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 2. Setup Instructions & Local Development

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v16.x or higher) and `npm` installed.

### Step 1: Install Dependencies
Run the following command in the project root directory to install all packages for both the client and server:
```bash
npm run install:all
```

### Step 2: Database Initialization (Prisma/SQLite)
Set up the Prisma client and seed the local SQLite database with dummy customer and agent accounts:
```bash
# Generate Prisma Client
npm run prisma:generate

# Execute SQLite schema migration
npm run prisma:migrate

# Seed dummy accounts and tickets
npm run prisma:seed
```

### Step 3: Run the Development Servers
Start both the React client dev server (Vite) and backend Express server (ts-node-dev) concurrently:
```bash
npm run dev
```
- **Client Application**: Hosted at `http://localhost:5173/`
- **Backend API**: Hosted at `http://localhost:5000/`

---

## 3. Seeded Accounts for Testing

The seeding script generates the following test accounts:

| Role | Email | Password |
|---|---|---|
| **Support Agent** | `agent@example.com` | `password123` |
| **Support Agent** | `agent2@example.com` | `password123` |
| **Customer** | `customer@example.com` | `password123` |
| **Customer** | `customer2@example.com` | `password123` |

---

## 4. Deployment Instructions

### Production Build
To package the application for production deployment, compile the React build files and transpile TypeScript server routes:
```bash
npm run build
```
This command compiles:
- The React application into static files under the `client/dist/` directory.
- The Express server into JavaScript files under the `server/dist/` directory.

### Running in Production
1. Serve the compiled backend server:
   ```bash
   npm run start:server
   ```
2. The server is configured to serve the built static client bundle `client/dist/` directly on production routes (so no separate static server is required).

---

## 5. Key Architecture & Assumptions Made

- **Session Isolation**: To support logging in as multiple different user roles simultaneously, the system stores credentials in `sessionStorage` rather than `localStorage`. Opening a new tab will start a clean session.
- **AI Fallback System**: If the `GEMINI_API_KEY` is not provided or fails, the application switches instantly to a keyword-matching triage script to ensure customers can submit tickets without interruptions.
- **Permission Boundary**: Customers can update the title and description of their own tickets as long as they are not `CLOSED`. Agents are authorized to modify ticket metadata (such as category, status, priority, or assignee) but cannot edit the description or title of a ticket.
