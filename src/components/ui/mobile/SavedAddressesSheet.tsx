"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Check, House, MapPin, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED } from "@/components/ui/mobile/mobile-design-tokens";
import {
  emptyAddressFor,
  isPlaceSet,
  loadSavedPlaces,
  MAX_PLACE_LABEL,
  savePlaces,
  type SavedPlace,
  type SavedPlaceId,
} from "@/lib/vk-saved-places";

const fontUi = C.mono;

function PlaceIcon({ id, active }: { id: SavedPlaceId; active: boolean }) {
  const color = active ? C.red : "rgba(0,0,0,0.35)";
  if (id === "home") return <House size={19} weight="regular" color={color} />;
  if (id === "work") return <Briefcase size={19} weight="regular" color={color} />;
  return <MapPin size={19} weight="regular" color={color} />;
}

/**
 * The addresses a customer orders to, listed where they expect to find them.
 * Setting the pin still happens on the map, which needs the whole screen, so
 * this hands off to it and is reopened on the way back.
 */
export function SavedAddressesSheet({
  onEditPlace,
  onClose,
}: {
  /** Opens the map for this slot; the sheet closes while it is up. */
  onEditPlace: (place: SavedPlace) => void;
  onClose: () => void;
}) {
  const [places, setPlaces] = useState<SavedPlace[]>(loadSavedPlaces);
  const [renaming, setRenaming] = useState<SavedPlaceId | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    const refresh = () => setPlaces(loadSavedPlaces());
    window.addEventListener("vk_saved_places_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("vk_saved_places_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (renaming) setRenaming(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, renaming]);

  const commit = (next: SavedPlace[]) => {
    setPlaces(next);
    savePlaces(next);
  };

  const clearPlace = (id: SavedPlaceId) => {
    commit(
      places.map((p) => (p.id === id ? { ...p, address: emptyAddressFor(id), lat: 0, lng: 0 } : p)),
    );
  };

  const saveLabel = (id: SavedPlaceId) => {
    const label = draftLabel.trim().slice(0, MAX_PLACE_LABEL);
    if (label) commit(places.map((p) => (p.id === id ? { ...p, label } : p)));
    setRenaming(null);
  };

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
        aria-labelledby="vk-saved-addresses-title"
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
              id="vk-saved-addresses-title"
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}
            >
              Saved addresses
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: C_TEXT_MUTED }}>
              The places you order to
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

        <div style={{ overflowY: "auto", padding: "6px 18px max(18px, env(safe-area-inset-bottom, 0px))" }}>
          {places.map((place) => {
            const set = isPlaceSet(place);
            const isRenaming = renaming === place.id;

            return (
              <div key={place.id} style={{ padding: "16px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: set ? "rgba(189,35,32,0.10)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${set ? "rgba(189,35,32,0.20)" : "rgba(0,0,0,0.06)"}`,
                    }}
                  >
                    <PlaceIcon id={place.id} active={set} />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRenaming ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          autoFocus
                          value={draftLabel}
                          maxLength={MAX_PLACE_LABEL}
                          onChange={(e) => setDraftLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveLabel(place.id);
                            }
                          }}
                          placeholder="Name this place"
                          aria-label="Name this place"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            boxSizing: "border-box",
                            padding: "9px 12px",
                            borderRadius: 11,
                            border: `1px solid ${C.red}`,
                            outline: "none",
                            background: C.white,
                            color: C.text,
                            fontSize: 15,
                            fontWeight: 700,
                            fontFamily: fontUi,
                            caretColor: C.red,
                            WebkitAppearance: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => saveLabel(place.id)}
                          aria-label="Save name"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            border: "none",
                            background: C.red,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={16} weight="bold" color={C.white} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 15.5,
                              fontWeight: 800,
                              color: C.text,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {place.label}
                          </p>
                          {/* Home and Work are the labels the driver expects; only
                              the third slot is the customer's to name. */}
                          {place.id === "other" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDraftLabel(place.label);
                                setRenaming(place.id);
                              }}
                              aria-label={`Rename ${place.label}`}
                              style={{
                                display: "flex",
                                padding: 4,
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              <PencilSimple size={13} weight="bold" color="rgba(0,0,0,0.3)" />
                            </button>
                          ) : null}
                        </div>
                        <p
                          style={{
                            margin: "3px 0 0",
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: set ? C_TEXT_MUTED : "rgba(0,0,0,0.3)",
                            lineHeight: 1.45,
                          }}
                        >
                          {set ? place.address : "Not set yet"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {isRenaming ? null : (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, paddingLeft: 52 }}>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onEditPlace(place)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 14px",
                        borderRadius: 11,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        color: C.text,
                        fontSize: 13.5,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: fontUi,
                      }}
                    >
                      <MapPin size={14} weight="bold" />
                      {set ? "Change on map" : "Set on map"}
                    </motion.button>
                    {set ? (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => clearPlace(place.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "9px 14px",
                          borderRadius: 11,
                          border: "none",
                          background: "transparent",
                          color: C.red,
                          fontSize: 13.5,
                          fontWeight: 800,
                          cursor: "pointer",
                          fontFamily: fontUi,
                        }}
                      >
                        <Trash size={14} weight="bold" />
                        Remove
                      </motion.button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          <p style={{ margin: "16px 0 0", fontSize: 12.5, fontWeight: 600, color: "rgba(0,0,0,0.3)", lineHeight: 1.5 }}>
            Saved addresses appear on the map when you set your delivery location.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
