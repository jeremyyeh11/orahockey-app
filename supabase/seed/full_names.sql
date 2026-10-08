-- =============================================================
-- ORA Hockey — full names for past players imported from the caps sheets
-- The caps sheets only had first names / nicknames, so the 2016–2023 imports
-- created placeholder players ('BRENNEN', 'ZAKI', ...). This swaps in the real
-- full names (from the club's roster list) and sets the preferred (display)
-- name to what the sheets call them, unless one is already set. The 2016–2018
-- seeds look players up by their placeholder name, so RUN THIS AFTER the
-- season seeds.
--
-- Re-run safe: a renamed player no longer matches its placeholder.
-- Run in: Supabase Dashboard → SQL Editor (or via MCP)
-- =============================================================

update players p
set full_name = v.new_name,
    preferred_name = coalesce(p.preferred_name, v.pref)
from (values
  -- placeholders from the caps-sheet imports
  ('BRENNEN',      'BRENNEN TAN KOK TONG',                         'BRENNEN'),
  ('KHAIRUL',      'MUHD KHAIRUL IRZHAN BIN ROSLI',                'KHAIRUL'),
  ('HAIKEL',       'MUHAMMAD HAIKEL BIN YASIN',                    'HAIKEL'),
  ('FAZLY',        'MUHAMMAD FAZLY BIN ABDUL RAHMAN',              'FAZLY'),
  ('IFRAN',        'IFRAN AHMAD-UL QAYYUM S/O MUSTAFA M R',        'IFRAN'),
  ('MARCUS',       'MARCUS OOI YIXUAN',                            'MARCUS'),
  ('NICK',         'NICHOLAS ANDREW JONATHAN KIRAMATHYPATHY',      'NICK'),
  ('KEANE',        'KEANE KWA BING HONG',                          'KEANE'),
  ('ZAKI',         'AHMAD ZAKI BIN ISKANDAR',                      'ZAKI'),
  ('JUSTIN',       'JUSTIN LEE ZHENG XIAN',                        'JUSTIN'),
  ('HANIF',        'ABDURRAHIM HANIF BIN ISKANDAR',                'HANIF'),
  ('HAO DUAN',     'ANG HAO DUAN',                                 'HAO DUAN'),
  ('ADIB',         'MUHAMMAD ADIB B SAPARI',                       'ADIB'),
  ('AQIL',         'MUHAMMAD AQIL BIN BAKHTIAR',                   'AQIL'),
  ('AMIRUL AFIQ',  'MUHAMMAD AMIRUL AFIQ BIN BAKTHIAR',            'AMIRUL AFIQ'),
  ('ZHYKRY',       'ZHYKRY BIN ZULKIFLEE',                         'ZHYKRY'),
  ('EASHWAR',      'UMAIDURAI EASHWAR',                            'EASHWAR'),
  ('HASEEF',       'MUHAMMAD HASEEF BIN SALIM',                    'HASEEF'),
  ('BENJAMIN ANG', 'ANG SI EN BENJAMIN',                           'BENJAMIN ANG'),
  -- one-word names from the earlier imports
  ('BALRAJ',       'BALRAJ SINGH',                                 'BALRAJ'),
  ('GOUTHAM',      'RAMALINGAM GOUTHAMAN',                         'GOUTHAM'),
  ('TIMOTHY',      'GOH KAI YANG TIMOTHY',                         'TIM'),
  ('ADAM',         'ADAM ANIQ BIN AMIR',                           'ADAM'),
  ('CALEB ANG',    'CALEB ANG SI KAI',                             'CALEB'),
  ('NATHANIEL GOH','NATHANIEL GOH RUO CHUAN',                      'NAT GOH'),
  ('JIM',          'CHOW JIM AN',                                  'JIM'),
  ('DANIEL XU',    'DANIEL XU JUEWEN',                             'DANIEL XU'),
  ('MOHAMMAD EZECKIEL', 'MOHAMAD EZECKIEL BIN MOHAMMAD IRWAN',          'EZEC')
) as v(old_name, new_name, pref)
where p.full_name = v.old_name
  and not exists (select 1 from players q where q.full_name = v.new_name);
