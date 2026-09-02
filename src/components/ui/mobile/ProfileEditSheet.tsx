"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Trash, X } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED } from "@/components/ui/mobile/mobile-design-tokens";
import { AvatarImageError, fileToSquareJpegDataUrl } from "@/lib/avatar-image";
import { auth } from "@/lib/firebase";

const fontUi = C.mono;
const MAX_NAME = 40;

export type ProfileSaveResult = { name: string; avatarUrl: string | null };

/**
 * Edit the name and picture together, so one Save covers both and Discard can
 * back out of the photo as easily as the typing.
 */
export function ProfileEditSheet({
  phone,
  initialName,
  initialAvatarUrl,
  onSaved,
  onClose,
}: {
  phone: string;
  initialName: string;
  initialAvatarUrl: string | null;
  onSaved: (result: ProfileSaveResult) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  /** Data URL of a freshly picked photo, before it has been uploaded. */
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shownPhoto = pickedPhoto ?? (removePhoto ? null : initialAvatarUrl);
  const trimmed = name.trim();
  const dirty = trimmed !== initialName.trim() || pickedPhoto !== null || removePhoto;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handlePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so picking the same file twice still fires a change.
    e.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const dataUrl = await fileToSquareJpegDataUrl(file);
      setPickedPhoto(dataUrl);
      setRemovePhoto(false);
    } catch (err) {
      setError(err instanceof AvatarImageError ? err.message : "That photo could not be used.");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    if (!dirty) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Proves to the server that this phone number is really ours. Test
      // logins never touch Firebase, so there is simply no token to send.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* Unsigned request; the server decides whether that is acceptable. */
      }

      const res = await fetch("/api/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone,
          name: trimmed,
          ...(pickedPhoto ? { avatar: pickedPhoto } : {}),
          ...(removePhoto && !pickedPhoto ? { removeAvatar: true } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; avatarUrl?: string | null };

      if (!res.ok) {
        setError(body.error || "Could not save your profile. Please try again.");
        setSaving(false);
        return;
      }

      onSaved({ name: trimmed, avatarUrl: body.avatarUrl ?? null });
      onClose();
    } catch {
      setError("No connection. Check your network and try again.");
      setSaving(false);
    }
  }, [dirty, onClose, onSaved, phone, pickedPhoto, removePhoto, trimmed]);

  const initial = (trimmed.charAt(0) || "?").toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !saving && onClose()}
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
        aria-labelledby="vk-profile-edit-title"
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
              id="vk-profile-edit-title"
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}
            >
              Edit profile
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: C_TEXT_MUTED }}>
              Your photo and name, just for you
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
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
              cursor: saving ? "default" : "pointer",
              flexShrink: 0,
              opacity: saving ? 0.5 : 1,
            }}
          >
            <X size={17} weight="bold" color={C.text} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "22px 18px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              aria-label={shownPhoto ? "Change profile photo" : "Add a profile photo"}
              style={{
                position: "relative",
                width: 104,
                height: 104,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                cursor: saving ? "default" : "pointer",
                boxShadow: `0 6px 20px ${C.redGlow}`,
                overflow: "visible",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.white,
                  fontSize: 40,
                  fontWeight: 900,
                }}
              >
                {shownPhoto ? (
                  // Blob and Supabase URLs both sidestep next/image on purpose:
                  // the file may not exist on the server yet.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shownPhoto}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  initial
                )}
              </span>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                <Camera size={17} weight="fill" color={C.red} />
              </span>
            </motion.button>

            {shownPhoto ? (
              <button
                type="button"
                onClick={() => {
                  setPickedPhoto(null);
                  setRemovePhoto(true);
                  setError(null);
                }}
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  border: "none",
                  background: "transparent",
                  color: C_TEXT_MUTED,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: saving ? "default" : "pointer",
                  fontFamily: fontUi,
                }}
              >
                <Trash size={14} weight="bold" />
                Remove photo
              </button>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C_TEXT_MUTED }}>
                Tap to add a photo
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePick}
              style={{ display: "none" }}
            />
          </div>

          <label
            htmlFor="vk-profile-name"
            style={{
              display: "block",
              margin: "24px 0 8px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.03em",
              color: C_TEXT_MUTED,
            }}
          >
            Your name
          </label>
          <input
            id="vk-profile-name"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            disabled={saving}
            placeholder="Display name"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 16px",
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              outline: "none",
              background: C.white,
              color: C.text,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: fontUi,
              caretColor: C.red,
              WebkitAppearance: "none",
            }}
          />

          {error ? (
            <p style={{ margin: "12px 0 0", fontSize: 13.5, fontWeight: 700, color: C.red, lineHeight: 1.45 }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          style={{
            padding: `14px 18px max(18px, env(safe-area-inset-bottom, 0px))`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <motion.button
            type="button"
            whileTap={{ scale: saving ? 1 : 0.98 }}
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: "16px 20px",
              borderRadius: 16,
              border: "none",
              background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
              color: C.white,
              fontSize: 15,
              fontWeight: 800,
              cursor: saving ? "default" : "pointer",
              fontFamily: fontUi,
              opacity: saving ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {saving ? (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: C.white,
                    animation: "vk-profile-spin 0.7s linear infinite",
                  }}
                />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </motion.button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              width: "100%",
              padding: "13px 10px",
              border: "none",
              background: "transparent",
              color: C_TEXT_MUTED,
              fontSize: 15,
              fontWeight: 800,
              cursor: saving ? "default" : "pointer",
              fontFamily: fontUi,
            }}
          >
            Discard
          </button>
        </div>
        <style>{"@keyframes vk-profile-spin{to{transform:rotate(360deg)}}"}</style>
      </motion.div>
    </motion.div>
  );
}
