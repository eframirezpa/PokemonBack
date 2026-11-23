-- Experiencia guardada por Pokémon (plan-xp-y-mesa, etapa 4 parte D).
--
-- La app sube de a un nivel por vez: al repartir una experiencia grande se
-- suma hasta ese tope y el resto queda aquí. Vuelve a ofrecerse al jugador
-- cuando el Pokémon termina las mejoras del nivel que acaba de subir.
-- Una fila por Pokémon: lo nuevo se acumula.
CREATE TABLE IF NOT EXISTS "{{schema}}"."personaje_pokemon_xp_guardada" (
  id_personaje_pokemon integer PRIMARY KEY
    REFERENCES "{{schema}}"."personaje_pokemon"(id_personaje_pokemon) ON DELETE CASCADE,
  xp_guardada          integer NOT NULL CHECK (xp_guardada > 0),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
