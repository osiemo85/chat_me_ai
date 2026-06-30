# Architecture

## Overview

`chat_me_ai` is a monorepo for an AI-powered digital twin CV platform. A candidate uploads a CV, passport photo, name, and persona choice. The system extracts and chunks CV text, generates embeddings, stores the chunks in PostgreSQL with pgvector, and creates a public profile URL. Employers open that URL and interact with a CV-grounded digital twin through text or audio.

The core architecture rule is strict grounding. The twin may use the selected persona to shape tone, but factual answers must come only from the uploaded CV context retrieved for that profile.

## Primary Components

### Frontend

The frontend is a Next.js application responsible for:

- Candidate upload flow for name, persona, CV file, and passport photo.
- Success screen with the generated public profile link.
- Public profile page with candidate identity, persona label, text chat, and audio chat.
- Client-side validation, progress feedback, and browser audio capture.

The frontend should remain presentation-focused. It should not implement business rules for retrieval, grounding, or persona guardrails beyond light request validation and UX messaging.

### Backend API

The backend is a FastAPI service responsible for:

- Receiving validated uploads and profile creation requests.
- Extracting text from PDF and DOCX CV files.
- Cleaning and chunking CV text for retrieval.
- Generating embeddings using an OpenAI-compatible provider.
- Storing profile, document, chunk, embedding, and chat data.
- Serving public profile data by public ID.
- Running retrieval-augmented chat for text and audio questions.
- Enforcing fallback behavior when the CV does not support an answer.

This service owns the application rules. Frontend and storage integrations should flow through it rather than bypassing it.

### Database

PostgreSQL with pgvector is the system of record. It stores:

- User profile metadata.
- Persona reference data or persona bindings.
- CV document records and processing state.
- CV chunks plus vector embeddings.
- Public profile identifiers.
- Chat sessions and chat messages.
- Optional audio message metadata.

Vector search must always be scoped to a single profile to prevent cross-profile leakage.

### File Storage

The storage layer holds uploaded assets:

- Original CV files.
- Passport photos.
- Optional audio uploads if persisted.

Development can use local disk. Production should use object storage such as Supabase Storage or an S3-compatible provider. The application should store references and metadata, not raw file contents, in relational tables.

### LLM and Speech Providers

The platform depends on OpenAI-compatible services for:

- Embedding generation.
- Chat completion or responses.
- Optional speech-to-text.
- Optional text-to-speech.

These integrations must be wrapped in backend services so provider choice can change without affecting API handlers or frontend code.

## Core Data Flow

### 1. Profile Creation

1. The candidate submits name, persona, CV file, and passport photo.
2. The backend validates file types, size limits, and required fields.
3. The backend creates a profile record with a generated public ID.
4. Files are stored and linked to the profile.
5. The CV text is extracted, cleaned, chunked, and prepared for embedding.
6. Embeddings are generated and stored with the chunk records.
7. The API returns the public profile URL.

Profile creation should fail safely. If parsing, storage, or embedding fails, the API should return a clear error and avoid leaving the profile in an ambiguous state.

### 2. Public Profile View

1. An employer opens a public URL containing the profile public ID.
2. The frontend requests the public profile payload from the backend.
3. The backend returns only shareable fields such as public name, persona label, and passport photo reference.
4. The frontend renders the digital twin page and enables text and audio chat.

Private storage paths, database IDs, raw CV content, and embeddings must never be returned to the browser.

### 3. Text Chat

1. The employer sends a question tied to a public profile.
2. The backend resolves the public ID to the internal profile record.
3. The question is embedded.
4. Retrieval searches only that profile's CV chunks.
5. The backend builds a prompt using retrieved context plus persona instructions.
6. The model generates an answer constrained to the supplied CV context.
7. If retrieval is weak or the answer is unsupported, the backend returns a fallback response stating that the CV does not provide that information.

### 4. Audio Chat

1. The browser records audio and uploads it to the backend.
2. The backend transcribes the audio through a speech-to-text provider.
3. The transcript is passed into the same retrieval and guardrail pipeline as text chat.
4. The backend returns text, and optionally audio output if text-to-speech is enabled.

Audio is an input mode, not a separate reasoning path. It must reuse the same CV-grounded chat pipeline.

## Logical Boundaries

### Persona Layer

Persona configuration controls tone, style, and communication posture. It must not introduce new facts. The persona layer should therefore be modeled as prompt instructions or configuration attached after retrieval, not as a source of knowledge.

### Retrieval Layer

The retrieval layer is responsible for:

- Chunk search.
- Metadata filtering by profile.
- Similarity ranking.
- Thresholding for weak matches.

This layer is the main control against hallucination. It should expose enough signals for the chat service to decide when to answer and when to fall back.

### Guardrail Layer

The guardrail layer enforces:

- Answer only from retrieved CV content.
- No fabricated claims.
- Professional employer-facing tone.
- Clear fallback when information is unavailable.

Guardrails should be enforced by both prompt design and application-side checks around retrieval strength and output handling.

## Data and Identity Design

Each candidate profile should have a stable internal primary key and a separate public identifier for URLs. Public URLs must never expose raw database IDs.

Recommended entities:

- `user_profiles`
- `personas`
- `cv_documents`
- `cv_chunks`
- `chat_sessions`
- `chat_messages`
- `audio_messages`

Each chunk should store profile linkage, document linkage, chunk text, chunk order, and embedding vector. Chat records should link back to the profile and session for auditability and evaluation without storing sensitive raw provider payloads.

## Security and Privacy

The system handles personal data and must default to minimization:

- Do not expose raw CV text in public responses.
- Do not log uploaded content, prompts, transcripts, embeddings, or provider payloads.
- Do not expose internal file paths or storage keys unless required for controlled backend access.
- Do not expose secrets from `.env` or `.env.local`.
- Restrict every retrieval and profile lookup by the resolved public ID to prevent data crossover.

Logging should use structured fields such as `severity`, `component`, `operation`, and `request_id`. Failed database connections must log at `CRITICAL`.

## Verification Strategy

The architecture should be validated through tests that cover:

- Upload validation for PDF, DOCX, and image inputs.
- CV extraction and chunking behavior.
- Embedding persistence and pgvector queries.
- Retrieval isolation across different profiles.
- Fallback behavior when retrieval is weak.
- Hallucination prevention for unsupported questions.
- Public profile response filtering.
- Audio transcription integration.

Backend verification command:

```bash
cd backend && uv run pytest -q
```

Frontend verification commands:

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

## MVP Scope Notes

This architecture is intentionally scoped to a single-upload digital twin workflow. It does not assume employer authentication, candidate profile editing, payment flows, ATS features, job matching, or long-term memory beyond the uploaded CV.
