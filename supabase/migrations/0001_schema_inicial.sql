-- ============================================================================
-- FinanSync — schema inicial (Supabase / Postgres)
-- ============================================================================
--
-- Cómo aplicarlo:
--   Dashboard de Supabase → SQL Editor → New query → pegar todo → Run.
--
-- El script es idempotente: se puede volver a correr sin romper nada.
--
-- Modelo (cinco tablas, según el diagrama entidad-relación del proyecto):
--
--   usuarios      perfil y preferencias. Su id_usuario ES el id de auth.users.
--   categorias    categorías propias de cada usuario (antes un arreglo de texto).
--   transacciones ingresos y gastos.
--   metas         metas de ahorro.
--   presupuestos  límite de gasto por categoría y mes.
--
-- Equivalencias con el modelo anterior de Firestore:
--   users/{uid}                → usuarios
--   users/{uid}.categorias[]   → categorias (una fila por categoría)
--   transacciones/{id}         → transacciones
--   metas/{id}                 → metas
--   presupuestos/{id}          → presupuestos
--
-- Todas las tablas cuelgan de auth.users con ON DELETE CASCADE, así que borrar
-- una cuenta arrastra todos sus datos.
-- ============================================================================

-- gen_random_uuid() para las llaves primarias
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum para el tipo de transacción.
-- Antes era texto libre ('INGRESO' / 'GASTO'); ahora Postgres valida el valor.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_transaccion') then
    create type public.tipo_transaccion as enum ('income', 'expense');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- usuarios — perfil y preferencias
--
-- No reemplaza a auth.users (esa tabla la administra Supabase y no se toca):
-- es una tabla espejo en el esquema public, con el mismo id, donde sí podemos
-- guardar campos propios. La fila se crea sola con el trigger del final.
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id_usuario         uuid primary key references auth.users (id) on delete cascade,
  nombre             text,
  email              text,

  -- moneda activa; las transacciones guardan además su moneda de origen
  moneda             text        not null default 'GTQ',

  -- preferencias de notificaciones
  notif_presupuesto  boolean     not null default true,
  notif_metas        boolean     not null default true,
  notif_ia           boolean     not null default true,

  -- Lista de nombres de las categorías del usuario, tal como aparece en el
  -- diagrama. NO se escribe a mano desde la app: la mantiene al día el trigger
  -- `categorias_sincronizar` cada vez que cambia la tabla `categorias`, así que
  -- las dos representaciones nunca se pueden desincronizar.
  -- La fuente de la verdad sigue siendo la tabla `categorias`, porque es la que
  -- transacciones y presupuestos referencian por llave foránea.
  categorias         text[]      not null default '{}',

  creado_en          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categorias — una fila por categoría de cada usuario
--
-- Antes vivían como arreglo de texto dentro del perfil. Al normalizarlas,
-- transacciones y presupuestos pueden referenciarlas por llave foránea y
-- renombrar una categoría deja de significar editar cada fila que la usaba.
-- ---------------------------------------------------------------------------
create table if not exists public.categorias (
  id_categoria  uuid primary key default gen_random_uuid(),
  id_usuario    uuid not null references public.usuarios (id_usuario) on delete cascade,
  nombre        text not null,
  creado_en     timestamptz not null default now(),

  -- el mismo usuario no puede tener dos categorías con el mismo nombre
  constraint categorias_nombre_unico unique (id_usuario, nombre)
);

create index if not exists categorias_usuario_idx
  on public.categorias (id_usuario);

-- ---------------------------------------------------------------------------
-- transacciones — ingresos y gastos
--
-- id_categoria usa ON DELETE SET NULL a propósito: si el usuario borra una
-- categoría, la transacción se conserva y solo queda sin clasificar. Un CASCADE
-- aquí le borraría el historial financiero, que es justo lo que no queremos.
-- ---------------------------------------------------------------------------
create table if not exists public.transacciones (
  id_transaccion  uuid primary key default gen_random_uuid(),
  id_usuario      uuid not null references auth.users (id) on delete cascade,
  id_categoria    uuid references public.categorias (id_categoria) on delete set null,

  descripcion     text not null,

  -- una sola columna date; antes eran dos campos (fecha visible + fechaISO)
  fecha           date not null,
  monto           numeric(14,2) not null,
  tipo            public.tipo_transaccion not null,

  -- moneda en que se registró el monto, para que el histórico no se distorsione
  moneda_origen   text not null default 'GTQ',
  creado_en       timestamptz not null default now()
);

-- el listado siempre pide "las mías, más recientes primero"
create index if not exists transacciones_usuario_fecha_idx
  on public.transacciones (id_usuario, fecha desc);

create index if not exists transacciones_categoria_idx
  on public.transacciones (id_categoria);

-- ---------------------------------------------------------------------------
-- metas — metas de ahorro
--
-- No hay columna `completada`, igual que en el diagrama: una meta está cumplida
-- cuando monto_actual >= objetivo, y eso ya se sabe con los datos que hay. Una
-- columna aparte podría quedar en `false` con la meta ya alcanzada.
-- ---------------------------------------------------------------------------
create table if not exists public.metas (
  id_meta        uuid primary key default gen_random_uuid(),
  id_usuario     uuid not null references auth.users (id) on delete cascade,
  nombre         text not null,
  objetivo       numeric(14,2) not null default 0 check (objetivo >= 0),
  monto_actual   numeric(14,2) not null default 0 check (monto_actual >= 0),
  fecha_limite   date,
  color          text not null default '#22c55e',
  icono          text not null default '🎯',
  moneda_origen  text not null default 'GTQ',
  creado_en      timestamptz not null default now()
);

create index if not exists metas_usuario_idx
  on public.metas (id_usuario);

-- ---------------------------------------------------------------------------
-- presupuestos — límite de gasto por categoría y mes
--
-- Aquí sí conviene CASCADE: un presupuesto de una categoría que ya no existe
-- no significa nada.
-- ---------------------------------------------------------------------------
create table if not exists public.presupuestos (
  id_presupuesto  uuid primary key default gen_random_uuid(),
  id_usuario      uuid not null references auth.users (id) on delete cascade,
  id_categoria    uuid not null references public.categorias (id_categoria) on delete cascade,

  limite_mensual  numeric(14,2) not null default 0 check (limite_mensual >= 0),
  mes             smallint not null check (mes between 1 and 12),
  anio            smallint not null check (anio between 2000 and 2200),
  color           text not null default '#3b82f6',
  icono           text not null default '📋',
  moneda_origen   text not null default 'GTQ',
  creado_en       timestamptz not null default now(),

  -- sin esto se podrían crear dos presupuestos de la misma categoría para el
  -- mismo mes y el progreso mostrado saldría mal
  constraint presupuestos_unico unique (id_usuario, id_categoria, mes, anio)
);

create index if not exists presupuestos_usuario_periodo_idx
  on public.presupuestos (id_usuario, anio, mes);

-- ============================================================================
-- Row Level Security
--
-- Reemplaza a las reglas de Firestore, con una diferencia importante: Postgres
-- las aplica dentro de la propia base de datos. No importa qué consulta mande
-- el cliente, solo puede alcanzar sus propias filas.
--
-- auth.uid() devuelve el id del usuario del token que viene en la petición.
-- ============================================================================

alter table public.usuarios      enable row level security;
alter table public.categorias    enable row level security;
alter table public.transacciones enable row level security;
alter table public.metas         enable row level security;
alter table public.presupuestos  enable row level security;

-- --- usuarios (la comparación es contra id_usuario, que ES el id del usuario)

drop policy if exists "usuarios: leer el propio" on public.usuarios;
create policy "usuarios: leer el propio"
  on public.usuarios for select using (auth.uid() = id_usuario);

drop policy if exists "usuarios: crear el propio" on public.usuarios;
create policy "usuarios: crear el propio"
  on public.usuarios for insert with check (auth.uid() = id_usuario);

drop policy if exists "usuarios: actualizar el propio" on public.usuarios;
create policy "usuarios: actualizar el propio"
  on public.usuarios for update using (auth.uid() = id_usuario) with check (auth.uid() = id_usuario);

drop policy if exists "usuarios: borrar el propio" on public.usuarios;
create policy "usuarios: borrar el propio"
  on public.usuarios for delete using (auth.uid() = id_usuario);

-- --- categorias

drop policy if exists "categorias: leer las propias" on public.categorias;
create policy "categorias: leer las propias"
  on public.categorias for select using (auth.uid() = id_usuario);

drop policy if exists "categorias: crear las propias" on public.categorias;
create policy "categorias: crear las propias"
  on public.categorias for insert with check (auth.uid() = id_usuario);

drop policy if exists "categorias: actualizar las propias" on public.categorias;
create policy "categorias: actualizar las propias"
  on public.categorias for update using (auth.uid() = id_usuario) with check (auth.uid() = id_usuario);

drop policy if exists "categorias: borrar las propias" on public.categorias;
create policy "categorias: borrar las propias"
  on public.categorias for delete using (auth.uid() = id_usuario);

-- --- transacciones

drop policy if exists "transacciones: leer las propias" on public.transacciones;
create policy "transacciones: leer las propias"
  on public.transacciones for select using (auth.uid() = id_usuario);

drop policy if exists "transacciones: crear las propias" on public.transacciones;
create policy "transacciones: crear las propias"
  on public.transacciones for insert with check (auth.uid() = id_usuario);

drop policy if exists "transacciones: actualizar las propias" on public.transacciones;
create policy "transacciones: actualizar las propias"
  on public.transacciones for update using (auth.uid() = id_usuario) with check (auth.uid() = id_usuario);

drop policy if exists "transacciones: borrar las propias" on public.transacciones;
create policy "transacciones: borrar las propias"
  on public.transacciones for delete using (auth.uid() = id_usuario);

-- --- metas

drop policy if exists "metas: leer las propias" on public.metas;
create policy "metas: leer las propias"
  on public.metas for select using (auth.uid() = id_usuario);

drop policy if exists "metas: crear las propias" on public.metas;
create policy "metas: crear las propias"
  on public.metas for insert with check (auth.uid() = id_usuario);

drop policy if exists "metas: actualizar las propias" on public.metas;
create policy "metas: actualizar las propias"
  on public.metas for update using (auth.uid() = id_usuario) with check (auth.uid() = id_usuario);

drop policy if exists "metas: borrar las propias" on public.metas;
create policy "metas: borrar las propias"
  on public.metas for delete using (auth.uid() = id_usuario);

-- --- presupuestos

drop policy if exists "presupuestos: leer los propios" on public.presupuestos;
create policy "presupuestos: leer los propios"
  on public.presupuestos for select using (auth.uid() = id_usuario);

drop policy if exists "presupuestos: crear los propios" on public.presupuestos;
create policy "presupuestos: crear los propios"
  on public.presupuestos for insert with check (auth.uid() = id_usuario);

drop policy if exists "presupuestos: actualizar los propios" on public.presupuestos;
create policy "presupuestos: actualizar los propios"
  on public.presupuestos for update using (auth.uid() = id_usuario) with check (auth.uid() = id_usuario);

drop policy if exists "presupuestos: borrar los propios" on public.presupuestos;
create policy "presupuestos: borrar los propios"
  on public.presupuestos for delete using (auth.uid() = id_usuario);

-- ============================================================================
-- Trigger: mantener usuarios.categorias al día
--
-- El diagrama tiene el campo `categorias` dentro de Usuarios y además la tabla
-- Categorias. Guardar lo mismo en dos lugares normalmente termina en datos que
-- no coinciden, así que aquí la copia la mantiene Postgres: cada insert, update
-- o delete en `categorias` vuelve a armar el arreglo del usuario afectado.
-- Es `security definer` para que pueda escribir en `usuarios` sin chocar con RLS.
-- ============================================================================

create or replace function public.sincronizar_categorias_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  objetivo uuid;
begin
  -- en un DELETE la fila nueva no existe, hay que mirar la vieja
  if tg_op = 'DELETE' then
    objetivo := old.id_usuario;
  else
    objetivo := new.id_usuario;
  end if;

  update public.usuarios u
     set categorias = coalesce(
           (select array_agg(c.nombre order by c.nombre)
              from public.categorias c
             where c.id_usuario = objetivo),
           '{}'
         )
   where u.id_usuario = objetivo;

  return null;
end;
$$;

drop trigger if exists categorias_sincronizar on public.categorias;
create trigger categorias_sincronizar
  after insert or update or delete on public.categorias
  for each row execute function public.sincronizar_categorias_usuario();

-- Y por si alguien intentara escribir el arreglo a mano: antes de guardar
-- cualquier cambio en `usuarios`, la columna se vuelve a calcular desde la
-- tabla `categorias`. Así el campo del diagrama es siempre un reflejo fiel y
-- nunca una segunda copia editable.
create or replace function public.usuarios_categorias_solo_lectura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.categorias := coalesce(
    (select array_agg(c.nombre order by c.nombre)
       from public.categorias c
      where c.id_usuario = new.id_usuario),
    '{}'
  );
  return new;
end;
$$;

drop trigger if exists usuarios_categorias_solo_lectura on public.usuarios;
create trigger usuarios_categorias_solo_lectura
  before update on public.usuarios
  for each row execute function public.usuarios_categorias_solo_lectura();

-- ============================================================================
-- Trigger: crear el usuario y sus categorías al registrarse
--
-- Antes la app insertaba el perfil desde el cliente después del registro, y
-- quien entraba con Google nunca lo obtenía. Hacerlo en la base garantiza que
-- exista siempre, sin importar por dónde entró.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id_usuario, nombre, email)
  values (
    new.id,
    -- 'nombre' lo manda el formulario de registro; 'full_name' / 'name' vienen de Google
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email
  )
  on conflict (id_usuario) do nothing;

  -- categorías por defecto, una fila cada una. 'Ahorro' se incluye porque la
  -- app la usa al registrar un aporte a una meta como gasto.
  insert into public.categorias (id_usuario, nombre)
  select new.id, c.nombre
  from unnest(array[
    'Alimentación','Transporte','Entretenimiento',
    'Salud','Educación','Vivienda','Ropa','Ahorro'
  ]) as c(nombre)
  on conflict (id_usuario, nombre) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Borrar la propia cuenta
--
-- Eliminar de auth.users exige permisos de servicio. En lugar de exponer la
-- service_role key en el navegador, se expone esta función security definer,
-- que solo puede borrar al usuario que la invoca. El ON DELETE CASCADE se
-- encarga del resto de sus datos.
-- ============================================================================

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No hay sesión activa';
  end if;

  delete from auth.users where id = uid;
end;
$$;

-- que solo la pueda llamar alguien con sesión, nunca un visitante anónimo
revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
