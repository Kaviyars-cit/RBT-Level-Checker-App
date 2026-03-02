import { Question } from '@/components/QuestionDisplay';
import { stripHtmlForAI } from '@/utils/htmlUtils';

export interface ParsedQuestion {
  questionNumber: string;
  text: string;
  co: string;
  level: string;
  marks: number;
  part: 'A' | 'B' | 'C';
  isOrOption: boolean;
  orPairNumber?: number;
  hasSubdivisions?: boolean;
  subdivisionCount?: number;
  subdivisionLevels?: string[];
}

export interface ParseResult {
  partA: Question[];
  partB: Question[];
  partC?: Question[];
  metadata: {
    title: string;
    subjectCode: string;
    subjectName: string;
    date: string;
    maxMarks: string;
    time: string;
    branch: string;
    yearSem: string;
    iaType: string;
    courseObjectives?: string[];
    courseOutcomes?: { co: string; description: string; level?: string }[];
  };
  originalHtml: string;
  globalImages?: string[]; // Images not attached to specific questions (e.g. PDF pages)
  pdfPageImages?: (string | null)[]; // Rendered PDF page images as data URLs
}

// RBT Level action verbs for detection (used as fallback)
const LEVEL_VERBS: Record<string, string[]> = {
  L1: ['define', 'list', 'state', 'identify', 'name', 'recall', 'recognize', 'label', 'match', 'memorize', 'enumerate', 'mention', 'write'],
  L2: ['explain', 'describe', 'discuss', 'summarize', 'interpret', 'classify', 'compare', 'contrast', 'illustrate', 'express', 'differentiate'],
  L3: ['apply', 'demonstrate', 'calculate', 'solve', 'implement', 'use', 'execute', 'construct', 'show', 'compute', 'practice', 'derive'],
  L4: ['analyze', 'examine', 'investigate', 'categorize', 'distinguish', 'organize', 'break down', 'outline', 'elaborate'],
  L5: ['evaluate', 'justify', 'assess', 'critique', 'judge', 'defend', 'argue', 'support', 'validate', 'appraise', 'rate'],
  L6: ['design', 'create', 'develop', 'formulate', 'propose', 'plan', 'invent', 'compose', 'devise', 'build']
};

// Get level number for comparison
export const getLevelNumber = (level: string): number => {
  const match = level.match(/L(\d)/i);
  return match ? parseInt(match[1]) : 1;
};

// Compare levels and return the higher one
export const getHigherLevel = (level1: string, level2: string): string => {
  return getLevelNumber(level1) >= getLevelNumber(level2) ? level1 : level2;
};

// Detect RBT level from question text based on action verbs
export const detectLevelFromText = (text: string): string => {
  const lowerText = text.toLowerCase();

  // Check from highest to lowest level
  for (const level of ['L6', 'L5', 'L4', 'L3', 'L2', 'L1']) {
    const verbs = LEVEL_VERBS[level];
    for (const verb of verbs) {
      // Check if verb appears at the start of a word
      const regex = new RegExp(`\\b${verb}`, 'i');
      if (regex.test(lowerText)) {
        return level;
      }
    }
  }

  return 'L1'; // Default to L1 if no match
};

// Parse question number to extract base number and suffix (e.g., "11 A" -> { base: 11, suffix: "A" })
const parseQuestionNumber = (qNo: string): { base: number; suffix: string | null; isSubdivision: boolean } => {
  const cleaned = qNo.trim().replace(/\s+/g, ' ');

  // Check for subdivision (i, ii, iii, etc.)
  if (/^[ivxIVX]+\)/.test(cleaned) || /^\([ivxIVX]+\)/.test(cleaned) || /^[ivxIVX]+$/.test(cleaned.toLowerCase())) {
    return { base: 0, suffix: null, isSubdivision: true };
  }

  // Match patterns like "11 A", "11A", "11 a", "11a", "11.A", "11)A", "11. A"
  const match = cleaned.match(/^(\d+)\s*[.)]*\s*([ABab])?[.)]*$/);
  if (match) {
    return {
      base: parseInt(match[1]),
      suffix: match[2]?.toUpperCase() || null,
      isSubdivision: false
    };
  }

  // Try to extract just the number
  const numMatch = cleaned.match(/^(\d+)/);
  if (numMatch) {
    return { base: parseInt(numMatch[1]), suffix: null, isSubdivision: false };
  }

  return { base: 0, suffix: null, isSubdivision: false };
};

// Parse subdivisions from question text (i, ii, iii format)
const parseSubdivisionsFromText = (text: string): { subdivisions: string[]; hasSubdivisions: boolean } => {
  // Match patterns like "i) question" or "i. question" or "(i) question"
  const pattern = /(?:^|\s)([ivxIVX]+[\)\.]|\([ivxIVX]+\))\s*([^ivxIVX]*?)(?=(?:\s[ivxIVX]+[\)\.]|\s\([ivxIVX]+\)|$))/gi;
  const subdivisions: string[] = [];
  let match;

  // Reset lastIndex
  pattern.lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    const subdivisionText = (match[1] + ' ' + match[2]).trim();
    if (subdivisionText.length > 3) {
      subdivisions.push(subdivisionText);
    }
  }

  // Also try simpler split approach for "i) ... ii) ..." format
  if (subdivisions.length < 2) {
    const simplePattern = /([ivxIVX]+\))\s*/gi;
    const parts = text.split(simplePattern).filter(p => p.trim().length > 0);

    if (parts.length >= 3) { // At least "i)", "text1", "ii)", "text2"
      subdivisions.length = 0;
      for (let i = 0; i < parts.length - 1; i += 2) {
        if (/^[ivxIVX]+\)$/i.test(parts[i])) {
          const subText = parts[i] + ' ' + (parts[i + 1] || '').trim();
          if (subText.length > 3) {
            subdivisions.push(subText);
          }
        }
      }
    }
  }

  return {
    subdivisions,
    hasSubdivisions: subdivisions.length > 1
  };
};

// Parse subdivisions from a question row
const parseSubdivisions = (row: Element, cells: NodeListOf<Element>, questionText: string): { count: number; levels: string[]; marks: number[]; hasSubdivisions: boolean } => {
  const levels: string[] = [];
  let parsedMarks: number[] = [];

  // First check if question text has subdivisions (i, ii format)
  const textSubdivisions = parseSubdivisionsFromText(questionText);

  // Check for multiple levels in the RBT column (separated by newlines or spaces)
  const levelCell = cells[3];
  if (levelCell) {
    const levelText = levelCell.textContent || '';
    // Extract all L1-L6 patterns
    const levelMatches = levelText.match(/L\d/gi);
    if (levelMatches) {
      levels.push(...levelMatches.map(l => l.toUpperCase()));
    }
  }

  // Check for marks in the marks column
  const marksCell = cells[4];
  if (marksCell) {
    const marksText = marksCell.textContent || '';
    const marksMatches = marksText.match(/\d+/g);
    if (marksMatches) {
      parsedMarks = marksMatches.map(m => parseInt(m));
    }
  }

  // Determine subdivision count based on text content first, then levels/marks
  const subdivisionCount = textSubdivisions.hasSubdivisions
    ? textSubdivisions.subdivisions.length
    : Math.max(levels.length > 1 ? levels.length : 0, 1);

  const hasSubdivisions = textSubdivisions.hasSubdivisions || subdivisionCount > 1;

  // If we have subdivisions from text but no level info, detect levels from each subdivision
  if (hasSubdivisions && textSubdivisions.subdivisions.length > 0 && levels.length < textSubdivisions.subdivisions.length) {
    textSubdivisions.subdivisions.forEach(subText => {
      const detectedLevel = detectLevelFromText(subText);
      if (levels.length < textSubdivisions.subdivisions.length) {
        levels.push(detectedLevel);
      }
    });
  }

  return {
    count: subdivisionCount,
    levels,
    marks: parsedMarks,
    hasSubdivisions
  };
};

// Extract metadata from the document
const extractMetadata = (doc: Document, iaType: string) => {
  const getText = (selector: string): string => {
    const el = doc.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  // Try to find subject code/name
  let subjectCode = '';
  let subjectName = '';
  const codeCell = doc.querySelector('#code');
  if (codeCell) {
    const text = codeCell.textContent?.trim() || '';
    const parts = text.split('/');
    if (parts.length >= 2) {
      subjectCode = parts[0].trim();
      subjectName = parts.slice(1).join('/').trim();
    } else if (text) {
      subjectName = text;
    }
  }

  // If not found by ID, search through table cells - AGGRESSIVE pattern matching
  if (!subjectCode && !subjectName) {
    const allTables = doc.querySelectorAll('table');
    allTables.forEach(table => {
      if (subjectCode && subjectName) return; // Already found
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        if (subjectCode && subjectName) return; // Already found
        const cells = row.querySelectorAll('td, th');
        const rowText = row.textContent?.trim() || '';

        // Strategy 1: Look for "Subject Code/Name" label row
        if (/Subject.*Code|Subject.*Name/i.test(rowText)) {
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i]?.textContent?.trim() || '';

            // Check if this cell contains code and name together (e.g., "EC4212 / ELECTRONIC DEVICES" or "CS4401 / Theory of Computation")
            const combinedMatch = cellText.match(/([A-Z]{2,}[0-9]{4})\s*[/\-–]\s*([A-Za-z\s&(),\-–]+?)(?:\(|$)/);
            if (combinedMatch) {
              subjectCode = combinedMatch[1].trim();
              subjectName = combinedMatch[2].trim();
              console.log(`[Metadata] Found combined subject via regex: ${subjectCode} / ${subjectName}`);
              return;
            }

            // Extract code pattern: CSXXXX, ECXXXX, etc.
            const codeMatch = cellText.match(/([A-Z]{2,}[0-9]{4})/);
            if (codeMatch) {
              subjectCode = codeMatch[1];
              console.log(`[Metadata] Found subject code: ${subjectCode}`);

              // Try to extract name from same or adjacent cells
              // Name might be: after "/" in same cell, in next cell, or after "(" in same cell
              const nameAfterSlash = cellText.match(/[A-Z]{2,}[0-9]{4}\s*[/\-–]\s*([A-Za-z\s&(),\-–]+)/);
              if (nameAfterSlash) {
                subjectName = nameAfterSlash[1].trim().replace(/\s*\(.*/, '').trim(); // Remove any bracketed content
                console.log(`[Metadata] Found subject name after slash: ${subjectName}`);
                return;
              }

              // Name in next cell
              if (i + 1 < cells.length) {
                const nextCell = cells[i + 1]?.textContent?.trim() || '';
                if (!/Code|Name|Subject|^[0-9]$/i.test(nextCell) && nextCell.length > 3) {
                  subjectName = nextCell;
                  console.log(`[Metadata] Found subject name in next cell: ${subjectName}`);
                  return;
                }
              }
            }
          }
        }

        // Strategy 2: Scan ALL rows for code pattern (CSXXXX, ECXXXX, etc.), not just those with "Subject" label
        // This catches DOCX conversions where structure changed
        if (!subjectCode) {
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i]?.textContent?.trim() || '';

            // Find 4-letter code + 4 digits pattern
            const codeMatch = cellText.match(/([A-Z]{2,}[0-9]{4})\s*[(/\-–]?\s*([A-Za-z\s&()\-–]*)?/);
            if (codeMatch && codeMatch[1]) {
              // Verify this looks like a subject code (not just any code)
              const potentialCode = codeMatch[1];
              if (/^(CS|EC|EE|ME|CE|IT|IS|BT|CV|AM|ST|CH|SA|AP|BO|EN|AR)\d{4}/.test(potentialCode)) {
                subjectCode = potentialCode;

                // Try to extract subject name from same cell after "/"
                const withSlash = cellText.match(/[A-Z]{2,}[0-9]{4}\s*[/]\s*(.+)/);
                if (withSlash) {
                  subjectName = withSlash[1].trim().replace(/\s*\(.*/, '').trim();
                  console.log(`[Metadata] Strategy 2: Found ${subjectCode} / ${subjectName}`);
                  return;
                }

                // Or in next cell
                if (i + 1 < cells.length) {
                  const nextCell = cells[i + 1]?.textContent?.trim() || '';
                  if (nextCell.length > 3 && !/^[0-9]$|^[A-Z]{2,}[0-9]/.test(nextCell)) {
                    subjectName = nextCell;
                    console.log(`[Metadata] Strategy 2: Found ${subjectCode} and name ${subjectName} in next cell`);
                    return;
                  }
                }
              }
            }
          }
        }
      });
    });
  }

  // Try to find IA type from document
  let detectedIaType = iaType;
  const assTypeCell = doc.querySelector('#assTypeCell');
  if (assTypeCell) {
    const text = assTypeCell.textContent?.toLowerCase() || '';
    if (text.includes('iii') || text.includes('3') || text.includes('model')) {
      detectedIaType = 'IA3';
    } else if (text.includes('ii') || text.includes('2')) {
      detectedIaType = 'IA2';
    } else if (text.includes('i') || text.includes('1')) {
      detectedIaType = 'IA1';
    }
  }

  // Fallback: search full document text for metadata
  const bodyText = doc.body?.textContent || '';

  let date = '';
  const dateMatch = bodyText.match(/Date[:\s]+([\d./-]+)/i);
  if (dateMatch) date = dateMatch[1].trim();

  let maxMarks = iaType === 'IA3' ? '100 Marks' : '50 Marks';
  const marksMatch = bodyText.match(/Max\.?\s*Marks[:\s]+(\d+(?:\s*Marks)?)/i);
  if (marksMatch) maxMarks = marksMatch[1].trim();

  let time = iaType === 'IA3' ? '3 hrs' : '1.30 hrs';
  const timeMatch = bodyText.match(/Time[:\s]+([\d.:]+\s*(?:hours?|hrs?)?)/i);
  if (timeMatch) time = timeMatch[1].trim();

  // Additional fallback: Extract from body text if not found via tables
  let branch = '';
  const branchMatch = bodyText.match(/Branch[:\s]+([A-Za-z0-9\s/&,]+?)(?:\n|$|Date|Subject|Year)/i);
  if (branchMatch) branch = branchMatch[1].trim();

  let yearSem = '';
  const yearSemMatch = bodyText.match(/Year\s*(?:\/\s*)?Sem(?:ester)?[:\s]+([A-Za-z0-9\s/,-]+?)(?:\n|$|Date|Subject|Branch)/i);
  if (yearSemMatch) yearSem = yearSemMatch[1].trim();

  // Extract Course Objectives & Course Outcomes from document
  const courseObjectives: string[] = [];
  const courseOutcomes: { co: string; description: string; level?: string }[] = [];

  console.log('--- CO Extraction Debug ---');
  console.log('Body text (first 500 chars):', bodyText.substring(0, 500));

  // Method 1: Scan ALL table rows for CO-related content
  const allTables = doc.querySelectorAll('table');
  let inCourseObjectivesSection = false;
  let inCourseOutcomesSection = false;

  allTables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const rowText = row.textContent?.trim() || '';

      // Detect section headers - be more specific to avoid confusion if both terms appear
      if (/course\s+objective/i.test(rowText) && !/course\s+outcome/i.test(rowText)) {
        inCourseObjectivesSection = true;
        inCourseOutcomesSection = false;
        return;
      }
      if (/course\s+outcome/i.test(rowText)) {
        // If it looks like a header row (e.g. has CO.NO), don't switch to Objectives even if "Course Objective" is mentioned
        inCourseOutcomesSection = true;
        inCourseObjectivesSection = false;
        return;
      }
      // Stop at Part A/B/C headers or question tables
      if (/^PART\s*[-–]?\s*[ABC]/i.test(rowText) || /Q\.?\s*No/i.test(rowText)) {
        inCourseObjectivesSection = false;
        inCourseOutcomesSection = false;
        return;
      }

      if (cells.length >= 1) {
        const firstCellText = cells[0]?.textContent?.trim() || '';

        // Check for CO identifier in first cell: "CO1", "CO 1", "CO.1" etc.
        const coIdMatch = firstCellText.match(/^CO\s*\.?\s*(\d+)$/i);

        if (coIdMatch && cells.length >= 2) {
          const desc = cells[1]?.textContent?.trim() || '';
          if (desc.length > 3) {
            const coKey = `CO${coIdMatch[1]}`;
            // Extract RBT level from 3rd cell if present
            const levelCell = cells.length >= 3 ? cells[2]?.textContent?.trim() || '' : '';
            const levelMatch = levelCell.match(/L[1-6]/i);
            const level = levelMatch ? levelMatch[0].toUpperCase() : '';
            const existing = courseOutcomes.find(c => c.co === coKey);
            if (!existing) {
              courseOutcomes.push({ co: coKey, description: desc, level });
            } else {
              // Priority: if existing has no level and new one does, or new description is longer
              if (!existing.level && level) existing.level = level;
              if (desc.length > existing.description.length && !existing.description.includes(desc)) {
                // If it's a subdivision-like merge, append. Otherwise, if much longer, replace.
                if (desc.length > existing.description.length * 1.5) {
                  existing.description = desc;
                }
              }
            }
          }
        }

        // If we're in a Course Objectives section, grab content
        if (inCourseObjectivesSection && rowText.length > 5) {
          // Skip if it's just a number
          if (!/^\d+$/.test(rowText)) {
            // Get the description from the cell with most text
            let longestText = '';
            cells.forEach(cell => {
              const t = cell?.textContent?.trim() || '';
              if (t.length > longestText.length) longestText = t;
            });
            if (longestText.length > 5 && !courseObjectives.includes(longestText)) {
              courseObjectives.push(longestText);
            }
          }
        }

        // If we're in a Course Outcomes section, try to extract CO + description
        if (inCourseOutcomesSection && !coIdMatch && cells.length >= 2) {
          // Try numbered format: "1" | "description"
          const numMatch = firstCellText.match(/^(\d+)$/);
          if (numMatch) {
            const desc = cells[1]?.textContent?.trim() || '';
            if (desc.length > 5) {
              const coKey = `CO${numMatch[1]}`;
              // Extract RBT level from 3rd cell if present
              const levelCell = cells.length >= 3 ? cells[2]?.textContent?.trim() || '' : '';
              const levelMatch = levelCell.match(/L[1-6]/i);
              const level = levelMatch ? levelMatch[0].toUpperCase() : '';
              const existing = courseOutcomes.find(c => c.co === coKey);
              if (!existing) {
                courseOutcomes.push({ co: coKey, description: desc, level });
              } else {
                if (!existing.level && level) existing.level = level;
                if (desc.length > existing.description.length * 1.5) existing.description = desc;
              }
            }
          }
        }
      }
    });
  });

  console.log('After table scan - Objectives:', courseObjectives.length, 'Outcomes:', courseOutcomes.length);

  // Method 2: Regex search in body text for "CO1: description" or "CO1 – description" patterns
  if (courseOutcomes.length === 0) {
    const coRegex = /CO\s*\.?\s*(\d+)\s*[:\-–.]\s*(.+?)(?=CO\s*\.?\s*\d+\s*[:\-–.]|\n\n|PART|$)/gi;
    const coSectionMatch = bodyText.match(/(?:Course\s+Outcome|CO\s*Statements?|On\s+course\s+completion)[:\s]*([\s\S]*?)(?=PART|Q\.?\s*No|$)/i);
    const coSearchText = coSectionMatch ? coSectionMatch[1] : bodyText;

    let coMatch;
    while ((coMatch = coRegex.exec(coSearchText)) !== null) {
      const coNum = coMatch[1];
      let desc = coMatch[2].trim().replace(/\s+/g, ' ').trim();
      if (desc.length > 5) {
        const coKey = `CO${coNum}`;
        if (!courseOutcomes.find(c => c.co === coKey)) {
          courseOutcomes.push({ co: coKey, description: desc });
        }
      }
    }
  }

  // Method 3: Extract Course Objectives from text if not found in tables
  if (courseObjectives.length === 0) {
    const objSectionMatch = bodyText.match(/Course\s+Objective[s]?\s*[:\-–]?\s*([\s\S]*?)(?=Course\s+Outcome|PART|Q\.?\s*No|$)/i);
    if (objSectionMatch) {
      const objText = objSectionMatch[1].trim();
      // Split by numbered patterns or newlines
      const objItems = objText.split(/(?:\d+[.)]\s*|\n(?=[A-Z]))/);
      objItems.forEach(item => {
        const cleaned = item.trim().replace(/\s+/g, ' ');
        if (cleaned.length > 10 && !courseObjectives.includes(cleaned)) {
          courseObjectives.push(cleaned);
        }
      });
    }
  }

  // Method 4: Try hidden courseOutcomes div (from PDF parser)
  if (courseOutcomes.length === 0) {
    const coDiv = doc.querySelector('#courseOutcomes');
    if (coDiv) {
      try {
        const parsed = JSON.parse(coDiv.textContent || '[]');
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.co && item.description) {
              courseOutcomes.push({ co: item.co, description: item.description });
            }
          });
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  // Method 5: Try hidden courseObjectives div (from PDF parser)
  if (courseObjectives.length === 0) {
    const objDiv = doc.querySelector('#courseObjectives');
    if (objDiv) {
      try {
        const parsed = JSON.parse(objDiv.textContent || '[]');
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (typeof item === 'string' && item.length > 5) {
              courseObjectives.push(item);
            }
          });
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  console.log('Final CO extraction:', { courseObjectives, courseOutcomes });

  // Extract Branch and Year/Sem with better fallback
  let branchFromId = getText('#branchCell');
  let yearSemFromId = getText('#yearSemesterCell');

  // Use values from ID if available, otherwise use fallback
  if (!branch && branchFromId) branch = branchFromId;
  if (!yearSem && yearSemFromId) yearSem = yearSemFromId;

  // If still not found, search through table cells
  if (!branch || !yearSem) {
    const allTables = doc.querySelectorAll('table');
    allTables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        const rowText = row.textContent?.trim() || '';

        // Look for branch info
        if (!branch && /Branch/i.test(rowText)) {
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i]?.textContent?.trim() || '';
            if (/Branch/i.test(cellText)) {
              // Branch value might be in the next cell or same cell after "Branch:"
              if (i + 1 < cells.length) {
                const nextCell = cells[i + 1]?.textContent?.trim() || '';
                if (nextCell && !/Branch/i.test(nextCell)) {
                  branch = nextCell;
                  break;
                }
              }
              // Or extract from same cell after "Branch:"
              const branchMatch = cellText.match(/Branch[:\s]+([^,\n]+)/i);
              if (branchMatch && !branch) {
                branch = branchMatch[1].trim();
              }
            }
          }
        }

        // Look for year/semester info
        if (!yearSem && /Year|Sem/i.test(rowText)) {
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i]?.textContent?.trim() || '';
            if (/Year|Sem/i.test(cellText)) {
              // Year/Sem value might be in the next cell or same cell after "Year/Sem:"
              if (i + 1 < cells.length) {
                const nextCell = cells[i + 1]?.textContent?.trim() || '';
                if (nextCell && !/Year|Sem/i.test(nextCell) && nextCell.length > 0) {
                  yearSem = nextCell;
                  break;
                }
              }
              // Or extract from same cell after "Year/Sem:"
              const yearSemMatch = cellText.match(/Year\s*(?:\/\s*)?Sem(?:ester)?[:\s]+([^,\n]+)/i);
              if (yearSemMatch && !yearSem) {
                yearSem = yearSemMatch[1].trim();
              }
            }
          }
        }
      });
    });
  }

  return {
    title: 'CHENNAI INSTITUTE OF TECHNOLOGY',
    subjectCode,
    subjectName,
    date,
    maxMarks,
    time,
    branch: branch || '',
    yearSem: yearSem || '',
    iaType: detectedIaType,
    courseObjectives: courseObjectives.length > 0 ? courseObjectives : undefined,
    courseOutcomes: courseOutcomes.length > 0 ? courseOutcomes : undefined
  };
};

// Parse questions from a table
const parseTableQuestions = (table: Element, part: 'A' | 'B' | 'C', iaType: string): Question[] => {
  const questions: Question[] = [];
  const rows = table.querySelectorAll('tr');

  let questionIndex = 0;
  const orPairs: Map<number, { questions: Question[]; hasSubdivisions: boolean[]; subdivisionLevels: string[][] }> = new Map();

  let lastQuestion: Question | null = null;

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');

    // Check if this is an OR separator row FIRST (before cell count check)
    // OR rows use colspan=5 so they appear as 1 cell - must check text before counting
    const rowText = row.textContent?.trim().toUpperCase();
    if (rowText === 'OR') {
      lastQuestion = null; // Reset last question on OR boundary
      return;
    }

    if (cells.length < 3) return; // Skip header rows, page-image rows, and other single-cell rows

    // Check if first cell has colspan spanning full table width (header-like)
    const firstCell = cells[0];
    const colspan = parseInt(firstCell.getAttribute('colspan') || '1');
    if (colspan >= 3) return; // Only skip full-width header rows, not partial merges

    // Extract question number
    const qNoText = cells[0]?.textContent?.trim() || '';
    const { base, suffix, isSubdivision } = parseQuestionNumber(qNoText);

    // If it's a subdivision or empty qNo, and we have a lastQuestion, merge it
    if ((isSubdivision || qNoText === '') && lastQuestion) {
      if (lastQuestion.questionNumber.startsWith('13')) {
        console.log(`[Parser] Merging subdivision row into Q${lastQuestion.questionNumber}. Text: ${cells[1]?.textContent?.substring(0, 30)}...`);
      }
      const additionalText = cells[1]?.textContent?.trim() || '';
      if (additionalText) {
        lastQuestion.text += ' ' + additionalText.replace(/\s+/g, ' ').trim();
      }

      const additionalHtml = cells[1]?.innerHTML?.trim() || '';
      if (additionalHtml) {
        if (lastQuestion.questionNumber.startsWith('13') && additionalHtml.includes('<img')) {
          console.log(`[Parser] Found image in Q13 subdivision row!`);
        }
        lastQuestion.originalHtml = (lastQuestion.originalHtml || '') + '<br>' + additionalHtml.replace(/\s+/g, ' ').trim();

        // Extract any images from this subdivision row and log them
        const subdImages = additionalHtml.match(/<img[^>]*>/gi);
        if (subdImages && lastQuestion.questionNumber.startsWith('13')) {
          console.log(`[Parser] Q${lastQuestion.questionNumber}: Found ${subdImages.length} images in subdivision row`);
        }
      }

      // Check for marks in this row too
      const marksText = cells[4]?.textContent?.trim();
      if (marksText) {
        const marksMatches = marksText.match(/\d+/g);
        if (marksMatches) {
          const additionalMarks = marksMatches.reduce((sum, m) => sum + (parseInt(m) || 0), 0);
          lastQuestion.marks += additionalMarks;
        }
      }
      return;
    }

    // Skip if base is 0 and not a merged row (unlikely but safe)
    if (base === 0 && qNoText !== '') return;

    // Extract question text (plain text for display/validation)
    let questionText = cells[1]?.textContent?.trim() || '';
    // Clean up the text - remove extra whitespace and line breaks
    questionText = questionText.replace(/\s+/g, ' ').trim();

    // Also get innerHTML to preserve images for display and Word document generation
    let questionHtml = cells[1]?.innerHTML?.trim() || '';

    // Skip if question text is too short or looks like a header
    if (questionText.length < 5 && qNoText === '') return;
    if (/^(part\s+[abc]|q\.no|question|answer|marks|co\.?no|rbt|course)/i.test(questionText)) return;

    // Check if HTML contains images or mathematical content - store original HTML separately
    // Enhanced detection for various image and content types
    const hasImages = /<img[^>]+(src|data-src)\s*=/i.test(questionHtml);
    const hasMath = /<math[^>]*>|<script[^>]*math/i.test(questionHtml) || /\$\$[\s\S]*?\$\$|\$[^$]+\$/.test(questionHtml);
    const hasSVG = /<svg[^>]*>|data:image\/svg\+xml/i.test(questionHtml);
    const hasComplexContent = /<(table|figure|canvas|iframe)[^>]*>/i.test(questionHtml);

    // ALWAYS store originalHtml to preserve any images/formatting for document generation
    // This is critical: even if we don't detect images NOW, they may be present in the raw HTML
    // from DOCX/PDF conversion, or be attached later via reattachImages
    // ENHANCEMENT: Also capture images from deeply nested elements (e.g., in table cells within the question cell)
    let originalHtml: string = questionHtml.replace(/\s+/g, ' ').trim();

    // Log for debugging Q13x questions
    if (qNoText?.startsWith('13')) {
      console.log(`[Parser] Q${qNoText}: hasImages=${hasImages}, hasMath=${hasMath}, hasSVG=${hasSVG}, htmlLength=${questionHtml.length}`);
      if (hasImages) {
        const imgMatches = questionHtml.match(/<img[^>]*>/gi);
        console.log(`[Parser] Q${qNoText}: Found ${imgMatches?.length || 0} img tags in HTML`);
      }
    }

    // Parse subdivisions - pass question text for better detection
    const subdivisions = parseSubdivisions(row, cells, questionText);
    const hasSubdivisions = subdivisions.hasSubdivisions;

    // Extract CO - may have multiple COs for subdivisions, take the first one
    let co = cells[2]?.textContent?.trim() || '';
    co = co.split('\n')[0].trim();
    co = co.replace(/\s+/g, '');
    let coAutoAssigned = false;
    if (!co.match(/^CO\d$/i)) {
      // Try to extract CO from the text
      const coMatch = co.match(/CO\s*(\d)/i);
      co = coMatch ? `CO${coMatch[1]}` : 'CO1';
      if (!coMatch) coAutoAssigned = true;
    }

    // Extract RBT Level from column - may have multiple levels for subdivisions
    let level = cells[3]?.textContent?.trim() || '';
    level = level.split('\n')[0].trim();
    level = level.replace(/\s+/g, '');
    let levelAutoDetected = false;
    // Handle ranges like "L1-L3" - take the highest
    if (level.includes('-')) {
      const parts = level.split('-');
      level = parts[parts.length - 1].trim();
    }
    if (!level.match(/^L\d$/i)) {
      // Fallback to detection from text
      level = detectLevelFromText(questionText);
      levelAutoDetected = true;
    }
    level = level.toUpperCase();

    // For questions with multiple subdivision levels, use the highest level
    if (subdivisions.levels.length > 1) {
      let highestLevel = subdivisions.levels[0];
      for (const subLevel of subdivisions.levels) {
        if (getLevelNumber(subLevel) > getLevelNumber(highestLevel)) {
          highestLevel = subLevel;
        }
      }
      level = highestLevel;
    }

    // Extract marks - may have multiple marks for subdivisions, sum them
    let marksText = cells[4]?.textContent?.trim() || '2';
    // Try to extract all numbers from marks cell
    const allMarksMatches = marksText.match(/\d+/g);
    let marks = 2;

    if (allMarksMatches && allMarksMatches.length > 0) {
      // Sum all mark values if there are multiple (e.g., "8\n8" = 16)
      const marksValues = allMarksMatches.map(m => parseInt(m) || 0);
      marks = marksValues.reduce((sum, m) => sum + m, 0) || parseInt(marksText) || 2;
    } else {
      marks = parseInt(marksText) || 2;
    }

    questionIndex++;
    const questionId = `${part.toLowerCase()}-${questionIndex}`;

    const question: Question = {
      id: questionId,
      questionNumber: qNoText,
      text: questionText,
      marks,
      detectedLevel: level,
      expectedLevel: level,
      co,
      hasError: false,
      isFixed: false,
      isFixing: false,
      hasSubdivisions,
      subdivisionCount: subdivisions.count,
      subdivisionLevels: subdivisions.levels,
      levelAutoDetected,
      originalHtml, // Preserve original HTML with images
    };

    // Track OR pairs for Part B and C
    if ((part === 'B' || part === 'C') && suffix) {
      if (!orPairs.has(base)) {
        orPairs.set(base, { questions: [], hasSubdivisions: [], subdivisionLevels: [] });
      }
      const pairData = orPairs.get(base)!;
      pairData.questions.push(question);
      pairData.hasSubdivisions.push(hasSubdivisions);
      pairData.subdivisionLevels.push(subdivisions.levels);
    }

    questions.push(question);
    lastQuestion = question;
  });

  // Handle OR pair level matching and subdivision structure matching
  orPairs.forEach((pairData, baseNum) => {
    const { questions: pair, hasSubdivisions } = pairData;

    if (pair.length === 2) {
      const [q1, q2] = pair;
      const q1HasSubs = hasSubdivisions[0];
      const q2HasSubs = hasSubdivisions[1];

      // Check subdivision structure mismatch
      if (q1HasSubs !== q2HasSubs) {
        // One has subdivisions, one doesn't - CONVERT subdivisions TO single question
        const questionWithSubs = q1HasSubs ? q1 : q2;
        const questionWithoutSubs = q1HasSubs ? q2 : q1;

        // Mark the question WITH subdivisions as needing to be converted to single question
        // to match the single question format of its OR pair
        questionWithSubs.hasError = true;
        questionWithSubs.errorMessage = `OR pair ${baseNum}: Structure mismatch. Convert to single ${questionWithoutSubs.detectedLevel} question to match OR pair.`;
        questionWithSubs.expectedLevel = questionWithoutSubs.detectedLevel;
        questionWithSubs.expectedCo = questionWithoutSubs.co; // Track expected CO for conversion

        // Also check if the single question has correct level for its marks
        const singleQMarks = questionWithoutSubs.marks;
        if (singleQMarks === 16 && !['L4', 'L5', 'L6'].includes(questionWithoutSubs.detectedLevel)) {
          questionWithoutSubs.hasError = true;
          questionWithoutSubs.expectedLevel = 'L4';
          questionWithoutSubs.errorMessage = `16-mark questions must be L4/L5/L6 only. Found ${questionWithoutSubs.detectedLevel}.`;
          // Update the subdivisions question target level to match
          questionWithSubs.expectedLevel = 'L4';
          questionWithSubs.expectedCo = questionWithoutSubs.co;
          questionWithSubs.errorMessage = `OR pair ${baseNum}: Structure mismatch. Convert to single L4 question to match OR pair.`;
        }
      } else {
        // Both have same structure - check level mismatch
        const level1 = getLevelNumber(q1.detectedLevel);
        const level2 = getLevelNumber(q2.detectedLevel);

        if (level1 !== level2 && !q1.hasError && !q2.hasError) {
          const higherLevel = level1 > level2 ? q1.detectedLevel : q2.detectedLevel;
          const lowerQuestion = level1 < level2 ? q1 : q2;

          // Mark the lower level question as needing a fix to match the higher level
          lowerQuestion.expectedLevel = higherLevel;
          lowerQuestion.hasError = true;
          lowerQuestion.errorMessage = `OR pair ${baseNum}: Level mismatch. Change to ${higherLevel} to match OR pair.`;
        }
      }
    }
  });

  return questions;
};

// Parse HTML table-based question paper
export const parseHTMLQuestions = (htmlContent: string, iaType: 'IA1' | 'IA2' | 'IA3'): ParseResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const partA: Question[] = [];
  const partB: Question[] = [];
  const partC: Question[] = [];

  // Extract metadata
  const metadata = extractMetadata(doc, iaType);

  // Find tables for Part A, B, C by ID
  const partATable = doc.querySelector('#parta, table#parta');
  const partBTable = doc.querySelector('#partb, table#partb');
  const partCTable = doc.querySelector('#partc, table#partc');

  // Track which tables have been processed to avoid double-counting
  const processedTables = new Set<Element>();

  // Parse Part A
  if (partATable) {
    const questions = parseTableQuestions(partATable, 'A', iaType);
    partA.push(...questions);
    processedTables.add(partATable);
  }

  // Parse Part B
  if (partBTable) {
    const questions = parseTableQuestions(partBTable, 'B', iaType);
    partB.push(...questions);
    processedTables.add(partBTable);
  }

  // Parse Part C (IA2 and IA3)
  if (partCTable && (iaType === 'IA2' || iaType === 'IA3')) {
    const questions = parseTableQuestions(partCTable, 'C', iaType);
    partC.push(...questions);
    processedTables.add(partCTable);
  }

  // Helper function to check if a table is likely a question table
  const isValidQuestionTable = (table: Element): boolean => {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 1) return false;

    // Check ALL rows for anti-patterns and positive signals (not just first row)
    // This handles continuation tables from page breaks where the first row may be an OR separator
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const rowText = rows[r].textContent?.toLowerCase() || '';

      // anti-patterns: tables we definitely don't want
      if (rowText.includes('course outcome') ||
        rowText.includes('program outcome') ||
        rowText.includes('bloom') ||
        rowText.includes('k-level') ||
        rowText.includes('knowledge level') ||
        rowText.includes('mapping')) {
        return false;
      }

      // positive signals: tables we do want
      if (rowText.includes('q.no') ||
        rowText.includes('q. no') ||
        rowText.includes('question') ||
        rowText.includes('s.no') ||
        rowText.includes('s. no')) {
        return true;
      }
    }

    // Fallback: Check ANY row (up to first 5) for column count >= 3
    // This is critical for continuation tables that start with OR rows (single cell with colspan)
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const cells = rows[r].querySelectorAll('th, td');
      if (cells.length >= 3) {
        // Also check the first cell for question-number patterns to increase confidence
        const firstCellText = cells[0]?.textContent?.trim() || '';
        if (/^\d+\s*[ABab]?$/.test(firstCellText)) {
          console.log(`[Parser] Continuation table detected via question number Q${firstCellText} in row ${r}`);
          return true;
        }
        // Still accept if it has enough columns even without question number pattern
        return true;
      }
    }

    // Special case: table with only OR rows and 1-2 data rows
    // Check if any row is an OR separator - if so, this is likely a continuation table
    for (let r = 0; r < rows.length; r++) {
      const rowText = rows[r].textContent?.trim().toUpperCase();
      if (rowText === 'OR') {
        console.log(`[Parser] Table has OR separator row, likely a continuation table`);
        return rows.length >= 2; // Need at least OR + 1 data row
      }
    }

    return false;
  };

  // Helper: check if questions are duplicates of already-parsed questions
  const getExistingQNumbers = (questions: Question[]): Set<string> => {
    return new Set(questions.map(q => q.questionNumber.trim().toLowerCase()));
  };

  const filterDuplicates = (newQuestions: Question[], existing: Question[]): Question[] => {
    const existingNums = getExistingQNumbers(existing);
    return newQuestions.filter(q => !existingNums.has(q.questionNumber.trim().toLowerCase()));
  };

  // Helper: determine which part a question belongs to based on its number
  const determinePartForQuestion = (qNum: number, iaType: string): 'A' | 'B' | 'C' => {
    if (qNum <= 10) return 'A';
    if ((iaType === 'IA2' || iaType === 'IA3') && qNum >= 16) return 'C';
    return 'B';
  };

  // ================================================================
  // ALWAYS scan ALL tables to find continuation tables from page splits
  // Documents (especially DOCX) often split one logical table across
  // multiple HTML tables when there's a page break.
  // ================================================================
  const allTables = doc.querySelectorAll('table');

  console.log(`[Parser] Total tables in document: ${allTables.length}, already processed: ${processedTables.size}`);
  // Log details about each table for debugging
  allTables.forEach((table, idx) => {
    const rows = table.querySelectorAll('tr');
    const firstRowText = rows[0]?.textContent?.trim().substring(0, 80) || '(empty)';
    const firstRowCells = rows[0]?.querySelectorAll('td, th').length || 0;
    const isProcessed = processedTables.has(table);
    const isValid = !isProcessed && isValidQuestionTable(table);
    console.log(`[Parser] Table ${idx}: ${rows.length} rows, first row cells: ${firstRowCells}, text: "${firstRowText}", processed: ${isProcessed}, valid: ${isValid}`);
  });

  // First pass: High confidence - matches "Part A/B/C" headers nearby
  allTables.forEach((table) => {
    if (processedTables.has(table)) return;
    if (!isValidQuestionTable(table)) return;

    let partFound: 'A' | 'B' | 'C' | null = null;

    // Search PRECEDING siblings backwards for explicit Part Header
    let prev = table.previousElementSibling;
    let distance = 0;
    while (prev && distance < 10 && prev.tagName !== 'TABLE') {
      const text = prev.textContent?.toLowerCase() || '';
      if (/part\s*[-–—]?\s*a/i.test(text)) { partFound = 'A'; break; }
      if (/part\s*[-–—]?\s*b/i.test(text)) { partFound = 'B'; break; }
      if (/part\s*[-–—]?\s*c/i.test(text)) { partFound = 'C'; break; }
      prev = prev.previousElementSibling;
      distance++;
    }

    // If not found above, check inside first row specifically
    if (!partFound) {
      const firstRowText = table.querySelector('tr')?.textContent?.toLowerCase() || '';
      if (/part\s*[-–—]?\s*a/i.test(firstRowText)) partFound = 'A';
      else if (/part\s*[-–—]?\s*b/i.test(firstRowText)) partFound = 'B';
      else if (/part\s*[-–—]?\s*c/i.test(firstRowText)) partFound = 'C';
    }

    if (partFound) {
      const questions = parseTableQuestions(table, partFound, iaType);
      if (questions.length > 0) {
        if (partFound === 'A') {
          const unique = filterDuplicates(questions, partA);
          if (unique.length > 0) { partA.push(...unique); console.log(`[Parser] Added ${unique.length} Part A questions from header-matched table`); }
        } else if (partFound === 'B') {
          const unique = filterDuplicates(questions, partB);
          if (unique.length > 0) { partB.push(...unique); console.log(`[Parser] Added ${unique.length} Part B questions from header-matched table`); }
        } else if (partFound === 'C') {
          const unique = filterDuplicates(questions, partC);
          if (unique.length > 0) { partC.push(...unique); console.log(`[Parser] Added ${unique.length} Part C questions from header-matched table`); }
        }
        processedTables.add(table);
      }
    }
  });

  // Second pass: Use question numbers to assign unmatched tables
  // This catches continuation tables from page splits that don't have Part headers
  allTables.forEach(table => {
    if (processedTables.has(table)) return;
    if (!isValidQuestionTable(table)) return;

    // Check for at least one data row with enough cells (not just OR separator rows)
    const rows = table.querySelectorAll('tr');
    let hasDataRow = false;
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const rowText = rows[r].textContent?.trim().toUpperCase();
      if (rowText === 'OR') continue; // Skip OR separator rows
      if (rows[r].querySelectorAll('td, th').length >= 3) {
        hasDataRow = true;
        break;
      }
    }
    if (!hasDataRow) return;

    // Parse questions temporarily
    const potentialQuestions = parseTableQuestions(table, 'B', iaType);

    if (potentialQuestions.length > 0) {
      // Determine part based on question numbers
      const firstQText = potentialQuestions[0].questionNumber;
      const firstQNum = parseInt(firstQText);

      if (!isNaN(firstQNum)) {
        const targetPart = determinePartForQuestion(firstQNum, iaType);
        console.log(`[Parser] Unmatched table has Q${firstQNum} → assigning to Part ${targetPart} (${potentialQuestions.length} questions)`);

        if (targetPart === 'A') {
          // Re-parse with correct part designation
          const questions = parseTableQuestions(table, 'A', iaType);
          const unique = filterDuplicates(questions, partA);
          if (unique.length > 0) partA.push(...unique);
        } else if (targetPart === 'C' && (iaType === 'IA2' || iaType === 'IA3')) {
          const questions = parseTableQuestions(table, 'C', iaType);
          const unique = filterDuplicates(questions, partC);
          if (unique.length > 0) partC.push(...unique);
        } else {
          // Part B — already parsed as 'B'
          const unique = filterDuplicates(potentialQuestions, partB);
          if (unique.length > 0) partB.push(...unique);
        }
        processedTables.add(table);
      }
    }
  });

  // Collect images that are attached to questions to avoid duplication
  const attachedImageSrcs = new Set<string>();
  const collectImages = (questions: Question[]) => {
    questions.forEach(q => {
      if (q.originalHtml) {
        const matches = q.originalHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
        if (matches) {
          // simpler regex to just extract src attributes for checking
          const srcMatches = q.originalHtml.match(/src=["']([^"']+)["']/gi);
          srcMatches?.forEach(srcAttr => {
            const src = srcAttr.match(/src=["']([^"']+)["']/i)?.[1];
            if (src) attachedImageSrcs.add(src);
          });
        }
      }
    });
  };

  collectImages(partA);
  collectImages(partB);
  if (partC) collectImages(partC);

  // Find global images (outside processed tables)
  const globalImages: string[] = [];
  const allImages = doc.querySelectorAll('img');
  allImages.forEach(img => {
    const src = img.getAttribute('src');
    if (src && !attachedImageSrcs.has(src)) {
      globalImages.push(img.outerHTML);
    }
  });

  console.log(`[Parser] Final question counts — Part A: ${partA.length}, Part B: ${partB.length}, Part C: ${partC.length}`);

  return {
    partA,
    partB,
    partC: (iaType === 'IA2' || iaType === 'IA3') ? partC : undefined,
    metadata,
    originalHtml: htmlContent,
    globalImages: globalImages.length > 0 ? globalImages : undefined
  };
};

// Generate corrected HTML preserving original format
export const generateCorrectedHTML = (
  parseResult: ParseResult,
  iaType: 'IA1' | 'IA2' | 'IA3',
  _originalTitle?: string
): string => {
  let html = parseResult.originalHtml;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Add font-family styling to ensure consistent Inter font
  const styleElement = doc.createElement('style');
  styleElement.textContent = `
    * {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif !important;
    }
    body, table, td, th, p, span, div, h1, h2, h3, h4, h5, h6 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif !important;
    }
  `;
  const head = doc.head || doc.querySelector('head');
  if (head) {
    head.appendChild(styleElement);
  } else {
    // Create head if it doesn't exist
    const newHead = doc.createElement('head');
    newHead.appendChild(styleElement);
    doc.documentElement.insertBefore(newHead, doc.body);
  }

  // Update questions in the document
  const updateQuestionsInTable = (table: Element, questions: Question[]) => {
    const rows = table.querySelectorAll('tr');
    let questionIndex = 0;

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      const rowText = row.textContent?.trim().toUpperCase();
      if (rowText === 'OR') return;

      const qNoText = cells[0]?.textContent?.trim() || '';
      const { base, isSubdivision } = parseQuestionNumber(qNoText);

      if (isSubdivision || base === 0) {
        // Hide merged sub-rows in the preview to avoid duplication
        (row as HTMLElement).style.display = 'none';
        return;
      }

      if (questionIndex < questions.length) {
        const question = questions[questionIndex];

        // Update question text if it was fixed
        if (question.isFixed && cells[1]) {
          // Preserve existing images in the cell
          const existingImages = cells[1].querySelectorAll('img');
          const imageHtmlParts: string[] = [];
          existingImages.forEach(img => {
            imageHtmlParts.push(img.outerHTML);
          });

          // Set the new text + preserved images
          const newTextHtml = question.text.replace(/<img[^>]+>/gi, ''); // Strip any images from text to avoid duplication
          cells[1].innerHTML = newTextHtml + (imageHtmlParts.length > 0 ? '<br>' + imageHtmlParts.join('<br>') : '') + '<br>';
        }

        // Update RBT level — always use detectedLevel (updated after fixes/distribution)
        if (cells[3]) {
          cells[3].textContent = question.detectedLevel;
        }

        questionIndex++;
      }
    });
  };

  // Update Part A
  const partATable = doc.querySelector('#parta, table#parta');
  if (partATable && parseResult.partA.length > 0) {
    updateQuestionsInTable(partATable, parseResult.partA);
  }

  // Update Part B
  const partBTable = doc.querySelector('#partb, table#partb');
  if (partBTable && parseResult.partB.length > 0) {
    updateQuestionsInTable(partBTable, parseResult.partB);
  }

  // Update Part C
  if ((iaType === 'IA2' || iaType === 'IA3') && parseResult.partC) {
    const partCTable = doc.querySelector('#partc, table#partc');
    if (partCTable && parseResult.partC.length > 0) {
      updateQuestionsInTable(partCTable, parseResult.partC);
    }
  }

  // If no tables with IDs, try to find tables by content
  if (!partATable && !partBTable) {
    const allTables = doc.querySelectorAll('table');

    allTables.forEach((table) => {
      const headerText = table.textContent?.toLowerCase() || '';

      if (headerText.includes('part a') || headerText.includes('part-a')) {
        updateQuestionsInTable(table, parseResult.partA);
      } else if (headerText.includes('part b') || headerText.includes('part-b')) {
        updateQuestionsInTable(table, parseResult.partB);
      } else if (headerText.includes('part c') || headerText.includes('part-c')) {
        if (parseResult.partC) {
          updateQuestionsInTable(table, parseResult.partC);
        }
      }
    });
  }

  // If Part C table wasn't found by ID, search by content even if Part A/B were found by ID
  if ((iaType === 'IA2' || iaType === 'IA3') && parseResult.partC && parseResult.partC.length > 0 && !doc.querySelector('#partc, table#partc')) {
    const allTables = doc.querySelectorAll('table');
    allTables.forEach((table) => {
      const headerText = table.textContent?.toLowerCase() || '';
      if (headerText.includes('part c') || headerText.includes('part-c')) {
        updateQuestionsInTable(table, parseResult.partC!);
      }
    });
  }

  // Clean up any <style> blocks from Word that might have fixed widths
  const styleBlocks = doc.querySelectorAll('style');
  styleBlocks.forEach(style => {
    let css = style.textContent || '';
    // Remove width properties like "width: 612pt" or "width: 100%" if they are fixed
    css = css.replace(/width\s*:\s*[\d.]+(pt|px|in|cm|mm|pc)\s*!?;?/gi, 'width: auto !important;');
    css = css.replace(/margin\s*:\s*[\d.]+(pt|px|in|cm|mm|pc)\s*!?;?/gi, 'margin: 0 !important;');
    css = css.replace(/margin-(left|right)\s*:\s*[\d.]+(pt|px|in|cm|mm|pc)\s*!?;?/gi, 'margin-$1: 0 !important;');
    style.textContent = css;
  });

  // Strip inline width/margin styles from all container elements to prevent
  // fixed-width constraints from Word/DOCX conversion (e.g. width: 612pt)
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    const style = (el as HTMLElement).style;
    if (style) {
      style.removeProperty('width');
      style.removeProperty('max-width');
      style.removeProperty('margin');
      style.removeProperty('margin-left');
      style.removeProperty('margin-right');
    }
  });

  // Get the updated HTML - return just body content with styles (no document wrapper)
  const styles = doc.querySelectorAll('style');
  let styleHtml = '';
  styles.forEach(s => { styleHtml += s.outerHTML; });
  return styleHtml + (doc.body?.innerHTML || doc.documentElement.innerHTML);
};
