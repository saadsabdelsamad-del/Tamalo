-- ============================================================
-- TAMALO v2 – Card Game Tables
-- Run this in Supabase → SQL Editor → New query
-- ============================================================

create table if not exists game_rounds (
  id                   uuid default gen_random_uuid() primary key,
  game_id              uuid references games(id) on delete cascade,
  round_number         int not null,
  status               text default 'peek', -- peek | playing | tamalo_called | revealing | scored
  turn_order           jsonb default '[]',
  current_turn_index   int default 0,
  tamalo_caller_id     uuid references players(id),
  tamalo_turns_left    int default 0,
  peek_ready           jsonb default '{}',
  deck                 jsonb default '[]',
  discard_pile         jsonb default '[]',
  drawn_card           text,
  drawn_from           text,
  pending_power        text,
  pending_power_target jsonb,
  last_discard         text,
  last_discard_by      uuid references players(id),
  slap_window          bool default false,
  created_at           timestamptz default now()
);

create table if not exists player_hand_cards (
  id             uuid default gen_random_uuid() primary key,
  game_round_id  uuid references game_rounds(id) on delete cascade,
  player_id      uuid references players(id),
  position       int not null,
  card_code      text not null,
  revealed       bool default false,
  unique(game_round_id, player_id, position)
);

create table if not exists player_known_cards (
  id             uuid default gen_random_uuid() primary key,
  game_round_id  uuid references game_rounds(id) on delete cascade,
  viewer_id      uuid references players(id),
  owner_id       uuid references players(id),
  position       int not null,
  card_code      text not null,
  unique(game_round_id, viewer_id, owner_id, position)
);

alter table game_rounds       enable row level security;
alter table player_hand_cards enable row level security;
alter table player_known_cards enable row level security;

create policy "public" on game_rounds        for all using (true) with check (true);
create policy "public" on player_hand_cards  for all using (true) with check (true);
create policy "public" on player_known_cards for all using (true) with check (true);

-- Add loser_name column to games if it doesn't exist yet
alter table games add column if not exists loser_name text;
