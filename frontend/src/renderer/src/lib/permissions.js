// Single source of truth for what each role can do in the UI.
//
// Mirrors the backend's PERMISSIONS table in backend/src/middleware/authorize.js.
// Whenever the backend's permissions change, update this file too — otherwise
// the UI will hide buttons the backend would allow, or vice versa.
//
//   read         → every authenticated user
//   create       → dev, section_manager, employee
//   edit/write   → dev, section_manager, employee  (interchangeable aliases)
//   delete       → dev, section_manager
//   manage_users → dev, it_service
//
// `canEdit` and `canWrite` resolve to the same boolean — the codebase uses
// "edit" for record changes and "write" for status transitions, so both names
// exist for readability at the call site.

export function getPermissions(user) {
  const role  = user?.role
  const isDev = role === 'dev'

  const canCreate = isDev || role === 'section_manager' || role === 'employee'
  const canWrite  = canCreate    // same set of roles
  const canEdit   = canWrite     // alias for clarity in CRUD contexts
  const canDelete = isDev || role === 'section_manager'
  const canManageUsers = isDev || role === 'it_service'

  return {
    role,
    isDev,
    canCreate,
    canEdit,
    canWrite,
    canDelete,
    canManageUsers,
  }
}
