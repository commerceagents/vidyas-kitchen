"use client";

import Image, { type ImageProps } from "next/image";
import { type CSSProperties, type MouseEvent, type ImgHTMLAttributes } from "react";

const blockContextMenu = (e: MouseEvent) => e.preventDefault();

const imgLock: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  pointerEvents: "none",
};

const shieldStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 2,
  WebkitTouchCallout: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  touchAction: "manipulation",
};

/**
 * Menu photography shown in the customer app. A transparent shield sits above
 * the image so iOS Safari does not offer “Save to Photos” on long-press.
 */
export function ProtectedMenuImage({ style, className, onContextMenu, ...rest }: ImageProps) {
  return (
    <>
      <Image
        {...rest}
        draggable={false}
        className={["vk-menu-photo", className].filter(Boolean).join(" ")}
        style={{ ...imgLock, ...style }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
      />
      <div aria-hidden className="vk-menu-photo-shield" style={shieldStyle} onContextMenu={blockContextMenu} />
    </>
  );
}

/** Same protection for legacy plain img tags in receipts / tracking. */
export function ProtectedMenuPhoto({
  src,
  alt = "",
  style,
  className,
}: Pick<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "style" | "className">) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small thumbs outside next/image loader */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={["vk-menu-photo", className].filter(Boolean).join(" ")}
        style={{ ...imgLock, width: "100%", height: "100%", objectFit: "cover", ...style }}
        onContextMenu={blockContextMenu}
      />
      <div aria-hidden className="vk-menu-photo-shield" style={shieldStyle} onContextMenu={blockContextMenu} />
    </div>
  );
}
