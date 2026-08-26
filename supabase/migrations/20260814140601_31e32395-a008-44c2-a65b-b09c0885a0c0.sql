-- roles
create type public.app_role as enum ('master','editor','viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_master(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'master')
$$;

create or replace function public.can_write(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and p.approved and r.role in ('master','editor')
  )
$$;

create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and approved)
$$;

-- profiles policies
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_master(auth.uid()));
create policy "master updates profiles" on public.profiles for update to authenticated
  using (public.is_master(auth.uid())) with check (public.is_master(auth.uid()));

-- user_roles policies
create policy "roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_master(auth.uid()));
create policy "master manages roles" on public.user_roles for all to authenticated
  using (public.is_master(auth.uid())) with check (public.is_master(auth.uid()));
grant insert, update, delete on public.user_roles to authenticated;

-- signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _master boolean;
begin
  _master := lower(new.email) = 'wesleyjunio197@gmail.com';
  insert into public.profiles (id, email, full_name, avatar_url, approved)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
          new.raw_user_meta_data->>'avatar_url', _master)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, case when _master then 'master'::public.app_role else 'viewer'::public.app_role end)
  on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- lock down app tables
do $$
declare t text;
begin
  foreach t in array array['categories','suppliers','units','products','stock_movements','stock_counts','stock_count_items','purchase_orders','purchase_order_items','app_users','settings']
  loop
    execute format('drop policy if exists open on public.%I', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "read approved" on public.%I for select to authenticated using (public.is_approved(auth.uid()))', t);
    execute format('create policy "write editors" on public.%I for insert to authenticated with check (public.can_write(auth.uid()))', t);
    execute format('create policy "update editors" on public.%I for update to authenticated using (public.can_write(auth.uid())) with check (public.can_write(auth.uid()))', t);
    execute format('create policy "delete editors" on public.%I for delete to authenticated using (public.can_write(auth.uid()))', t);
  end loop;
end $$;