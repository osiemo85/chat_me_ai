chat_me_ai/
│
├── AGENTS.md
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Makefile
│
├── docs/
│   ├── architecture.md
│   ├── api-reference.md
│   ├── database-schema.md
│   ├── deployment.md
│   └── product-requirements.md
│
├── backend/
│   ├── README.md
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── .env.example
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   ├── logging_config.py
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   │
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── health.py
│   │   │       ├── uploads.py
│   │   │       ├── profiles.py
│   │   │       ├── chat.py
│   │   │       ├── audio.py
│   │   │       └── personas.py
│   │   │
│   │   ├── core/
│   │   │   ├── security.py
│   │   │   ├── constants.py
│   │   │   ├── exceptions.py
│   │   │   └── file_validation.py
│   │   │
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   ├── base.py
│   │   │   └── init_db.py
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user_profile.py
│   │   │   ├── cv_document.py
│   │   │   ├── cv_chunk.py
│   │   │   ├── persona.py
│   │   │   ├── chat_session.py
│   │   │   ├── chat_message.py
│   │   │   └── audio_message.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py
│   │   │   ├── profile.py
│   │   │   ├── chat.py
│   │   │   ├── audio.py
│   │   │   └── persona.py
│   │   │
│   │   ├── services/
│   │   │   ├── cv_parser_service.py
│   │   │   ├── chunking_service.py
│   │   │   ├── embedding_service.py
│   │   │   ├── retrieval_service.py
│   │   │   ├── chat_service.py
│   │   │   ├── profile_service.py
│   │   │   ├── storage_service.py
│   │   │   ├── image_service.py
│   │   │   ├── audio_service.py
│   │   │   └── persona_service.py
│   │   │
│   │   ├── repositories/
│   │   │   ├── user_profile_repository.py
│   │   │   ├── cv_document_repository.py
│   │   │   ├── cv_chunk_repository.py
│   │   │   ├── persona_repository.py
│   │   │   └── chat_repository.py
│   │   │
│   │   ├── prompts/
│   │   │   ├── system_prompts.py
│   │   │   ├── persona_prompts.py
│   │   │   └── guardrails.py
│   │   │
│   │   ├── tasks/
│   │   │   ├── embedding_tasks.py
│   │   │   ├── cleanup_tasks.py
│   │   │   └── audio_tasks.py
│   │   │
│   │   ├── utils/
│   │   │   ├── ids.py
│   │   │   ├── slug.py
│   │   │   ├── dates.py
│   │   │   ├── text_cleaning.py
│   │   │   └── response.py
│   │   │
│   │   └── tests/
│   │       ├── test_health.py
│   │       ├── test_uploads.py
│   │       ├── test_profiles.py
│   │       ├── test_embeddings.py
│   │       └── test_chat.py
│   │
│   └── scripts/
│       ├── create_pgvector_extension.sql
│       ├── seed_personas.py
│       └── run_migrations.sh
│
├── frontend/
│   ├── README.md
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── Dockerfile
│   ├── .env.example
│   │
│   ├── public/
│   │   ├── logo.svg
│   │   └── placeholder-avatar.png
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── globals.css
│   │   │   │
│   │   │   ├── upload/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── success/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── twin/
│   │   │   │   └── [publicId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── api/
│   │   │       └── health/
│   │   │           └── route.ts
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   │
│   │   │   ├── upload/
│   │   │   │   ├── CVUploadForm.tsx
│   │   │   │   ├── PassportPhotoUpload.tsx
│   │   │   │   ├── PersonaSelector.tsx
│   │   │   │   └── UploadProgress.tsx
│   │   │   │
│   │   │   ├── profile/
│   │   │   │   ├── TwinHeader.tsx
│   │   │   │   ├── ProfileCard.tsx
│   │   │   │   ├── PassportImage.tsx
│   │   │   │   └── ShareLinkBox.tsx
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ChatInterface.tsx
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   ├── TypingIndicator.tsx
│   │   │   │   └── SourceBadges.tsx
│   │   │   │
│   │   │   ├── audio/
│   │   │   │   ├── AudioRecorder.tsx
│   │   │   │   ├── AudioChatButton.tsx
│   │   │   │   └── VoicePlayer.tsx
│   │   │   │
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Textarea.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Select.tsx
│   │   │       └── Loader.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── env.ts
│   │   │   ├── validators.ts
│   │   │   ├── constants.ts
│   │   │   └── utils.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useUpload.ts
│   │   │   ├── useChat.ts
│   │   │   ├── useAudioRecorder.ts
│   │   │   └── useProfile.ts
│   │   │
│   │   ├── types/
│   │   │   ├── upload.ts
│   │   │   ├── profile.ts
│   │   │   ├── chat.ts
│   │   │   ├── audio.ts
│   │   │   └── persona.ts
│   │   │
│   │   └── styles/
│   │       └── theme.css
│   │
│   └── tests/
│       ├── upload.test.tsx
│       ├── chat.test.tsx
│       └── profile.test.tsx
│
├── infra/
│   ├── nginx/
│   │   └── default.conf
│   ├── postgres/
│   │   └── init.sql
│   └── render/
│       ├── backend.yaml
│       └── frontend.yaml
│
└── storage/
    ├── cvs/
    ├── passport_photos/
    └── audio/