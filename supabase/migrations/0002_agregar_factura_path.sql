-- ============================================================================
-- Agrega la columna para asociar la imagen de la factura (Google Cloud
-- Storage) a la transacción que se creó a partir de ella.
--
-- Nullable a proposito: la mayoria de las transacciones se crean a mano, sin
-- factura escaneada. Guarda solo el nombre del objeto en el bucket (no una
-- URL publica, el bucket es privado), ej. "<id_usuario>/<id_transaccion>.jpg".
-- ============================================================================

alter table public.transacciones
  add column if not exists factura_path text;
