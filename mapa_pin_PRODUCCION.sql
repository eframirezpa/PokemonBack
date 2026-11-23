-- Pin de ubicación de la party en el mapa de la partida.
--
-- Uno solo por partida: lo fija el máster y lo ven los jugadores. Las
-- coordenadas van en PORCENTAJE (0-100) sobre la imagen, no en píxeles, para
-- que no dependan de la resolución ni del zoom con que se mire.
--
-- mapa_pin_mapa guarda a QUÉ mapa pertenece el pin. Hoy solo existe 'all',
-- pero cuesta una columna ahora y evita tener que adivinarlo el día que haya
-- un segundo mapa.
--
-- Todo nulo = la partida no tiene pin puesto.
ALTER TABLE juego.partida
  ADD COLUMN IF NOT EXISTS mapa_pin_x     NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS mapa_pin_y     NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS mapa_pin_label TEXT    NULL,
  ADD COLUMN IF NOT EXISTS mapa_pin_mapa  TEXT    NULL;

-- Las coordenadas solo valen dentro de la imagen
ALTER TABLE juego.partida
  DROP CONSTRAINT IF EXISTS partida_mapa_pin_rango;
ALTER TABLE juego.partida
  ADD CONSTRAINT partida_mapa_pin_rango CHECK (
    (mapa_pin_x IS NULL OR (mapa_pin_x >= 0 AND mapa_pin_x <= 100)) AND
    (mapa_pin_y IS NULL OR (mapa_pin_y >= 0 AND mapa_pin_y <= 100))
  );
