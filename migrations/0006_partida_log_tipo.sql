-- Tipo de cada línea del registro de la partida (captura, evolución, nivel,
-- item, ataque, aparición, tirada...). Sirve para armar el resumen de la
-- sesión anterior sin tener que adivinar el tipo leyendo el texto. Las líneas
-- anteriores a esta migración quedan sin tipo.
ALTER TABLE "{{schema}}"."partida_log"
  ADD COLUMN IF NOT EXISTS partida_log_tipo text;
