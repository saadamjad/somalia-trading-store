import { CMSPageForm } from "@/components/admin/cms-page-form";

export const metadata = { title: "New Page | Admin" };

export default function NewCMSPagePage() {
  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">New Page</h1>
      <CMSPageForm />
    </div>
  );
}
