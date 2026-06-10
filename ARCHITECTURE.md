# System Architecture Documentation

This document describes the high-level architecture, design decisions, database schemas, and data flow of the TicketMaster system.

---

## 1. Architectural Overview

TicketMaster is built using a decoupled Client-Server architecture:
- **Frontend (Client)**: A modern Single Page Application (SPA) built using React, TypeScript, and Vite.
- **Backend (Server)**: A RESTful API server powered by Express, TypeScript, and Prisma ORM.
- **Database**: A lightweight SQLite relational database managed via Prisma.
- **AI Integration**: Automatic ticket classification (priority, category) and suggested response generation using the Google Gemini Pro (`gemini-1.5-flash`) model, with a robust rule-based fallback system.

---

## 2. Directory Structure

```text
ticket-master/
├── client/                 # React Frontend Application
│   ├── src/
│   │   ├── components/     # Reusable layout components (e.g., Navbar)
│   │   ├── context/        # React Context wrappers (e.g., AuthContext)
│   │   ├── pages/          # Core pages (Dashboard, Login, TicketDetails, etc.)
│   │   ├── styles/         # Global typography, color schemes, theme variables
│   │   ├── utils/          # API helper functions (api.ts)
│   │   └── main.tsx        # Application mount entry point
│   ├── index.html          # HTML Entry Document
│   └── package.json        # Frontend Node dependencies and scripts
│
├── server/                 # Express Backend Application
│   ├── prisma/             # Schema definitions and migrations
│   │   ├── schema.prisma   # Database models definition
│   │   └── dev.db          # Local SQLite development database
│   ├── src/
│   │   ├── middlewares/    # Custom middlewares (e.g., JWT authentication)
│   │   ├── routes/         # Express API routing logic (auth, tickets, analytics)
│   │   ├── services/       # Core business logic helpers (AI triage, SSE, database)
│   │   └── index.ts        # Server bootstrap entry point
│   └── package.json        # Server Node dependencies and scripts
│
└── package.json            # Monorepo scripts for running/building client & server
```

---

## 3. Core Architectural Patterns

### 3.1. Authentication and State Isolation
- **JSON Web Tokens (JWT)**: Standard bearer tokens are used to authenticate requests. Tokens are signed by the server upon successful login or registration.
- **Session-Level Isolation**: User credentials (`token` and `user`) are stored in `sessionStorage` instead of `localStorage`. This ensures that if a user opens multiple browser tabs, they can log in with different accounts (e.g., Customer in one tab, Support Agent in another) without their sessions overriding or syncing with each other.

### 3.2. Real-Time Communication (Server-Sent Events)
Instead of expensive HTTP polling, TicketMaster uses **Server-Sent Events (SSE)** for unidirectional real-time data flow from the server to the client:
1. When a client establishes an authenticated connection to `/api/tickets/events`, the server registers the connection in the `sseService`.
2. Whenever a ticket is created, updated, or receives a new comment, the server broadcasts an event payload containing the event `type` and the updated ticket data to all registered clients.
3. The frontend `App.tsx` captures these messages and raises a window-level custom event (`ticket-sse-event`).
4. Both the `AgentDashboard`, `CustomerDashboard`, and `TicketDetails` pages listen to this event. When fired, they automatically update their local states (fetching latest data from the API) in real-time without needing a manual page reload.

### 3.3. AI Triage & Fallbacks
When a customer submits a new ticket:
1. The backend triggers the `triageTicket` service helper.
2. If `GEMINI_API_KEY` is configured in environment variables, the server calls the **Google Gemini API** (`gemini-1.5-flash` model) to:
   - Analyze the sentiment and context of the ticket's title and description.
   - Categorize the ticket into one of the designated categories (Billing, Technical Issue, etc.).
   - Prioritize the ticket (Low, Medium, High, Critical).
   - Draft a highly personalized, friendly suggested reply.
3. If the API key is missing, or the call fails (e.g. rate limits or network issues), the server automatically falls back to a **local rule-based classifier** that scans keywords and outputs predefined triage values and template answers. This ensures zero downtime for ticket submissions.

### 3.4. Field-Level Change Logs (Auditing)
Every update made to a ticket (status change, priority change, assignee updates) is recorded in the `AuditLog` table. A summary of these changes (`lastChange`) is also broadcasted to users via SSE so that toast alerts accurately state what was changed (e.g., `Ticket "Title": priority updated to High` instead of always saying `status updated to RESOLVED`).

---

## 4. Database Schema Details

Managed through **Prisma**, the relational schema consists of four tables:

```mermaid
erDiagram
    User ||--o{ Ticket : "CreatedTickets"
    User ||--o{ Ticket : "AssignedTickets"
    User ||--o{ Comment : "Writes"
    User ||--o{ AuditLog : "Performs"
    Ticket ||--o{ Comment : "Contains"
    Ticket ||--o{ AuditLog : "Tracks"

    User {
        string id PK
        string email UNIQUE
        string password
        string name
        string role "CUSTOMER or AGENT"
        datetime createdAt
        datetime updatedAt
    }

    Ticket {
        string id PK
        string title
        string description
        string status "OPEN, IN_PROGRESS, RESOLVED, CLOSED"
        string priority "Low, Medium, High, Critical"
        string category "Billing, Technical Issue, etc."
        string createdById FK
        string assignedToId FK "Nullable"
        string suggestedResponse "AI Response Suggestion"
        datetime createdAt
        datetime updatedAt
    }

    Comment {
        string id PK
        string ticketId FK
        string userId FK
        string content
        datetime createdAt
    }

    AuditLog {
        string id PK
        string ticketId FK
        string userId FK
        string action "STATUS_CHANGE, ASSIGNMENT, etc."
        string details "JSON stringified change data"
        datetime createdAt
    }
```

---

## 5. Security & Access Control

The API enforces strict middleware-level validation (`authenticateJWT`):
- **Customers**:
  - Can only view or retrieve tickets that they created (`createdById === user.id`).
  - Can only post comments on their own tickets.
  - Can only edit `title` and `description` of their own tickets, and only if the ticket is not `CLOSED`.
  - Can only modify ticket status to `CLOSED`.
- **Agents**:
  - Can view all tickets in the system.
  - Can modify metadata fields (Status, Priority, Category, Assignee) on any ticket.
  - Cannot edit a ticket's `title` or `description` (this is restricted solely to the customer who raised it).
