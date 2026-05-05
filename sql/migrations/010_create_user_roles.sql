CREATE TYPE user_role AS ENUM ('head_manager', 'section_manager', 'employee', 'it_service');

ALTER TABLE users
    ALTER COLUMN role TYPE user_role USING role::user_role;

ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'employee'::user_role;
