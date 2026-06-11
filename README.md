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

# PostgreSQL database connection URL (for local dev or production)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_master?schema=public
```

---

## 2. Setup Instructions & Local Development

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v16.x or higher) and `npm` installed. You will also need a **PostgreSQL** database instance (either running locally, via Docker, or hosted remotely on Neon/Supabase).

### Step 1: Install Dependencies
Run the following command in the project root directory to install all packages for both the client and server:
```bash
npm run install:all
```

### Step 2: Database Initialization (Prisma/PostgreSQL)
Ensure your `DATABASE_URL` is set in `server/.env` pointing to your database, then run:
```bash
# Generate Prisma Client
npm run prisma:generate

# Synchronize database schema with PostgreSQL
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

## 4. Production Deployment

This project is optimized for deployment using **Netlify** (for the frontend React client) and **Render** (for the backend Express API and PostgreSQL database).

### 🚀 Step A: Deploy the Database on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **PostgreSQL**.
3. Configure the database (Name it e.g. `ticket-master-db`) and click **Create Database**.
4. Once active, copy the **External Connection String**.

### 💻 Step B: Deploy the Express Backend on Render
1. Click **New +** and select **Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
4. Under **Advanced**, add the following **Environment Variables**:
   - `DATABASE_URL`: *[Your PostgreSQL Connection String]*
   - `JWT_SECRET`: *[A long secure secret key]*
   - `GEMINI_API_KEY`: *[Your Gemini API Key]* (Optional)
   - `NODE_ENV`: `production`
5. Click **Create Web Service**. Once deployed, copy your service's URL (e.g., `https://ticket-master-api.onrender.com`).

### 🌐 Step C: Deploy the React Frontend on Netlify
1. Log in to [Netlify](https://app.netlify.com).
2. Click **Add new site** > **Import an existing project** and select your GitHub repository.
3. Configure the build settings:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist` (Vite's build output relative to repository root)
4. Go to **Environment variables** and add:
   - **Key**: `VITE_API_URL`
   - **Value**: *[Your Render Web Service URL]*
5. Click **Deploy [Site Name]**. Netlify will host the frontend and dynamically forward all API & SSE event calls to Render.

---

## 5. Key Architecture & Assumptions Made

- **Configurable backend URL**: The frontend is equipped to dynamically fetch resources from a custom API URL using the `VITE_API_URL` build environment variable. If empty, it defaults back to `localhost:5000` when running locally.
- **Session Isolation**: To support logging in as multiple different user roles simultaneously, the system stores credentials in `sessionStorage` rather than `localStorage`. Opening a new tab will start a clean session.
- **AI Fallback System**: If the `GEMINI_API_KEY` is not provided or fails, the application switches instantly to a keyword-matching triage script to ensure customers can submit tickets without interruptions.
- **Permission Boundary**: Customers can update the title and description of their own tickets as long as they are not `CLOSED`. Agents are authorized to modify ticket metadata (such as category, status, priority, or assignee) but cannot edit the description or title of a ticket.
