create extension if not exists pg_trgm;

create index participants_active_name_normalized_trgm_idx
  on public.participants using gin (name_normalized gin_trgm_ops)
  where is_active;
