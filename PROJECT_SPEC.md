# Capstone spec - chat_me_ai

## Problem statement

Job seekers often rely on static CVs that do not fully communicate their skills, projects, experience, and professional personality to potential employers. Recruiters may still need to manually interpret the CV and ask follow-up questions to understand whether a candidate fits a role. This project provides an AI-powered digital twin platform that turns a candidate's uploaded CV into a shareable, interactive profile where employers can chat with the candidate's AI representative through text or voice. Candidates may also add optional social links such as LinkedIn and GitHub to strengthen the public profile. The digital twin answers only from the uploaded CV content and selected persona, without inventing qualifications, experience, education, skills, or achievements.

## What success looks like

* [ ] A user can upload a CV.
* [ ] A user can upload a passport photo.
* [ ] A user can provide their name.
* [ ] A user can choose a preferred persona for their digital twin.
* [ ] A user can optionally provide social links such as LinkedIn and GitHub.
* [ ] The backend can extract text from uploaded PDF or DOCX CV files.
* [ ] The backend can chunk extracted CV text and generate embeddings.
* [ ] The backend can store CV chunks and embeddings in PostgreSQL with pgvector.
* [ ] The platform can generate a unique public profile URL for each user.
* [ ] An employer can open the public URL and view the user's name and passport photo.
* [ ] An employer can ask questions through a text chat interface.
* [ ] An employer can ask questions through an audio chat interface.
* [ ] The digital twin retrieves only the selected user's CV chunks when answering questions.
* [ ] The digital twin answers only from the uploaded CV content and selected persona.
* [ ] The digital twin gives a clear fallback when the CV does not contain enough information.
* [ ] The platform avoids exposing raw CV text, embeddings, private file paths, secrets, or sensitive logs.
* [ ] Backend and frontend verification commands pass before submission.

## Architecture sketch

* Next.js frontend for landing page, CV upload, passport photo upload, optional social links input, persona selection, generated link display, public profile page, text chat, and audio chat.
* FastAPI backend for upload handling, profile creation, optional social links capture, CV parsing, text chunking, embedding generation, RAG retrieval, chat responses, audio transcription, and guardrails.
* PostgreSQL with pgvector for storing user profiles, optional social links, CV documents, CV chunks, embeddings, personas, chat sessions, and chat messages.
* Storage layer for uploaded CVs, passport photos, and optional audio files using local storage in development and Supabase/S3-compatible storage in production.
* Persona layer that maps each selected persona to tone, communication style, and prompt instructions.
* Retrieval layer that scopes every vector search by the user's profile ID to prevent cross-profile data leakage.

## Tech stack

* Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic Settings, pgvector, pypdf, python-docx, tiktoken, OpenAI/OpenRouter-compatible clients.
* Frontend: Next.js, React, TypeScript, Tailwind, shadcn/radix, lucide-react, browser audio recording APIs.
* Database: PostgreSQL with pgvector.
* External services: OpenAI/OpenRouter-compatible API, optional OpenAI Agents SDK, optional Supabase/S3 storage, optional speech-to-text and text-to-speech provider.

## Task list

1. [ ] Create Codex instruction files and this project spec.
2. [ ] Define database models for user profiles, optional social links, personas, CV documents, CV chunks, chat sessions, chat messages, and audio messages.
3. [ ] Configure PostgreSQL with pgvector and create required Alembic migrations.
4. [ ] Build the profile creation endpoint for name, optional social links, persona, CV upload, and passport photo upload.
5. [ ] Add file validation for CV files and passport photo images.
6. [ ] Implement CV text extraction for PDF and DOCX files.
7. [ ] Implement CV text cleaning, chunking, and metadata preparation.
8. [ ] Generate embeddings for CV chunks and store them in pgvector.
9. [ ] Generate a unique public profile ID and public URL for each user.
10. [ ] Build the frontend upload flow with optional social links, persona selection, and progress feedback.
11. [ ] Build the success page that shows the generated shareable profile link.
12. [ ] Build the public digital twin page showing user name, passport photo, persona, text chat, and audio chat.
13. [ ] Build RAG retrieval so chat queries search only the selected user's CV chunks.
14. [ ] Add prompt guardrails so the digital twin answers only from uploaded CV content.
15. [ ] Add unsupported-question fallback when retrieval is weak or the CV lacks the requested information.
16. [ ] Add audio transcription and connect audio questions to the same CV-grounded chat pipeline.
17. [ ] Add privacy and guardrail tests for uploads, retrieval isolation, weak retrieval, hallucination prevention, and sensitive logging.
18. [ ] Update monitoring/logging to show upload status, embedding status, retrieval quality, chat latency, and guardrail fallback events.

## Out of scope for MVP

* Employer authentication.
* Candidate dashboard with profile editing.
* Payment system.
* Full applicant tracking system.
* Automatic job matching.
* Interview scheduling.
* Background checks or reference verification.
* Fine-tuning models on uploaded CVs.
* Public access to raw CV files.
* Multiple CV versions per candidate.
* Long-term memory beyond the uploaded CV.
* AI-generated claims that are not grounded in the CV.
