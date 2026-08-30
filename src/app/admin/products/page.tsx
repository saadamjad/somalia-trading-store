import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { productService } from "@/server/services/product-service";
import { formatProductPrice } from "@/lib/utils";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";

export const metadata = { title: "Products | Admin" };

export default async function AdminProductsPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/products");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const t = await getTranslations("admin.products.list");

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("products.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">{t("accessDeniedTitle")}</h1>
        <p className="text-muted">{t("accessDeniedMessage")}</p>
      </div>
    );
  }

  const products = await productService.getAll();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("totalCount", { count: products.length })}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/products/new">{t("addNew")}</Link>
        </Button>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">{t("columns.name")}</th>
              <th className="px-4 py-3">{t("columns.category")}</th>
              <th className="px-4 py-3">{t("columns.price")}</th>
              <th className="px-4 py-3">{t("columns.availability")}</th>
              <th className="px-4 py-3">{t("columns.featured")}</th>
              <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{product.name}</td>
                <td className="px-4 py-3 text-muted">{product.category}</td>
                <td className="px-4 py-3">
                  {formatProductPrice(product.price, product.currency, product.priceUnit)}
                </td>
                <td className="px-4 py-3 text-muted">{product.availability}</td>
                <td className="px-4 py-3 text-muted">{product.featured ? t("yes") : t("no")}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/products/${product.id}/edit`}>{t("edit")}</Link>
                    </Button>
                    <DeleteButton
                      url={`/api/products/${product.id}`}
                      confirmMessage={t("deleteConfirm", { name: product.name })}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
