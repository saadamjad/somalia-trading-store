"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
