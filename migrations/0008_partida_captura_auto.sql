-- Captura automática de Pokémon (idea #1). La activa el máster desde su
-- panel: con ella encendida, la pokébola que lanza un entrenador pide la
-- tirada de Animal Handling y el servidor resuelve la captura. Apagada, todo
-- sigue como siempre -el máster decide a mano si el Pokémon se queda o sale-.
ALTER TABLE "{{schema}}"."partida"
  ADD COLUMN IF NOT EXISTS partida_captura_auto boolean NOT NULL DEFAULT false;
