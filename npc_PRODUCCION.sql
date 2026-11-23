-- NPC del máster: personajes que invoca en la partida como invoca Pokémon.
--
-- Son suyos, igual que master_pokemon: cuelgan del usuario que los creó y se
-- borran con él. La vida se guarda como en los Pokémon (máxima y actual), para
-- que un NPC herido siga herido tras recargar o al volver a invocarlo.

CREATE TABLE IF NOT EXISTS juego.master_npc (
  id_master_npc         SERIAL   PRIMARY KEY,
  id_master             INTEGER  NOT NULL REFERENCES juego.usuarios(user_id) ON DELETE CASCADE,
  master_npc_apodo      TEXT     NOT NULL,
  master_npc_level      INTEGER  NOT NULL,
  master_npc_hp         INTEGER  NOT NULL,
  master_npc_current_hp INTEGER  NOT NULL,
  -- Nombre del archivo del avatar ('face7.png'). Se guarda el archivo y no un
  -- id de la tabla avatar porque ahí solo hay 14 de las 20 caras que existen.
  master_npc_avatar     TEXT     NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT master_npc_level_rango CHECK (master_npc_level BETWEEN 1 AND 20),
  CONSTRAINT master_npc_hp_rango    CHECK (master_npc_hp >= 0 AND master_npc_current_hp >= 0)
);

CREATE INDEX IF NOT EXISTS master_npc_id_master_idx ON juego.master_npc (id_master);

-- Bolsa de nombres y apellidos para bautizar NPC al azar. Separados por tipo
-- para poder combinarlos: cualquier nombre con cualquier apellido.
CREATE TABLE IF NOT EXISTS juego.nombres_npc (
  id_nombre_npc  SERIAL PRIMARY KEY,
  nombre_npc_tipo   TEXT NOT NULL,
  nombre_npc_valor  TEXT NOT NULL,
  nombre_npc_origen TEXT,
  CONSTRAINT nombres_npc_tipo_valido CHECK (nombre_npc_tipo IN ('nombre', 'apellido')),
  CONSTRAINT nombres_npc_unico UNIQUE (nombre_npc_tipo, nombre_npc_valor)
);

INSERT INTO juego.nombres_npc (nombre_npc_tipo, nombre_npc_valor, nombre_npc_origen) VALUES
  -- Pokémon
  ('nombre', 'Ash',      'pokemon'),
  ('nombre', 'Misty',    'pokemon'),
  ('nombre', 'Brock',    'pokemon'),
  ('nombre', 'Gary',     'pokemon'),
  ('nombre', 'Jessie',   'pokemon'),
  ('nombre', 'James',    'pokemon'),
  ('nombre', 'Lance',    'pokemon'),
  ('nombre', 'Cynthia',  'pokemon'),
  ('nombre', 'Giovanni', 'pokemon'),
  ('nombre', 'Oak',      'pokemon'),
  ('apellido', 'Ketchum',   'pokemon'),
  ('apellido', 'Oak',       'pokemon'),
  ('apellido', 'Rocket',    'pokemon'),
  ('apellido', 'del Cerulean', 'pokemon'),
  -- Harry Potter
  ('nombre', 'Harry',    'harry potter'),
  ('nombre', 'Hermione', 'harry potter'),
  ('nombre', 'Ron',      'harry potter'),
  ('nombre', 'Albus',    'harry potter'),
  ('nombre', 'Severus',  'harry potter'),
  ('nombre', 'Luna',     'harry potter'),
  ('nombre', 'Draco',    'harry potter'),
  ('nombre', 'Minerva',  'harry potter'),
  ('apellido', 'Potter',     'harry potter'),
  ('apellido', 'Granger',    'harry potter'),
  ('apellido', 'Weasley',    'harry potter'),
  ('apellido', 'Dumbledore', 'harry potter'),
  ('apellido', 'Snape',      'harry potter'),
  ('apellido', 'Lovegood',   'harry potter'),
  ('apellido', 'Malfoy',     'harry potter'),
  -- Game of Thrones
  ('nombre', 'Jon',     'got'),
  ('nombre', 'Arya',    'got'),
  ('nombre', 'Tyrion',  'got'),
  ('nombre', 'Daenerys','got'),
  ('nombre', 'Cersei',  'got'),
  ('nombre', 'Sansa',   'got'),
  ('nombre', 'Brienne', 'got'),
  ('nombre', 'Davos',   'got'),
  ('apellido', 'Snow',      'got'),
  ('apellido', 'Stark',     'got'),
  ('apellido', 'Lannister', 'got'),
  ('apellido', 'Targaryen', 'got'),
  ('apellido', 'Baratheon', 'got'),
  ('apellido', 'Tarth',     'got'),
  ('apellido', 'Greyjoy',   'got'),
  -- Breaking Bad
  ('nombre', 'Walter', 'breaking bad'),
  ('nombre', 'Jesse',  'breaking bad'),
  ('nombre', 'Skyler', 'breaking bad'),
  ('nombre', 'Saul',   'breaking bad'),
  ('nombre', 'Gustavo','breaking bad'),
  ('nombre', 'Mike',   'breaking bad'),
  ('nombre', 'Hank',   'breaking bad'),
  ('apellido', 'White',      'breaking bad'),
  ('apellido', 'Pinkman',    'breaking bad'),
  ('apellido', 'Goodman',    'breaking bad'),
  ('apellido', 'Fring',      'breaking bad'),
  ('apellido', 'Ehrmantraut','breaking bad'),
  ('apellido', 'Schrader',   'breaking bad'),
  -- Betty la fea
  ('nombre', 'Beatriz',   'betty la fea'),
  ('nombre', 'Armando',   'betty la fea'),
  ('nombre', 'Patricia',  'betty la fea'),
  ('nombre', 'Nicolás',   'betty la fea'),
  ('nombre', 'Marcela',   'betty la fea'),
  ('nombre', 'Hugo',      'betty la fea'),
  ('nombre', 'Aura María', 'betty la fea'),
  ('nombre', 'Bertha',    'betty la fea'),
  ('apellido', 'Pinzón',    'betty la fea'),
  ('apellido', 'Mendoza',   'betty la fea'),
  ('apellido', 'Fernández', 'betty la fea'),
  ('apellido', 'Valencia',  'betty la fea'),
  ('apellido', 'Lombardi',  'betty la fea'),
  ('apellido', 'Solano',    'betty la fea')
ON CONFLICT (nombre_npc_tipo, nombre_npc_valor) DO NOTHING;
