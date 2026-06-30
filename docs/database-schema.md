# Database Schema Draft

This draft is intentionally client-agnostic. It defines the table shape for the
upload flow without choosing a PostgreSQL driver or ORM yet.

## Current frontend upload scope

The current frontend form captures:

- `first_name`
- `second_name`
- `email`
- `linkedin_url` optional
- `github_url` optional
- `other_url` optional
- `persona` selected from a dropdown
- `cv` as a PDF file

Supabase storage is expected to hold the actual file. PostgreSQL should store
the file reference and metadata, not the file bytes.

## Recommended table

### `candidate_profiles`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key |
| `first_name` | `varchar(100)` | yes | Candidate first name |
| `second_name` | `varchar(100)` | yes | Candidate second name |
| `email` | `varchar(255)` | yes | Unique candidate email |
| `linkedin_url` | `text` | no | Optional LinkedIn profile URL |
| `github_url` | `text` | no | Optional GitHub profile URL |
| `other_url` | `text` | no | Optional portfolio or other public URL |
| `persona` | `varchar(50)` | yes | Selected persona label or slug |
| `cv_original_filename` | `varchar(255)` | yes | Original uploaded PDF name |
| `cv_content_type` | `varchar(100)` | yes | Expected `application/pdf` |
| `cv_storage_bucket` | `varchar(100)` | no | Supabase bucket name once configured |
| `cv_storage_path` | `text` | no | Supabase object key/path |
| `created_at` | `timestamptz` | yes | Row creation time |
| `updated_at` | `timestamptz` | yes | Last update time |

## Suggested SQL sketch

```sql
create table candidate_profiles (
  id uuid primary key,
  first_name varchar(100) not null,
  second_name varchar(100) not null,
  email varchar(255) not null unique,
  linkedin_url text,
  github_url text,
  other_url text,
  persona varchar(50) not null,
  cv_original_filename varchar(255) not null,
  cv_content_type varchar(100) not null default 'application/pdf',
  cv_storage_bucket varchar(100),
  cv_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Notes

- Keep persona as a simple string for now. It can later become a foreign key if
  personas are normalized into a separate table.
- If multiple social links per type are needed later, split links into a
  separate `candidate_social_links` table.
- Passport photo storage can be added later as separate columns or a separate
  asset table once that part of the upload flow is implemented.
