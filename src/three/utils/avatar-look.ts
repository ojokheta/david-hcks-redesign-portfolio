import { CanvasTexture, Mesh, Vector3 } from "three";

import type { Texture } from "three";

const SKIN_SHADOW = { r: 42, g: 24, b: 16 };
const SKIN_MID = { r: 110, g: 64, b: 40 };
const SKIN_HIGHLIGHT = { r: 196, g: 140, b: 98 };
const HAIR_SHADOW = { r: 18, g: 12, b: 10 };
const HAIR_MID = { r: 32, g: 22, b: 18 };
const HAIR_HIGHLIGHT = { r: 62, g: 44, b: 34 };

const lerpChannel = (a: number, b: number, t: number) => a + (b - a) * t;

const sampleSkin = (t: number) => {
  if (t < 0.55) {
    const k = t / 0.55;
    return {
      r: lerpChannel(SKIN_SHADOW.r, SKIN_MID.r, k),
      g: lerpChannel(SKIN_SHADOW.g, SKIN_MID.g, k),
      b: lerpChannel(SKIN_SHADOW.b, SKIN_MID.b, k),
    };
  }

  const k = (t - 0.55) / 0.45;
  return {
    r: lerpChannel(SKIN_MID.r, SKIN_HIGHLIGHT.r, k),
    g: lerpChannel(SKIN_MID.g, SKIN_HIGHLIGHT.g, k),
    b: lerpChannel(SKIN_MID.b, SKIN_HIGHLIGHT.b, k),
  };
};

const sampleHair = (t: number) => {
  if (t < 0.6) {
    const k = t / 0.6;
    return {
      r: lerpChannel(HAIR_SHADOW.r, HAIR_MID.r, k),
      g: lerpChannel(HAIR_SHADOW.g, HAIR_MID.g, k),
      b: lerpChannel(HAIR_SHADOW.b, HAIR_MID.b, k),
    };
  }

  const k = (t - 0.6) / 0.4;
  return {
    r: lerpChannel(HAIR_MID.r, HAIR_HIGHLIGHT.r, k),
    g: lerpChannel(HAIR_MID.g, HAIR_HIGHLIGHT.g, k),
    b: lerpChannel(HAIR_MID.b, HAIR_HIGHLIGHT.b, k),
  };
};

const luminance = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

const getImageSource = (texture: Texture): CanvasImageSource | null => {
  const image = texture.image as CanvasImageSource | undefined;
  if (!image) return null;
  if ("width" in image && "height" in image) return image;
  return null;
};

const drawToCanvas = (texture: Texture) => {
  const source = getImageSource(texture);
  if (!source) return null;

  const width = "width" in source ? Number(source.width) : 0;
  const height = "height" in source ? Number(source.height) : 0;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, ctx, width, height };
};

const applyCanvasToTexture = (texture: Texture, canvas: HTMLCanvasElement) => {
  const processed = new CanvasTexture(canvas);
  processed.colorSpace = texture.colorSpace;
  processed.flipY = texture.flipY;
  processed.generateMipmaps = texture.generateMipmaps;
  processed.minFilter = texture.minFilter;
  processed.magFilter = texture.magFilter;
  processed.wrapS = texture.wrapS;
  processed.wrapT = texture.wrapT;
  processed.needsUpdate = true;
  return processed;
};

export const recolorSkinMatcap = (texture: Texture): Texture => {
  const drawn = drawToCanvas(texture);
  if (!drawn) return texture;

  const { canvas, ctx, width, height } = drawn;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const tone = sampleSkin(luminance(r, g, b));
    data[i] = Math.round(tone.r);
    data[i + 1] = Math.round(tone.g);
    data[i + 2] = Math.round(tone.b);
  }

  ctx.putImageData(image, 0, 0);
  return applyCanvasToTexture(texture, canvas);
};

const rasterizeHeadHeight = (head: Mesh, width: number, height: number) => {
  const mask = new Float32Array(width * height);
  const pos = head.geometry.attributes.position;
  const uv = head.geometry.attributes.uv;
  const index = head.geometry.index;
  if (!pos || !uv) return mask;

  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();

  const triangleCount = index ? index.count / 3 : pos.count / 3;

  const writeTriangle = (ia: number, ib: number, ic: number) => {
    const u0 = uv.getX(ia);
    const v0u = uv.getY(ia);
    const u1 = uv.getX(ib);
    const v1u = uv.getY(ib);
    const u2 = uv.getX(ic);
    const v2u = uv.getY(ic);

    v0.fromBufferAttribute(pos, ia);
    v1.fromBufferAttribute(pos, ib);
    v2.fromBufferAttribute(pos, ic);

    const x0 = u0 * (width - 1);
    const y0 = (1 - v0u) * (height - 1);
    const x1 = u1 * (width - 1);
    const y1 = (1 - v1u) * (height - 1);
    const x2 = u2 * (width - 1);
    const y2 = (1 - v2u) * (height - 1);

    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));

    const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(denom) < 1e-8) return;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denom;
        const w1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denom;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        const worldY = v0.y * w0 + v1.y * w1 + v2.y * w2;
        mask[y * width + x] = worldY;
      }
    }
  };

  for (let i = 0; i < triangleCount; i++) {
    if (index) {
      writeTriangle(index.getX(i * 3), index.getX(i * 3 + 1), index.getX(i * 3 + 2));
    } else {
      writeTriangle(i * 3, i * 3 + 1, i * 3 + 2);
    }
  }

  return mask;
};

export const restyleHeadTexture = (texture: Texture, head: Mesh): Texture => {
  const drawn = drawToCanvas(texture);
  if (!drawn) return texture;

  const { canvas, ctx, width, height } = drawn;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const heightMask = rasterizeHeadHeight(head, width, height);

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < heightMask.length; i++) {
    const y = heightMask[i] ?? 0;
    if (y <= 0) continue;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const span = Math.max(0.001, maxY - minY);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
    const lum = luminance(r, g, b);

    if (a < 8 || lum < 0.04) continue;

    const pixel = i / 4;
    const worldY = heightMask[pixel] ?? 0;
    const topFactor = worldY > 0 ? (worldY - minY) / span : 0.5;
    const isSkinIsland = lum > 0.55 && r > g && r > 140;
    const fade = Math.max(0, Math.min(1, (topFactor - 0.42) / 0.28));
    const hairAmount = isSkinIsland ? 0 : fade;
    const skinTone = sampleSkin(Math.min(1, lum + 0.08));
    const hairTone = sampleHair(lum);
    const blended = {
      r: lerpChannel(skinTone.r, hairTone.r, hairAmount),
      g: lerpChannel(skinTone.g, hairTone.g, hairAmount),
      b: lerpChannel(skinTone.b, hairTone.b, hairAmount),
    };

    data[i] = Math.round(blended.r);
    data[i + 1] = Math.round(blended.g);
    data[i + 2] = Math.round(blended.b);
  }

  ctx.putImageData(image, 0, 0);
  return applyCanvasToTexture(texture, canvas);
};

export const applyAvatarLook = (textures: { skin: Texture; head: Texture }, head: Mesh) => {
  return {
    skin: recolorSkinMatcap(textures.skin),
    head: restyleHeadTexture(textures.head, head),
  };
};
