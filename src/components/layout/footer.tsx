import Link from "next/link";
import { brand } from "@/config/brand";
import { footerNav } from "@/config/navigation";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-custom py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link
              href="/"
              className="font-display mb-5 inline-flex items-center gap-2.5 text-base font-bold"
            >
              <span className="flex h-7 w-7 items-center justify-center bg-foreground text-[9px] font-bold tracking-wider text-background">
                FGT
              </span>
              {brand.name}
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              {brand.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-4 md:col-start-7">
            <div>
              <p className="label mb-4">Shop</p>
              <ul className="space-y-2.5">
                {footerNav.shop.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
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
                      className="text-sm text-muted transition-colors hover:text-foreground"
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
              <li>{brand.contact.email}</li>
              {brand.contact.phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {phone}
                  </a>
                </li>
              ))}
              <li>{brand.contact.address}</li>
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
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
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
