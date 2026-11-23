-- Held item elegido por el máster al crear un Pokémon (opcional).
-- Nula por defecto: si no se marca el checkbox, el Pokémon no lleva nada.
-- Al transferirlo a un entrenador, el backend copia esto a
-- personaje_pokemon_held_item (tabla, no columna) — ver transferToPersonaje.
--
-- Ya aplicado en local. Este es el mismo script para correr en PRODUCCIÓN.
ALTER TABLE juego.master_pokemon
  ADD COLUMN IF NOT EXISTS personaje_pokemon_held_item INTEGER NULL
    REFERENCES juego.items(item_id);
