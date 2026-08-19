import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { productService } from "@/server/services/product-service";

export const metadata = { title: "Edit Product | Admin" };

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    productService.getById(id),
    productService.getCategories(),
  ]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">Edit Product</h1>
      <ProductForm categories={categories} product={{ ...product, id }} />
    </div>
  );
}
