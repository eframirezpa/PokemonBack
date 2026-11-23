-- Orden de turno de la partida y estados alterados.
--
-- La iniciativa va en UNA columna JSON y no en una tabla aparte porque es una
-- sola cosa viva por partida -quién tiró, cuánto sacó y a quién le toca-, se
-- reemplaza entera en cada cambio y no se consulta por dentro. Se difunde en
-- vivo por el canal de la partida; esto es lo que hace que sobreviva a que
-- alguien recargue el móvil a mitad del combate.
--
-- Forma del JSON:
--   { "estado": "pidiendo" | "activa",
--     "ronda": 1,
--     "turno": 0,                       -- posición dentro de participantes
--     "participantes": [
--       { "clave": "u12", "user_id": 12, "personaje_id": 5, "nombre": "Rave",
--         "es_master": false, "mod": 3, "d20": 15, "total": 18, "listo": true }
--     ] }
ALTER TABLE juego.partida
  ADD COLUMN IF NOT EXISTS iniciativa JSONB NULL;

-- Estados alterados: los pone y los quita cada quien sobre sí mismo y sobre su
-- Pokémon. Se guarda la lista separada por comas ('quemado,confuso') en vez de
-- una tabla: son pocos, cortos, y siempre se leen y escriben todos juntos.
ALTER TABLE juego.personaje
  ADD COLUMN IF NOT EXISTS personaje_estados TEXT NULL;

ALTER TABLE juego.personaje_pokemon
  ADD COLUMN IF NOT EXISTS personaje_pokemon_estados TEXT NULL;
