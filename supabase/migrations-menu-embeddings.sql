-- Semantic menu search. Run once in the Supabase SQL editor.
-- 1536 dimensions = OpenAI text-embedding-3-small. Stay on that model.
-- The WhatsApp cart stays on whatsapp_sessions.cart (checkout, gifts, and the
-- 3-dish cap already write that row). This file only adds dish matching.

create extension if not exists vector;

alter table menu_items add column if not exists aliases text;
alter table menu_items add column if not exists embedding vector(1536);

create or replace function match_menu_items(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (id uuid, name text, similarity float)
language sql
stable
as $$
  select
    menu_items.id,
    menu_items.name,
    (1 - (menu_items.embedding <=> query_embedding))::float as similarity
  from menu_items
  where menu_items.embedding is not null
    and coalesce(menu_items.is_available, true)
    and 1 - (menu_items.embedding <=> query_embedding) > match_threshold
  order by menu_items.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function match_menu_items(vector, float, int) from public;
grant execute on function match_menu_items(vector, float, int) to service_role;
