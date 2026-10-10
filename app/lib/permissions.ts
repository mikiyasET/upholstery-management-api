// =========================================================
// Permission system — shared constants, types, helpers
// =========================================================

/**
 * Every granular permission key in the system.
 * Stored as a JSON object on the User model: { "orders.view": true, ... }
 */
export const PERMISSION_KEYS = [
  // Dashboard (derived — auto-allowed if orders or directSales view is on)
  'dashboard.view',

  // Orders
  'orders.view',
  'orders.create',

  // Direct Sales
  'directSales.view',
  'directSales.create',
  'directSales.history',

  // Customers
  'customers.view',
  'customers.edit',

  // Storage
  'storage.view',
  'storage.edit',

  // Catalog — Materials
  'catalog.materials.view',
  'catalog.materials.add',
  'catalog.materials.edit',
  'catalog.materials.remove',

  // Catalog — Services
  'catalog.services.view',
  'catalog.services.add',
  'catalog.services.edit',
  'catalog.services.remove',

  // Catalog — Cars
  'catalog.cars.view',
  'catalog.cars.add',
  'catalog.cars.edit',
  'catalog.cars.remove',

  // Users & Employees
  'users.view',
  'users.edit',

  // Reports
  'reports.view',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

/**
 * The permissions object shape stored in the DB.
 * Boolean flags for each permission key, plus an optional numeric limit.
 */
export interface UserPermissions {
  [key: string]: boolean | number;
  // Special numeric field:
  // 'orders.limitCount' — 0 means unlimited, >0 means only see last N orders
}

// -------------------------------------------------------
// Permission group definitions — used by the frontend
// to render the toggle grid when configuring a Manager.
// -------------------------------------------------------

export interface PermissionItem {
  key: PermissionKey;
  label: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: PermissionItem[];
  /** If present, this group also has a numeric field */
  numericField?: {
    key: string;
    label: string;
    description: string;
    defaultValue: number;
  };
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'orders',
    label: 'Orders',
    description: 'View, create, and manage customer orders',
    permissions: [
      { key: 'orders.view', label: 'View Orders' },
      { key: 'orders.create', label: 'Create Orders' },
    ],
    numericField: {
      key: 'orders.limitCount',
      label: 'Order Visibility Limit',
      description: '0 = unlimited. Otherwise, the manager can only see the last N orders.',
      defaultValue: 0,
    },
  },
  {
    id: 'directSales',
    label: 'Direct Sales',
    description: 'View and create over-the-counter material sales',
    permissions: [
      { key: 'directSales.view', label: 'View Sales' },
      { key: 'directSales.create', label: 'Create Sales' },
      { key: 'directSales.history', label: 'View Sales History' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'View and manage customer profiles',
    permissions: [
      { key: 'customers.view', label: 'View Customers' },
      { key: 'customers.edit', label: 'Edit Customers' },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'View stock levels and manage transfers, restocks, adjustments',
    permissions: [
      { key: 'storage.view', label: 'View Stock' },
      { key: 'storage.edit', label: 'Edit Stock (Transfers, Restocks)' },
    ],
  },
  {
    id: 'catalog.materials',
    label: 'Catalog — Materials',
    description: 'Manage material items in the catalog',
    permissions: [
      { key: 'catalog.materials.view', label: 'View Materials' },
      { key: 'catalog.materials.add', label: 'Add Materials' },
      { key: 'catalog.materials.edit', label: 'Edit Materials' },
      { key: 'catalog.materials.remove', label: 'Remove Materials' },
    ],
  },
  {
    id: 'catalog.services',
    label: 'Catalog — Services',
    description: 'Manage service items in the catalog',
    permissions: [
      { key: 'catalog.services.view', label: 'View Services' },
      { key: 'catalog.services.add', label: 'Add Services' },
      { key: 'catalog.services.edit', label: 'Edit Services' },
      { key: 'catalog.services.remove', label: 'Remove Services' },
    ],
  },
  {
    id: 'catalog.cars',
    label: 'Catalog — Cars',
    description: 'Manage car brands and models',
    permissions: [
      { key: 'catalog.cars.view', label: 'View Cars' },
      { key: 'catalog.cars.add', label: 'Add Cars' },
      { key: 'catalog.cars.edit', label: 'Edit Cars' },
      { key: 'catalog.cars.remove', label: 'Remove Cars' },
    ],
  },
  {
    id: 'users',
    label: 'Users & Employees',
    description: 'View and manage user accounts and employee profiles',
    permissions: [
      { key: 'users.view', label: 'View Users' },
      { key: 'users.edit', label: 'Edit Users' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Access the reports dashboard',
    permissions: [
      { key: 'reports.view', label: 'View Reports' },
    ],
  },
];

// -------------------------------------------------------
// Default permission sets
// -------------------------------------------------------

/** Full access — used for ADMIN users */
export function getDefaultAdminPermissions(): UserPermissions {
  const perms: UserPermissions = { 'orders.limitCount': 0 };
  for (const key of PERMISSION_KEYS) {
    perms[key] = true;
  }
  return perms;
}

/** No access — baseline for MANAGER users (admin toggles on what's needed) */
export function getDefaultManagerPermissions(): UserPermissions {
  const perms: UserPermissions = { 'orders.limitCount': 0 };
  for (const key of PERMISSION_KEYS) {
    perms[key] = false;
  }
  return perms;
}

// -------------------------------------------------------
// Runtime helpers
// -------------------------------------------------------

/**
 * Check if a user's permissions object grants a specific permission.
 * ADMIN role always returns true (full bypass).
 */
export function hasPermission(
  role: string,
  permissions: UserPermissions | null | undefined,
  key: PermissionKey
): boolean {
  if (role === 'ADMIN') return true;
  if (!permissions) return false;
  return permissions[key] === true;
}

/**
 * Get the order limit count for a user.
 * Returns 0 (unlimited) for ADMINs or if not set.
 */
export function getOrderLimitCount(
  role: string,
  permissions: UserPermissions | null | undefined
): number {
  if (role === 'ADMIN') return 0;
  if (!permissions) return 0;
  const limit = permissions['orders.limitCount'];
  return typeof limit === 'number' ? limit : 0;
}
