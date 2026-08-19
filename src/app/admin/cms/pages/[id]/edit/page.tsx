import { notFound } from "next/navigation";
import { CMSPageForm } from "@/components/admin/cms-page-form";
import { cmsPageService, CMSPageNotFoundError } from "@/server/services/cms-page-service";

export const metadata = { title: "Edit Page | Admin" };

interface EditCMSPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCMSPagePage({ params }: EditCMSPageProps) {
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
