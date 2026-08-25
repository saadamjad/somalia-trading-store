/**
 * Admin User Management & RBAC — human-readable labels for permission keys, grouped
 * by resource. Single source of truth for the read-only "this role grants..." display
 * on the admin-user create/edit form; never used for authorization itself (that's
 * always `requirePermission`/`getRolePermissions`, server-side).
 */
export const PERMISSION_GROUPS: {
  label: string;
  permissions: { key: string; label: string }[];
}[] = [
  {
    label: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View Dashboard" }],
  },
  {
    label: "Products",
    permissions: [
      { key: "products.view", label: "View Products" },
      { key: "products.create", label: "Create Products" },
      { key: "products.update", label: "Update Products" },
      { key: "products.delete", label: "Delete Products" },
    ],
  },
  {
    label: "Categories",
    permissions: [
      { key: "categories.view", label: "View Categories" },
      { key: "categories.create", label: "Create Categories" },
      { key: "categories.update", label: "Update Categories" },
      { key: "categories.delete", label: "Delete Categories" },
    ],
  },
  {
    label: "Inventory",
    permissions: [
      { key: "inventory.view", label: "View Inventory" },
      { key: "inventory.update", label: "Update Inventory" },
    ],
  },
  {
    label: "Orders",
    permissions: [
      { key: "orders.view", label: "View Orders" },
      { key: "orders.update", label: "Update Orders" },
    ],
  },
  {
    label: "Customers",
    permissions: [
      { key: "customers.view", label: "View Customers" },
      { key: "customers.update", label: "Update Customers" },
    ],
  },
  {
    label: "Refunds",
    permissions: [
      { key: "refunds.view", label: "View Refunds" },
      { key: "refunds.manage", label: "Manage Refunds" },
    ],
  },
  {
    label: "Quotes",
    permissions: [
      { key: "quotes.view", label: "View Quotes" },
      { key: "quotes.manage", label: "Manage Quotes" },
    ],
  },
  {
    label: "CMS",
    permissions: [
      { key: "cms.view", label: "View CMS" },
      { key: "cms.manage", label: "Manage CMS" },
    ],
  },
  {
    label: "Reports",
    permissions: [{ key: "reports.view", label: "View Reports" }],
  },
  {
    label: "Admin Users",
    permissions: [
      { key: "admin_users.view", label: "View Admins" },
      { key: "admin_users.create", label: "Create Admins" },
      { key: "admin_users.update", label: "Update Admins" },
      { key: "admin_users.deactivate", label: "Activate/Deactivate Admins" },
      { key: "admin_users.reset_password", label: "Reset Admin Passwords" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function roleLabel(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName;
}
