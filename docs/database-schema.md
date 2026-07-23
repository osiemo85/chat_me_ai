# Database Schema Draft

This draft is intentionally client-agnostic. It defines the table shape for the
upload flow without choosing a PostgreSQL driver or ORM yet.

## Current frontend upload scope

The current frontend form captures:

- `first_name`
- `second_name`
- `email`
- `contact_email` optional and public
- `contact_phone` optional and public
- `linkedin_url` optional
- `github_url` optional
- `other_url` optional
- `persona` selected from a dropdown
- `cv` as a PDF file
- `passport_photo` as an image file

Supabase storage is expected to hold the actual files. PostgreSQL should store
file references, metadata, and processing state, not file bytes.

## Recommended table

### `candidate_profiles`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key |
| `first_name` | `varchar(100)` | yes | Candidate first name |
| `second_name` | `varchar(100)` | yes | Candidate second name |
| `email` | `varchar(255)` | yes | Unique candidate email |
| `contact_email` | `varchar(255)` | no | Optional public contact email |
| `contact_phone` | `varchar(40)` | no | Optional public contact phone number |
| `linkedin_url` | `text` | no | Optional LinkedIn profile URL |
| `github_url` | `text` | no | Optional GitHub profile URL |
| `other_url` | `text` | no | Optional portfolio or other public URL |
| `persona` | `varchar(50)` | yes | Selected persona label or slug |
| `public_profile_id` | `varchar(120)` | yes | Public-safe shareable ID |
| `upload_status` | `varchar(30)` | yes | Overall upload pipeline status |
| `cv_processing_status` | `varchar(30)` | yes | CV extraction and embedding status |
| `created_at` | `timestamptz` | yes | Row creation time |
| `updated_at` | `timestamptz` | yes | Last update time |

### `profile_assets`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key |
| `candidate_profile_id` | `uuid` | yes | FK to `candidate_profiles.id` |
| `asset_type` | `varchar(30)` | yes | `cv` or `passport_photo` |
| `original_filename` | `varchar(255)` | yes | Uploaded file name |
| `content_type` | `varchar(100)` | yes | Example `application/pdf` or `image/jpeg` |
| `storage_bucket` | `varchar(100)` | no | Supabase bucket |
| `storage_path` | `text` | no | Supabase object path |
| `upload_status` | `varchar(30)` | yes | Upload lifecycle state |
| `is_current` | `boolean` | yes | Marks the active asset for this type |
| `version` | `integer` | yes | Incremented on each replacement |
| `replaced_at` | `timestamptz` | no | When the asset stopped being current |
| `created_at` | `timestamptz` | yes | Row creation time |
| `updated_at` | `timestamptz` | yes | Last update time |

### `chunks`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key |
| `candidate_profile_id` | `uuid` | yes | FK to `candidate_profiles.id` |
| `profile_asset_id` | `uuid` | yes | FK to the current or historical CV asset row |
| `chunk_index` | `integer` | yes | Chunk ordering inside the document |
| `chunk_text` | `text` | yes | Extracted CV content chunk |
| `embedding_model` | `varchar(120)` | no | Embedding model identifier |
| `embedding_status` | `varchar(30)` | yes | Current embedding pipeline state |
| `embedding` | `jsonb` | no | Placeholder storage until pgvector is enabled |
| `is_current` | `boolean` | yes | Marks chunks from the active CV asset |
| `created_at` | `timestamptz` | yes | Row creation time |

## Suggested SQL sketch

```sql
create table candidate_profiles (
  id uuid primary key,
  first_name varchar(100) not null,
  second_name varchar(100) not null,
  email varchar(255) not null unique,
  contact_email varchar(255),
  contact_phone varchar(40),
  linkedin_url text,
  github_url text,
  other_url text,
  persona varchar(50) not null,
  public_profile_id varchar(120) not null unique,
  upload_status varchar(30) not null default 'pending',
  cv_processing_status varchar(30) not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_assets (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id),
  asset_type varchar(30) not null,
  original_filename varchar(255) not null,
  content_type varchar(100) not null,
  storage_bucket varchar(100),
  storage_path text,
  upload_status varchar(30) not null default 'pending',
  is_current boolean not null default false,
  version integer not null default 1,
  replaced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profile_assets_one_current_per_type
  on profile_assets (candidate_profile_id, asset_type)
  where is_current = true;

create table chunks (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id),
  profile_asset_id uuid not null references profile_assets(id),
  chunk_index integer not null,
  chunk_text text not null,
  embedding_model varchar(120),
  embedding_status varchar(30) not null default 'pending',
  embedding jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
```

## Notes

- Keep persona as a simple string for now. It can later become a foreign key if
  personas are normalized into a separate table.
- If multiple social links per type are needed later, split links into a
  separate `candidate_social_links` table.
- Use `candidate_profiles.upload_status`, `candidate_profiles.cv_processing_status`,
  and `profile_assets.upload_status` to track pipeline progress instead of a
  separate jobs table for now.
- Keep one stable `public_profile_id` per candidate so repeated uploads update
  the same shareable link instead of creating a new identity each time.
- Store actual files in Supabase and persist only the bucket and object path in
  PostgreSQL.
- Set `DB_TYPE=supabase` and provide the Supabase PostgreSQL connection string
  in `DATABASE_URL`. The backend supports Supabase transaction pooler URLs
  on port 6543 and disables prepared statements automatically. Existing Aiven
  deployments can keep `DB_TYPE=aiven` with `AIVEN_SERVICE_URL`.
- Environment variables expected for storage and embeddings:
  `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_BUCKET`,
  `NVIDIA_API_KEY`, `MODEL_NAME`, and optional `NVIDIA_TRUNCATE`.
