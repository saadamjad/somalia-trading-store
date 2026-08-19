import { CategoryForm } from "@/components/admin/category-form";

export const metadata = { title: "New Category | Admin" };

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">New Category</h1>
      <CategoryForm />
    </div>
  );
}
