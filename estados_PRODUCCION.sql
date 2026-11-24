-- =====================================================================
-- Producción (Supabase) · estados alterados en mesa (2026-11-24)
--   - Estados de los Pokémon y NPC del DM
--   - Datos de cada estado (rondas, DC de Congelado, periodo de gracia)
--
-- Corresponde a migrations/0013_campo_estados.sql y 0014_estados_meta.sql.
-- Aplicar ANTES de desplegar el back nuevo: sin estas columnas el campo de
-- la partida, la party y los estados fallan.
--
-- - Va en una transacción y se puede ejecutar más de una vez.
-- - Solo agrega columnas (vacías): no borra ni modifica datos.
-- - Los proyectiles (items de tipo "Proyectil") ya existen en producción:
--   este script no los toca; la verificación solo los cuenta.
-- =====================================================================

BEGIN;

-- 0013 · Estado de cada Pokémon o NPC invocado por el DM
ALTER TABLE juego.master_campo
  ADD COLUMN IF NOT EXISTS campo_estados text;

-- 0014 · Datos de los estados
ALTER TABLE juego.personaje
  ADD COLUMN IF NOT EXISTS personaje_estados_meta jsonb;
ALTER TABLE juego.personaje_pokemon
  ADD COLUMN IF NOT EXISTS personaje_pokemon_estados_meta jsonb;
ALTER TABLE juego.master_campo
  ADD COLUMN IF NOT EXISTS campo_estados_meta jsonb;

INSERT INTO juego.schema_migrations (name) VALUES
  ('0013_campo_estados.sql'),
  ('0014_estados_meta.sql')
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- ── Verificación (ejecútala después; debe devolver 6 filas en "ok") ──
-- Las dos últimas cuentan los proyectiles. La app reconoce uno elemental por
-- su descripción: "Elemental …" (inglés, producción) o "cambia su tipo a <Tipo>"
-- (español, CSV local).
SELECT 'master_campo.campo_estados' AS objeto,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'juego'
                AND table_name = 'master_campo' AND column_name = 'campo_estados') AS ok
UNION ALL
SELECT 'master_campo.campo_estados_meta',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'juego'
                AND table_name = 'master_campo' AND column_name = 'campo_estados_meta')
UNION ALL
SELECT 'personaje.personaje_estados_meta',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'juego'
                AND table_name = 'personaje' AND column_name = 'personaje_estados_meta')
UNION ALL
SELECT 'personaje_pokemon.personaje_pokemon_estados_meta',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'juego'
                AND table_name = 'personaje_pokemon' AND column_name = 'personaje_pokemon_estados_meta')
UNION ALL
SELECT 'proyectiles en items (113 esperados)', COUNT(*) >= 113
  FROM juego.items WHERE item_type = 'Proyectil'
UNION ALL
SELECT 'proyectiles elementales (90 esperados)', COUNT(*) = 90
  FROM juego.items WHERE item_type = 'Proyectil'
   AND (item_description ILIKE 'Elemental%' OR item_description ILIKE '%cambia su tipo a%');
