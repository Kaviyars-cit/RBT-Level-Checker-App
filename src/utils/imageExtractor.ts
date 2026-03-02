// Advanced image extraction and processing utilities
// Handles base64, external URLs, SVG, and embedded content

export interface ExtractedImage {
  src: string;
  base64Data?: string;
  buffer?: Uint8Array;
  type: 'png' | 'jpg' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'svg' | 'wmf' | 'emf';
  originalMimeType?: string; // The raw MIME type from the data URI (e.g. 'image/x-wmf')
  width?: number;
  height?: number;
  alt?: string;
  isBase64: boolean;
}

/**
 * Extract all images from HTML content with improved regex
 * Enhanced to handle nested img tags in tables, divs, and other elements
 */
export const extractAllImages = (html: string): ExtractedImage[] => {
  if (!html) return [];

  const images: ExtractedImage[] = [];
  const seenSrcs = new Set<string>();

  try {
    // Use DOMParser for robust HTML parsing instead of fragile Regex
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgElements = doc.querySelectorAll('img');

    console.log(`[ImageExtractor] Found ${imgElements.length} img elements via DOMParser`);

    imgElements.forEach((img, idx) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      const alt = img.getAttribute('alt') || '';

      if (!src || seenSrcs.has(src)) {
        if (src) console.log(`[ImageExtractor] Skipping duplicate or missing src for img ${idx}`);
        return;
      }
      seenSrcs.add(src);

      console.log(`[ImageExtractor] Processing img ${idx}: src="${src.substring(0, 50)}${src.length > 50 ? '...' : ''}"`);

      if (src.startsWith('data:image/')) {
        // Parse data URI
        const image = parseDataUri(src, alt);
        if (image) images.push(image);
      } else if (src.startsWith('data:') && src.includes('svg')) {
        // Handle SVG data URI
        const image = parseSvgDataUri(src, alt);
        if (image) images.push(image);
      } else {
        // External URL
        images.push({
          src,
          isBase64: false,
          type: 'png', // default
          alt,
        });
      }
    });

    // ALSO identify direct <svg> tags in the HTML
    const svgElements = doc.querySelectorAll('svg');
    console.log(`[ImageExtractor] Found ${svgElements.length} raw svg elements via DOMParser`);
    svgElements.forEach((svg, idx) => {
      const svgHtml = svg.outerHTML;
      // Use a unique ID based on hash or index if no ID exists
      const id = svg.id || `svg-extracted-${idx}`;
      if (seenSrcs.has(id)) return;
      seenSrcs.add(id);

      // Safe Base64 encoding for Unicode SVGs
      const safeBase64 = btoa(unescape(encodeURIComponent(svgHtml)));

      images.push({
        src: id,
        base64Data: safeBase64,
        isBase64: true,
        type: 'svg',
        alt: 'Vector Diagram'
      });
    });
  } catch (e) {
    console.warn('[ImageExtractor] DOMParser extraction failed, falling back to regex:', e);

    // Fallback to improved regex if DOMParser fails
    const imgRegex = /<img[^>]*(?:src|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"'>\s]+))[^>]*>/gi;
    let match;
    let regexCount = 0;
    while ((match = imgRegex.exec(html)) !== null) {
      regexCount++;
      const src = match[1] || match[2] || match[3];
      const alt = ''; // Simplify regex fallback

      if (!src || seenSrcs.has(src)) continue;
      seenSrcs.add(src);

      console.log(`[ImageExtractor] Regex found img ${regexCount}: src="${src.substring(0, 50)}${src.length > 50 ? '...' : ''}"`);

      if (src.startsWith('data:image/')) {
        const image = parseDataUri(src, alt);
        if (image) images.push(image);
      } else {
        images.push({ src, isBase64: false, type: 'png', alt });
      }
    }
    console.log(`[ImageExtractor] Regex fallback found ${regexCount} images`);

    // Regex fallback for SVGs
    const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
    let svgMatch;
    while ((svgMatch = svgRegex.exec(html)) !== null) {
      const svgHtml = svgMatch[0];
      const id = `svg-regex-${images.length}`;

      // Safe Base64 encoding for Unicode SVGs
      try {
        const safeBase64 = btoa(unescape(encodeURIComponent(svgHtml)));
        images.push({
          src: id,
          base64Data: safeBase64,
          isBase64: true,
          type: 'svg',
          alt: 'Vector Diagram'
        });
      } catch (err) {
        console.error('[ImageExtractor] SVG regex Base64 fail:', err);
      }
    }
  }

  console.log(`[ImageExtractor] Total extracted images: ${images.length}`);
  return images;
};

/**
 * Parse Base64 Data URI
 */
const parseDataUri = (dataUri: string, alt: string): ExtractedImage | null => {
  try {
    const commaIndex = dataUri.indexOf(',');
    if (commaIndex === -1) return null;

    const meta = dataUri.substring(0, commaIndex);
    let data = dataUri.substring(commaIndex + 1).replace(/\s/g, '');

    // Normalize padding
    while (data.length % 4 !== 0) {
      data += '=';
    }

    // Detect image type - support all common formats including those from DOCX conversion
    const typeMatch = meta.match(/data:image\/(png|jpeg|jpg|gif|bmp|webp|svg\+xml|x-wmf|x-emf|tiff|x-png|vnd\.microsoft\.icon);base64/i);
    const typeFromMime = meta.match(/data:(image\/[^;,]+)/);

    // Preserve original MIME type for downstream conversion decisions
    const originalMimeType = typeFromMime ? typeFromMime[1].toLowerCase() : (typeMatch ? `image/${typeMatch[1].toLowerCase()}` : undefined);

    let type: ExtractedImage['type'] = 'png';
    if (typeMatch) {
      const matched = typeMatch[1].toLowerCase();
      if (matched === 'jpeg' || matched === 'jpg') type = 'jpg';
      else if (matched === 'gif') type = 'gif';
      else if (matched === 'bmp') type = 'bmp';
      else if (matched === 'webp') type = 'webp';
      else if (matched === 'svg+xml') type = 'svg';
      else type = 'png'; // x-wmf, x-emf, tiff, x-png all get treated as png (will be converted later)
    } else if (typeFromMime) {
      const mime = typeFromMime[1].toLowerCase();
      if (mime.includes('svg')) type = 'svg';
      else if (mime.includes('jpeg') || mime.includes('jpg')) type = 'jpg';
      else if (mime.includes('gif')) type = 'gif';
      else if (mime.includes('bmp')) type = 'bmp';
      else if (mime.includes('webp')) type = 'webp';
      else type = 'png'; // Fallback: treat any unrecognized image/* as png
    }

    return {
      src: dataUri,
      base64Data: data,
      isBase64: true,
      type,
      originalMimeType,
      alt,
    };
  } catch (e) {
    console.error('[ImageExtractor] Failed to parse data URI:', e);
    return null;
  }
};

/**
 * Parse SVG Data URI
 */
const parseSvgDataUri = (dataUri: string, alt: string): ExtractedImage | null => {
  try {
    const commaIndex = dataUri.indexOf(',');
    if (commaIndex === -1) return null;

    let data = dataUri.substring(commaIndex + 1);

    // If it's base64 encoded
    if (dataUri.includes('base64')) {
      data = data.replace(/\s/g, '');
      while (data.length % 4 !== 0) {
        data += '=';
      }
    } else {
      // It's URL encoded
      data = decodeURIComponent(data);
    }

    return {
      src: dataUri,
      base64Data: typeof data === 'string' && dataUri.includes('base64') ? data : undefined,
      isBase64: dataUri.includes('base64'),
      type: 'svg',
      alt,
    };
  } catch (e) {
    console.error('[ImageExtractor] Failed to parse SVG data URI:', e);
    return null;
  }
};

/**
 * Convert base64 string to Uint8Array
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  try {
    return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
  } catch (e) {
    console.error('[ImageExtractor] Failed to convert base64:', e);
    return new Uint8Array();
  }
};

/**
 * Fetch and convert external image URL to buffer
 */
export const fetchImageAsBuffer = async (url: string): Promise<{ buffer: Uint8Array; type: string } | null> => {
  try {
    // Try direct fetch first
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      // Prefer declared MIME type; fall back to content-based detection
      let type = 'png';
      try {
        const mime = (blob.type || '').toLowerCase();
        if (mime.includes('jpeg') || mime.includes('jpg')) type = 'jpg';
        else if (mime.includes('png')) type = 'png';
        else if (mime.includes('gif')) type = 'gif';
        else if (mime.includes('bmp')) type = 'bmp';
        else if (mime.includes('webp')) type = 'webp';
        else if (mime.includes('svg')) type = 'svg';
        else {
          // Inspect bytes if MIME unknown
          type = detectImageType(buffer);
        }
      } catch (e) {
        type = detectImageType(buffer);
      }
      return { buffer, type };
    }
  } catch (e) {
    console.warn('[ImageExtractor] Direct fetch failed for:', url, e);
  }

  // Fallback to canvas (handles CORS issues)
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const base64 = dataUrl.split(',')[1];
          const buffer = base64ToUint8Array(base64);
          resolve({ buffer, type: 'png' });
        } else {
          resolve(null);
        }
      } catch (err) {
        console.error('[ImageExtractor] Canvas conversion failed:', err);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.error('[ImageExtractor] Image load failed:', url);
      resolve(null);
    };
    img.src = url;
  });
};

/**
 * Detect image dimensions
 */
export const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    };
    img.onerror = () => {
      resolve({ width: 600, height: 400 }); // fallback
    };
    img.src = dataUrl;
  });
};

/**
 * Scale image dimensions while preserving aspect ratio
 */
export const scaleDimensions = (
  width: number,
  height: number,
  maxWidth: number = 450,
  maxHeight: number = 600
): { width: number; height: number } => {
  let scaledWidth = width;
  let scaledHeight = height;

  // Scale if exceeds max width
  if (scaledWidth > maxWidth) {
    const ratio = maxWidth / scaledWidth;
    scaledWidth = maxWidth;
    scaledHeight = Math.round(scaledHeight * ratio);
  }

  // Scale if exceeds max height
  if (scaledHeight > maxHeight) {
    const ratio = maxHeight / scaledHeight;
    scaledHeight = maxHeight;
    scaledWidth = Math.round(scaledWidth * ratio);
  }

  return {
    width: Math.max(scaledWidth, 100),
    height: Math.max(scaledHeight, 50),
  };
};

/**
 * Convert SVG to PNG for Word document compatibility
 */
export const convertSvgToPng = async (
  svgData: string,
  width: number = 400,
  height: number = 300
): Promise<{ base64: string; width: number; height: number } | null> => {
  try {
    const svg = svgData.includes('<svg') ? svgData : `<svg>${svgData}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.width = width;
    img.height = height;

    return new Promise((resolve) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            URL.revokeObjectURL(url);
            resolve({ base64, width, height });
          } else {
            URL.revokeObjectURL(url);
            resolve(null);
          }
        } catch (e) {
          console.error('[SVG Converter] Canvas rendering failed:', e);
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.error('[SVG Converter] Failed to load SVG');
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch (e) {
    console.error('[SVG Converter] Error:', e);
    return null;
  }
};

/**
 * Validate image data
 */
export const validateImageData = (buffer: Uint8Array, minSize: number = 100): boolean => {
  if (!buffer || buffer.length < minSize) {
    return false;
  }
  return true;
};

/**
 * Get MIME type from image buffer
 */
export const detectImageType = (buffer: Uint8Array): string => {
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }
  return 'png'; // default
};
