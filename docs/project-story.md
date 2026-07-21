# Chat Me AI: Project Story


## What it does

CVs are useful, but they are static. Chat Me AI was inspired by the idea of turning a CV into an interactive professional introduction—one that lets recruiters ask questions and understand a candidate beyond a document.

Candidates upload a CV, photo, social links, and choose a communication persona. Chat Me AI creates a shareable profile where recruiters can chat with an AI representative grounded in that candidate’s CV. It answers from available profile information and gives a clear fallback when the CV does not contain the answer.

## How we built it

We started by using Codex to create the project’s instruction and planning documents. `AGENTS.md` defined the working rules, `PROJECT_SPEC.md` captured the product requirements and architecture, and `docs/project_stucture.md` defined where each part of the system belongs. These documents gave every later implementation task a shared context and clear boundaries.

Different Codex models and reasoning levels were used according to the task: `gpt-5.6-luna` for fast everyday implementation and iteration, `gpt-5.6-terra` for balanced planning and development work, and `gpt-5.6-sol` for complex architecture and high-stakes reasoning. Low or Medium reasoning suited routine edits and verification; High or Extra High was used when designing the architecture, privacy boundaries, retrieval flow, and more complex setup.

The result is a monorepo with a Next.js/TypeScript frontend, a FastAPI backend, PostgreSQL with pgvector, and a storage layer supporting local development and Supabase in production. The CV pipeline extracts text, cleans and chunks it, creates embeddings, retrieves profile-specific context, and generates a grounded response.

## Challenges we ran into

The main challenge was making the experience conversational without allowing the AI to invent qualifications or expose another user’s information. We addressed this with profile-scoped retrieval, deterministic routing for predictable questions, guardrails, fallback responses, and tests.

We also had to coordinate CV uploads across validation, storage, extraction, embeddings, and processing status while supporting both local and cloud environments.

## Accomplishments that we're proud of

- We turned a static CV into a shareable, conversational professional profile.
- We made privacy and factual grounding core product requirements.
- We created clear boundaries between the frontend, backend, database, storage, and AI logic.
- We used project documentation and Codex workflows to keep implementation focused, testable, and consistent.

## What we learned

We learned that reliable AI products depend as much on their boundaries as on their models. Deterministic code should handle validation, identity, retrieval scope, status changes, and usage limits; the model should focus on language and synthesis within those constraints.

We also learned that instruction files are practical engineering tools. `AGENTS.md`, `PROJECT_SPEC.md`, and the structure documentation gave both people and Codex a shared understanding of what to build, where to put it, and how to verify it.

## What's next for Chat Me AI

Next, we want to complete and verify the audio experience, improve processing observability and retrieval quality, strengthen production security, add profile management and deletion controls, and expand end-to-end testing. The goal is to make candidates easier to understand—without making the AI sound more certain than the evidence allows.
