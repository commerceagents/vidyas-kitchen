"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, X } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED } from "@/components/ui/mobile/mobile-design-tokens";
import { EmptyState, EMPTY_ICON_COLOR } from "@/components/ui/mobile/EmptyState";

const fontUi = C.mono;

export type FavoriteRow = {
  id: string;
  name: string;
  price: number;
  listPrice: number | null;
};

/**
 * The dishes this device has hearted. A drawer rather than a block on the
 * account page, so an empty list is a screen you chose to open with a way out
 * of it, instead of a paragraph of instructions sitting under your addresses.
 */
export function FavoritesSheet({
  favorites,
  onOpenDish,
  onRemove,
  onBrowseMenu,
  onClose,
}: {
  favorites: FavoriteRow[];
  onOpenDish: (id: string) => void;
  onRemove: (id: string, name: string) => void;
  onBrowseMenu: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        fontFamily: fontUi,
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vk-favorites-title"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 18px 14px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              id="vk-favorites-title"
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}
            >
              Favorites
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: C_TEXT_MUTED }}>
              Saved on this device
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={17} weight="bold" color={C.text} />
          </button>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: "4px 18px max(18px, env(safe-area-inset-bottom, 0px))",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {favorites.length === 0 ? (
            <EmptyState
              padding="44px 24px 28px"
              icon={<Heart size={32} weight="thin" color={EMPTY_ICON_COLOR} />}
              text="No favorites added yet"
              action={
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={onBrowseMenu}
                  style={{
                    marginTop: 2,
                    padding: "13px 22px",
                    borderRadius: 14,
                    border: "none",
                    background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                    color: C.white,
                    fontSize: 14.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: fontUi,
                  }}
                >
                  Add favorites
                </motion.button>
              }
            />
          ) : (
            favorites.map((fav) => (
              <div
                key={fav.id}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 10,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onOpenDish(fav.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    padding: "14px 0",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: fontUi,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: C.text }}>{fav.name}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: C.red }}>
                    From ₹{fav.price.toLocaleString("en-IN")}
                    {fav.listPrice != null ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "rgba(0,0,0,0.3)",
                          textDecoration: "line-through",
                        }}
                      >
                        ₹{fav.listPrice.toLocaleString("en-IN")}
                      </span>
                    ) : null}
                  </p>
                </motion.button>
                <button
                  type="button"
                  aria-label={`Remove ${fav.name} from favorites`}
                  onClick={() => onRemove(fav.id, fav.name)}
                  style={{
                    alignSelf: "center",
                    flexShrink: 0,
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid rgba(189,35,32,0.38)",
                    background: "rgba(189,35,32,0.14)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={19} weight="bold" color={C.red} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
