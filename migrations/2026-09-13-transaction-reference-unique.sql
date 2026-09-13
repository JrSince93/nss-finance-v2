-- Unique transaction references: close the duplicate-reference race.
-- Run manually in the Supabase SQL editor (project bhqjsqwbsbhjuhjwxwcp).
--
-- ⚠️ READ ALL OF THIS BEFORE RUNNING. This migration changes behaviour for the
-- EXISTING PRODUCTION APP (northernstar-app), which writes to the same
-- database. It is the one migration in either repo that can make a currently
-- working action start failing.
--
-- WHY
--   Both apps build a cash book reference by reading the ledger and adding one.
--   Two people adding a transaction at the same moment compute the same number
--   and both inserts succeed, because nothing stops them. References are how
--   invoice payments are attributed back to budget lines
--   (attributeReceiptsToLines matches transactions.reference against
--   BL_INV_PREFIXES), so a duplicate silently misattributes money.
--
--   The production app has a second, deterministic way to produce duplicates:
--   getNextRef() returns COUNT(rows with prefix) + 1. Delete any transaction
--   and the count drops, so the next reference reuses a live one. nss-finance-v2
--   now derives from MAX(suffix) + 1 instead, which retires deleted numbers —
--   but the production app still uses the count. Until that is changed there,
--   or the production app stops being used to add transactions, it will keep
--   generating collisions that this index now REJECTS rather than accepts.
--
-- WHAT BREAKS IF YOU RUN THIS WITHOUT THINKING
--   In the production app, addTx() does `sb2.from('transactions').insert(...)`
--   and shows res.error.message in a toast. After this index exists, a
--   colliding insert fails with "duplicate key value violates unique
--   constraint" instead of silently writing a duplicate. That is the correct
--   outcome — the transaction genuinely should not be written with that
--   reference — but it is a user-visible failure in an app that has no retry.
--   Decide that is acceptable, or update the production app's getNextRef to use
--   MAX + 1 first, before running this.
--
-- ORDER OF OPERATIONS
--   1. Run STEP 1 and resolve every row it returns. The index cannot be created
--      while duplicates exist, and it should not be — those rows need a human
--      to decide which is which.
--   2. Run STEP 2.
--
-- ROLLBACK: bottom of file. Dropping the index is safe and instant.

-- ── STEP 1: find existing duplicates ────────────────────────────────────────
-- Expect zero rows. Anything returned here is two or more transactions sharing
-- one reference; they must be renumbered by hand before STEP 2 will succeed.
-- NULL references are fine and are excluded — a transaction without a reference
-- is legitimate (Wise imports and reconciled payroll rows both produce them).

select
  reference,
  count(*)                              as row_count,
  array_agg(id order by date, id)       as transaction_ids,
  array_agg(date order by date, id)     as dates,
  array_agg(description order by date, id) as descriptions
from public.transactions
where reference is not null
  and btrim(reference) <> ''
group by reference
having count(*) > 1
order by count(*) desc, reference;

-- Useful alongside it: the highest sequence actually in use per prefix, which
-- is what nss-finance-v2's nextSequence() derives from.
--
-- select split_part(reference,'-',1) as prefix,
--        max(nullif(split_part(reference,'-',2),'')::int) as highest,
--        count(*) as used
--   from public.transactions
--  where reference ~ '^[A-Z0-9]+-\d+$'
--  group by 1 order by 1;

-- ── STEP 2: enforce it ──────────────────────────────────────────────────────
-- Only run once STEP 1 returns nothing.
--
-- Partial on `reference is not null` so unreferenced rows are unaffected.
-- (Postgres already allows repeated NULLs in a unique index; the predicate also
-- keeps the index small, since a large share of rows carry no reference.)
-- Empty strings are excluded for the same reason — several legacy rows have
-- '' rather than NULL, and they are all equally "no reference".

create unique index if not exists transactions_reference_unique
  on public.transactions (reference)
  where reference is not null and btrim(reference) <> '';

comment on index public.transactions_reference_unique is
  'One transaction per reference. References attribute invoice payments to budget lines, so a duplicate misattributes money. Added 2026-09-13; nss-finance-v2 retries on 23505 (see src/lib/data/reference-allocator.ts). The production app does NOT retry — a collision there surfaces as an error toast.';

-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- Should return one row:
-- select indexname from pg_indexes
--  where tablename = 'transactions' and indexname = 'transactions_reference_unique';
--
-- Should fail with 23505 (run inside a transaction and roll it back):
-- begin;
--   insert into public.transactions (month, date, description, reference, amount_in, amount_out)
--   select month, date, description, reference, 0, 0
--     from public.transactions
--    where reference is not null limit 1;
-- rollback;

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- drop index if exists public.transactions_reference_unique;
