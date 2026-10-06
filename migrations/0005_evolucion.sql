-- Regla de poke5e: si el jugador pospone la evolución, no puede volver a
-- evolucionar hasta subir otro nivel. Guarda el nivel en que la pospuso;
-- NULL es que nunca la pospuso (o que ya evolucionó).
ALTER TABLE "{{schema}}"."personaje_pokemon"
  ADD COLUMN IF NOT EXISTS personaje_pokemon_evo_pospuesta_nivel integer;
