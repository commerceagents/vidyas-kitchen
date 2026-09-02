/**
 * Turns whatever the photo picker hands back into a small square JPEG.
 *
 * Phone cameras produce 3–8MB files that would be pointless to store and slow
 * to upload for something rendered at 96px, so the shrinking happens here on
 * the device rather than sending the original over a mobile connection.
 */
const OUTPUT_SIZE = 512;
const QUALITY = 0.82;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class AvatarImageError extends Error {}

export async function fileToSquareJpegDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new AvatarImageError("Please choose an image file.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarImageError("That photo is too large. Try a smaller one.");
  }

  const source = await decode(file);
  const side = Math.min(source.width, source.height);
  if (!side) throw new AvatarImageError("That photo could not be read.");

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarImageError("That photo could not be processed.");

  // Centre crop, so a portrait photo keeps the face rather than the ceiling.
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source as CanvasImageSource,
    (source.width - side) / 2,
    (source.height - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  if ("close" in source && typeof source.close === "function") source.close();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new AvatarImageError("That photo could not be processed.");
  }
  return dataUrl;
}

type Decoded = { width: number; height: number; close?: () => void };

async function decode(file: File): Promise<Decoded & CanvasImageSource> {
  // createImageBitmap applies the EXIF rotation, which is what keeps photos
  // taken sideways from being saved sideways.
  if (typeof createImageBitmap === "function") {
    try {
      return (await createImageBitmap(file, { imageOrientation: "from-image" })) as ImageBitmap;
    } catch {
      // Falls through to the <img> path — older Safari rejects the options bag.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new AvatarImageError("That photo format isn't supported. Try a JPEG or PNG."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
