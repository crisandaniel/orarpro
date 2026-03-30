-- =============================================================================
-- seed_school.sql
-- Date de test pentru o instituție școlară tipică.
-- Rulează în Supabase SQL Editor după ce ai creat organizația.
-- =============================================================================

do $$
declare
  org_id uuid;

  -- Teacher IDs
  t_math      uuid := uuid_generate_v4();
  t_math2     uuid := uuid_generate_v4();
  t_rom       uuid := uuid_generate_v4();
  t_rom2      uuid := uuid_generate_v4();
  t_bio       uuid := uuid_generate_v4();
  t_chem      uuid := uuid_generate_v4();
  t_phys      uuid := uuid_generate_v4();
  t_hist      uuid := uuid_generate_v4();
  t_geo       uuid := uuid_generate_v4();
  t_eng       uuid := uuid_generate_v4();
  t_eng2      uuid := uuid_generate_v4();
  t_sport     uuid := uuid_generate_v4();
  t_it        uuid := uuid_generate_v4();
  t_music     uuid := uuid_generate_v4();
  t_art       uuid := uuid_generate_v4();

  -- Subject IDs
  s_math      uuid := uuid_generate_v4();
  s_rom       uuid := uuid_generate_v4();
  s_bio       uuid := uuid_generate_v4();
  s_chem      uuid := uuid_generate_v4();
  s_phys      uuid := uuid_generate_v4();
  s_hist      uuid := uuid_generate_v4();
  s_geo       uuid := uuid_generate_v4();
  s_eng       uuid := uuid_generate_v4();
  s_sport     uuid := uuid_generate_v4();
  s_it        uuid := uuid_generate_v4();
  s_music     uuid := uuid_generate_v4();
  s_art       uuid := uuid_generate_v4();

begin
  -- Preia org_id-ul tău (primul din listă)
  -- Dacă ai mai multe organizații, înlocuiește cu ID-ul specific:
  -- org_id := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  select id into org_id from public.organizations limit 1;

  if org_id is null then
    raise exception 'Nu există nicio organizație. Creează mai întâi o organizație.';
  end if;

  raise notice 'Seeding pentru org_id: %', org_id;

  -- ===========================================================================
  -- PROFESORI
  -- ===========================================================================
  insert into public.school_teachers
    (id, organization_id, name, color, unavailable_slots, preferred_slots,
     max_lessons_per_day, max_lessons_per_week, min_lessons_per_week)
  values
    (t_math,  org_id, 'Prof. Ion Popescu',      '#6366f1', '[]', '[]', 6, 18, null),
    (t_math2, org_id, 'Prof. Maria Ionescu',    '#2563eb', '[]', '[]', 6, 18, null),
    (t_rom,   org_id, 'Prof. Elena Dumitrescu', '#0891b2', '[]', '[]', 6, 18, null),
    (t_rom2,  org_id, 'Prof. Ana Constantin',   '#059669', '[]', '[]', 6, 18, null),
    (t_bio,   org_id, 'Prof. Mihai Georgescu',  '#d97706', '[]', '[]', 5, 16, null),
    (t_chem,  org_id, 'Prof. Laura Stanescu',   '#dc2626', '[]', '[]', 5, 16, null),
    (t_phys,  org_id, 'Prof. Radu Vlad',        '#7c3aed', '[]', '[]', 5, 16, null),
    (t_hist,  org_id, 'Prof. Cristina Munteanu','#db2777', '[]', '[]', 5, 16, null),
    (t_geo,   org_id, 'Prof. Alexandru Dinu',   '#ea580c', '[]', '[]', 5, 16, null),
    (t_eng,   org_id, 'Prof. Diana Popa',       '#65a30d', '[]', '[]', 6, 18, null),
    (t_eng2,  org_id, 'Prof. Andrei Luca',      '#0d9488', '[]', '[]', 6, 18, null),
    (t_sport, org_id, 'Prof. Victor Stoica',    '#1d4ed8', '[]', '[]', 8, 24, null),
    (t_it,    org_id, 'Prof. Bogdan Niță',      '#9333ea', '[]', '[]', 5, 16, null),
    (t_music, org_id, 'Prof. Ioana Florescu',   '#be185d', '[]', '[]', 4, 12, null),
    (t_art,   org_id, 'Prof. Mihaela Radu',     '#b45309', '[]', '[]', 4, 12, null)
  on conflict do nothing;

  -- ===========================================================================
  -- MATERII
  -- ===========================================================================
  insert into public.school_subjects
    (id, organization_id, name, short_name, color, difficulty, required_room_type)
  values
    (s_math,  org_id, 'Matematică',         'Mat',  '#6366f1', 'hard',   null),
    (s_rom,   org_id, 'Limba Română',        'Rom',  '#2563eb', 'hard',   null),
    (s_bio,   org_id, 'Biologie',            'Bio',  '#059669', 'medium', 'chemistry_lab'),
    (s_chem,  org_id, 'Chimie',              'Chi',  '#dc2626', 'hard',   'chemistry_lab'),
    (s_phys,  org_id, 'Fizică',              'Fiz',  '#7c3aed', 'hard',   null),
    (s_hist,  org_id, 'Istorie',             'Ist',  '#d97706', 'medium', null),
    (s_geo,   org_id, 'Geografie',           'Geo',  '#ea580c', 'medium', null),
    (s_eng,   org_id, 'Limba Engleză',       'Eng',  '#0891b2', 'medium', null),
    (s_sport, org_id, 'Educație Fizică',     'EF',   '#1d4ed8', 'easy',   'gym'),
    (s_it,    org_id, 'Informatică',         'Info', '#9333ea', 'medium', 'computer_lab'),
    (s_music, org_id, 'Muzică',              'Muz',  '#be185d', 'easy',   null),
    (s_art,   org_id, 'Arte Vizuale',        'Arte', '#b45309', 'easy',   null)
  on conflict do nothing;

  -- ===========================================================================
  -- SĂLI — S101 până la S150 (generic) + săli speciale
  -- ===========================================================================
  insert into public.school_rooms
    (id, organization_id, name, type, capacity)
  values
    -- Săli speciale
    (uuid_generate_v4(), org_id, 'Sală Sport',        'gym',           100),
    (uuid_generate_v4(), org_id, 'Lab Chimie',         'chemistry_lab',  30),
    (uuid_generate_v4(), org_id, 'Lab Biologie',       'chemistry_lab',  30),
    (uuid_generate_v4(), org_id, 'Lab Informatică 1',  'computer_lab',   25),
    (uuid_generate_v4(), org_id, 'Lab Informatică 2',  'computer_lab',   25),
    -- Clase S101–S150
    (uuid_generate_v4(), org_id, 'S101', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S102', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S103', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S104', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S105', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S106', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S107', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S108', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S109', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S110', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S111', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S112', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S113', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S114', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S115', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S116', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S117', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S118', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S119', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S120', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S121', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S122', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S123', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S124', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S125', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S126', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S127', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S128', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S129', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S130', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S131', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S132', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S133', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S134', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S135', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S136', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S137', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S138', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S139', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S140', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S141', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S142', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S143', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S144', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S145', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S146', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S147', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S148', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S149', 'homeroom', 30),
    (uuid_generate_v4(), org_id, 'S150', 'homeroom', 30)
  on conflict do nothing;

  -- ===========================================================================
  -- CLASE — 9A-9E, 10A-10E, 11A-11D, 12A-12D
  -- ===========================================================================
  insert into public.school_classes
    (id, organization_id, name, grade_number, stage, max_lessons_per_day, homeroom_id)
  values
    -- Clasa a 9-a
    (uuid_generate_v4(), org_id, '9A',  9,  'high', 7, null),
    (uuid_generate_v4(), org_id, '9B',  9,  'high', 7, null),
    (uuid_generate_v4(), org_id, '9C',  9,  'high', 7, null),
    (uuid_generate_v4(), org_id, '9D',  9,  'high', 7, null),
    (uuid_generate_v4(), org_id, '9E',  9,  'high', 7, null),
    -- Clasa a 10-a
    (uuid_generate_v4(), org_id, '10A', 10, 'high', 7, null),
    (uuid_generate_v4(), org_id, '10B', 10, 'high', 7, null),
    (uuid_generate_v4(), org_id, '10C', 10, 'high', 7, null),
    (uuid_generate_v4(), org_id, '10D', 10, 'high', 7, null),
    (uuid_generate_v4(), org_id, '10E', 10, 'high', 7, null),
    -- Clasa a 11-a
    (uuid_generate_v4(), org_id, '11A', 11, 'high', 7, null),
    (uuid_generate_v4(), org_id, '11B', 11, 'high', 7, null),
    (uuid_generate_v4(), org_id, '11C', 11, 'high', 7, null),
    (uuid_generate_v4(), org_id, '11D', 11, 'high', 7, null),
    -- Clasa a 12-a
    (uuid_generate_v4(), org_id, '12A', 12, 'high', 7, null),
    (uuid_generate_v4(), org_id, '12B', 12, 'high', 7, null),
    (uuid_generate_v4(), org_id, '12C', 12, 'high', 7, null),
    (uuid_generate_v4(), org_id, '12D', 12, 'high', 7, null)
  on conflict do nothing;

  raise notice 'Seed complet: 15 profesori, 12 materii, 55 săli, 18 clase.';
end $$;