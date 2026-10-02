-- Your sheds. Run once after the migration.

-- ============================================================
-- 6.9 Seed (your real sheds)
-- ============================================================
insert into sheds (code, name, type) values
  ('S1', 'Brooder 1', 'BROODER'),
  ('S2', 'Brooder 2', 'BROODER'),
  ('S3', 'Grower 1',  'GROWER'),
  ('S4', 'Grower 2',  'GROWER'),
  ('S5', 'Grower 3',  'GROWER');
