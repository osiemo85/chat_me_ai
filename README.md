# Chat Me AI

Chat Me AI turns a candidate’s CV into a shareable, conversational professional profile. Recruiters can ask questions through an AI representative that answers from the candidate’s profile and CV-grounded context instead of inventing experience or qualifications.

## Table of contents

- [Codex and GPT-5.6 workflow](#codex-and-gpt-56-workflow)
- [What it does](#what-it-does)
- [How it is built](#how-it-is-built)
- [MCP and skills](#mcp-and-skills)
- [Project structure](#project-structure)
- [Setup](#setup)
- [Verification](#verification)
- [Privacy and safety](#privacy-and-safety)
- [Project documentation](#project-documentation)

## Codex and GPT-5.6 workflow

Codex was used as the development partner for project preparation, architecture, implementation, documentation, testing, and review. Work followed a repeatable loop:

1. Read the repository instructions and relevant documentation.
2. Search the existing code before adding new abstractions.
3. Implement the smallest complete change in the correct layer.
4. Run focused checks, then broader verification where relevant.
5. Review the result against the product specification, privacy rules, and tests.

The instruction system was created before the main implementation. `AGENTS.md` defines the engineering, privacy, testing, and completion rules. `PROJECT_SPEC.md` defines the product problem, MVP, architecture, technology choices, and out-of-scope features. `docs/project_stucture.md` defines where backend, frontend, infrastructure, storage, and documentation files belong.

The GPT-5.6 models were used according to the type and risk of the work:

- **`gpt-5.6-luna`** handled fast repository searches, README and documentation edits, small UI/API changes, focused test updates, and short implementation loops where quick feedback mattered.
- **`gpt-5.6-terra`** supported balanced feature work such as connecting CV upload states, profile flows, chat behavior, Supabase storage services, and ordinary payment-flow changes while keeping quality and usage cost practical.
- **`gpt-5.6-sol`** was reserved for difficult reasoning, such as shaping the initial architecture, defining service boundaries, implementing the Paystack subscription and webhook system, reviewing profile-scoped retrieval isolation, and resolving privacy-sensitive integration decisions.

Reasoning levels were also selected per task:

- **Low** was used for quick lookups, straightforward edits, formatting, and simple verification.
- **Medium** was the everyday default for implementation and debugging because it balanced response speed, reasoning depth, and cost.
- **High** was used for cross-layer changes involving the frontend, backend, database, AI pipeline, or payment security.
- **Extra High** was reserved for the most complex architecture, privacy, retrieval, and integration problems, where deeper reasoning justified higher usage.

## What it does

- Lets candidates upload a CV and passport photo.
- Supports a selected communication persona and optional public links.
- Extracts, chunks, embeds, and retrieves CV content for grounded answers.
- Creates a public profile URL for recruiter conversations.
- Supports profile-scoped text chat and usage-aware billing flows.
- Supports local storage for development and Supabase Storage for cloud deployments.

## How it is built

The repository is a monorepo with separated responsibilities:

- **Frontend:** Next.js, React, TypeScript, and Tailwind for the landing page, upload flow, public profile, chat, and billing screens.
- **Backend:** FastAPI, Pydantic, SQLAlchemy, and service boundaries for uploads, CV processing, retrieval, chat, storage, authentication, and payments.
- **Database:** PostgreSQL with pgvector for profiles, CV documents, chunks, embeddings, conversations, and usage records.
- **AI pipeline:** CV extraction → cleaning and chunking → embeddings → profile-scoped retrieval → grounded response.
- **Payments:** Paystack checkout, transaction verification, signed webhook handling, and entitlement updates. The integration is implemented in application services and tests; no Paystack-specific skill is recorded in this repository.

## MCP and skills

Relevant MCP-assisted work includes:

- **GitHub Developer MCP:** repository-aware exploration, file and history inspection, and implementation context.
- **OpenAI Developer Docs MCP:** authoritative guidance for OpenAI-compatible APIs, embeddings, transcription, text-to-speech, and Codex-related work, as required by `AGENTS.md`.
- **Supabase tools and skill:** database, storage, configuration, security, and local/cloud integration guidance. The Supabase skill is recorded in `skills-lock.json` from `supabase/agent-skills`.

MCP configuration is intentionally not committed with the application, so individual server calls cannot be reproduced from the repository alone. No Paystack skill is currently recorded; Paystack-specific behavior is covered by the backend implementation and regression tests.

## Project structure

Important locations are documented in [`docs/project_stucture.md`](docs/project_stucture.md):

- `frontend/` — Next.js application
- `backend/` — FastAPI application and tests
- `docs/` — architecture, schema, API, and product documentation
- `storage/` — local development assets
- `infra/` — deployment and infrastructure configuration

## Setup

### Prerequisites

- Python 3.12 or newer
- [`uv`](https://docs.astral.sh/uv/) for backend dependencies
- Node.js and npm for the frontend
- PostgreSQL with pgvector, or a configured Supabase/Aiven PostgreSQL database
- An OpenRouter-compatible API key for chat and embeddings

### Backend setup

```bash
cd backend
uv sync
cp .env.example .env
```

Edit `backend/.env` with the database, model provider, storage, authentication, and optional Paystack settings required for your environment. For local file storage, use `STORAGE_TYPE=local` and set `LOCAL_STORAGE_DIR`. For Supabase, provide `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_BUCKET`.

Start the API:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

The frontend runs at `http://localhost:3000`. By default, server-side requests use `API_BASE_URL=http://localhost:8000`; set `NEXT_PUBLIC_API_BASE_URL` only when the browser must call the backend directly.

For a production-style frontend build:

```bash
cd frontend
npm run build
npm run start
```

Never commit `.env` files, credentials, API keys, or uploaded personal data.

## Verification

Run the checks required by `AGENTS.md`:

```bash
(cd backend && uv run pytest -q)
(cd frontend && npm run lint && npm run typecheck && npm run build)
```

## Privacy and safety

Chat responses are scoped to the resolved public profile. The application is designed not to expose raw CV text, embeddings, private storage paths, credentials, or sensitive logs. Unsupported questions receive a clear fallback rather than an invented answer.

## Project documentation

- [`AGENTS.md`](AGENTS.md) — repository working contract
- [`PROJECT_SPEC.md`](PROJECT_SPEC.md) — product and technical specification
- [`docs/project-story.md`](docs/project-story.md) — project narrative
- [`docs/architecture.md`](docs/architecture.md) — service boundaries and data flow
- [`docs/database-schema.md`](docs/database-schema.md) — persistence and storage model