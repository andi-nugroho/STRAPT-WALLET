/**
 * Image optimization utilities
 */

// Cache for preloaded images
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Preload an image
 * @param src Image source URL
 * @returns Promise that resolves when the image is loaded
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Check if image is already cached
    if (imageCache.has(src)) {
      resolve(imageCache.get(src)!);
      return;
    }
    
    const img = new Image();
    
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    
    img.onerror = (error) => {
      reject(error);
    };
    
    img.src = src;
  });
}

/**
 * Preload multiple images
 * @param srcs Array of image source URLs
 * @returns Promise that resolves when all images are loaded
 */
export function preloadImages(srcs: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(srcs.map(src => preloadImage(src)));
}

/**
 * Check if an image is cached
 * @param src Image source URL
 * @returns Boolean indicating if the image is cached
 */
export function isImageCached(src: string): boolean {
  return imageCache.has(src);
}

/**
 * Clear the image cache
 * @param src Optional image source URL to clear from cache
 */
export function clearImageCache(src?: string): void {
  if (src) {
    imageCache.delete(src);
  } else {
    imageCache.clear();
  }
}

/**
 * Get image dimensions
 * @param src Image source URL
 * @returns Promise that resolves with the image dimensions
 */
export async function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  const img = await preloadImage(src);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

/**
 * Generate a responsive image srcset
 * @param src Base image source URL
 * @param widths Array of widths for the srcset
 * @returns Srcset string
 */
export function generateSrcSet(src: string, widths: number[]): string {
  // This assumes your server can handle width parameters like ?w=300
  return widths
    .map(width => `${src}?w=${width} ${width}w`)
    .join(', ');
}

/**
 * Calculate image aspect ratio
 * @param width Image width
 * @param height Image height
 * @returns Aspect ratio (width / height)
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Calculate responsive image size
 * @param originalWidth Original image width
 * @param originalHeight Original image height
 * @param containerWidth Container width
 * @returns Calculated width and height
 */
export function calculateResponsiveSize(
  originalWidth: number,
  originalHeight: number,
  containerWidth: number
): { width: number; height: number } {
  const aspectRatio = calculateAspectRatio(originalWidth, originalHeight);
  const width = Math.min(originalWidth, containerWidth);
  const height = width / aspectRatio;
  
  return { width, height };
}

/**
 * Convert a base64 string to a Blob
 * @param base64 Base64 string
 * @param mimeType MIME type of the image
 * @returns Blob object
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeType });
}

/**
 * Create an object URL from a Blob
 * @param blob Blob object
 * @returns Object URL
 */
export function createObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke an object URL
 * @param url Object URL
 */
export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url);
}
