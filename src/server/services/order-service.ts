import { prisma } from "@/server/lib/prisma";
import { orderRepository, type ShippingSnapshot } from "@/server/repositories/order-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { cartRepository } from "@/server/repositories/cart-repository";
import { cartService, type StockIssue } from "@/server/services/cart-service";
import { addressService } from "@/server/services/address-service";
import { inventoryService } from "@/server/services/inventory-service";
import type { OrderCreateInput } from "@/lib/validations/order";
import type { Order, OrderItem } from "@/generated/prisma/client";

export class EmptyCartError extends Error {
  constructor() {
    super("Your cart is empty — add items before checking out.");
    this.name = "EmptyCartError";
  }
}

/** Thrown when one or more cart lines can't be fulfilled at their requested quantity. */
export class StockUnavailableError extends Error {
  issues: StockIssue[];
  constructor(issues: StockIssue[]) {
    super("One or more items in your cart are no longer available in the requested quantity.");
    this.name = "StockUnavailableError";
    this.issues = issues;
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
    this.name = "OrderNotFoundError";
  }
}

export interface OrderItemView {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  shipping: {
    recipientName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
  };
  subtotal: number;
  total: number;
  currency: string;
  customerNote: string | null;
  items: OrderItemView[];
  createdAt: string;
  updatedAt: string;
}

type OrderWithItems = Order & { items: OrderItem[] };

function toOrderView(order: OrderWithItems): OrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shipping: {
      recipientName: order.shippingRecipientName,
      phone: order.shippingPhone,
      line1: order.shippingLine1,
      line2: order.shippingLine2,
      city: order.shippingCity,
      region: order.shippingRegion,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    currency: order.currency,
    customerNote: order.customerNote,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function normalizeInline(value?: string): string | null {
  return value ? value : null;
}

function shippingFromAddress(address: {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
}): ShippingSnapshot {
  return {
    shippingRecipientName: address.recipientName,
    shippingPhone: address.phone,
    shippingLine1: address.line1,
    shippingLine2: address.line2,
    shippingCity: address.city,
    shippingRegion: address.region,
    shippingPostalCode: address.postalCode,
    shippingCountry: address.country,
  };
}

function shippingFromInline(input: NonNullable<OrderCreateInput["shippingAddress"]>): ShippingSnapshot {
  return {
    shippingRecipientName: input.recipientName,
    shippingPhone: input.phone,
    shippingLine1: input.line1,
    shippingLine2: normalizeInline(input.line2),
    shippingCity: input.city,
    shippingRegion: normalizeInline(input.region),
    shippingPostalCode: normalizeInline(input.postalCode),
    shippingCountry: input.country,
  };
}

function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${datePart}-${randPart}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Order creation — the safety-critical core of Phase 8. Given a session-verified
 * `userId` and a shipping choice (an owned address id or an inline address), this:
 *
 *  1. Resolves the shipping snapshot (never a live Address FK — see schema.prisma).
 *  2. Loads the user's server-side cart — the ONLY source of "what's being ordered".
 *     No API surface here accepts a client-supplied product list, price, or quantity;
 *     see src/lib/validations/order.ts.
 *  3. Validates stock via cartService.validateStock (reused from Phase 7, not
 *     reimplemented) and re-prices every line from the current Product rows.
 *  4. Runs order creation + inventory decrement + cart clear in ONE Prisma
 *     `$transaction`: if anything fails (insufficient stock discovered at the atomic
 *     decrement, a DB error, an order-number collision), everything rolls back —
 *     no partial order, no wrongly-decremented inventory, cart left untouched.
 *
 * `status`/`paymentStatus` are hardcoded to PENDING/NOT_PAID — see docs/DECISIONS.md
 * D-007. Nothing in this method (or anywhere else in this phase) can produce any other
 * value.
 */
export const orderService = {
  async createOrder(userId: string, input: OrderCreateInput): Promise<OrderView> {
    const shipping = input.addressId
      ? shippingFromAddress(await addressService.getOwned(input.addressId, userId))
      : shippingFromInline(input.shippingAddress!);

    const cartItems = await cartService.getCartForUser(userId);
    if (cartItems.length === 0) {
      throw new EmptyCartError();
    }

    const stockIssues = await cartService.validateStock(cartItems);
    if (stockIssues.length > 0) {
      throw new StockUnavailableError(stockIssues);
    }

    const productIds = cartItems.map((item) => item.productId);
    const products = await productRepository.findByIds(productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    const missing = cartItems.filter((item) => !productById.has(item.productId));
    if (missing.length > 0) {
      // A cart item referencing a product that no longer exists is functionally the
      // same as "0 available" from the customer's point of view.
      throw new StockUnavailableError(
        missing.map((item) => ({ productId: item.productId, requested: item.quantity, available: 0 }))
      );
    }

    const currency = products[0]?.currency ?? "USD";

    const orderItemsInput = cartItems.map((item) => {
      const product = productById.get(item.productId)!;
      const unitPrice = Number(product.price);
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? null,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const subtotal = Math.round(orderItemsInput.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
    // No tax/shipping charges are calculated (D-008, deferred) — total equals subtotal
    // today. Kept as a separate field so tax/shipping can be added later without a
    // breaking schema change.
    const total = subtotal;

    const customerNote = input.customerNote ? input.customerNote : null;

    const MAX_ORDER_NUMBER_ATTEMPTS = 5;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
      const orderNumber = generateOrderNumber();
      try {
        const created = await prisma.$transaction(async (tx) => {
          // Decrement stock for every line FIRST, inside this same transaction — the
          // atomic conditional UPDATE inside inventoryService.adjustStock (passed this
          // `tx`, not a new one) throws InsufficientStockError if stock changed since
          // the pre-check above, which aborts and rolls back the whole transaction.
          for (const item of orderItemsInput) {
            await inventoryService.adjustStock(
              {
                productId: item.productId,
                delta: -item.quantity,
                reason: "ORDER_PLACED",
                actorId: userId,
                note: `Order ${orderNumber}`,
              },
              tx
            );
          }

          const order = await orderRepository.createTx(tx, {
            orderNumber,
            userId,
            subtotal,
            total,
            currency,
            customerNote,
            ...shipping,
            items: orderItemsInput,
          });

          // Cart is cleared only here, inside the same transaction as order creation —
          // if anything above throws, this line never runs and the cart is untouched.
          const cart = await cartRepository.findByUserIdTx(tx, userId);
          if (cart) {
            await cartRepository.clearItemsTx(tx, cart.id);
          }

          return order;
        });

        return toOrderView(created);
      } catch (error) {
        lastError = error;
        if (isUniqueConstraintError(error)) {
          // orderNumber collision — vanishingly unlikely, but retry with a fresh one
          // rather than surfacing a confusing 500 to the customer.
          continue;
        }
        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to create order after multiple attempts.");
  },

  async listForUser(userId: string): Promise<OrderView[]> {
    const orders = await orderRepository.findAllForUser(userId);
    return orders.map(toOrderView);
  },

  /** Verifies ownership before returning — throws `OrderNotFoundError` otherwise. */
  async getOwned(id: string, userId: string): Promise<OrderView> {
    const order = await orderRepository.findByIdForUser(id, userId);
    if (!order) throw new OrderNotFoundError();
    return toOrderView(order);
  },
};
