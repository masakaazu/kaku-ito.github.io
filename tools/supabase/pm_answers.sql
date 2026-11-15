-- 午後（科目B）の記述の答え・自己採点を端末間で同期するためのテーブル
-- Supabase の SQL Editor に貼って1回だけ実行する（study_notes.sql と同じ作り）。
-- question_key は "2024r06a-1"（回-問）、part_id は "s1" "s3-a" "s6-1"。
-- part_id "_" の行は、問い全体（かかった時間・最後に採点した日時）。
-- grade は自己採点：good（○）／fair（△）／bad（×）。まだ採点していなければ null。
-- graded_at は「採点を記録する」を押した日時（まだ記録していなければ null）。
-- history は前回までの [{ "at": 日時, "answer": 文字, "grade": "fair", "sec": 秒 }]（新しい順、10件まで）。
--   part_id "_" の行の history は、記録した回の [{ "at": 日時, "sec": 秒, "good": 2, "fair": 1, "bad": 0, "total": 3 }]。

create table if not exists public.pm_answers (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_key text not null check (char_length(question_key) between 1 and 40),
  part_id text not null check (char_length(part_id) between 1 and 20),
  answer text not null default '' check (char_length(answer) <= 2000),
  grade text check (grade in ('good', 'fair', 'bad')),
  graded_at timestamptz,
  elapsed_sec integer check (elapsed_sec is null or elapsed_sec >= 0),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array' and jsonb_array_length(history) <= 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_key, part_id)
);

alter table public.pm_answers enable row level security;

create policy "自分の答えだけ読める" on public.pm_answers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "自分の答えだけ追加できる" on public.pm_answers
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "自分の答えだけ更新できる" on public.pm_answers
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "自分の答えだけ削除できる" on public.pm_answers
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.pm_answers to authenticated;
