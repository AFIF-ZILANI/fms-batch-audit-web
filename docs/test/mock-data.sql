-- Mock data for testing ONLY. Run against a LOCAL / throwaway database, never the live project.
-- Assumes "today" = 2026-10-03 and an empty schema (migration applied, no seed).
-- Every row is realistic enough to drive every page; a few rows are deliberately "dirty" so the
-- Data checks page has something to show (marked  -- DIRTY).

begin;

-- ---------- masters ----------
insert into sheds (code, name, type) values
  ('S1','Brooder 1','BROODER'), ('S2','Brooder 2','BROODER'),
  ('S3','Grower 1','GROWER'),   ('S4','Grower 2','GROWER'), ('S5','Grower 3','GROWER');
insert into sheds (code, name, type, is_active) values ('S6','Old shed (archived)','GROWER', false);

insert into items (code, name, category, unit, unit_weight_kg) values
  ('FD-01','Starter feed','FEED','bag',50),
  ('FD-02','Grower feed','FEED','bag',50),
  ('FD-03','Finisher feed','FEED','bag',50);
insert into items (code, name, category, unit) values
  ('MED-01','Amoxicillin','MEDICINE','bottle'),
  ('MED-02','Vitamin AD3E','MEDICINE','bottle'),
  ('VAC-01','Newcastle vaccine','VACCINE','vial'),
  ('VAC-02','Gumboro vaccine','VACCINE','vial'),
  ('HSK-01','Rice husk','HUSK','sack');
insert into items (code, name, category, unit, is_active) values ('MED-09','Discontinued tonic','MEDICINE','bottle', false);

insert into suppliers (code, name, company, phone) values
  ('SUP-01','Karim Traders','Karim Feed & Co','01711000001'),
  ('SUP-02','Rahman Hatchery','Rahman Hatchery Ltd','01811000002'),
  ('SUP-03','Vet Care','Vet Care Pharma','01911000003');
insert into buyers (code, name, company, phone) values
  ('BUY-01','Hasan Trader','Hasan & Sons','01611000011'),
  ('BUY-02','City Broilers','City Broilers Ltd','01511000012'),
  ('BUY-03','Local Market',null,null);

-- ---------- batches ----------
insert into batches (code, start_date, close_date, note) values
  ('B-2026-07-20-01','2026-07-20','2026-09-03','Closed, fully sold'),
  ('B-2026-09-05-01','2026-09-05',null,'Running, ~4 weeks old'),
  ('B-2026-10-01-01','2026-10-01',null,'Just placed'),
  ('B-2026-10-03-01','2026-10-03',null,'DIRTY: no chick purchase yet');   -- DIRTY

-- ---------- purchases (items) ----------
insert into purchases (date, item_id, supplier_id, qty, unit_price, note)
select d::date, i.id, s.id, q, p, n from (values
  ('2026-07-18','FD-01','SUP-01',60 , 3100.00,'starter for B1'),
  ('2026-07-30','FD-02','SUP-01',120, 3000.00,null),
  ('2026-08-15','FD-03','SUP-01',100, 2950.00,null),
  ('2026-07-18','MED-01','SUP-03',10 , 450.00 ,null),
  ('2026-07-18','VAC-01','SUP-03',8  , 300.00 ,null),
  ('2026-07-18','HSK-01','SUP-01',40 , 120.00 ,null),
  ('2026-09-03','FD-01','SUP-01',80 , 3200.00,null),
  ('2026-09-10','FD-02','SUP-01',150, 3050.00,null),
  ('2026-09-10','MED-02','SUP-03',6  , 380.00 ,null),
  ('2026-09-03','VAC-02','SUP-03',6  , 320.00 ,null),
  ('2026-09-03','HSK-01','SUP-01',30 , 125.00 ,null),
  ('2026-09-28','FD-01','SUP-01',40 , 3250.00,null)
) as v(d,ic,sc,q,p,n)
join items i on i.code = v.ic join suppliers s on s.code = v.sc;

-- DIRTY: purchase that will be voided after usage (-> "Item used more than purchased")
insert into purchases (date, item_id, supplier_id, qty, unit_price, note)
select '2026-09-01', i.id, s.id, 5, 500, 'will be voided' from items i, suppliers s where i.code='MED-02' and s.code='SUP-03';

-- ---------- chick purchases ----------
select create_chick_purchase('2026-07-20', b.id, s.id, 2000, 55, 1000, 50000, 'CASH', 'B1 chicks')
  from batches b, suppliers s where b.code='B-2026-07-20-01' and s.code='SUP-02';
select create_chick_purchase('2026-09-05', b.id, s.id, 3000, 58, 0, 100000, 'BANK', 'B2 chicks')
  from batches b, suppliers s where b.code='B-2026-09-05-01' and s.code='SUP-02';
select create_chick_purchase('2026-10-01', b.id, s.id, 1500, 60, 0, 0, 'CASH', 'B3 chicks, unpaid')
  from batches b, suppliers s where b.code='B-2026-10-01-01' and s.code='SUP-02';

-- ---------- usage ----------
-- B1: feed over 45 days
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-07-22'::date + (g*3), b.id, i.id, 'ISSUE', 4 + g, 0
  from batches b, items i, generate_series(0,13) g
 where b.code='B-2026-07-20-01' and i.code = case when g < 4 then 'FD-01' when g < 10 then 'FD-02' else 'FD-02' end;
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-07-21', b.id, i.id, 'ISSUE', q, 0 from batches b, items i,
  (values ('MED-01',2),('VAC-01',2),('HSK-01',20)) v(c,q) where b.code='B-2026-07-20-01' and i.code=v.c;
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-09-02', b.id, i.id, 'RETURN', 3, 0 from batches b, items i where b.code='B-2026-07-20-01' and i.code='FD-02';

-- B2: feed over 4 weeks
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-09-06'::date + g, b.id, i.id, 'ISSUE', 3 + (g/2), 0
  from batches b, items i, generate_series(0,26) g
 where b.code='B-2026-09-05-01' and i.code = case when g < 12 then 'FD-01' else 'FD-02' end;
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-09-11', b.id, i.id, 'ISSUE', q, 0 from batches b, items i,
  (values ('VAC-02',3),('HSK-01',15),('MED-02',2)) v(c,q) where b.code='B-2026-09-05-01' and i.code=v.c;
-- B3: first days only (DIRTY-ish: no weight sample for >7d is not true yet; no usage since 2 Oct is, via reminder)
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-10-01', b.id, i.id, 'ISSUE', 2, 0 from batches b, items i where b.code='B-2026-10-01-01' and i.code='FD-01';

-- DIRTY: usage dated BEFORE its batch started
insert into usages (date, batch_id, item_id, kind, qty, unit_cost)
select '2026-09-01', b.id, i.id, 'ISSUE', 1, 0 from batches b, items i where b.code='B-2026-09-05-01' and i.code='MED-02';

-- DIRTY: void the purchase that this usage relied on
update purchases set is_void = true where note = 'will be voided';

-- ---------- mortality ----------
insert into mortalities (date, batch_id, shed_id, dead_count, reason)
select '2026-07-21'::date + g, b.id, s.id, case when g < 7 then 12 - g else 2 + (g % 3) end,
       case when g = 20 then 'ILLNESS'::mortality_reason when g = 33 then 'ACCIDENT' else 'NORMAL' end
  from batches b, sheds s, generate_series(0,44) g where b.code='B-2026-07-20-01' and s.code='S3';
insert into mortalities (date, batch_id, shed_id, dead_count, reason)
select '2026-09-06'::date + g, b.id, s.id, case when g < 5 then 10 - g else 3 + (g % 4) end, 'NORMAL'
  from batches b, sheds s, generate_series(0,26) g where b.code='B-2026-09-05-01' and s.code='S1';
insert into mortalities (date, batch_id, shed_id, dead_count, reason)
select '2026-10-02', b.id, s.id, 6, 'NORMAL' from batches b, sheds s where b.code='B-2026-10-01-01' and s.code='S2';

-- ---------- weights ----------
insert into weights (date, batch_id, sample_size, total_weight_kg)
select '2026-07-20'::date + d, b.id, 40, round((40 * (45 + d*d*0.9 + d*18)) / 1000.0, 3)
  from batches b, (values (7),(14),(21),(28),(35),(42)) v(d) where b.code='B-2026-07-20-01';
insert into weights (date, batch_id, sample_size, total_weight_kg)
select '2026-09-05'::date + d, b.id, 40, round((40 * (45 + d*d*0.9 + d*18)) / 1000.0, 3)
  from batches b, (values (7),(14),(21)) v(d) where b.code='B-2026-09-05-01';
-- B2 last weight 12 days ago -> "no weight in 7 days" reminder

-- ---------- sales (B1, mixed grades, partial and full payments) ----------
select create_sale('2026-09-01', b.id, y.id, 600, 400, 'A', 2000.000, 1000, 205, 0, 380000, 'BANK', 'first lot')
  from batches b, buyers y where b.code='B-2026-07-20-01' and y.code='BUY-01';
select create_sale('2026-09-02', b.id, y.id, 400, 300, 'B', 1500.000, 1000, 198, 500, 200000, 'CASH', null)
  from batches b, buyers y where b.code='B-2026-07-20-01' and y.code='BUY-02';
select create_sale('2026-09-03', b.id, y.id, 100, 80, 'C', 330.000, 800, 180, 0, 0, 'CASH', 'unpaid so far')
  from batches b, buyers y where b.code='B-2026-07-20-01' and y.code='BUY-03';
-- DIRTY: closed batch live balance != 0 is implied (2000 placed - dead - 1880 sold)

-- ---------- extra payments ----------
insert into payments (date, party, sale_id, amount, method)
select '2026-09-10', 'BUYER', s.id, 25000, 'MOBILE' from sales s where s.grade='C';
insert into payments (date, party, purchase_id, amount, method)
select '2026-08-01', 'SUPPLIER', p.id, 100000, 'BANK' from purchases p
 where p.unit_price = 3000.00 and p.qty = 120;

-- ---------- one deliberately voided entry of each kind (for "Show deleted") ----------
insert into mortalities (date, batch_id, shed_id, dead_count, reason, is_void, note)
select '2026-09-20', b.id, s.id, 99, 'NORMAL', true, 'typo [deleted: wrong count]' from batches b, sheds s
 where b.code='B-2026-09-05-01' and s.code='S1';

commit;
