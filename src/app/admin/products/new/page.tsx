import { ProductForm } from "@/components/admin/product-form";
import { productService } from "@/server/services/product-service";

export const metadata = { title: "New Product | Admin" };

export default async function NewProductPage() {
  const categories = await productService.getCategories();

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">New Product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
