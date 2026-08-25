import { notFound, redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { productService } from "@/server/services/product-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

export const metadata = { title: "Edit Product | Admin" };

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/products");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("products.update")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to update products.</p>
      </div>
    );
  }

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
