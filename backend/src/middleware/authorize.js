// Permissions granted to each role.
//   read         → GET endpoints (view data)
//   create       → POST endpoints (add new records, record transactions, link items)
//   write        → PATCH endpoints + sub-action POSTs (edit records, mark POs sent / received,
//                  mark SOs confirmed / shipped, transition statuses)
//   delete       → DELETE endpoints
//   manage_users → /users endpoints only
//
// Permission rules:
//   - Everyone can read.
//   - `dev` is the all-access role; the first account created via the setup wizard is `dev`.
//   - `section_manager` can do everything except manage accounts.
//   - `employee` is a frontline worker — they can add data and progress orders, but can't
//     delete or change other users.
//   - `head_manager` is intentionally read-only for executive-level oversight.
//   - `it_service` only manages accounts (and can read to make sense of audit context).
const PERMISSIONS = {
    dev:             ['read', 'create', 'write', 'delete', 'manage_users'],
    head_manager:    ['read'],
    section_manager: ['read', 'create', 'write', 'delete'],
    employee:        ['read', 'create', 'write'],
    it_service:      ['read', 'manage_users'],
};

export function authorize(...required) {
    return async (request, reply) => {
        const userPerms = PERMISSIONS[request.user?.role] ?? [];
        if (!required.every(p => userPerms.includes(p))) {
            reply.code(403).send({ error: 'Forbidden' });
        }
    };
}
