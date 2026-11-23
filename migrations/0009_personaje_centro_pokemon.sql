-- "En centro Pokémon" (por jugador, lo marca el máster junto a "Editable").
-- Desactivado (por defecto) el entrenador no puede mover Pokémon entre el
-- cinturón y la Femputadora, ni liberarlos ni transferirlos: la narrativa no
-- lo permite hasta que llegue a un centro Pokémon.
ALTER TABLE "{{schema}}"."personaje"
  ADD COLUMN IF NOT EXISTS personaje_en_centro_pokemon boolean NOT NULL DEFAULT false;
