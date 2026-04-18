-- ============================================================
-- TAMALO – Database Schema
-- Run this entire file in Supabase → SQL Editor → New query
-- ============================================================

-- PLAYERS
create table if not exists players (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  name_lower  text not null unique,
  pin_hash    text not null,
  avatar_url  text,
  games_played int default 0,
  games_won   int default 0,
  total_rounds int default 0,
  created_at  timestamptz default now()
);

-- GAMES
create table if not exists games (
  id          uuid default gen_random_uuid() primary key,
  room_code   text not null unique,
  host_id     uuid references players(id),
  status      text default 'waiting',   -- waiting | active | finished
  loser_id    uuid references players(id),
  created_at  timestamptz default now(),
  ended_at    timestamptz
);

-- WHO IS IN EACH GAME
create table if not exists game_players (
  id            uuid default gen_random_uuid() primary key,
  game_id       uuid references games(id) on delete cascade,
  player_id     uuid references players(id),
  current_score int default 0,
  final_score   int,
  placement     int,
  joined_at     timestamptz default now(),
  unique(game_id, player_id)
);

-- ROUNDS
create table if not exists rounds (
  id           uuid default gen_random_uuid() primary key,
  game_id      uuid references games(id) on delete cascade,
  round_number int not null,
  created_at   timestamptz default now()
);

-- SCORES PER PLAYER PER ROUND
create table if not exists round_scores (
  id             uuid default gen_random_uuid() primary key,
  round_id       uuid references rounds(id) on delete cascade,
  game_id        uuid references games(id) on delete cascade,
  player_id      uuid references players(id),
  score_delta    int not null,
  total_score    int not null,
  note           text
);

-- ACHIEVEMENTS
create table if not exists achievements (
  id         uuid default gen_random_uuid() primary key,
  player_id  uuid references players(id),
  type       text not null,
  game_id    uuid references games(id),
  earned_at  timestamptz default now(),
  unique(player_id, type)
);

-- ============================================================
-- ROW LEVEL SECURITY (open policies — safe behind publishable key)
-- ============================================================
alter table players     enable row level security;
alter table games       enable row level security;
alter table game_players enable row level security;
alter table rounds      enable row level security;
alter table round_scores enable row level security;
alter table achievements enable row level security;

create policy "public" on players      for all using (true) with check (true);
create policy "public" on games        for all using (true) with check (true);
create policy "public" on game_players for all using (true) with check (true);
create policy "public" on rounds       for all using (true) with check (true);
create policy "public" on round_scores for all using (true) with check (true);
create policy "public" on achievements for all using (true) with check (true);

-- ============================================================
-- STORAGE – avatar uploads
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict do nothing;

create policy "avatar public" on storage.objects
  for all using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
