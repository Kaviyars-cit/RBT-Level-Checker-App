/**
 * Document Validator
 * 
 * Validates that uploaded documents are legitimate question papers for the
 * correct IA type. Rejects non-question-paper documents like lab manuals,
 * aptitude tests, and other unrelated documents.
 */

export interface DocumentValidationResult {
    isValid: boolean;
    isQuestionPaper: boolean;
    detectedIAType: string | null; // 'IA1', 'IA2', 'IA3', or null if unknown
    iaTypeMismatch: boolean;
    errorTitle: string;
    errorMessage: string;
}

/**
 * Structural markers that indicate a document is a question paper:
 * - Has Part A / Part B sections
 * - Has a question table with Q.No, CO, RBT, Marks columns
 * - Has "Internal Assessment" or IA references
 * - Has mark allocation (2 marks, 8 marks, 16 marks)
 * - Has CO references (CO1, CO2, etc.)
 * - Has RBT/Bloom's level references (L1-L6)
 */

/**
 * Detect if the HTML content represents an actual question paper.
 * Returns false for lab manuals, aptitude papers, general documents, etc.
 */
function isQuestionPaper(htmlContent: string): { isQP: boolean; reason: string } {
    const text = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

    // --- Negative signals: documents that are NOT question papers ---

    // Lab manual indicators
    const labManualSignals = [
        /lab\s+manual/i,
        /laboratory\s+manual/i,
        /experiment\s+no/i,
        /aim\s*:\s*/i,
        /apparatus\s+required/i,
        /equipment\s+required/i,
        /procedure\s*:\s*/i,
        /observation\s+table/i,
        /precautions\s*:/i,
        /theory\s*:\s*/i,
        /circuit\s+diagram\s*:/i,
        /tabular\s+column/i,
        /viva\s+questions/i,
    ];

    let labManualScore = 0;
    for (const pattern of labManualSignals) {
        if (pattern.test(text)) labManualScore++;
    }
    if (labManualScore >= 3) {
        return { isQP: false, reason: 'This appears to be a Lab Manual, not a question paper.' };
    }

    // Aptitude / competitive exam paper indicators
    const aptitudeSignals = [
        /aptitude/i,
        /reasoning\s+ability/i,
        /quantitative\s+analysis/i,
        /verbal\s+ability/i,
        /data\s+interpretation/i,
        /logical\s+reasoning/i,
        /general\s+knowledge/i,
        /general\s+awareness/i,
        /entrance\s+exam/i,
        /competitive\s+exam/i,
    ];

    let aptitudeScore = 0;
    for (const pattern of aptitudeSignals) {
        if (pattern.test(text)) aptitudeScore++;
    }

    // Count actual questions - only from the question sections (after Part A heading),
    // not from CO tables, course objectives, headings, or other metadata.
    // We look for the Part A section first, then count question numbers only from there.
    const partAStart = text.search(/part\s*[-–—]?\s*a/i);
    const questionSectionText = partAStart >= 0 ? text.substring(partAStart) : text;

    // Use a stricter regex: match only 1-2 digit numbers (question numbers are 1-16 typically,
    // never 3 digits like CO codes "309"). Also require the number to be preceded by a
    // word boundary or start of line, not part of a larger alphanumeric token like "C309".
    const maxQuestionNumber = (() => {
        let max = 0;
        // Match question-like patterns: standalone 1-2 digit numbers
        // This avoids matching 3-digit CO codes (C309), marks (100), or year (2025)
        const matches = questionSectionText.match(/(?:^|[\s,;|(])(\d{1,2})(?:\s*[.)]\s|\s+[ABab]\b)/gm) || [];
        for (const m of matches) {
            const numMatch = m.match(/(\d{1,2})/);
            if (numMatch) {
                const num = parseInt(numMatch[1]);
                if (!isNaN(num) && num > 0 && num <= 99 && num > max) max = num;
            }
        }
        return max;
    })();

    // Check if document has clear IA markers (Internal Assessment, IA1/IA2/IA3, Model Exam, etc.)
    const hasIAMarkers = /internal\s+assessment/i.test(text) ||
        /\bIA\s*[-–—]?\s*[123I]+\b/i.test(text) ||
        /model\s+exam/i.test(text);

    // If it has aptitude signals and > 30 questions, it's likely an aptitude paper
    if (aptitudeScore >= 2 && maxQuestionNumber > 30) {
        return { isQP: false, reason: 'This appears to be an aptitude/competitive exam paper, not an Internal Assessment question paper.' };
    }

    // If it has > 50 questions, it's unlikely to be an IA paper (IA papers have ~15-25 questions)
    // BUT skip this check entirely if the document has clear IA markers
    if (maxQuestionNumber > 50 && aptitudeScore === 0 && !hasIAMarkers) {
        return { isQP: false, reason: `This document appears to have ${maxQuestionNumber}+ questions. Internal Assessment papers typically have 15-25 questions. This does not appear to be a valid IA question paper.` };
    }

    // Generic document indicators (textbooks, notes, reports)
    const genericDocSignals = [
        /chapter\s+\d+\s*:/i,
        /table\s+of\s+contents/i,
        /bibliography/i,
        /references\s*:/i,
        /abstract\s*:/i,
        /introduction\s*:\s*/i,
        /conclusion\s*:\s*/i,
        /acknowledgement/i,
    ];
    let genericScore = 0;
    for (const pattern of genericDocSignals) {
        if (pattern.test(text)) genericScore++;
    }
    if (genericScore >= 3) {
        return { isQP: false, reason: 'This appears to be a report, notes, or textbook — not a question paper.' };
    }

    // --- Positive signals: markers of a valid question paper ---
    let qpScore = 0;

    // Part A / Part B structure
    if (/part\s*[-–—]?\s*a/i.test(text)) qpScore += 2;
    if (/part\s*[-–—]?\s*b/i.test(text)) qpScore += 2;

    // Question table headers
    if (/q\.?\s*no/i.test(text)) qpScore += 2;
    if (/co\.?\s*no|course\s+outcome/i.test(text)) qpScore += 1;
    if (/rbt|bloom/i.test(text)) qpScore += 1;
    if (/marks?\s*$/im.test(text) || /max\.?\s*marks/i.test(text)) qpScore += 1;

    // Internal Assessment / IA references
    if (/internal\s+assessment/i.test(text)) qpScore += 3;
    if (/\bIA\s*[-–]?\s*[123]\b/i.test(text)) qpScore += 3;
    if (/model\s+exam/i.test(text)) qpScore += 2;
    if (/end\s*semester/i.test(text)) qpScore += 2;

    // CO level references (CO1, CO2, etc.)
    const coMatches = text.match(/\bco\s*[1-6]\b/gi);
    if (coMatches && coMatches.length >= 2) qpScore += 2;

    // RBT level references (L1-L6)
    const levelMatches = text.match(/\b[lL][1-6]\b/g);
    if (levelMatches && levelMatches.length >= 2) qpScore += 2;

    // Mark values typical in IA papers (2, 8, 10, 16)
    if (/\b(2|8|10|16)\s*marks?\b/i.test(text)) qpScore += 1;

    // College/university/institute name
    if (/institute|university|college|department/i.test(text)) qpScore += 1;

    // Subject code pattern (CS4401, EC1234, etc.)
    if (/[A-Z]{2,}\d{4}/i.test(text)) qpScore += 1;

    // Time / Duration
    if (/time\s*:\s*\d/i.test(text) || /duration\s*:\s*\d/i.test(text)) qpScore += 1;

    // Need a minimum score to consider it a question paper
    // Score of 5+ is a confident match
    if (qpScore < 4) {
        return { isQP: false, reason: 'This document does not appear to be an Internal Assessment question paper. Please upload a valid IA question paper (PDF, Word, or HTML) with Parts A & B, CO, and RBT levels.' };
    }

    return { isQP: true, reason: '' };
}

/**
 * Detect the IA type from document content.
 * Checks for "Internal Assessment 1/2/3", "IA1/IA2/IA3", "Model Exam" etc.
 */
function detectIAType(htmlContent: string): string | null {
    const text = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Check for specific IA type mentions
    // Must check IA3 before IA1 because "IA1" is a substring issue with "Internal Assessment 1"
    // and "III" comes before "I" in pattern specificity

    // IA3 / Model Exam detection
    if (/Internal\s+Assessment\s*[-–—]?\s*3/i.test(text) ||
        /\bIA\s*[-–—]?\s*3\b/i.test(text) ||
        /Model\s+Exam(?:ination)?/i.test(text) ||
        /\bIA\s*[-–—]?\s*III\b/i.test(text) ||
        /Internal\s+Assessment\s*[-–—]?\s*III/i.test(text)) {
        return 'IA3';
    }

    // IA2 detection
    if (/Internal\s+Assessment\s*[-–—]?\s*2/i.test(text) ||
        /\bIA\s*[-–—]?\s*2\b/i.test(text) ||
        /\bIA\s*[-–—]?\s*II\b/i.test(text) ||
        /Internal\s+Assessment\s*[-–—]?\s*II(?!\s*I)/i.test(text)) {
        return 'IA2';
    }

    // IA1 detection
    if (/Internal\s+Assessment\s*[-–—]?\s*1/i.test(text) ||
        /\bIA\s*[-–—]?\s*1\b/i.test(text) ||
        /\bIA\s*[-–—]?\s*I\b/i.test(text) ||
        /Internal\s+Assessment\s*[-–—]?\s*I(?!\s*[IV])/i.test(text) ||
        /\bEPC\b/i.test(text)) {
        return 'IA1';
    }

    // Structural detection: check question numbering patterns
    // IA3 typically has Part C (Q16+) and more questions
    const hasPartC = /part\s*[-–—]?\s*c/i.test(text);
    if (hasPartC) return 'IA3';

    // Check max marks
    const maxMarksMatch = text.match(/max\.?\s*marks?\s*[:=]?\s*(\d+)/i);
    if (maxMarksMatch) {
        const marks = parseInt(maxMarksMatch[1]);
        if (marks >= 90) return 'IA3'; // 100 marks = IA3
        // 50 marks could be IA1 or IA2 — can't determine from marks alone
    }

    // Check CO focus
    const coMentions = text.match(/\bCO\s*([1-6])\b/gi);
    if (coMentions) {
        const cos = new Set(coMentions.map(c => c.replace(/\s/g, '').toUpperCase()));
        // IA1 focuses on CO1, IA2 on CO2+CO3, IA3 on CO3+CO4+CO5
        if (cos.has('CO4') || cos.has('CO5')) return 'IA3';
        if (cos.has('CO2') && cos.has('CO3') && !cos.has('CO1')) return 'IA2';
        if (cos.has('CO1') && !cos.has('CO3') && !cos.has('CO4')) return 'IA1';
    }

    return null; // Cannot determine IA type
}

/**
 * Main validation function — validates the document before processing.
 * Called during handleSubmit in each IA page.
 */
export function validateDocument(
    htmlContent: string,
    expectedIAType: 'IA1' | 'IA2' | 'IA3'
): DocumentValidationResult {
    // Step 1: Check if document is a question paper at all
    const qpCheck = isQuestionPaper(htmlContent);
    if (!qpCheck.isQP) {
        return {
            isValid: false,
            isQuestionPaper: false,
            detectedIAType: null,
            iaTypeMismatch: false,
            errorTitle: 'Invalid Document',
            errorMessage: qpCheck.reason,
        };
    }

    // Step 2: Detect IA type from document content
    const detectedIAType = detectIAType(htmlContent);
    console.log(`[DocumentValidator] Expected: ${expectedIAType}, Detected: ${detectedIAType}`);

    // Step 3: Check IA type mismatch
    if (detectedIAType && detectedIAType !== expectedIAType) {
        return {
            isValid: false,
            isQuestionPaper: true,
            detectedIAType,
            iaTypeMismatch: true,
            errorTitle: 'Invalid IA Paper',
            errorMessage: `This appears to be an ${detectedIAType} question paper, but you uploaded it to the ${expectedIAType} verification page. Please upload this paper on the correct ${detectedIAType} page instead.`,
        };
    }

    // All checks passed
    return {
        isValid: true,
        isQuestionPaper: true,
        detectedIAType: detectedIAType || expectedIAType,
        iaTypeMismatch: false,
        errorTitle: '',
        errorMessage: '',
    };
}
