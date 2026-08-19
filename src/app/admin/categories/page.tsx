import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { productService } from "@/server/services/product-service";

export const metadata = { title: "Categories | Admin" };

export default async function AdminCategoriesPage() {
  const categories = await productService.getCategories();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted">{categories.length} total</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/categories/new">New Category</Link>
        </Button>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Subcategories</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{category.name}</td>
                <td className="px-4 py-3 text-muted">{category.slug}</td>
                <td className="px-4 py-3 text-muted">
                  {category.subcategories.join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/categories/${category.id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteButton
                      url={`/api/categories/${category.id}`}
                      confirmMessage={`Delete "${category.name}"? This fails if it still has products.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
