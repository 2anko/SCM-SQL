import bcrypt from 'bcryptjs';

export async function getUserByEmail(db, email) {
    const { rows } = await db.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
    );
    return rows[0] ?? null;
}

export async function getAllUsers(db) {
    const { rows } = await db.query(
        'SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    return rows;
}

export async function createUser(db, { email, password, role, created_by }) {
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, role, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role, is_active, created_at`,
        [email, password_hash, role, created_by]
    );
    return rows[0];
}

export async function updateUser(db, id, { role, is_active, password }) {
    const fields = [];
    const values = [];
    if (role      !== undefined) fields.push(`role = $${values.push(role)}`);
    if (is_active !== undefined) fields.push(`is_active = $${values.push(is_active)}`);
    if (password  !== undefined) {
        const hash = await bcrypt.hash(password, 12);
        fields.push(`password_hash = $${values.push(hash)}`);
    }
    if (fields.length === 0) return null;
    values.push(id);
    const { rows } = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}
         RETURNING id, email, role, is_active, created_at`,
        values
    );
    return rows[0] ?? null;
}
