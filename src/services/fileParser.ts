
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
// Use unpkg as it reliably mirrors npm versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface ParseFileResult {
  html: string;
  pdfPageImages?: (string | null)[];
}

export const parseFile = async (file: File): Promise<ParseFileResult> => {
  const fileType = file.name.split('.').pop()?.toLowerCase();

  if (fileType === 'html' || fileType === 'htm') {
    const html = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
    return { html };
  } else if (fileType === 'docx') {
    const html = await parseDocx(file);
    return { html };
  } else if (fileType === 'pdf') {
    return parsePdf(file);
  } else {
    throw new Error('Unsupported file type');
  }
};

const parseDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  // Explicitly configure image handling to ensure ALL images are converted to base64 data URIs
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(function (image: any) {
        return image.read("base64").then(function (imageBuffer: string) {
          const contentType = image.contentType || 'image/png';
          console.log(`[DOCX Parser] Found embedded image: type=${contentType}, size=${imageBuffer.length}`);
          return {
            src: `data:${contentType};base64,${imageBuffer}`
          };
        });
      })
    }
  );

  // Count images for debugging
  const imgCount = (result.value.match(/<img/gi) || []).length;
  console.log(`[DOCX Parser] Converted DOCX to HTML: ${result.value.length} chars, ${imgCount} images found`);
  if (result.messages.length > 0) {
    console.log('[DOCX Parser] Mammoth messages:', result.messages);
  }

  return result.value;
};

// ============================================================
// PDF Parsing: Text-flattening + Sequential Question Detection
// ============================================================

const extractImagesFromPdfPage = async (page: any): Promise<string[]> => {
  try {
    const images: string[] = [];
    const operatorList = await page.getOperatorList();

    if (!operatorList) return images;

    // operatorList.fnArray contains operator functions
    // operatorList.argsArray contains arguments for each operator
    // XObject is typically how images are referenced in PDFs
    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];
      const args = operatorList.argsArray[i];

      // Check if this is an image operator (Do is the operator that draws XObjects like images)
      if (fn === 99) { // OPS ENUM for "Do" (draw XObject)
        try {
          const resources = page.getResources().then((res: any) => {
            if (res?.XObject) {
              Object.values(res.XObject).forEach((obj: any) => {
                obj?.promise?.then((xobj: any) => {
                  if (xobj?.data) {
                    // Successfully got image data
                    console.log('[PDF] Found embedded image in XObject');
                  }
                }).catch(() => {
                  // Image extraction not always successful
                });
              });
            }
          });
        } catch (e) {
          // Silently fail for individual image extraction
        }
      }
    }

    return images;
  } catch (e) {
    console.warn('[PDF] Error extracting embedded images:', e);
    return [];
  }
};

const renderPdfPageToImage = async (page: any, scale: number = 2.0): Promise<string | null> => {
  try {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    console.log(`[PDF] Rendered page to image: ${canvas.width}x${canvas.height}, data length: ${dataUrl.length}`);
    return dataUrl;
  } catch (err) {
    console.error('[PDF] Failed to render page to image:', err);
    return null;
  }
};

const parsePdf = async (file: File): Promise<ParseFileResult> => {
  try {
    console.log('Starting PDF parsing for:', file.name);
    const arrayBuffer = await file.arrayBuffer();

    // Ensure worker is set
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('PDF Loaded, pages:', pdf.numPages);

    // Extract text AND render images from all pages
    const pageTexts: string[] = [];
    const pageImages: (string | null)[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // 1. Extract text content (existing logic)
      const textContent = await page.getTextContent();

      // Get items with position
      const items = textContent.items.map((item: any) => ({
        str: item.str as string,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
      }));

      // Sort: top to bottom (Y desc), then left to right (X asc)
      items.sort((a: any, b: any) => {
        if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
        return b.y - a.y;
      });

      // Group into lines by Y-coordinate
      const lines: string[] = [];
      let currentLine: typeof items = [];

      if (items.length > 0) {
        currentLine.push(items[0]);
        for (let j = 1; j < items.length; j++) {
          if (Math.abs(items[j].y - currentLine[0].y) < 5) {
            currentLine.push(items[j]);
          } else {
            currentLine.sort((a: any, b: any) => a.x - b.x);
            lines.push(currentLine.map((it: any) => it.str).join(' '));
            currentLine = [items[j]];
          }
        }
        if (currentLine.length > 0) {
          currentLine.sort((a: any, b: any) => a.x - b.x);
          lines.push(currentLine.map((it: any) => it.str).join(' '));
        }
      }

      pageTexts.push(lines.join('\n'));

      // 2. Render page to image (captures diagrams, figures, math, everything visual)
      // This is critical for preserving visual content that doesn't have text
      const pageImage = await renderPdfPageToImage(page, 2.0);
      pageImages.push(pageImage);

      // 3. Try to extract images directly from the PDF page
      const imageData = await extractImagesFromPdfPage(page);

      console.log(`[PDF] Page ${i}: ${lines.length} text lines, rendered image: ${pageImage ? 'yes' : 'no'}, data length: ${pageImage?.length || 0}, embedded images: ${imageData.length}`);
    }

    const fullText = pageTexts.join('\n');
    console.log('Full extracted text length:', fullText.length);
    console.log(`[PDF] Total page images: ${pageImages.filter(Boolean).length}/${pageImages.length}`);

    const html = convertTextToHtml(fullText, pageImages, pageTexts);
    return { html, pdfPageImages: pageImages };
  } catch (error) {
    console.error('PDF Parsing Error:', error);
    throw error;
  }
};

const convertTextToHtml = (fullText: string, pageImages?: (string | null)[], pageTexts?: string[]): string => {
  let html = '<div class="pdf-content">';

  // Extract metadata from header area
  let subject = '';
  let subjectCode = '';
  let date = '';
  let maxMarks = '';
  let time = '';
  let branch = '';
  let yearSem = '';

  // Subject (match various patterns)
  const subjectMatch = fullText.match(/Subject[:\s]+([A-Za-z\s&]+?)(?:\s+Time|\s+Date|\s+Branch|\n)/i);
  if (subjectMatch) subject = subjectMatch[1].trim();

  // Subject code/name combined
  const subjectCodeMatch = fullText.match(/Subject\s*(?:Code)?(?:\/?\s*Name)?[:\s]+([A-Z0-9]+)\s*[/]\s*([A-Za-z\s&]+?)(?:\s+Time|\n)/i);
  if (subjectCodeMatch) {
    subjectCode = subjectCodeMatch[1].trim();
    subject = subjectCodeMatch[2].trim();
  }

  // Date
  const dateMatch = fullText.match(/Date[:\s]+([\d./-]+)/i);
  if (dateMatch) date = dateMatch[1].trim();

  // Max Marks
  const marksMatch = fullText.match(/Max\.?\s*Marks[:\s]+(\d+(?:\s*Marks)?)/i);
  if (marksMatch) maxMarks = marksMatch[1].trim();

  // Time
  const timeMatch = fullText.match(/Time[:\s]+([\d.:]+\s*(?:hours?|hrs?)?)/i);
  if (timeMatch) time = timeMatch[1].trim();

  // Branch
  const branchMatch = fullText.match(/Branch[:\s]+([A-Za-z\s&,]+?)(?:\s+Year|\s+Date|\n)/i);
  if (branchMatch) branch = branchMatch[1].trim();

  // Year/Sem
  const yearSemMatch = fullText.match(/Year\s*[/]\s*Sem[:\s]+([A-Za-z0-9\s/]+?)(?:\n|$)/im);
  if (yearSemMatch) yearSem = yearSemMatch[1].trim();

  // Detect IA type from text
  let iaTypeText = 'Internal Assessment';
  if (/Internal\s+Assessment\s*[-–]?\s*3|IA\s*[-–]?\s*3|Model\s+Exam/i.test(fullText)) {
    iaTypeText = 'Internal Assessment 3';
  } else if (/Internal\s+Assessment\s*[-–]?\s*2|IA\s*[-–]?\s*2/i.test(fullText)) {
    iaTypeText = 'Internal Assessment 2';
  } else if (/Internal\s+Assessment\s*[-–]?\s*1|IA\s*[-–]?\s*1|EPC/i.test(fullText)) {
    iaTypeText = 'Internal Assessment 1';
  }

  console.log('Extracted metadata:', { subject, subjectCode, date, maxMarks, time, branch, yearSem });

  // Header table with proper IDs for metadata extraction
  html += `
    <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 20px;">
      <tr>
        <td colspan="4" style="text-align: center; border: 1px solid black; padding: 10px;">
          <h2 style="margin: 0;">CHENNAI INSTITUTE OF TECHNOLOGY</h2>
          <p style="margin: 5px 0;">Autonomous</p>
          <p style="margin: 2px 0;">Sarathy Nagar, Kundrathur, Chennai – 600 069.</p>
          <p style="margin: 5px 0;" id="assTypeCell"><strong>${iaTypeText}</strong></p>
        </td>
      </tr>
      <tr>
        <td style="border: 1px solid black; padding: 5px;">Date: ${date}</td>
        <td style="border: 1px solid black; padding: 5px;" id="code">${subjectCode}${subject ? ' / ' + subject : ''}</td>
        <td style="border: 1px solid black; padding: 5px;">Max. Marks: ${maxMarks || '50 Marks'}</td>
        <td style="border: 1px solid black; padding: 5px;">Time: ${time || '1.30 hrs'}</td>
      </tr>
      <tr>
        <td style="border: 1px solid black; padding: 5px;" colspan="2" id="branchCell">${branch}</td>
        <td style="border: 1px solid black; padding: 5px;" colspan="2" id="yearSemesterCell">${yearSem}</td>
      </tr>
    </table>
  `;

  // ---- Extract Course Objectives ----
  const courseObjectives: string[] = [];
  const objSectionMatch = fullText.match(/Course\s+Objective[s]?\s*[:\-–]?\s*([\s\S]*?)(?=Course\s+Outcome|PART|Q\.?\s*No|$)/i);
  if (objSectionMatch) {
    const objText = objSectionMatch[1].trim();
    const objItems = objText.split(/(?:\d+[.)]\s*|\n(?=[A-Z]))/);
    objItems.forEach(item => {
      const cleaned = item.trim().replace(/\s+/g, ' ');
      if (cleaned.length > 10 && !courseObjectives.includes(cleaned)) {
        courseObjectives.push(cleaned);
      }
    });
  }

  // ---- Extract Course Outcomes ----
  const courseOutcomes: { co: string; description: string }[] = [];
  const coRegex = /CO\s*\.?\s*(\d+)\s*[:\-–.]\s*(.+?)(?=CO\s*\.?\s*\d+\s*[:\-–.]|\n\n|PART|$)/gi;
  const coSectionMatch = fullText.match(/(?:Course\s+Outcome|CO\s*Statements?|On\s+course\s+completion)[:\s]*([\s\S]*?)(?=PART|Q\.?\s*No|$)/i);
  const coSearchText = coSectionMatch ? coSectionMatch[1] : fullText;

  let coMatch;
  while ((coMatch = coRegex.exec(coSearchText)) !== null) {
    const coNum = coMatch[1];
    let desc = coMatch[2].trim().replace(/\s+/g, ' ').trim();
    if (desc.length > 5) {
      courseOutcomes.push({ co: `CO${coNum}`, description: desc });
    }
  }

  console.log('PDF Extracted Course Objectives:', courseObjectives);
  console.log('PDF Extracted Course Outcomes:', courseOutcomes);

  // Embed COs as hidden data for metadata extraction
  if (courseObjectives.length > 0) {
    html += `<div id="courseObjectives" style="display:none;">${JSON.stringify(courseObjectives)}</div>`;
  }
  if (courseOutcomes.length > 0) {
    html += `<div id="courseOutcomes" style="display:none;">${JSON.stringify(courseOutcomes)}</div>`;
  }

  // ---- Question Detection ----
  // Strategy: Find all occurrences of "N." where N is a number
  // Then filter to only keep sequentially increasing numbers starting from 1

  interface QuestionData {
    num: number;
    suffix: string; // Captured suffix (e.g. 'A', 'B')
    text: string;
    co: string;
    rbt: string;
    marks: string;
    pageIndex?: number; // Track which PDF page this question came from
  }

  // Find all potential question number positions
  const potentialQs: { num: number; suffix: string; textStart: number; charIndex: number }[] = [];

  // Multiple regex patterns to catch all question number formats across pages
  // Pattern 1: Number + optional space + optional Suffix at line start or after whitespace
  // Handles: "11 A", "11A", "1.", "2 ", etc.
  const qRegex1 = /(?:^|\n|\s{2,})(\d{1,3})\s*([A-Ba-b])?[\s.:\)]/gm;
  let m;
  while ((m = qRegex1.exec(fullText)) !== null) {
    const afterPos = m.index + m[0].length;
    if (m[1].length < 4) {
      potentialQs.push({
        num: parseInt(m[1]),
        suffix: m[2] ? m[2].toUpperCase() : '',
        textStart: afterPos,
        charIndex: m.index
      });
    }
  }

  // Pattern 2: Specifically look for "N A" or "N B" patterns (question with OR variants)
  // This catches cases where Pattern 1 might miss due to context
  const qRegex2 = /(?:^|\n)(\d{1,2})\s+([ABab])\s/gm;
  while ((m = qRegex2.exec(fullText)) !== null) {
    const afterPos = m.index + m[0].length;
    const num = parseInt(m[1]);
    const suffix = m[2].toUpperCase();
    // Only add if not already found at similar position
    const isDuplicate = potentialQs.some(pq =>
      pq.num === num && pq.suffix === suffix && Math.abs(pq.charIndex - m!.index) < 10
    );
    if (!isDuplicate) {
      potentialQs.push({ num, suffix, textStart: afterPos, charIndex: m.index });
    }
  }

  // Pattern 3: Look for question numbers right after "OR" separator lines
  // This is critical for multi-page PDFs where OR separates A/B variants
  const orRegex = /OR\s*\n\s*(\d{1,2})\s*([ABab])\s/gim;
  while ((m = orRegex.exec(fullText)) !== null) {
    const numStartIndex = fullText.indexOf(m[1], m.index + 2);
    const afterPos = numStartIndex + m[1].length + (m[2] ? m[2].length : 0) + 1;
    const num = parseInt(m[1]);
    const suffix = m[2].toUpperCase();
    const isDuplicate = potentialQs.some(pq =>
      pq.num === num && pq.suffix === suffix && Math.abs(pq.charIndex - numStartIndex) < 10
    );
    if (!isDuplicate) {
      potentialQs.push({ num, suffix, textStart: afterPos, charIndex: numStartIndex });
    }
  }

  // Sort all potential questions by their position in the text
  potentialQs.sort((a, b) => a.charIndex - b.charIndex);

  // Remove duplicates while preserving order (keep first occurrence at each position)
  const seen = new Set<string>();
  const uniquePQs = potentialQs.filter(pq => {
    const key = `${pq.num}-${pq.suffix}-${pq.charIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Also deduplicate by num+suffix (keep first occurrence only unless positions are very different)
  const deduped: typeof uniquePQs = [];
  const seenNumSuffix = new Map<string, number>();
  for (const pq of uniquePQs) {
    const key = `${pq.num}-${pq.suffix}`;
    const prevPos = seenNumSuffix.get(key);
    if (prevPos === undefined || Math.abs(pq.charIndex - prevPos) > 200) {
      // Allow same num+suffix if they're far apart (might be legitimate, e.g. table row nums from CO table vs actual questions)
      if (prevPos === undefined) {
        deduped.push(pq);
        seenNumSuffix.set(key, pq.charIndex);
      }
    }
  }

  console.log('Questions found from patterns:', deduped.map(q => `Q${q.num}${q.suffix}`).join(', '));
  console.log('Potential question positions found:', deduped.length);
  if (deduped.length > 0) {
    console.log('First 5 potential questions:', deduped.slice(0, 5).map(q => `Q${q.num}${q.suffix}`).join(', '));
    console.log('Last 5 potential questions:', deduped.slice(-5).map(q => `Q${q.num}${q.suffix}`).join(', '));
  }

  // Filter: Build sequential question list allowing for gaps (multi-part papers)
  // and repetitions (subdivisions like 11A, 11B, 11C)
  const sequentialQs: typeof deduped = [];
  let nextExpected = 1;
  let maxAllowedGap = 50; // Large gap to handle multi-part papers
  // Track which base numbers we've seen (to accept A/B variants)
  const seenBaseNumbers = new Set<number>();

  for (const pq of deduped) {
    // Basic validation: must have some text following it to be a question
    const sampleText = fullText.substring(pq.textStart, pq.textStart + 50);
    if (!/[A-Za-z]/.test(sampleText)) continue;

    // Skip numbers that are clearly not question numbers (CO numbers in CO tables, etc.)
    // Check context: if surrounded by CO/RBT/L-level text, skip
    const contextBefore = fullText.substring(Math.max(0, pq.charIndex - 30), pq.charIndex);
    if (/CO\.?\s*NO|CO\s*\.?\s*$/i.test(contextBefore) ||
      /Course\s+Outcome/i.test(contextBefore) ||
      /RBT\s+Level/i.test(contextBefore)) {
      continue;
    }

    if (pq.num === nextExpected) {
      sequentialQs.push(pq);
      seenBaseNumbers.add(pq.num);
      if (!pq.suffix || pq.suffix === 'A') {
        nextExpected++;
      }
    } else if (seenBaseNumbers.has(pq.num) || pq.num === nextExpected - 1) {
      // Repeat number (likely A/B variants on same or different page)
      sequentialQs.push(pq);
      seenBaseNumbers.add(pq.num);
    } else if (pq.num > nextExpected && pq.num <= nextExpected + maxAllowedGap) {
      // Allowed jump (Part A to Part B, etc.)
      if (sequentialQs.length >= 1) {
        sequentialQs.push(pq);
        seenBaseNumbers.add(pq.num);
        nextExpected = pq.num + 1;
      }
    } else if (pq.num < nextExpected && pq.num > 0 && sequentialQs.length > 3) {
      // Catch cases where numbering restarts or B-variant appears later
      // Accept if we've seen the base number before (it's an A/B variant)
      if (pq.suffix && (pq.suffix === 'A' || pq.suffix === 'B')) {
        sequentialQs.push(pq);
        seenBaseNumbers.add(pq.num);
      }
    }
  }

  // Post-pass: Sort sequential questions by (num, suffix) to ensure correct ordering
  sequentialQs.sort((a, b) => {
    if (a.num !== b.num) return a.num - b.num;
    return (a.suffix || '').localeCompare(b.suffix || '');
  });

  console.log('Sequential questions found:', sequentialQs.length,
    sequentialQs.length > 0 ? `(Q${sequentialQs[0].num}${sequentialQs[0].suffix} to Q${sequentialQs[sequentialQs.length - 1].num}${sequentialQs[sequentialQs.length - 1].suffix})` : '');
  if (sequentialQs.length > 0) {
    console.log('Final questions detected:', sequentialQs.map(q => `Q${q.num}${q.suffix}`).join(', '));
  }

  // Build a map of character positions to page indices for PDF page-image association
  const pageCharOffsets: number[] = [];
  if (pageImages && pageImages.length > 0 && pageTexts && pageTexts.length > 0) {
    // Track cumulative character positions per page (pages are joined by '\n')
    let cumLen = 0;
    for (let p = 0; p < pageTexts.length; p++) {
      pageCharOffsets.push(cumLen);
      cumLen += pageTexts[p].length + 1; // +1 for the '\n' joiner
    }
  }

  const getPageForPosition = (charPos: number): number => {
    if (pageCharOffsets.length === 0) return 0;
    for (let p = pageCharOffsets.length - 1; p >= 0; p--) {
      if (charPos >= pageCharOffsets[p]) return p;
    }
    return 0;
  };

  // Extract question text
  // Use position-sorted order for text boundary calculation
  const positionSorted = [...sequentialQs].sort((a, b) => a.charIndex - b.charIndex);
  const questions: QuestionData[] = [];

  // Build a map from charIndex to extracted question data
  const questionDataMap = new Map<number, QuestionData>();

  for (let i = 0; i < positionSorted.length; i++) {
    const start = positionSorted[i].textStart;
    const end = i + 1 < positionSorted.length
      ? positionSorted[i + 1].charIndex
      : fullText.length;

    let qText = fullText.substring(start, end).trim();

    // Clean up: remove Part B/C headers that might be inside the text
    qText = qText.replace(/\n\s*PART\s*[-–]?\s*[A-C].*/gi, '').trim();
    // Remove "OR" markers that may be captured in text
    qText = qText.replace(/\s*\bOR\b\s*$/i, '').trim();

    // Replace multiple whitespace/newlines with single space
    qText = qText.replace(/\s+/g, ' ').trim();

    // Try to extract CO, RBT, Marks from the text
    let co = '';
    let rbt = '';
    let qMarks = '';

    // Pattern: "CO1 L2 2" or "CO1 L2 12" at end
    const metaMatch = qText.match(/\s+(CO\s*\d+)\s+(L\d(?:-L\d)?)\s+(\d{1,2})\s*$/i);
    if (metaMatch) {
      co = metaMatch[1].replace(/\s/g, '');
      rbt = metaMatch[2];
      qMarks = metaMatch[3];
      qText = qText.substring(0, qText.length - metaMatch[0].length).trim();
    }

    // Determine which PDF page this question is on
    const pageIdx = getPageForPosition(positionSorted[i].charIndex);

    questionDataMap.set(positionSorted[i].charIndex, {
      num: positionSorted[i].num,
      suffix: positionSorted[i].suffix,
      text: qText,
      co,
      rbt,
      marks: qMarks,
      pageIndex: pageIdx
    });
  }

  // Build questions array in the (num, suffix) sorted order
  for (const sq of sequentialQs) {
    const qData = questionDataMap.get(sq.charIndex);
    if (qData) {
      questions.push(qData);
    }
  }

  // ---- Detect Part boundaries ----
  const partAMatch = fullText.match(/PART\s*[-–]?\s*A/i);
  const partBMatch = fullText.match(/PART\s*[-–]?\s*B/i);
  const partCMatch = fullText.match(/PART\s*[-–]?\s*C/i);

  let partBStartQ = -1;
  let partCStartQ = -1;

  if (partBMatch && partBMatch.index) {
    // Find the minimum question number among questions that appear after Part B header in the text
    let minNum = Infinity;
    for (const sq of sequentialQs) {
      if (sq.charIndex > partBMatch.index && sq.num < minNum) {
        minNum = sq.num;
      }
    }
    if (minNum < Infinity) partBStartQ = minNum;
  }

  if (partCMatch && partCMatch.index) {
    let minNum = Infinity;
    for (const sq of sequentialQs) {
      if (sq.charIndex > partCMatch.index && sq.num < minNum) {
        minNum = sq.num;
      }
    }
    if (minNum < Infinity) partCStartQ = minNum;
  }

  // ---- Generate HTML Tables ----
  // Track which PDF pages have already had their image embedded (avoid duplicates)
  const embeddedPages = new Set<number>();

  const generateTable = (id: string, title: string, qs: QuestionData[]) => {
    let tableHtml = `
      <h3 style="text-align: center; margin-top: 20px; font-weight: bold;">${title}</h3>
      <table id="${id}" style="width: 100%; border-collapse: collapse; border: 1px solid black;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid black; padding: 8px; width: 50px;">Q.No</th>
            <th style="border: 1px solid black; padding: 8px;">Questions</th>
            <th style="border: 1px solid black; padding: 8px; width: 60px;">CO</th>
            <th style="border: 1px solid black; padding: 8px; width: 80px;">RBT</th>
            <th style="border: 1px solid black; padding: 8px; width: 60px;">Marks</th>
          </tr>
        </thead>
        <tbody>
    `;

    let prevNum = -1;

    for (const q of qs) {
      // Insert OR separator row between A/B variants of the same question number
      if (q.num === prevNum && q.suffix === 'B') {
        tableHtml += `
          <tr>
            <td colspan="5" style="border: 1px solid black; padding: 4px; text-align: center; font-weight: bold; background-color: #f9f9f9;">OR</td>
          </tr>
        `;
      }
      prevNum = q.num;

      // Build question cell content — include text AND any associated PDF page image
      let questionCellContent = q.text;

      // For PDF-sourced questions: embed the rendered page image ONCE per page
      // This captures diagrams, circuit drawings, and other visual content  
      if (q.pageIndex !== undefined && pageImages && pageImages[q.pageIndex] && !embeddedPages.has(q.pageIndex)) {
        const pageImgDataUrl = pageImages[q.pageIndex];
        if (pageImgDataUrl) {
          questionCellContent += `<br><img src="${pageImgDataUrl}" alt="Page ${q.pageIndex + 1} content" style="max-width: 100%; height: auto;" data-page="${q.pageIndex}">`;
          embeddedPages.add(q.pageIndex);
          console.log(`[PDF→HTML] Embedded page ${q.pageIndex + 1} image for Q${q.num}${q.suffix || ''}`);
        }
      }

      // Question row — includes text and any embedded images
      tableHtml += `
        <tr>
          <td style="border: 1px solid black; padding: 8px; text-align: center; vertical-align: top;">${q.num}${q.suffix ? ' ' + q.suffix : ''}</td>
          <td style="border: 1px solid black; padding: 8px; vertical-align: top;">${questionCellContent}</td>
          <td style="border: 1px solid black; padding: 8px; text-align: center; vertical-align: top;">${q.co}</td>
          <td style="border: 1px solid black; padding: 8px; text-align: center; vertical-align: top;">${q.rbt}</td>
          <td style="border: 1px solid black; padding: 8px; text-align: center; vertical-align: top;">${q.marks}</td>
        </tr>
      `;
    }

    tableHtml += '</tbody></table>';
    return tableHtml;
  };

  if (questions.length > 0) {
    if (partBStartQ > 0) {
      const partAQs = questions.filter(q => q.num < partBStartQ);
      let partBQs: QuestionData[];
      let partCQs: QuestionData[] = [];

      if (partCStartQ > 0) {
        // Has Part C - split Part B and Part C
        partBQs = questions.filter(q => q.num >= partBStartQ && q.num < partCStartQ);
        partCQs = questions.filter(q => q.num >= partCStartQ);
      } else {
        partBQs = questions.filter(q => q.num >= partBStartQ);
      }

      if (partAQs.length > 0) html += generateTable('parta', 'Part A', partAQs);
      if (partBQs.length > 0) html += generateTable('partb', 'Part B', partBQs);
      if (partCQs.length > 0) html += generateTable('partc', 'Part C', partCQs);
    } else {
      html += generateTable('parta', partAMatch ? 'Part A' : 'Questions', questions);
    }
  } else {
    html += '<p style="color: red; text-align: center; padding: 20px; font-weight: bold;">No numbered questions (1., 2., 3...) detected in this document.</p>';
  }

  html += '</div>';
  return html;
};
