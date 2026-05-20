export type LoadedAtlasImage = CanvasImageSource & { width: number; height: number }

const TRANSPARENT_BLACK_THRESHOLD = 3

export function makeBlackPixelsTransparent(
  pixels: Uint8ClampedArray,
  threshold = TRANSPARENT_BLACK_THRESHOLD
): number {
  let changed = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const alpha = pixels[index + 3]
    if (alpha > 0 && red <= threshold && green <= threshold && blue <= threshold) {
      pixels[index + 3] = 0
      changed += 1
    }
  }
  return changed
}

async function bitmapFromBlob(blob: Blob): Promise<LoadedAtlasImage> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(blob)
  }

  const objectUrl = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Failed to decode atlas image"))
    }
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.src = objectUrl
  })
}

function applyTransparencyKey(image: LoadedAtlasImage): LoadedAtlasImage {
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return image

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const changed = makeBlackPixelsTransparent(imageData.data)
  if (changed === 0) return image

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export async function loadAtlasImage(
  src: string,
  options: { transparentBlack?: boolean } = {}
): Promise<LoadedAtlasImage> {
  const response = await fetch(src, { cache: "force-cache" })
  if (!response.ok) throw new Error(`Failed to load ${src} (${response.status})`)

  const image = await bitmapFromBlob(await response.blob())
  return options.transparentBlack === false ? image : applyTransparencyKey(image)
}

export async function loadAtlasImages(
  atlases: Record<string, string>,
  options: { transparentBlackFor?: (atlasId: string) => boolean } = {}
): Promise<Record<string, LoadedAtlasImage>> {
  const images: Record<string, LoadedAtlasImage> = {}
  await Promise.all(
    Object.entries(atlases).map(async ([id, src]) => {
      images[id] = await loadAtlasImage(src, {
        transparentBlack: options.transparentBlackFor?.(id) ?? id !== "character",
      })
    })
  )
  return images
}
