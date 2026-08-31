import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/components/admin/product-form";
import { productService } from "@/server/services/product-service";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

export const metadata = { title: "New Product | Admin" };

export default async function NewProductPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/products/new");
  }

  const t = await getTranslations("admin.products");

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("products.create")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">{t("list.accessDeniedTitle")}</h1>
        <p className="text-muted">{t("list.accessDeniedCreateMessage")}</p>
      </div>
    );
  }

  const categories = await productService.getCategories();

  return (
    <div>
      <h1 className="font-display mb-8 text-2xl font-bold">{t("new.title")}</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
