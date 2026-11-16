-- Rasoi — Supabase schema (Postgres)
-- Mirrors src/data/types.ts. The prototype runs on localStorage; this is the
-- shape to move to when two phones need to share one household.

create extension if not exists "pgcrypto";

-- Users map 1:1 to auth.users (magic link or anonymous sign-in keeps onboarding simple)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique check (code ~ '^[2-9A-HJ-KM-NP-Z]{6}$'),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  hue smallint not null default 0,
  profile jsonb not null,         -- Profile: goal, targets, diet, dislikes, portion style, breakfast ramp…
  sharing jsonb not null default '{"fullLog":true,"calories":true,"protein":true,"mealCompletion":true}',
  tips jsonb not null default '{}',
  joined_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (user_id)                -- one household per person
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  name text not null default 'Our week',
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  day smallint not null check (day between 0 and 6),          -- 0 = Monday
  slot text not null check (slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  items jsonb not null default '[]', -- MealItem[]: foodId, lighter/hearty portions, alts, optional, onlyFor
  unique (meal_plan_id, day, slot)
);

-- Built-in foods ship with the app; this table holds custom + recipe foods.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.users (id),
  name text not null,
  category text not null,
  per100 jsonb not null,           -- {kcal, protein, carbs, fat, fibre} per 100 g / 100 ml (estimate)
  units jsonb not null,            -- [{name, grams, label?}]
  default_unit text not null,
  default_amount numeric not null default 1,
  fv_per100 numeric,
  produce text[],
  tags text[],
  recipe_id uuid,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.users (id),
  name text not null,
  servings smallint not null check (servings > 0),
  ingredients jsonb not null,      -- [{foodId, amount, unit}]
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  meal_item_id text,               -- set when ticking a planned item
  food_id text not null,           -- built-in id (e.g. 'rice') or foods.id
  status text not null check (status in ('eaten', 'partial', 'skipped')),
  amount numeric not null,
  unit text not null,
  fraction numeric not null default 1 check (fraction between 0 and 1),
  nutrients jsonb not null,        -- snapshot at log time (estimate)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_logs_user_date on public.food_logs (user_id, date);
create unique index food_logs_one_per_item on public.food_logs (user_id, date, meal_item_id) where meal_item_id is not null;

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  kg numeric(5, 1) not null check (kg between 20 and 300),
  unique (user_id, date)
);

create table public.water_logs (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  glasses smallint not null default 0,
  primary key (user_id, date)
);

create table public.item_choices (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  meal_item_id text not null,
  alt_index smallint not null default -1,
  primary key (user_id, date, meal_item_id)
);

-- ——— Row level security ———
-- Members can read/write everything in their household; personal logs are
-- writable only by their owner. What the *other* person sees of your logs is
-- filtered by `household_members.sharing` (enforce in a view or RPC).

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meals enable row level security;
alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.food_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.item_choices enable row level security;

create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from household_members where user_id = auth.uid()
$$;

create policy "read housemates" on public.users for select using (
  id = auth.uid() or id in (select user_id from household_members where household_id = my_household())
);
create policy "edit self" on public.users for all using (id = auth.uid()) with check (id = auth.uid());

create policy "members read household" on public.households for select using (id = my_household());
create policy "members rename household" on public.households for update using (id = my_household());
create policy "create household" on public.households for insert with check (created_by = auth.uid());

create policy "members read members" on public.household_members for select using (household_id = my_household());
create policy "edit own membership" on public.household_members for update using (user_id = auth.uid());

create policy "plan read/write" on public.meal_plans for all using (household_id = my_household()) with check (household_id = my_household());
create policy "meals read/write" on public.meals for all
  using (meal_plan_id in (select id from meal_plans where household_id = my_household()))
  with check (meal_plan_id in (select id from meal_plans where household_id = my_household()));
create policy "foods read/write" on public.foods for all using (household_id = my_household()) with check (household_id = my_household());
create policy "recipes read/write" on public.recipes for all using (household_id = my_household()) with check (household_id = my_household());

create policy "logs read household" on public.food_logs for select using (household_id = my_household());
create policy "logs write own" on public.food_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weight own only" on public.weight_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "water own" on public.water_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "choices own" on public.item_choices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Joining by code: the joiner isn't a member yet, so do it in a function.
create or replace function public.join_household(join_code text, member_profile jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare hh uuid; n int;
begin
  select id into hh from households where code = upper(join_code);
  if hh is null then raise exception 'not-found'; end if;
  select count(*) into n from household_members where household_id = hh;
  if n >= 2 then raise exception 'full'; end if;
  insert into household_members (household_id, user_id, role, hue, profile)
  values (hh, auth.uid(), 'member', n, member_profile);
  return hh;
end $$;

-- Realtime: both phones subscribe to changes filtered by household_id.
alter publication supabase_realtime add table public.food_logs, public.meals, public.household_members;
