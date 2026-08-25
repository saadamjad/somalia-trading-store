import { notFound, redirect } from "next/navigation";
import { CMSPageForm } from "@/components/admin/cms-page-form";
import { cmsPageService, CMSPageNotFoundError } from "@/server/services/cms-page-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

export const metadata = { title: "Edit Page | Admin" };

interface EditCMSPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCMSPagePage({ params }: EditCMSPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/cms");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("cms.manage")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to manage CMS content.</p>
      </div>
    );
  }

  const { id } = await params;

  const page = await cmsPageService.adminGetById(id).catch((error) => {
    if (error instanceof CMSPageNotFoundError) notFound();
    throw error;
  });

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">Edit Page</h1>
      <CMSPageForm page={page} />
    </div>
  );
}
