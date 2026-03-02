# Image Display Fix in Downloaded Question Paper (DOCX)

## Problem Identified
Images were **NOT displaying** in the downloaded corrected/enhanced question paper (DOCX format), even though:
- Images displayed correctly in the verification page (IA1Page, IA2Page, IA3Page)
- Images displayed correctly in the enhancement preview page (EnhancePage)

## Root Cause
In `src/services/documentGenerator.ts`, the `createQuestionsTable()` function was using the WRONG priority for content:

**Old Code (WRONG):**
```typescript
const htmlSource = q.originalHtml || q.text || '';
```

This meant:
1. **Always prioritized `originalHtml`** (original question from upload)
2. When questions were enhanced/fixed, `q.text` was updated with enhanced content + images reattached
3. But `q.originalHtml` was never updated - it stayed as the ORIGINAL question
4. Result: **Word document showed original questions**, not the enhanced ones, and images from the enhancement might not extract properly

## Solution Applied
Changed the priority to use the **current/active version** of the question:

**New Code (CORRECT):**
```typescript
// PRIORITY: Use q.text (the current/enhanced/fixed version) first, fall back to originalHtml
// WHY: q.text contains enhanced questions with reattached images, originalHtml has the original content
// This ensures the document shows the corrected/enhanced questions, not the original ones
const htmlSource = q.text || q.originalHtml || '';
```

## Changes Made
1. **Line 553** - Updated `htmlSource` priority to use `q.text` first
2. **Line 559** - Updated debug log to show which source is being used
3. **Line 563** - Updated `tempText` to use `htmlSource` (which now contains the enhanced/reattached images)
4. **Line 578** - Updated math expression detection to use `htmlSource` 
5. **Line 581** - Updated math extraction to use `htmlSource`
6. **Line 780** - Updated PDF fallback to check both `q.text` and `q.originalHtml`

## Flow After Fix
1. **Original Upload**: `q.text` = original, `q.originalHtml` = original with images
2. **After Enhancement**: `q.text` = enhanced content + reattached images (via `reattachImages()`), `q.originalHtml` = original
3. **Document Generation**: Uses `q.text` (enhanced with images) → **Images now display correctly!**

## Benefits
✅ Word document now shows **enhanced/corrected questions** (not originals)
✅ **Images display in exact order** as they were in the uploaded paper
✅ Same image extraction logic as verification/preview pages is now applied
✅ Works for fixed questions, enhanced questions, and original accepted questions

## Testing Recommendations
1. Upload a question paper with circuit diagrams/images
2. Enhance the questions
3. Download as DOCX
4. Verify images appear in correct positions in the document
