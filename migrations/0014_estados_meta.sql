-- Datos de los estados alterados (lib/estados.js): rondas que le quedan a
-- Dormido/Confuso/Retroceso, el DC para liberarse de Congelado y el periodo
-- de gracia tras curarse. El texto de *_estados sigue diciendo cuáles tiene.
ALTER TABLE "{{schema}}"."personaje"
  ADD COLUMN IF NOT EXISTS personaje_estados_meta jsonb;
ALTER TABLE "{{schema}}"."personaje_pokemon"
  ADD COLUMN IF NOT EXISTS personaje_pokemon_estados_meta jsonb;
ALTER TABLE "{{schema}}"."master_campo"
  ADD COLUMN IF NOT EXISTS campo_estados_meta jsonb;
