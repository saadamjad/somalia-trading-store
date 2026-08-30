-- DropIndex
DROP INDEX "CartItem_cartId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantLabel" TEXT;

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "price" DECIMAL(12,2),
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantInventory" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "variantId" TEXT NOT NULL,

    CONSTRAINT "VariantInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantInventoryTransaction" (
    "id" TEXT NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "reason" "InventoryChangeReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "VariantInventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantInventory_variantId_key" ON "VariantInventory"("variantId");

-- CreateIndex
CREATE INDEX "VariantInventoryTransaction_inventoryId_idx" ON "VariantInventoryTransaction"("inventoryId");

-- CreateIndex
CREATE INDEX "VariantInventoryTransaction_variantId_idx" ON "VariantInventoryTransaction"("variantId");

-- CreateIndex
CREATE INDEX "VariantInventoryTransaction_actorId_idx" ON "VariantInventoryTransaction"("actorId");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantInventory" ADD CONSTRAINT "VariantInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantInventoryTransaction" ADD CONSTRAINT "VariantInventoryTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "VariantInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantInventoryTransaction" ADD CONSTRAINT "VariantInventoryTransaction_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantInventoryTransaction" ADD CONSTRAINT "VariantInventoryTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique indexes: Prisma's schema DSL has no WHERE-clause syntax, same gap as
-- the hand-added CHECK constraints elsewhere in this schema (see docs/DECISIONS.md).
-- Replaces the dropped plain "CartItem_cartId_productId_key" with two conditional
-- indexes so a plain (non-variant) product line keeps its original one-row-per-product
-- guarantee, while a variant product can have multiple lines (one per chosen variant)
-- in the same cart.
CREATE UNIQUE INDEX "CartItem_cartId_productId_novariant_key" ON "CartItem"("cartId", "productId") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId", "productId", "variantId") WHERE "variantId" IS NOT NULL;

-- CHECK constraints: same hand-added pattern as Inventory.quantity's non-negative
-- constraint (see docs/DECISIONS.md and prisma/migrations/20260819190717_add_inventory).
ALTER TABLE "VariantInventory" ADD CONSTRAINT "variant_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "variant_price_non_negative" CHECK ("price" IS NULL OR "price" >= 0);
