import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { productService } from "@/server/services/product-service";

export const metadata = { title: "Edit Category | Admin" };

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;
  const [category, allCategories] = await Promise.all([
    productService.getCategoryById(id),
    productService.getCategories(),
  ]);

  if (!category) notFound();

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">Edit Category</h1>
      <CategoryForm category={category} allCategories={allCategories} />
    </div>
  );
}
