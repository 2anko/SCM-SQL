// Permissions granted to each role.
// read    → GET endpoints (view data)
// create  → POST / endpoints (add new records, record transactions)
// write   → PATCH / sub-action POSTs (edit existing records, receive POs, ship SOs)
// delete  → DELETE endpoints
// manage_users → /users endpoints only
const PERMISSIONS = {
    head_manager:    ['read'],
    section_manager: ['read', 'write', 'delete'],
    employee:        ['read', 'create'],
    it_service:      ['manage_users'],
};

export function authorize(...required) {
    return async (request, reply) => {
        const userPerms = PERMISSIONS[request.user?.role] ?? [];
        if (!required.every(p => userPerms.includes(p))) {
            reply.code(403).send({ error: 'Forbidden' });
        }
    };
}
