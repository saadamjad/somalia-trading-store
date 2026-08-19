-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "subcategory" TEXT;

-- CreateIndex
CREATE INDEX "Product_subcategory_idx" ON "Product"("subcategory");
