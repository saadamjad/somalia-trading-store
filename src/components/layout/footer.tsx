import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { footerNav } from "@/config/navigation";

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      <div className="container-custom py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              className="font-display mb-5 inline-flex items-center gap-2.5 text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="relative h-10 w-10 shrink-0 border border-border bg-white p-1.5 shadow-(--shadow-sm)">
                <Image
                  src="/images/brand/fgt-logo.svg"
                  alt=""
                  fill
                  className="object-contain p-0.5"
                />
              </span>
              {brand.name}
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              {brand.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8 md:col-span-5">
            <div>
              <p className="label mb-4">Shop</p>
              <ul className="space-y-2.5">
                {footerNav.shop.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="relative inline-block text-sm text-muted transition-colors duration-(--duration-base) hover:text-foreground hover:pl-1 focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="label mb-4">Company</p>
              <ul className="space-y-2.5">
                {footerNav.company.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="relative inline-block text-sm text-muted transition-colors duration-(--duration-base) hover:text-foreground hover:pl-1 focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="label mb-4">Legal</p>
              <ul className="space-y-2.5">
                {footerNav.legal.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="relative inline-block text-sm text-muted transition-colors duration-(--duration-base) hover:text-foreground hover:pl-1 focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="label mb-4">Contact</p>
            <ul className="space-y-2 text-sm text-muted">
              {brand.contact.email && <li>{brand.contact.email}</li>}
              {brand.contact.phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                  >
                    {phone}
                  </a>
                </li>
              ))}
              {brand.contact.address && <li>{brand.contact.address}</li>}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brand.name}
          </p>
          <div className="flex gap-6">
            {footerNav.account.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
