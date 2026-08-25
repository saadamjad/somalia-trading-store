"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

const PLACEHOLDER_SRC = "/images/shared/no-image-placeholder.svg";

type SafeImageProps = Omit<ImageProps, "src"> & { src: string | null | undefined };

/**
 * Wraps next/image with a guard against empty/missing src and a fallback for a
 * broken/404 URL — an admin-uploaded image that failed partway through, or a
 * stale/deleted URL, would otherwise throw at render (empty string) or show a
 * broken-image icon with no recovery (404).
 */
export function SafeImage({ src, alt, ...props }: SafeImageProps) {
  const [errored, setErrored] = useState(false);
  const resolvedSrc = !src || errored ? PLACEHOLDER_SRC : src;

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      onError={() => setErrored(true)}
      {...props}
    />
  );
}
