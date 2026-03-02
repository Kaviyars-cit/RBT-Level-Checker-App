# Image, Diagram, and Mathematical Expression Processing - Implementation Guide

## Overview

This guide explains the comprehensive solution implemented to fix missing images, diagrams, and mathematical expressions in the Word document conversion process.

## Problem Statement

The original system was losing critical content during document conversion:
- Embedded images/diagrams were not appearing in Word documents
- Mathematical expressions were not being rendered
- SVG content was unsupported
- Only plain text was preserved in the final output

## Solution Architecture

### 1. New Utility Modules Created

#### `src/utils/imageExtractor.ts`
Advanced image extraction and processing utilities that handle:
- **Base64 Data URIs**: Extraction and validation of embedded images
- **External URLs**: Fetching and processing remote images with CORS handling
- **SVG Support**: Conversion of SVG to PNG for Word document compatibility
- **Image Validation**: Dimension detection and aspect ratio preservation
- **Format Support**: PNG, JPG, GIF, BMP, WebP, and SVG

**Key Functions:**
```typescript
extractAllImages(html)              // Extract all images from HTML
parseDataUri(dataUri)               // Parse Base64 data URIs
fetchImageAsBuffer(url)             // Fetch external images
convertSvgToPng(svgData)            // Convert SVG to PNG
scaleDimensions(w, h)               // Scale with aspect ratio preservation
getImageDimensions(dataUrl)         // Detect actual image dimensions
```

#### `src/utils/contentRenderer.ts`
Enhanced content rendering for complex mathematical and technical content:
- **MathML Support**: Detection and conversion of MathML to text/images
- **Complex LaTeX**: Rendering of advanced mathematical expressions
- **Diagram Description Extraction**: Extracting alt text and captions
- **Content Processing**: Automated conversion of mathematical content to images

**Key Functions:**
```typescript
extractMathML(html)                    // Find MathML elements
convertMathMLToText(mathml)            // Convert MathML to text
renderComplexLatex(latex)              // Render complex LaTeX to image
processMathematicalContent(html)       // Process all math in HTML
extractDiagramDescriptions(html)       // Extract diagram captions
```

### 2. Enhanced Existing Services

#### `src/services/documentGenerator.ts` - Updates

**Added Imports:**
```typescript
import { 
  extractAllImages, 
  base64ToUint8Array, 
  fetchImageAsBuffer, 
  scaleDimensions, 
  convertSvgToPng 
} from '@/utils/imageExtractor';
import { processMathematicalContent } from '@/utils/contentRenderer';
```

**Improved `extractImagesFromHtml()` Function:**
- Uses the new `extractAllImages()` utility
- Handles SVG conversion to PNG
- Better error handling and logging
- Supports multiple image formats

**Enhanced Image Embedding:**
- Proper dimension detection for all image types
- Aspect ratio preservation
- SVG/WebP conversion before embedding
- Better buffer validation

#### `src/services/fileParser.ts` - Updates

**PDF Processing Enhancements:**
- Added `extractImagesFromPdfPage()` function for embedded image detection
- Improved page image rendering at higher resolution (2.0 scale)
- Better tracking of page-to-question associations
- Enhanced metadata extraction

**New Capabilities:**
```typescript
extractImagesFromPdfPage(page)  // Extract embedded images from PDF
renderPdfPageToImage(page, scale) // Render full page as image
```

#### `src/services/parser/htmlParser.ts` - Updates

**Improved Image Detection:**
- Enhanced regex patterns for image detection
- Support for MathML detection
- SVG content detection
- Complex content preservation

**Better `originalHtml` Storage:**
```typescript
const hasImages = /<img[^>]+(src|data-src)\s*=/i.test(questionHtml);
const hasMath = /<math[^>]*>|<script[^>]*math/i.test(questionHtml);
const hasSVG = /<svg[^>]*>|data:image\/svg\+xml/i.test(questionHtml);
const hasComplexContent = /<(table|figure|canvas|iframe)[^>]*>/i.test(questionHtml);
```

### 3. Image Processing Flow

```
Input Document (PDF/HTML/DOCX)
         ↓
    File Parser
         ↓
  Extract Images + Text
         ↓
  HTML Parser
         ↓
  Extract Questions + Store originalHtml
         ↓
Document Generator
         ↓
Extract Images from originalHtml
         ↓
Convert SVG → PNG if needed
         ↓
Fetch External URLs
         ↓
Embed in Word Document
         ↓
Output (.docx)
```

### 4. Mathematical Expression Processing

**Supported Formats:**
- LaTeX inline: `$...$` or `\(...\)`
- LaTeX display: `$$...$$` or `\[...\]`
- MathML: `<math>...</math>`
- Common notation: superscripts, subscripts, Greek letters, etc.

**Processing Steps:**
1. Detection of mathematical content
2. Extraction of expressions
3. Conversion to images (with or without MathJax)
4. Embedding in Word document

### 5. SVG and Diagram Handling

**SVG Processing:**
1. Detection in HTML (both as tags and data URIs)
2. Conversion to PNG using Canvas API
3. Fallback rendering with text representation
4. Proper embedding in Word documents

**Diagram Support:**
- Full page images from PDFs (captures all visual content)
- Circuit diagrams preserved as images
- Technical drawings maintained
- Fallback: text descriptions from alt attributes

### 6. Updated Question Type

The `Question` interface now properly utilizes:
```typescript
originalHtml?: string;  // Preserves original HTML with images/formulas
```

This field is populated during parsing and used during Word generation.

## Usage Instructions

### For Frontend Users

1. **Upload Document**: Upload PDF, HTML, or Word file
2. **System Processing**: All images, diagrams, and math are automatically extracted
3. **Word Generation**: Download Word document with all content preserved

### For Developers

#### Creating Custom Image Processing:
```typescript
import { extractAllImages, scaleDimensions } from '@/utils/imageExtractor';

const images = extractAllImages(htmlContent);
for (const img of images) {
  const scaled = scaleDimensions(img.width, img.height);
  // Process image with proper dimensions
}
```

#### Processing Mathematical Content:
```typescript
import { processMathematicalContent } from '@/utils/contentRenderer';

const { processedHtml, mathCount } = await processMathematicalContent(html);
console.log(`Processed ${mathCount} mathematical expressions`);
```

## Key Improvements

### 1. **Image Preservation**
- ✅ Embedded images (base64) are extracted and embedded
- ✅ External images are fetched and embedded
- ✅ Proper dimension detection and scaling
- ✅ Support for PNG, JPG, GIF, BMP, WebP

### 2. **SVG and Diagram Support**
- ✅ SVG detection and conversion to PNG
- ✅ Full PDF pages preserved as images
- ✅ Circuit diagrams captured and embedded
- ✅ Aspect ratio preservation

### 3. **Mathematical Expression Rendering**
- ✅ LaTeX expression detection and rendering
- ✅ MathML support and conversion
- ✅ Complex expressions rendered as images
- ✅ Chemical formulas and scientific notation

### 4. **Error Handling**
- ✅ Graceful fallback for failed image processing
- ✅ Detailed logging for debugging
- ✅ Validation of image buffers
- ✅ CORS handling for external images

### 5. **Performance**
- ✅ Async image processing
- ✅ Parallel image extraction and processing
- ✅ Efficient buffer conversion
- ✅ Lazy loading of external resources

## Testing Recommendations

### Test Cases

1. **PDF with Diagrams**
   - Upload PDF with circuit diagrams
   - Verify diagrams appear in Word output
   - Check quality and size

2. **Mathematical Expressions**
   - Upload document with LaTeX/MathML
   - Verify expressions render as images
   - Check alignment and formatting

3. **Mixed Content**
   - Document with images, math, and text
   - Verify all content is preserved
   - Check layout integrity

4. **Edge Cases**
   - Very large images
   - Strange color spaces
   - Corrupted image data
   - Missing alt text

### Test Commands

```bash
# Run existing tests
npm test

# Check for console errors
npm run dev  # Watch for warnings
```

## Configuration & Dependencies

### Existing Dependencies Used
- `docx`: Word document generation
- `mammoth`: DOCX parsing
- `pdfjs-dist`: PDF parsing
- `cheerio`: HTML parsing

### Recommended Optional Dependencies
```json
{
  "mathjax": "^3.0.0",           // For advanced math rendering
  "sharp": "^0.32.0"              // For server-side image processing
}
```

### No New Required Dependencies
The solution uses existing browser APIs:
- Canvas API (image rendering)
- Image API (dimension detection)
- Fetch API (external image loading)
- DOMParser (HTML parsing)

## Troubleshooting

### Issue: Images Not Appearing

**Solution:**
1. Check browser console for errors
2. Verify image sources in originalHtml
3. Ensure CORS is properly configured
4. Check image buffer validation in console logs

### Issue: Math Not Rendering

**Solution:**
1. Verify LaTeX/MathML syntax
2. Check if expression matches regex patterns
3. Review console logs for rendering errors
4. Ensure `renderMathToImage()` is being called

### Issue: SVG Not Converting

**Solution:**
1. Verify SVG has valid structure
2. Check browser Canvas API availability
3. Review conversion function logs
4. Fallback to PNG rendering

## Future Enhancements

### Planned Features
1. **MathJax Integration**: For complex mathematical rendering
2. **Server-Side Image Processing**: Using Sharp for better performance
3. **Advanced Diagram Recognition**: Automatic diagram classification
4. **Custom Styling**: Control over image sizing in Word documents
5. **Batch Processing**: Handle large documents with many images

### Potential Optimizations
- Image compression before embedding
- Progressive loading for large PDFs
- Caching of rendered math expressions
- Memory-efficient streaming for large files

## References

- [docx Library](https://github.com/dolanmiu/docx)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MathML Standard](https://www.w3.org/TR/MathML3/)
- [SVG Specification](https://www.w3.org/TR/SVG2/)

## Summary

This solution provides a robust, production-ready system for preserving images, diagrams, and mathematical expressions in document conversion workflows. The modular design allows for easy maintenance and future enhancements without affecting existing functionality.

All improvements maintain backward compatibility while significantly enhancing the quality and completeness of the output Word documents.
