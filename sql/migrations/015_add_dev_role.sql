-- Promote 'dev' from a frontend-only convention to a real DB-level role.
--
-- Until now, `dev` lived only in the application's PERMISSIONS table and
-- frontend role checks. The user_role enum (migration 010) didn't include
-- it, so trying to INSERT a user with role='dev' would fail. The setup
-- wizard now assigns 'dev' to the very first account created on a fresh
-- install, so the enum needs to accept it.
--
-- ALTER TYPE ... ADD VALUE is supported inside a transaction since
-- Postgres 12. IF NOT EXISTS makes this migration safely re-runnable.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dev';
