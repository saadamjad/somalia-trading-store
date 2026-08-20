# Admin Guide — Somalia Trading Store

A plain-language walkthrough of the admin/operations back office.

## Logging in

The admin area lives at `/admin` and requires an admin account — there's no separate admin login page, you sign in the same way a customer does, and the site shows you admin navigation based on your account's role.

**Creating the first admin account:** if no admin account exists yet, one is created from the command line, not through the website (there's no public "become an admin" signup, for obvious security reasons). See the "Getting Started" section of the project's `README.md` — in short, someone with access to the server/deployment runs:

```bash
BOOTSTRAP_ADMIN_EMAIL="you@example.com" \
BOOTSTRAP_ADMIN_PASSWORD="a-strong-password" \
npm run bootstrap:admin
```

This creates (or promotes) that email to a full administrator account. From there, that admin can sign in normally at `/login` and reach `/admin`.

**A note on roles:** the system is designed to eventually support several specialized admin roles (a Product Manager who can only manage the catalog, an Inventory Manager who can only adjust stock, and so on), so that different staff can be given only the access they need. In the current version of the site, only two roles actually exist: **Customer** (no admin access at all) and **Super Admin** (full access to everything in the admin area). If your business needs to give a staff member limited admin access (e.g. "can update inventory but nothing else"), that's not available yet — flag it to whoever maintains the site so the additional roles can be built out and granted.

## The dashboard

`/admin` shows a real-time summary: order counts, customer counts, product counts, low-stock alerts, open refund requests, and pending quotes, with date filters. Every number here comes directly from the database — nothing is estimated or made up. Because there's no payment processing built into the site yet, you won't see a "revenue" figure that implies money has actually been collected — order totals reflect what was ordered, not what's been paid.

## Managing products and categories

`/admin/products` lists every product with quick actions to edit or archive. `/admin/products/new` creates a new one — name, description, category, price, images (by URL), specifications, tags, and whether it's available to buy online, quote-only, or both.

`/admin/categories` works the same way for categories (name, description, images, accent color). A category can't be deleted while it still has products in it, and a product can't be deleted once it's ever appeared in an order — the system protects your order history from being invalidated by a later catalog cleanup.

## Managing inventory

`/admin/inventory` shows every product's current stock level, its low-stock threshold, and a status (in stock / low stock / out of stock). To adjust stock, enter a signed amount (positive to add stock, negative to remove it) and a reason (restock, correction, manual adjustment, etc.) — every adjustment is permanently logged with who made it, the previous and new quantity, and why, so there's always a full audit trail if a stock number ever looks wrong later.

Stock can never go negative — if you try to remove more than is on hand, the system will reject the adjustment rather than letting the count go below zero. The same protection applies automatically when a customer places an order — the ordered quantity is only deducted if there's genuinely enough on hand.

## Managing orders

`/admin/orders` lists every order across all customers, with search/filter by status, payment status, order number, or customer, and sorting/pagination. Click into an order to see full details: items, shipping address, status timeline, and payment status timeline.

**Status vs. payment status — an important distinction:** an order's fulfillment status (Pending → Confirmed → Processing → Shipped → Delivered, or Cancelled at any point before Delivered) is tracked completely separately from its payment status (Not Paid / Paid / Refunded / Failed). The website has no payment gateway yet, so every order's payment status stays "Not Paid" — updating an order's fulfillment status (e.g. marking it Shipped) never changes its payment status, and there's currently no action in the admin UI that changes payment status at all. Payment is arranged with the customer outside the website.

To move an order forward, use the status update control on the order detail page. The system only allows moving forward through the normal sequence (or cancelling at any point before Delivered) — you can't skip steps or move a shipped order back to pending. Every status change is timestamped and logged with who made it, and you can add a note explaining the change.

There's also an **internal note** field on each order — visible only to admins, never to the customer — useful for jotting down things like "customer called to confirm delivery window."

## Reviewing refund requests

`/admin/refunds` lists customer refund requests. Each shows the order it's for, the customer's stated reason, and any details they provided. You can mark a request "Under Review" while you look into it, then **Approve** or **Reject** it, with a note — this note is shown to the customer, so write it as an explanation to them, not an internal aside.

Remember: approving a refund request here records the business's decision that a refund is warranted — it does **not** move any money, since there's no payment gateway to process a refund against. Actually returning the customer's payment happens through whatever arrangement was used to collect it in the first place.

## Managing quotes

`/admin/quotes` lists incoming quote requests, including ones from guests who haven't created an account. Open one to see the requested products, quantities, and any price the customer suggested (which is just their hope — not binding).

To respond, set your own price for every item on the quote and submit — this moves the quote to "Quoted" and notifies the customer (if they're logged in) so they can accept or decline.

If the customer accepts, the quote doesn't automatically become an order — you'll convert it manually from the quote's detail page once you're ready (e.g. after confirming shipping details with them by phone). Conversion locks in the price you quoted, not whatever the product's current catalog price is, and it double-checks that enough stock is still available before creating the order. **A quote can only be converted if it's tied to a registered account** — if a guest's quote needs converting, ask them to register or log in first.

## Managing CMS content

`/admin/cms` lets you edit site content without a code deployment — currently, banners (the homepage hero and an optional promotional strip) and structured content pages. The FAQ page is the working example of a content page today: a title plus a list of content blocks (headings, paragraphs, FAQ items) that you build and reorder in the editor. Pages can be saved as drafts and only go live once you publish them. (If additional policy pages — Terms, Privacy, Refund Policy, Shipping Policy — have been added to the site since this guide was written, they'll follow this same editor pattern; check `/admin/cms` for what's currently available.)

Banners can be scheduled with a start/end date and given a priority if more than one is active for the same homepage slot at once. If no banner is active, the homepage simply falls back to its default design — you can never accidentally break the homepage by leaving the banner list empty.

## Reports and exports

`/admin/reports` gives you order, product, customer, inventory, refund, and quote reports with date-range filtering, exportable as CSV, XLSX, or PDF. Reports reflect real data from the database — for very large date ranges with a very high volume of underlying records, the report may only reflect the most recent portion of that data rather than the entire range (this is a known current limitation, not a bug — see `docs/ai/KNOWN_LIMITATIONS.md` if you're technical and want the detail).
