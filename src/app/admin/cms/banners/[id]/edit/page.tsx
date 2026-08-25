import { notFound, redirect } from "next/navigation";
import { BannerForm } from "@/components/admin/banner-form";
import { bannerService, BannerNotFoundError } from "@/server/services/banner-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

export const metadata = { title: "Edit Banner | Admin" };

interface EditBannerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBannerPage({ params }: EditBannerPageProps) {
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

  const banner = await bannerService.adminGetById(id).catch((error) => {
    if (error instanceof BannerNotFoundError) notFound();
    throw error;
  });

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">Edit Banner</h1>
      <BannerForm banner={banner} />
    </div>
  );
}
