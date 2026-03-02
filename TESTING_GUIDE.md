# Quick Start Testing Guide

## Overview

This guide will help you quickly test and verify that all the fixes for images, diagrams, and mathematical expressions are working correctly.

## Quick Test Checklist

### ✅ Before You Start
- [ ] Project builds without errors: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Development server runs: `npm run dev`

### ✅ Test 1: Simple Image Upload (5 minutes)

**Purpose**: Verify basic image embedding works

**Steps**:
1. Create a simple HTML file with an embedded image:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>Test Document</h1>
     <table>
       <tr><th>Q.No</th><th>Questions</th><th>CO</th><th>RBT</th><th>Marks</th></tr>
       <tr>
         <td>1</td>
         <td>
           What is this diagram?
           <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="test image" width="100">
         </td>
         <td>CO1</td><td>L1</td><td>2</td>
       </tr>
     </table>
   </body>
   </html>
   ```

2. Upload this HTML file to your system
3. Download the generated Word document
4. **Verify**: Image appears in the Word document

**Expected Result**: Image is visible in Word, properly sized

---

### ✅ Test 2: Mathematical Expression (5 minutes)

**Purpose**: Verify LaTeX/math rendering works

**Steps**:
1. Create HTML with LaTeX expressions:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>Math Test</h1>
     <table>
       <tr><th>Q.No</th><th>Questions</th><th>CO</th><th>RBT</th><th>Marks</th></tr>
       <tr>
         <td>1</td>
         <td>Solve: $x^2 + 2x + 1 = 0$</td>
         <td>CO1</td><td>L3</td><td>5</td>
       </tr>
       <tr>
         <td>2</td>
         <td>Integral: $$\int_0^1 x^2 dx$$</td>
         <td>CO1</td><td>L4</td><td>8</td>
       </tr>
     </table>
   </body>
   </html>
   ```

2. Upload this HTML file
3. Download the Word document
4. **Verify**: Math expressions appear as rendered images

**Expected Result**: LaTeX expressions converted to images, properly displayed

---

### ✅ Test 3: PDF with Circuits (10 minutes)

**Purpose**: Verify PDF diagram preservation

**Steps**:
1. Create a PDF with a circuit diagram (use any tool like:
   - LTspice (free circuit simulator)
   - Inkscape (free vector drawing)
   - PowerPoint → Export as PDF
   
2. Add a question table to your PDF:
   ```
   Q.No | Questions | CO  | RBT | Marks
   -----|-----------|-----|-----|------
   1    | Draw the circuit | CO1 | L5 | 10
   ```

3. Upload this PDF to your system
4. Download the Word document
5. **Verify**: 
   - Diagram appears in the document
   - Diagram quality is acceptable
   - Question text is present

**Expected Result**: Diagram captured and embedded, text preserved

---

### ✅ Test 4: SVG Graphics (5 minutes)

**Purpose**: Verify SVG to PNG conversion

**Steps**:
1. Create HTML with inline SVG:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>SVG Test</h1>
     <table>
       <tr><th>Q.No</th><th>Questions</th><th>CO</th><th>RBT</th><th>Marks</th></tr>
       <tr>
         <td>1</td>
         <td>
           Identify the shape:
           <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
             <circle cx="50" cy="50" r="40" fill="blue"/>
           </svg>
         </td>
         <td>CO1</td><td>L1</td><td>2</td>
       </tr>
     </table>
   </body>
   </html>
   ```

2. Upload this HTML file
3. Download the Word document
4. **Verify**: SVG is converted to image and displayed

**Expected Result**: SVG converted to PNG and embedded correctly

---

### ✅ Test 5: Complex Document (15 minutes)

**Purpose**: Verify all features work together

**Steps**:
1. Create complex HTML with all types of content:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>Electronics Circuit Analysis</h1>
     <table style="width:100%; border:1px solid black;">
       <tr>
         <th style="border:1px solid black;">Q.No</th>
         <th style="border:1px solid black;">Questions</th>
         <th style="border:1px solid black;">CO</th>
         <th style="border:1px solid black;">RBT</th>
         <th style="border:1px solid black;">Marks</th>
       </tr>
       <tr>
         <td style="border:1px solid black;">13B</td>
         <td style="border:1px solid black;">
           <p>Analyze the circuit to find voltage V:</p>
           <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
             <line x1="10" y1="50" x2="50" y2="50" stroke="black" stroke-width="2"/>
             <circle cx="50" cy="50" r="20" fill="none" stroke="black" stroke-width="2"/>
             <line x1="70" y1="50" x2="110" y2="50" stroke="black" stroke-width="2"/>
           </svg>
           <p>Also compute resonant frequency: $f = \frac{1}{2\pi\sqrt{LC}}$</p>
         </td>
         <td style="border:1px solid black;">CO1</td>
         <td style="border:1px solid black;">L4</td>
         <td style="border:1px solid black;">8</td>
       </tr>
     </table>
   </body>
   </html>
   ```

2. Upload this comprehensive document
3. Download the Word document
4. **Verify**:
   - SVG diagram appears as image
   - Text is preserved
   - Math formula is rendered
   - Question number is correct
   - All metadata is present

**Expected Result**: Complete document with all content preserved

---

## Browser Console Debugging

While testing, open your browser's Developer Tools (F12) and look for these logs:

### ✅ Expected Success Logs
```
[DocumentGenerator] Extracted base64 image for Q1, type: png
[DocumentGenerator] Converted SVG to PNG for Q1
[DocumentGenerator] Rendered math expression for Q1: "x^2 + y^2 = r^2"
[PDF] Page 1: 15 text lines, rendered image: yes
[Parser] Q13 has images - originalHtml stored, length: 2450
```

### ⚠️ Warning Logs (OK, but check)
```
[DocumentGenerator] Failed to fetch image: URL
[ImageExtractor] Failed to parse data URI
[SVG Converter] Canvas rendering failed
```

These warnings mean the system tried an alternative approach - should still work.

### ❌ Error Logs (Need investigation)
```
[DocumentGenerator] Error extracting images
[PDF] Error extracting embedded images
[Parser] Error parsing table
```

If you see these, please check:
1. Browser console for full error message
2. Image format validity
3. HTML structure correctness

---

## Quick Fixes for Common Issues

### Issue: "Image not appearing in Word"

**Check**:
1. [ ] Image exists in original document
2. [ ] Image has valid format (PNG, JPG, GIF, BMP, WebP, SVG)
3. [ ] Base64 data is not corrupted
4. [ ] External image URL is accessible
5. [ ] Console shows no errors

**Fix**: Check console logs, look for image extraction messages

### Issue: "Math expressions appear as text"

**Check**:
1. [ ] LaTeX syntax is valid (e.g., `$x^2$`, `$$y = mx+c$$`)
2. [ ] Expression matches regex pattern
3. [ ] Canvas API is available (all modern browsers)
4. [ ] No JavaScript errors in console

**Fix**: Verify LaTeX syntax, check console for render errors

### Issue: "SVG not converting to image"

**Check**:
1. [ ] SVG has closing tag `</svg>`
2. [ ] SVG is valid XML
3. [ ] SVG is not too complex
4. [ ] No nested SVG issues

**Fix**: Validate SVG with online tools, simplify if needed

### Issue: "PDF pages not rendered"

**Check**:
1. [ ] PDF is valid and readable
2. [ ] PDF.js worker is loaded (check console)
3. [ ] PDF has text content (not just images)
4. [ ] PDF is not corrupted

**Fix**: Try different PDF or convert to HTML first

---

## Performance Testing

For documents with many images:

1. **Monitor Memory**: Open DevTools → Memory tab
2. **Check Performance**: DevTools → Performance tab → Record
3. **Typical Processing Time**:
   - Small document (5 questions, 5 images): ~2-5 seconds
   - Medium document (15 questions, 20 images): ~5-15 seconds
   - Large document (40 questions, 50+ images): ~15-30 seconds

If processing takes too long, check:
- Image file sizes (reduce if > 1MB total)
- External image URLs (ensure they're responsive)
- Canvas rendering (complex SVG might slow things)

---

## Success Criteria

### ✅ All of these should be true:

1. [ ] Project builds without errors
2. [ ] Images appear in Word documents
3. [ ] Math expressions render properly
4. [ ] SVG graphics convert to images
5. [ ] PDF diagrams are captured
6. [ ] No console errors during processing
7. [ ] Word documents open without issues
8. [ ] Formatting is preserved
9. [ ] Multiple images in one question work
10. [ ] Quality is acceptable

---

## Reporting Issues

If you encounter problems:

1. **Gather Information**:
   - Screenshot of Word document
   - Browser console logs (copy & paste)
   - Original input file
   - Expected vs actual result

2. **Test with Minimal Example**:
   - Create smallest possible test case
   - Include just the problematic element
   - Verify it's not a specific format issue

3. **Check Documentation**:
   - Review IMPLEMENTATION_GUIDE.md
   - Check browser compatibility
   - Verify file formats are supported

4. **Provide Details**:
   - Exact error message
   - Steps to reproduce
   - Browser and OS version
   - File that causes the issue

---

## Next Steps After Testing

1. **If everything works**: Great! Your system is fixed ✅
2. **If some issues remain**: Check troubleshooting section
3. **For optimization**: Consider adding MathJax for better math (optional)
4. **For production**: Make sure to handle edge cases in your upload validation

---

**Questions or issues? Check the console logs and IMPLEMENTATION_GUIDE.md for detailed information.**
