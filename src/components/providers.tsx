"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { AccountSync } from "@/components/cart/account-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AccountSync />
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-xl border border-border shadow-lg",
          },
        }}
      />
    </SessionProvider>
  );
}
