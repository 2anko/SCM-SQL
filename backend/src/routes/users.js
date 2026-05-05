// routes/users.js — only accessible by it_service role
import { getAllUsers, createUser, updateUser } from '../queries/users.js';
import { authorize } from '../middleware/authorize.js';

export default async function userRoutes(app) {
    app.get('/', { preHandler: authorize('manage_users') },
        async (req) => getAllUsers(req.db)
    );

    app.post('/', { preHandler: authorize('manage_users') },
        async (req, rep) => {
            try {
                const user = await createUser(req.db, { ...req.body, created_by: req.user.userId });
                return rep.code(201).send(user);
            } catch (err) {
                // unique constraint on email
                if (err.code === '23505') return rep.code(409).send({ error: 'Email already in use' });
                throw err;
            }
        }
    );

    app.patch('/:id', { preHandler: authorize('manage_users') },
        async (req, rep) => {
            const user = await updateUser(req.db, req.params.id, req.body);
            return user ?? rep.code(404).send({ error: 'User not found' });
        }
    );
}
