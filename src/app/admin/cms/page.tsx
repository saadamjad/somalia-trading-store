import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { bannerService } from "@/server/services/banner-service";
import { cmsPageService } from "@/server/services/cms-page-service";

export const metadata = { title: "CMS | Admin" };

/** `/admin/cms` — gated on `cms.view` (the admin shell's own layout already requires
 * `products.view` to enter `/admin` at all; this page's own gate is the CMS-specific
 * one per the Phase 12 spec). Lists Banners and CMSPages together, matching the
 * proportionate-editor scope from docs/IMPLEMENTATION_PLAN.md Phase 12 — no separate
 * dashboard framework, just the two entity tables. */
export default async function AdminCMSPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?callbackUrl=/admin/cms");

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("cms.view")) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to manage CMS content.</p>
      </div>
    );
  }

  const canManage = permissions.has("cms.manage");
  const [banners, pages] = await Promise.all([
    bannerService.adminList(),
    cmsPageService.adminList(),
  ]);

  return (
    <div className="space-y-12">
      <div>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Banners</h1>
            <p className="text-sm text-muted">{banners.length} total</p>
          </div>
          {canManage && (
            <Button asChild size="sm">
              <Link href="/admin/cms/banners/new">New Banner</Link>
            </Button>
          )}
        </div>

        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Active</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{banner.title}</td>
                  <td className="px-4 py-3 text-muted">{banner.slot}</td>
                  <td className="px-4 py-3 text-muted">{banner.priority}</td>
                  <td className="px-4 py-3">
                    {banner.active ? (
                      <span className="text-accent">Active</span>
                    ) : (
                      <span className="text-muted">Inactive</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/cms/banners/${banner.id}/edit`}>Edit</Link>
                        </Button>
                        <DeleteButton
                          url={`/api/admin/cms/banners/${banner.id}`}
                          confirmMessage={`Delete banner "${banner.title}"?`}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {banners.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-muted">
                    No banners yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Pages</h1>
            <p className="text-sm text-muted">{pages.length} total</p>
          </div>
          {canManage && (
            <Button asChild size="sm">
              <Link href="/admin/cms/pages/new">New Page</Link>
            </Button>
          )}
        </div>

        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Published</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{page.title}</td>
                  <td className="px-4 py-3 text-muted">/{page.slug}</td>
                  <td className="px-4 py-3">
                    {page.published ? (
                      <span className="text-accent">Published</span>
                    ) : (
                      <span className="text-muted">Draft</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/cms/pages/${page.id}/edit`}>Edit</Link>
                        </Button>
                        <DeleteButton
                          url={`/api/admin/cms/pages/${page.id}`}
                          confirmMessage={`Delete page "${page.title}"?`}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {pages.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-4 py-8 text-center text-muted">
                    No pages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
