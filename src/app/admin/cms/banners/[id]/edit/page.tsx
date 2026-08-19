import { notFound } from "next/navigation";
import { BannerForm } from "@/components/admin/banner-form";
import { bannerService, BannerNotFoundError } from "@/server/services/banner-service";

export const metadata = { title: "Edit Banner | Admin" };

interface EditBannerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBannerPage({ params }: EditBannerPageProps) {
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
