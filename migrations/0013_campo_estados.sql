-- Estado alterado de cada Pokémon o NPC invocado por el máster (quemado,
-- envenenado…). Uno a la vez, como los de entrenadores y Pokémon de la party.
-- Vive en la instancia del campo: al quitarlo del campo, se va con él.
ALTER TABLE "{{schema}}"."master_campo"
  ADD COLUMN IF NOT EXISTS campo_estados text;
