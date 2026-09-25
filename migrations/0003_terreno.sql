-- Terreno en el que está cada entrenador y cada Pokémon de entrenador. Lo pone
-- el máster y es informativo (los bonos y debilidades se llevan por narrativa).
-- Es el nombre del terreno tal cual sale del catálogo del feat que ofrece
-- terrenos; NULL es "sin terreno". Un terreno a la vez por ser vivo.
ALTER TABLE "{{schema}}"."personaje"
  ADD COLUMN IF NOT EXISTS personaje_terreno text;
ALTER TABLE "{{schema}}"."personaje_pokemon"
  ADD COLUMN IF NOT EXISTS personaje_pokemon_terreno text;
