// routes/users.js — only accessible by it_service role
import { getAllUsers, createUser, updateUser } from '../queries/users.js';
import { authorize } from '../middleware/authorize.js';

const ROLES = ['head_manager', 'section_manager', 'employee', 'it_service'];

const createSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'role'],
    additionalProperties: false,
    properties: {
      email:    { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      role:     { type: 'string', enum: ROLES },
    },
  },
};

const updateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      role:      { type: 'string', enum: ROLES },
      is_active: { type: 'boolean' },
      password:  { type: 'string', minLength: 8 },
    },
  },
};

export default async function userRoutes(app) {
  app.get('/', { preHandler: authorize('manage_users') },
    async (req) => getAllUsers(req.db)
  );
  app.post('/', { preHandler: authorize('manage_users'), schema: createSchema },
    async (req, rep) => {
      try {
        const user = await createUser(req.db, { ...req.body, created_by: req.user.userId });
        return rep.code(201).send(user);
      } catch (err) {
        if (err.code === '23505') return rep.code(409).send({ error: 'Email already in use' });
        throw err;
      }
    }
  );
  app.patch('/:id', { preHandler: authorize('manage_users'), schema: updateSchema },
    async (req, rep) => {
      const user = await updateUser(req.db, req.params.id, req.body);
      return user ?? rep.code(404).send({ error: 'User not found' });
    }
  );
}
