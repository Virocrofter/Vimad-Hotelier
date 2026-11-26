-- P50: global travel_agent role + scoped permissions. The permission
-- resolver's global fallback matches user.role to a tenantId-null role by
-- name — without this row, travel_agent users resolve zero permissions.
INSERT INTO roles (id, name, description, type, "isDefault", "isLocked", "tenantId", "createdAt", "updatedAt")
VALUES ('role_travel_agent_global', 'travel_agent', 'Travel-agent portal role (global)', 'system', false, true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- permissions may already exist under other ids (earlier seeders) — target
-- the (resource, action) unique constraint, never assume fixed ids.
INSERT INTO permissions (id, resource, action, description, category)
VALUES ('perm_reservation_read', 'reservation', 'read', 'Read reservations', 'reservations'),
       ('perm_folio_read', 'folio', 'read', 'Read folios', 'finance')
ON CONFLICT (resource, action) DO NOTHING;

-- wire grants by looking up the REAL permission ids (existing or inserted).
INSERT INTO role_permissions (id, "roleId", "permissionId", conditions)
SELECT 'rp_agent_res_read', 'role_travel_agent_global', p.id, NULL::jsonb
  FROM permissions p WHERE p.resource = 'reservation' AND p.action = 'read'
UNION ALL
SELECT 'rp_agent_folio_read', 'role_travel_agent_global', p.id, NULL::jsonb
  FROM permissions p WHERE p.resource = 'folio' AND p.action = 'read'
ON CONFLICT (id) DO NOTHING;
