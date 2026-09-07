-- ============================================================================
-- Reportes financieros — funciones SQL para el módulo de Reportes.
--
-- No crea ni modifica tablas: son dos funciones que agrupan y suman
-- `transacciones` directamente en Postgres, en vez de traer todas las filas y
-- calcularlo en JavaScript. `security invoker` + `auth.uid()` (en lugar de
-- recibir el uid como parámetro) para que las mismas políticas de RLS que ya
-- protegen `transacciones` y `categorias` apliquen aquí también.
--
-- Las dos devuelven montos separados por `moneda_origen`: la conversión a la
-- moneda activa del usuario se sigue haciendo en el cliente (FinanzasContext),
-- igual que en el resto de la app.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reporte_comparativa_mensual — ingresos y gastos agrupados por año/mes.
--
-- p_meses controla cuántos meses hacia atrás se incluyen (por defecto 12,
-- contando el mes actual). La vista anual de la página de Reportes se arma
-- sumando estas mismas filas por año en el cliente, sin otra función SQL.
-- ---------------------------------------------------------------------------
create or replace function public.reporte_comparativa_mensual(p_meses int default 12)
returns table (
  anio          smallint,
  mes           smallint,
  tipo          public.tipo_transaccion,
  moneda_origen text,
  total         numeric
)
language sql
security invoker
stable
as $$
  select
    extract(year  from t.fecha)::smallint as anio,
    extract(month from t.fecha)::smallint as mes,
    t.tipo,
    t.moneda_origen,
    sum(t.monto) as total
  from public.transacciones t
  where t.id_usuario = auth.uid()
    and t.fecha >= (date_trunc('month', current_date) - (p_meses - 1) * interval '1 month')::date
  group by 1, 2, 3, 4
  order by 1, 2;
$$;

-- ---------------------------------------------------------------------------
-- reporte_promedio_categoria — promedio mensual de gasto por categoría.
--
-- El promedio se calcula sobre p_meses (el periodo pedido), no solo sobre los
-- meses en que hubo movimiento, para que "promedio mensual" refleje el ritmo
-- de gasto real del periodo y no lo infle si un mes no se gastó nada.
-- ---------------------------------------------------------------------------
create or replace function public.reporte_promedio_categoria(p_meses int default 6)
returns table (
  id_categoria          uuid,
  nombre_categoria      text,
  moneda_origen         text,
  total_gastado         numeric,
  meses_con_movimiento  bigint,
  promedio_mensual      numeric
)
language sql
security invoker
stable
as $$
  select
    c.id_categoria,
    c.nombre as nombre_categoria,
    t.moneda_origen,
    sum(t.monto) as total_gastado,
    count(distinct date_trunc('month', t.fecha)) as meses_con_movimiento,
    round(sum(t.monto) / p_meses, 2) as promedio_mensual
  from public.transacciones t
  join public.categorias c on c.id_categoria = t.id_categoria
  where t.id_usuario = auth.uid()
    and t.tipo = 'expense'
    and t.fecha >= (date_trunc('month', current_date) - (p_meses - 1) * interval '1 month')::date
  group by c.id_categoria, c.nombre, t.moneda_origen
  order by total_gastado desc;
$$;

-- solo usuarios con sesión (autenticados) pueden llamarlas
revoke all on function public.reporte_comparativa_mensual(int) from public, anon;
grant execute on function public.reporte_comparativa_mensual(int) to authenticated;

revoke all on function public.reporte_promedio_categoria(int) from public, anon;
grant execute on function public.reporte_promedio_categoria(int) to authenticated;
