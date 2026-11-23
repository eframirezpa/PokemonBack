-- "En centro Pokémon" (por jugador): sin él, el entrenador no mueve, libera ni
-- transfiere Pokémon de su cinturón y Femputadora. Arranca desactivado para todos.
-- Misma migración que migrations/0009_personaje_centro_pokemon.sql.
ALTER TABLE juego.personaje
  ADD COLUMN IF NOT EXISTS personaje_en_centro_pokemon boolean NOT NULL DEFAULT false;
