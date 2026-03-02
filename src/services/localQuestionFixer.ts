// Local question fixer — works without Supabase edge functions
// Uses rule-based verb swapping to match target RBT levels

const RBT_VERBS: Record<string, string[]> = {
    L1: ['Identify', 'Label', 'List', 'State', 'Define', 'Name', 'Recognize'],
    L2: ['Describe', 'Compare', 'Restate', 'Illustrate', 'Explain', 'Summarize', 'Interpret'],
    L3: ['Calculate', 'Apply', 'Solve', 'Demonstrate', 'Compute', 'Use', 'Determine'],
    L4: ['Break down', 'Categorize', 'Outline', 'Simplify', 'Analyze', 'Differentiate', 'Examine'],
    L5: ['Select', 'Rate', 'Defend', 'Verify', 'Evaluate', 'Justify', 'Critique'],
    L6: ['Plan', 'Modify', 'Propose', 'Develop', 'Design', 'Create', 'Construct']
};

// All known verbs flattened for detection
const ALL_VERBS = Object.values(RBT_VERBS).flat();

function pickRandomVerb(level: string): string {
    const verbs = RBT_VERBS[level] || RBT_VERBS.L3;
    return verbs[Math.floor(Math.random() * verbs.length)];
}

function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fixes a question locally by swapping/prepending the action verb to match the target level.
 */
export function fixQuestionLocally(
    questionText: string,
    _currentLevel: string,
    targetLevel: string,
    convertToSingle: boolean = false
): string {
    const plain = stripHtmlTags(questionText);
    const targetVerb = pickRandomVerb(targetLevel);

    if (convertToSingle) {
        // Remove subdivision markers and merge into a single question
        const cleaned = plain
            .replace(/\b(i+\)|[ivx]+\)|[a-d]\)|[a-d]\.)\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Remove any existing leading verb
        let body = cleaned;
        for (const verb of ALL_VERBS) {
            const regex = new RegExp(`^${verb}\\b\\s*`, 'i');
            if (regex.test(body)) {
                body = body.replace(regex, '').trim();
                break;
            }
        }
        return `${targetVerb} ${body}`;
    }

    // Standard level change: replace the leading action verb
    let body = plain;
    let verbReplaced = false;

    for (const verb of ALL_VERBS) {
        const regex = new RegExp(`^${verb}\\b\\s*`, 'i');
        if (regex.test(body)) {
            body = body.replace(regex, '').trim();
            verbReplaced = true;
            break;
        }
    }

    if (!verbReplaced) {
        // No known verb found at start — just prepend the target verb
        // Try to lowercase the first character to flow naturally
        if (body.length > 0) {
            body = body.charAt(0).toLowerCase() + body.slice(1);
        }
    }

    return `${targetVerb} ${body}`;
}

/**
 * Attempts to call the Supabase edge function; falls back to local fixing if it fails.
 */
export async function fixQuestionWithFallback(
    supabase: any,
    questionText: string,
    currentLevel: string,
    targetLevel: string,
    convertToSingle: boolean,
    subdivisionLevels?: string[],
    originalHtml?: string
): Promise<{ fixedQuestion: string; usedFallback: boolean }> {
    // Try the edge function first
    try {
        const { data, error } = await supabase.functions.invoke('fix-question', {
            body: {
                questionText,
                currentLevel,
                targetLevel,
                convertToSingle,
                subdivisionLevels
            }
        });

        if (!error && data?.fixedQuestion) {
            return { fixedQuestion: data.fixedQuestion, usedFallback: false };
        }
    } catch {
        // Edge function failed — fall through to local fix
    }

    // Fallback: fix locally
    const fixed = fixQuestionLocally(questionText, currentLevel, targetLevel, convertToSingle);
    return { fixedQuestion: fixed, usedFallback: true };
}
