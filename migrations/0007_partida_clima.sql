-- Clima de combate de la partida (sol, lluvia, tormenta de arena, granizo,
-- nieve, niebla). Lo pone el máster; se guarda para que sobreviva a una
-- recarga, igual que el pin del mapa. NULL es sin clima.
ALTER TABLE "{{schema}}"."partida"
  ADD COLUMN IF NOT EXISTS partida_clima text;
