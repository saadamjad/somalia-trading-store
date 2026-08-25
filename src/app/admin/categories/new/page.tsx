import { CategoryForm } from "@/components/admin/category-form";
import { productService } from "@/server/services/product-service";

export const metadata = { title: "New Category | Admin" };

export default async function NewCategoryPage() {
  const categories = await productService.getCategories();

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">New Category</h1>
      <CategoryForm allCategories={categories} />
    </div>
  );
}
