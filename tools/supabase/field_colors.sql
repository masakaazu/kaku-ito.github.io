-- 分野マップの目印の色（周回の目印など）を端末間で同期するためのテーブル
-- Supabase の SQL Editor に貼って1回だけ実行する。
-- field_key は "ap:11"（資格:中分類番号）。color の "none" は「色なし」に戻したことを表す。

create table if not exists public.field_colors (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z]+:[0-9]{1,2}$'),
  color text not null check (color in ('none', 'red', 'orange', 'green', 'blue', 'purple')),
  updated_at timestamptz not null default now(),
  primary key (user_id, field_key)
);

alter table public.field_colors enable row level security;

create policy "自分の分野色だけ読める" on public.field_colors
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "自分の分野色だけ追加できる" on public.field_colors
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "自分の分野色だけ更新できる" on public.field_colors
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "自分の分野色だけ削除できる" on public.field_colors
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.field_colors to authenticated;
