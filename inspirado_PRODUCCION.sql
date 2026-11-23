-- Punto de inspiración del entrenador: lo marca el máster, y mientras esté
-- activo el jugador ve el aura y el aviso de que puede usarlo. Booleano
-- simple, como personaje_is_editable, que ya sigue este mismo patrón.
ALTER TABLE juego.personaje
  ADD COLUMN IF NOT EXISTS personaje_inspirado BOOLEAN NOT NULL DEFAULT false;
