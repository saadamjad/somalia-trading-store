import { prisma } from "@/server/lib/prisma";
import {
  quoteRepository,
  type QuoteAdminListFilters,
} from "@/server/repositories/quote-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { cartService } from "@/server/services/cart-service";
import { addressService } from "@/server/services/address-service";
import {
  orderService,
  shippingFromAddress,
  shippingFromInline,
  StockUnavailableError,
  type ShippingSnapshot,
  type OrderView,
} from "@/server/services/order-service";
import { notificationService } from "@/server/services/notification-service";
import type {
  QuoteAdminQueryInput,
  QuoteAdminRespondInput,
  QuoteConvertInput,
  QuoteCreateInput,
} from "@/lib/validations/quote";
import type { Quote, QuoteItem, QuoteStatus } from "@/generated/prisma/client";

export class QuoteNotFoundError extends Error {
  constructor() {
    super("Quote not found.");
    this.name = "QuoteNotFoundError";
  }
}

export class QuoteItemProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.name = "QuoteItemProductNotFoundError";
  }
}

export class InvalidQuoteStatusTransitionError extends Error {
  constructor(from: QuoteStatus, to: QuoteStatus) {
    super(`Cannot move a quote from ${from} to ${to}.`);
    this.name = "InvalidQuoteStatusTransitionError";
  }
}

/** Thrown when a PATCH response's `items` don't exactly match the quote's own item ids. */
export class QuoteItemMismatchError extends Error {
  constructor() {
    super("The submitted items don't match this quote's items — every item needs a price.");
    this.name = "QuoteItemMismatchError";
  }
}

/** Thrown by `convertToOrder` when the quote isn't in ACCEPTED status. */
export class QuoteNotConvertibleError extends Error {
  constructor(status: QuoteStatus) {
    super(`Only ACCEPTED quotes can be converted to an order (this quote is ${status}).`);
    this.name = "QuoteNotConvertibleError";
  }
}

/**
 * Thrown by `convertToOrder` for a guest quote (no `userId`) — see Quote's schema
 * comment: conversion requires an owning User because Order.userId is required and
 * there's no session to attach a guest's order to. A guest whose quote needs
 * converting must register/log in (and a new quote submitted while logged in), or an
 * admin can handle it manually outside this system — both explicitly out of scope here.
 */
export class QuoteMissingUserForConversionError extends Error {
  constructor() {
    super(
      "This quote was submitted by a guest and has no associated account — it can't be " +
        "converted directly. The guest must register or log in first."
    );
    this.name = "QuoteMissingUserForConversionError";
  }
}

/** Defensive guard — should be unreachable in practice, since ACCEPTED is only ever
 * reached via QUOTED, and `respond` requires every item to receive a price. */
export class QuoteMissingPricingError extends Error {
  constructor() {
    super("This quote has an item with no quoted price and cannot be converted.");
    this.name = "QuoteMissingPricingError";
  }
}

/**
 * Judgment call (Phase 11 plan leaves granularity open): NEW and REVIEWING can both
 * move to QUOTED (via `respond`, a dedicated action — see its own comment) or DECLINED;
 * REVIEWING is an optional intermediate an admin can pass through first, mirroring
 * RefundRequestStatus.UNDER_REVIEW. QUOTED can move to ACCEPTED or DECLINED. ACCEPTED
 * has no further transition through this map — moving to CONVERTED only ever happens
 * via `convertToOrder`, a distinct action with its own preconditions (stock, an
 * associated user), never a plain status PATCH. DECLINED/CONVERTED are terminal.
 */
const ALLOWED_QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  NEW: ["REVIEWING", "QUOTED", "DECLINED"],
  REVIEWING: ["QUOTED", "DECLINED"],
  QUOTED: ["ACCEPTED", "DECLINED"],
  ACCEPTED: [],
  DECLINED: [],
  CONVERTED: [],
};

function assertValidTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!ALLOWED_QUOTE_STATUS_TRANSITIONS[from].includes(to)) {
    throw new InvalidQuoteStatusTransitionError(from, to);
  }
}

export interface QuoteItemView {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  requestedPrice: number | null;
  customerNote: string | null;
  quotedUnitPrice: number | null;
  quotedLineTotal: number | null;
}

export interface QuoteStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actor: { id: string; name: string } | null;
  createdAt: string;
}

export interface QuoteView {
  id: string;
  status: string;
  contact: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
  };
  user: { id: string; name: string; email: string } | null;
  customerNote: string | null;
  adminNote: string | null;
  currency: string;
  items: QuoteItemView[];
  convertedOrder: { id: string; orderNumber: string } | null;
  statusHistory: QuoteStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

interface QuoteItemRow {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  requestedPrice: unknown;
  customerNote: string | null;
  quotedUnitPrice: unknown;
}

interface QuoteRow {
  id: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  contactCompany: string | null;
  user: { id: string; name: string; email: string } | null;
  customerNote: string | null;
  adminNote: string | null;
  currency: string;
  items: QuoteItemRow[];
  convertedOrder: { id: string; orderNumber: string } | null;
  statusHistory: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    actor: { id: string; name: string } | null;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

function toItemView(row: QuoteItemRow): QuoteItemView {
  const quotedUnitPrice = row.quotedUnitPrice !== null ? Number(row.quotedUnitPrice) : null;
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    sku: row.sku,
    quantity: row.quantity,
    requestedPrice: row.requestedPrice !== null ? Number(row.requestedPrice) : null,
    customerNote: row.customerNote,
    quotedUnitPrice,
    quotedLineTotal:
      quotedUnitPrice !== null ? Math.round(quotedUnitPrice * row.quantity * 100) / 100 : null,
  };
}

function toView(row: QuoteRow): QuoteView {
  return {
    id: row.id,
    status: row.status,
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
      company: row.contactCompany,
    },
    user: row.user,
    customerNote: row.customerNote,
    adminNote: row.adminNote,
    currency: row.currency,
    items: row.items.map(toItemView),
    convertedOrder: row.convertedOrder,
    statusHistory: row.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      actor: h.actor,
      createdAt: h.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type QuoteWithDetail = Quote & {
  items: QuoteItem[];
  user: { id: string; name: string; email: string } | null;
  convertedOrder: { id: string; orderNumber: string } | null;
  statusHistory: {
    id: string;
    fromStatus: QuoteStatus | null;
    toStatus: QuoteStatus;
    note: string | null;
    actor: { id: string; name: string } | null;
    createdAt: Date;
  }[];
};

/**
 * Quote submission, customer/admin review, and quote-to-order conversion — the core of
 * Phase 11. Guest submission is intentional (see Quote's schema comment); ownership
 * checks (customer-facing reads/decisions) mirror refund-request-service.ts exactly.
 */
export const quoteService = {
  /**
   * Creates a NEW quote. `submitterUserId` is the session-verified caller's id if
   * logged in, or null for a guest — either way, `input.name/email/phone/company` are
   * what get stored (see Quote's schema comment on why contact fields are always
   * inline rather than read live off the user profile). Every `items[].productId` is
   * re-resolved against the live Product table for its name/sku snapshot and to reject
   * a request for a product that doesn't exist; `requestedPrice` is stored purely as
   * customer-supplied context and never becomes an authoritative price.
   */
  async submit(submitterUserId: string | null, input: QuoteCreateInput): Promise<QuoteView> {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await productRepository.findByIds(productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      if (!productById.has(item.productId)) {
        throw new QuoteItemProductNotFoundError(item.productId);
      }
    }

    const currency = products[0]?.currency ?? "USD";

    const items = input.items.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? null,
        quantity: item.quantity,
        requestedPrice: item.requestedPrice ?? null,
        customerNote: item.note ? item.note : null,
      };
    });

    const created = await prisma.$transaction((tx) =>
      quoteRepository.createTx(tx, {
        userId: submitterUserId,
        contactName: input.name,
        contactEmail: input.email,
        contactPhone: input.phone ? input.phone : null,
        contactCompany: input.company ? input.company : null,
        customerNote: input.message ? input.message : null,
        currency,
        items,
      })
    );

    return toView(created as unknown as QuoteRow);
  },

  /** Customer's own quotes only (guest quotes have no userId and never appear here). */
  async listForUser(userId: string): Promise<QuoteView[]> {
    const rows = await quoteRepository.findAllForUser(userId);
    return rows.map((r) => toView(r as unknown as QuoteRow));
  },

  /** Verifies ownership before returning — throws otherwise (IDOR: 404). */
  async getOwned(id: string, userId: string): Promise<QuoteView> {
    const row = await quoteRepository.findByIdForUser(id, userId);
    if (!row) throw new QuoteNotFoundError();
    return toView(row as unknown as QuoteRow);
  },

  /**
   * Customer's own accept/decline of a QUOTED quote. Ownership-checked; only reachable
   * from QUOTED, only to ACCEPTED or DECLINED — enforced by the same transitions map as
   * the admin path, so a customer can't, say, PATCH their own quote back to NEW. The
   * history row is written with no `actorId` (see QuoteStatusHistory's schema comment)
   * even though the actor is a known, session-verified user — this keeps the
   * admin-facing timeline's `actor` field meaning "an admin did this" unambiguously.
   */
  async customerUpdateStatus(
    id: string,
    userId: string,
    toStatus: "ACCEPTED" | "DECLINED"
  ): Promise<QuoteView> {
    const current = await quoteRepository.findByIdForUser(id, userId);
    if (!current) throw new QuoteNotFoundError();

    assertValidTransition(current.status, toStatus);

    const updated = await prisma.$transaction((tx) =>
      quoteRepository.updateStatusTx(tx, id, {
        fromStatus: current.status,
        toStatus,
        actorId: null,
      })
    );

    return toView(updated as unknown as QuoteRow);
  },

  /** Admin list — no ownership scoping; caller must have already checked `quotes.view`. */
  async adminList(query: QuoteAdminQueryInput): Promise<{
    items: QuoteView[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const filters: QuoteAdminListFilters = { status: query.status };
    const { items, total } = await quoteRepository.adminFindMany({
      filters,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: items.map((r) => toView(r as unknown as QuoteRow)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  /** Admin detail — no ownership scoping. */
  async adminGetById(id: string): Promise<QuoteView> {
    const row = await quoteRepository.adminFindById(id);
    if (!row) throw new QuoteNotFoundError();
    return toView(row as unknown as QuoteRow);
  },

  /**
   * Admin pricing response — sets `quotedUnitPrice` on every item and moves the quote
   * to QUOTED. Only reachable from NEW/REVIEWING (via `assertValidTransition`).
   * `input.items` must name exactly the quote's own item ids, no more, no fewer — a
   * partially-priced quote isn't a valid response.
   */
  async respond(id: string, actorId: string, input: QuoteAdminRespondInput): Promise<QuoteView> {
    const current = await quoteRepository.adminFindById(id);
    if (!current) throw new QuoteNotFoundError();

    assertValidTransition(current.status, "QUOTED");

    const currentItemIds = new Set(current.items.map((item) => item.id));
    const inputItemIds = new Set(input.items.map((item) => item.id));

    if (
      currentItemIds.size !== inputItemIds.size ||
      current.items.some((item) => !inputItemIds.has(item.id))
    ) {
      throw new QuoteItemMismatchError();
    }

    const updated = await prisma.$transaction((tx) =>
      quoteRepository.respondTx(tx, id, {
        items: input.items,
        fromStatus: current.status,
        actorId,
        adminNote: input.adminNote !== undefined ? (input.adminNote ? input.adminNote : null) : undefined,
      })
    );

    const view = toView(updated as unknown as QuoteRow);

    // Phase 15: notify the quote's associated user, if there is one — guest quotes
    // (no `userId`) have no in-app inbox to deliver to and are skipped, per
    // docs/IMPLEMENTATION_PLAN.md Phase 15 ("guest quotes have no user to notify
    // in-app — that's fine, just skip in-app notification for guest quotes").
    if (current.userId) {
      await notificationService.notify({
        userId: current.userId,
        type: "QUOTE_RESPONSE",
        title: "Your quote is ready",
        message: "We've responded to your quote request with pricing — take a look.",
        relatedEntityType: "QUOTE",
        relatedEntityId: view.id,
      });
    }

    return view;
  },

  /**
   * Admin plain status transition (REVIEWING / ACCEPTED / DECLINED) — e.g. an admin
   * marking a quote ACCEPTED on the customer's behalf after a phone confirmation.
   * Never QUOTED (use `respond`) or CONVERTED (use `convertToOrder`).
   */
  async adminUpdateStatus(
    id: string,
    actorId: string,
    toStatus: "REVIEWING" | "ACCEPTED" | "DECLINED",
    note?: string
  ): Promise<QuoteView> {
    const current = await quoteRepository.adminFindById(id);
    if (!current) throw new QuoteNotFoundError();

    assertValidTransition(current.status, toStatus);

    const updated = await prisma.$transaction((tx) =>
      quoteRepository.updateStatusTx(tx, id, {
        fromStatus: current.status,
        toStatus,
        actorId,
        note: note ? note : null,
      })
    );

    return toView(updated as unknown as QuoteRow);
  },

  /**
   * Quote-to-order conversion — admin-triggered by design (see docs/DECISIONS.md-style
   * judgment call recorded in AGENTS.md/Phase 11 plan): this is a B2B-style manual
   * sales process, not self-service checkout, so a customer accepting a quote
   * (`customerUpdateStatus` to ACCEPTED) does not by itself create an order. Requires:
   *  - the quote to be ACCEPTED (`QuoteNotConvertibleError` otherwise),
   *  - the quote to have an associated `userId` (`QuoteMissingUserForConversionError`
   *    for a guest quote — see that error's own comment for the full rationale),
   *  - current stock to still cover every item (re-checked here via
   *    `cartService.validateStock`, even though the quote may have been accepted a
   *    while ago and stock can have changed since — `StockUnavailableError` otherwise).
   *
   * Pricing is locked to each item's `quotedUnitPrice` — NEVER the product's current
   * live price — the entire point of a quote is a negotiated, locked-in price.
   * Composes with `orderService.createOrderFromPricedItems`, which reuses the exact
   * same atomic order-creation transaction pattern as normal checkout (Phase 8); the
   * Quote is marked CONVERTED inside that SAME transaction via `withinTransaction`, so
   * a converted quote and its resulting order can never disagree about whether
   * conversion happened.
   */
  async convertToOrder(
    id: string,
    actorId: string,
    input: QuoteConvertInput
  ): Promise<{ quote: QuoteView; order: OrderView }> {
    const quote = (await quoteRepository.adminFindById(id)) as unknown as QuoteWithDetail | null;
    if (!quote) throw new QuoteNotFoundError();

    if (quote.status !== "ACCEPTED") {
      throw new QuoteNotConvertibleError(quote.status);
    }

    if (!quote.userId) {
      throw new QuoteMissingUserForConversionError();
    }

    if (quote.items.some((item) => item.quotedUnitPrice === null)) {
      throw new QuoteMissingPricingError();
    }

    const stockCheckItems = quote.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    const stockIssues = await cartService.validateStock(stockCheckItems);
    if (stockIssues.length > 0) {
      throw new StockUnavailableError(stockIssues);
    }

    const shipping: ShippingSnapshot = input.addressId
      ? shippingFromAddress(await addressService.getOwned(input.addressId, quote.userId))
      : shippingFromInline(input.shippingAddress!);

    const priceItems = quote.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitPrice: Number(item.quotedUnitPrice),
      quantity: item.quantity,
    }));

    let convertedQuoteRow: QuoteWithDetail | null = null;

    const order = await orderService.createOrderFromPricedItems({
      userId: quote.userId,
      items: priceItems,
      shipping,
      currency: quote.currency,
      customerNote: `Converted from quote request ${quote.id}.`,
      withinTransaction: async (tx, createdOrder) => {
        convertedQuoteRow = (await quoteRepository.markConvertedTx(tx, id, {
          fromStatus: quote.status,
          orderId: createdOrder.id,
          actorId,
        })) as unknown as QuoteWithDetail;
      },
    });

    return {
      quote: toView((convertedQuoteRow as unknown as QuoteRow) ?? (quote as unknown as QuoteRow)),
      order,
    };
  },
};
