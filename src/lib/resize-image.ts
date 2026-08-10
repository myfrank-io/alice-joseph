/**
 * Redimensionnement côté navigateur, avant l'envoi.
 *
 * Une photo de téléphone pèse 4 à 8 Mo ; on n'a besoin ni de cette taille ni de
 * ce poids. On produit deux JPEG — un pour l'affichage plein écran, un pour la
 * grille — ce qui rend l'upload quasi instantané même en 4G.
 */

export interface ResizedImage {
  dataUrl: string;
  thumbDataUrl: string;
  width: number;
  height: number;
}

const FULL_EDGE = 1800;
const THUMB_EDGE = 520;

function draw(source: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer l'image");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL("image/jpeg", quality), width, height };
}

export async function resizeImage(file: File): Promise<ResizedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ce fichier n'est pas une image.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const full = draw(bitmap, FULL_EDGE, 0.82);
    const thumb = draw(bitmap, THUMB_EDGE, 0.72);
    return {
      dataUrl: full.dataUrl,
      thumbDataUrl: thumb.dataUrl,
      width: full.width,
      height: full.height,
    };
  } finally {
    bitmap.close();
  }
}
