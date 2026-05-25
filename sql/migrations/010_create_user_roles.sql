-- Convert users.role from VARCHAR to a proper enum.
--
-- Order matters: we must drop the old DEFAULT first, because changing the
-- column's type doesn't auto-cast its default expression. Without the DROP
-- step Postgres raises "default for column \"role\" cannot be cast
-- automatically to type user_role".

CREATE TYPE user_role AS ENUM ('head_manager', 'section_manager', 'employee', 'it_service');

ALTER TABLE users
    ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
    ALTER COLUMN role TYPE user_role USING role::user_role;

ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'employee'::user_role;
