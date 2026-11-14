-- 用語・問題・分野に書いたメモを端末間で同期するためのテーブル
-- Supabase の SQL Editor に貼って1回だけ実行する。
-- note_key は、用語なら "ap-6-PLL"（回答記録と同じID）、問題なら "q:ap-6-r03a-q22"、分野なら "field:ap:6"。
-- body が空のメモは「消した」ことを表す（ほかの端末にも消したことを伝えるために行は残す）。

create table if not exists public.study_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_key text not null check (char_length(note_key) between 1 and 300),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, note_key)
);

alter table public.study_notes enable row level security;

create policy "自分のメモだけ読める" on public.study_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "自分のメモだけ追加できる" on public.study_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "自分のメモだけ更新できる" on public.study_notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "自分のメモだけ削除できる" on public.study_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.study_notes to authenticated;
