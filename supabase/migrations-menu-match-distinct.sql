-- One row per dish name in semantic search.
-- Checked 6 Oct 2026: group by name, price having count(*) > 1 returned 0 rows.
-- The picker repeats were the base row plus the 500gm and 1kg rows of the same
-- dish (different names, and orders already point at the size rows). Those
-- rows stay. This only stops two identical names from both coming back.

create or replace function match_menu_items(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (id uuid, name text, similarity float)
language sql
stable
as $$
  select id, name, similarity
  from (
    select distinct on (lower(btrim(menu_items.name)))
      menu_items.id,
      menu_items.name,
      (1 - (menu_items.embedding <=> query_embedding))::float as similarity
    from menu_items
    where menu_items.embedding is not null
      and coalesce(menu_items.is_available, true)
      and 1 - (menu_items.embedding <=> query_embedding) > match_threshold
    order by lower(btrim(menu_items.name)), menu_items.embedding <=> query_embedding
  ) unique_names
  order by similarity desc
  limit match_count;
$$;

revoke all on function match_menu_items(vector, float, int) from public;
grant execute on function match_menu_items(vector, float, int) to service_role;
