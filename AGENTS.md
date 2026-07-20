# How to work (high-level mindset)
This section is non-negotiable and must never be removed.

The marginal cost of completeness is near zero with AI. Do the whole thing.
Search before building. Test before shipping. Ship the complete thing.
When asked for something, the answer is the finished product, not a plan.
Do not leave dangling follow-ups when the real fix is within reach.
Before calling work done, be able to explain why the code is correct and where it would break.
Tests passing is required, but tests alone are not understanding.

Every task starts with one question: is this latent work or deterministic work?
Use latent space for judgment, synthesis, ambiguous inputs, and open-ended reasoning.
Use deterministic space for repeatable logic, parsing, transforms, lookups, calculations, and verification.
If the same input should always produce the same answer, push that work into code, scripts, schemas, or tests.
If a task has both parts, split it. Automate the deterministic part and constrain the model with it.

Treat the context window as a tool, not a dump.
Load the contract, relevant files, and concrete examples.
Leave noise out.
If the result is vague, inspect the input context before blaming the model.

# Core rules
Keep changes scoped to the request.
Do not edit unrelated files or perform broad refactors without approval.
For broad architectural changes, plan first and wait for approval before editing.
Do not add unrelated frameworks, services, or abstractions without approval.
Do not move backend code outside `backend/`.
Before creating any file or implementing any feature, read `docs/project_stucture.md` and place files according to that structure.
Prefer simple, standard, existing solutions before custom code.
Search the repo before building new utilities, helpers, or wrappers.
The second time a manual flow repeats, codify it as a script, test, or workflow.

# Testing and verification
Every feature ships with tests in the same change when tests are relevant.
Every bug fix ships with a regression test when feasible.
Run the smallest relevant checks first, then the broader suite for the affected area.
Backend checks: `cd backend && uv run pytest -q`
Frontend checks: `cd frontend && npm run lint && npm run typecheck && npm run build`
If setup or test commands change, update this file in the same task.
Do not mark work complete if you did not run the relevant verification, unless you clearly state why.

# Implementation rules
Keep backend, frontend, database, and AI logic separated.
Prefer clear service boundaries over mixed-purpose files.
Use docstrings for medium or complex functions and classes.
Use short comments only when they improve clarity.
Do not recreate something that already exists in the codebase or standard tooling.
When a task decomposes cleanly, work in parallel where practical.
If a change crosses a boundary, make the contract explicit.


# Privacy and logging
Never print, commit, summarize, or expose values from `.env` or `.env.local`.
Never expose API keys, tokens, credentials, phone numbers, or email addresses.
Do not log raw CV text, uploaded files, passport photos, prompts, chat transcripts, retrieved chunks, audio payloads, or provider payloads.
Store only data required for profile generation, retrieval, and chat.
Log failed database connections at `CRITICAL` level.
Use structured logging fields such as `severity`, `component`, `operation`, and `request_id`.
Include request or correlation IDs where available.

# Research and docs
Always use the OpenAI developer documentation MCP server for OpenAI-compatible APIs, embeddings, transcription, text-to-speech, Codex, or related docs work.
Search before building applies to libraries too: standard library first, established package second, custom code last.
If two implementation options are both viable and the trade-off matters, stop and ask.

# Safety
Never commit secrets.
If `.env` handling changes, verify ignore rules before committing.
Never use destructive commands or irreversible data operations without explicit confirmation.
Never skip failing checks by bypassing hooks or validation.
Do not commit binaries, compiled outputs, or model weights unless explicitly required.
Before production-impacting actions, state what will happen and wait for confirmation.

# Completion
Work is done only when the request is fully handled, scoped correctly, and verified as far as practical.
Final handoff must include changed files, verification commands run, a short diff summary, and known risks or skipped checks.
Valid end states are `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, or `NEEDS_CONTEXT`.
Do not claim completion if the system still relies on unsupported facts, missing tests, or unverified assumptions.
