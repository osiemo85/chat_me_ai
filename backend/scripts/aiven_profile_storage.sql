create table if not exists candidate_profiles (
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
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists profile_assets (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  asset_type varchar(30) not null,
  original_filename varchar(255) not null,
  content_type varchar(100) not null,
  storage_bucket varchar(100) not null,
  storage_path text not null,
  upload_status varchar(30) not null default 'pending',
  is_current boolean not null default false,
  version integer not null default 1,
  replaced_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists profile_assets_one_current_per_type
  on profile_assets (candidate_profile_id, asset_type)
  where is_current = true;

create table if not exists chunks (
  id uuid primary key,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  profile_asset_id uuid not null references profile_assets(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding_model varchar(120),
  embedding_status varchar(30) not null default 'pending',
  embedding jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null
);

create index if not exists chunks_profile_lookup_idx
  on chunks (candidate_profile_id, profile_asset_id, chunk_index);
