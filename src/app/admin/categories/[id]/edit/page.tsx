import { notFound, redirect } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { productService } from "@/server/services/product-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

export const metadata = { title: "Edit Category | Admin" };

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/categories");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("categories.update")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to update categories.</p>
      </div>
    );
  }

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
