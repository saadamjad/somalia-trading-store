import { BannerForm } from "@/components/admin/banner-form";

export const metadata = { title: "New Banner | Admin" };

export default function NewBannerPage() {
  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">New Banner</h1>
      <BannerForm />
    </div>
  );
}
