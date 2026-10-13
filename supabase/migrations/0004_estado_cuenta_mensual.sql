-- ---------------------------------------------------------------------------
-- 0004 — Estado de cuenta mensual
--
-- El job que manda el estado de cuenta por correo no corre con la sesión de
-- nadie: lo dispara Cloud Scheduler. Por eso no puede usar las funciones de
-- 0003_reportes.sql, que se apoyan en auth.uid() para saber de quién son los
-- datos.
--
-- Estas funciones reciben el id del usuario y son SECURITY DEFINER, así que
-- se les revoca el permiso a los roles anon y authenticated: solo la
-- service_role key, que vive únicamente en el servidor, puede ejecutarlas.
-- ---------------------------------------------------------------------------

-- preferencia para recibir (o no) el estado de cuenta mensual
alter table public.usuarios
  add column if not exists notif_reporte_mensual boolean not null default true;

-- ---------------------------------------------------------------------------
-- usuarios a los que les toca el envío
-- ---------------------------------------------------------------------------
create or replace function public.usuarios_reporte_mensual()
returns table (
  id_usuario uuid,
  nombre     text,
  email      text,
  moneda     text
)
language sql
security definer
set search_path = public
as $$
  select u.id_usuario, u.nombre, u.email, u.moneda
  from public.usuarios u
  where u.notif_reporte_mensual
    and u.email is not null
    and u.email <> ''
$$;

revoke execute on function public.usuarios_reporte_mensual() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- resumen del mes de un usuario
--
-- Nota: los montos se suman tal como fueron registrados, sin convertir entre
-- monedas. La app guarda moneda_origen por transacción, de modo que un usuario
-- que registre en dos monedas distintas vería un total mezclado. Se asume una
-- sola moneda por usuario, que es el caso real hoy; convertir aquí exigiría
-- traer el tipo de cambio a la base de datos.
-- ---------------------------------------------------------------------------
create or replace function public.estado_cuenta_mensual(
  p_user_id uuid,
  p_anio    int,
  p_mes     int
)
returns json
language sql
security definer
set search_path = public
as $$
  with periodo as (
    select
      make_date(p_anio, p_mes, 1) as inicio,
      (make_date(p_anio, p_mes, 1) + interval '1 month')::date as fin
  ),
  movimientos as (
    select t.*
    from public.transacciones t, periodo p
    where t.id_usuario = p_user_id
      and t.fecha >= p.inicio
      and t.fecha <  p.fin
  ),
  totales as (
    select
      coalesce(sum(monto) filter (where tipo = 'income'),  0) as ingresos,
      coalesce(sum(monto) filter (where tipo = 'expense'), 0) as gastos,
      count(*) as movimientos
    from movimientos
  ),
  gasto_por_categoria as (
    select
      coalesce(c.nombre, 'Sin categoría') as categoria,
      sum(m.monto) as total
    from movimientos m
    left join public.categorias c on c.id_categoria = m.id_categoria
    where m.tipo = 'expense'
    group by 1
    order by 2 desc
  ),
  presupuestos_mes as (
    select
      c.nombre            as categoria,
      pr.limite_mensual   as limite,
      coalesce((
        select sum(m.monto)
        from movimientos m
        where m.id_categoria = pr.id_categoria
          and m.tipo = 'expense'
      ), 0) as gastado
    from public.presupuestos pr
    join public.categorias c on c.id_categoria = pr.id_categoria
    where pr.id_usuario = p_user_id
      and pr.anio = p_anio
      and pr.mes  = p_mes
    order by c.nombre
  ),
  metas_usuario as (
    select nombre, objetivo, monto_actual as actual, fecha_limite
    from public.metas
    where id_usuario = p_user_id
    order by nombre
  )
  select json_build_object(
    'anio',          p_anio,
    'mes',           p_mes,
    'ingresos',      (select ingresos from totales),
    'gastos',        (select gastos from totales),
    'balance',       (select ingresos - gastos from totales),
    'movimientos',   (select movimientos from totales),
    'categorias',    coalesce((
                       select json_agg(json_build_object('categoria', categoria, 'total', total))
                       from gasto_por_categoria
                     ), '[]'::json),
    'presupuestos',  coalesce((
                       select json_agg(json_build_object('categoria', categoria, 'limite', limite, 'gastado', gastado))
                       from presupuestos_mes
                     ), '[]'::json),
    'metas',         coalesce((
                       select json_agg(json_build_object('nombre', nombre, 'objetivo', objetivo, 'actual', actual, 'fechaLimite', fecha_limite))
                       from metas_usuario
                     ), '[]'::json)
  )
$$;

revoke execute on function public.estado_cuenta_mensual(uuid, int, int) from anon, authenticated;
