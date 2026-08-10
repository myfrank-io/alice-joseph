import { put } from "@vercel/blob";
import { hasBlobStorage } from "@/lib/data/store";

export interface StoredImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface IncomingImage {
  /** Image redimensionnée côté navigateur, en data URL JPEG. */
  dataUrl: string;
  thumbDataUrl: string;
  width: number;
  height: number;
}

const MAX_BYTES = 8 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > MAX_BYTES) return null;
  return { buffer, contentType: match[1] };
}

export function isValidIncomingImage(value: unknown): value is IncomingImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<IncomingImage>;
  return (
    typeof image.dataUrl === "string" &&
    typeof image.thumbDataUrl === "string" &&
    typeof image.width === "number" &&
    typeof image.height === "number" &&
    decodeDataUrl(image.dataUrl) !== null &&
    decodeDataUrl(image.thumbDataUrl) !== null
  );
}

/**
 * Range une image envoyée par le navigateur.
 *
 * Avec un jeton Blob, les deux tailles partent sur le stockage Vercel et on ne
 * garde que les URL. Sans jeton, on conserve les data URL telles quelles : le
 * mode démo reste utilisable, simplement rien ne survit à la mise en veille.
 */
export async function storeImage(image: IncomingImage, prefix: string): Promise<StoredImage> {
  if (!hasBlobStorage()) {
    return {
      url: image.dataUrl,
      thumbUrl: image.thumbDataUrl,
      width: image.width,
      height: image.height,
    };
  }

  const full = decodeDataUrl(image.dataUrl);
  const thumb = decodeDataUrl(image.thumbDataUrl);
  if (!full || !thumb) throw new Error("Image illisible");

  const stamp = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [uploaded, uploadedThumb] = await Promise.all([
    put(`${stamp}.jpg`, full.buffer, {
      access: "public",
      contentType: full.contentType,
      addRandomSuffix: false,
    }),
    put(`${stamp}-min.jpg`, thumb.buffer, {
      access: "public",
      contentType: thumb.contentType,
      addRandomSuffix: false,
    }),
  ]);

  return {
    url: uploaded.url,
    thumbUrl: uploadedThumb.url,
    width: image.width,
    height: image.height,
  };
}
