// Math expression detection and rendering utilities
// Detects LaTeX, MathML, and common math patterns in text, then renders them as PNG images

/**
 * Common math patterns to detect in question text:
 * - LaTeX inline: $...$ or \(...\)
 * - LaTeX display: $$...$$ or \[...\]
 * - MathML: <math>...</math>
 * - Common notation: x², x₂, fractions, integrals, summations, Greek letters
 */

// Regex patterns for math expressions
const LATEX_INLINE_PATTERN = /\$([^$]+)\$/g;
const LATEX_DISPLAY_PATTERN = /\$\$([^$]+)\$\$/g;
const LATEX_PAREN_PATTERN = /\\\((.+?)\\\)/g;
const LATEX_BRACKET_PATTERN = /\\\[(.+?)\\\]/g;
const MATHML_PATTERN = /<math[^>]*>[\s\S]*?<\/math>/gi;

// Common math-like text patterns (superscripts, subscripts, fractions, etc.)
const MATH_TEXT_PATTERNS = [
    /[a-zA-Z]\^[{(\d]/, // x^2, x^{n}
    /[a-zA-Z]_[{(\d]/, // x_1, x_{n}  
    /\\frac\{/, // \frac{a}{b}
    /\\sqrt\{/, // \sqrt{x}
    /\\int/, // \int
    /\\sum/, // \sum
    /\\prod/, // \prod
    /\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\sigma|\\omega|\\pi|\\phi|\\psi/i,
    /\\infty/, // infinity
    /\\partial/, // partial derivative
    /\\nabla/, // nabla/gradient
    /\\lim/, // limit
    /\\log|\\ln|\\sin|\\cos|\\tan/, // trig/log functions
];

/**
 * Check if text contains renderable math expressions
 */
export const containsMathExpression = (text: string): boolean => {
    if (!text) return false;

    // Check LaTeX patterns
    if (LATEX_DISPLAY_PATTERN.test(text)) return true;
    LATEX_DISPLAY_PATTERN.lastIndex = 0;

    if (LATEX_INLINE_PATTERN.test(text)) return true;
    LATEX_INLINE_PATTERN.lastIndex = 0;

    if (LATEX_PAREN_PATTERN.test(text)) return true;
    LATEX_PAREN_PATTERN.lastIndex = 0;

    if (LATEX_BRACKET_PATTERN.test(text)) return true;
    LATEX_BRACKET_PATTERN.lastIndex = 0;

    // Check MathML
    if (MATHML_PATTERN.test(text)) return true;
    MATHML_PATTERN.lastIndex = 0;

    // Check common math patterns
    for (const pattern of MATH_TEXT_PATTERNS) {
        if (pattern.test(text)) return true;
    }

    return false;
};

/**
 * Extract math expressions from text
 * Returns array of { original, expression, type }
 */
export const extractMathExpressions = (text: string): { original: string; expression: string; type: 'latex' | 'mathml' | 'text' }[] => {
    const results: { original: string; expression: string; type: 'latex' | 'mathml' | 'text' }[] = [];

    // Extract LaTeX display mode first ($$...$$)
    let match;
    const displayRegex = /\$\$([^$]+)\$\$/g;
    while ((match = displayRegex.exec(text)) !== null) {
        results.push({ original: match[0], expression: match[1], type: 'latex' });
    }

    // Extract LaTeX inline ($...$) - excluding already matched display mode
    const inlineRegex = /\$([^$]+)\$/g;
    while ((match = inlineRegex.exec(text)) !== null) {
        // Skip if this is part of a $$ display
        if (!results.some(r => r.original.includes(match[0]))) {
            results.push({ original: match[0], expression: match[1], type: 'latex' });
        }
    }

    // Extract \(...\) and \[...\]
    const parenRegex = /\\\((.+?)\\\)/g;
    while ((match = parenRegex.exec(text)) !== null) {
        results.push({ original: match[0], expression: match[1], type: 'latex' });
    }

    const bracketRegex = /\\\[(.+?)\\\]/g;
    while ((match = bracketRegex.exec(text)) !== null) {
        results.push({ original: match[0], expression: match[1], type: 'latex' });
    }

    // Extract MathML
    const mathmlRegex = /<math[^>]*>([\s\S]*?)<\/math>/gi;
    while ((match = mathmlRegex.exec(text)) !== null) {
        results.push({ original: match[0], expression: match[0], type: 'mathml' });
    }

    return results;
};

/**
 * Render a math expression to a base64 PNG image using Canvas
 * This is a simple renderer for basic LaTeX-like expressions
 */
export const renderMathToImage = async (expression: string, fontSize: number = 24): Promise<string | null> => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Enhanced cleaning and substitution logic
        let displayText = expression
            // Matrices/Arrays (simplify to linear representation)
            .replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (_, content) => `(${content.replace(/\\\\/g, '; ').replace(/&/g, ', ')})`)
            .replace(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, (_, content) => `[${content.replace(/\\\\/g, '; ').replace(/&/g, ', ')}]`)

            // Fractions and Roots
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
            .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)')
            .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')

            // Greek Letters
            .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ').replace(/\\Gamma/g, 'Γ')
            .replace(/\\delta/g, 'δ').replace(/\\Delta/g, 'Δ').replace(/\\epsilon/g, 'ε').replace(/\\zeta/g, 'ζ')
            .replace(/\\eta/g, 'η').replace(/\\theta/g, 'θ').replace(/\\Theta/g, 'Θ').replace(/\\iota/g, 'ι')
            .replace(/\\kappa/g, 'κ').replace(/\\lambda/g, 'λ').replace(/\\Lambda/g, 'Λ').replace(/\\mu/g, 'μ')
            .replace(/\\nu/g, 'ν').replace(/\\xi/g, 'ξ').replace(/\\Xi/g, 'Ξ').replace(/\\pi/g, 'π')
            .replace(/\\Pi/g, 'Π').replace(/\\rho/g, 'ρ').replace(/\\sigma/g, 'σ').replace(/\\Sigma/g, 'Σ')
            .replace(/\\tau/g, 'τ').replace(/\\upsilon/g, 'υ').replace(/\\phi/g, 'φ').replace(/\\Phi/g, 'Φ')
            .replace(/\\chi/g, 'χ').replace(/\\psi/g, 'ψ').replace(/\\Psi/g, 'Ψ').replace(/\\omega/g, 'ω')
            .replace(/\\Omega/g, 'Ω')

            // Common Symbols
            .replace(/\\infty/g, '∞').replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇')
            .replace(/\\int/g, '∫').replace(/\\oint/g, '∮').replace(/\\sum/g, 'Σ').replace(/\\prod/g, 'Π')
            .replace(/\\lim/g, 'lim').replace(/\\log/g, 'log').replace(/\\ln/g, 'ln')
            .replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan')
            .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥').replace(/\\neq/g, '≠')
            .replace(/\\approx/g, '≈').replace(/\\equiv/g, '≡').replace(/\\sim/g, '∼')
            .replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\pm/g, '±').replace(/\\mp/g, '∓')
            .replace(/\\rightarrow/g, '→').replace(/\\leftarrow/g, '←').replace(/\\leftrightarrow/g, '↔')
            .replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐').replace(/\\Leftrightarrow/g, '⇔')
            .replace(/\\forall/g, '∀').replace(/\\exists/g, '∃').replace(/\\in/g, '∈').replace(/\\notin/g, '∉')
            .replace(/\\subset/g, '⊂').replace(/\\supset/g, '⊃').replace(/\\cup/g, '∪').replace(/\\cap/g, '∩')

            // Superscripts/Subscripts
            .replace(/\^{([^}]+)}/g, (_, exp) => toSuperscript(exp))
            .replace(/\^(\d)/g, (_, d) => toSuperscript(d))
            .replace(/_{([^}]+)}/g, (_, exp) => toSubscript(exp))
            .replace(/_(\d)/g, (_, d) => toSubscript(d))

            // Formatting
            .replace(/\\text\{([^}]+)\}/g, '$1')
            .replace(/\\mathbf\{([^}]+)\}/g, '$1')
            .replace(/\\mathrm\{([^}]+)\}/g, '$1')
            .replace(/\\mathit\{([^}]+)\}/g, '$1')
            .replace(/[{}]/g, '')
            .replace(/\\/g, ''); // Remove remaining backslashes

        // Handle MathML specifically - simple text extraction
        if (expression.includes('<math') || expression.includes('<mi>') || expression.includes('<mn>')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = expression;
            displayText = tempDiv.textContent || expression;
            // Clean up extra whitespace
            displayText = displayText.replace(/\s+/g, ' ').trim();
        }

        // Measure text dimensions
        ctx.font = `${fontSize}px 'Cambria Math', 'Times New Roman', serif`;
        const metrics = ctx.measureText(displayText);
        const textWidth = metrics.width + 20; // padding
        const textHeight = fontSize * 1.5 + 20; // padding

        // Set canvas size (minimum dimensions for visibility)
        canvas.width = Math.max(textWidth, 100);
        canvas.height = Math.max(textHeight, 50);

        // Draw with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw text
        ctx.fillStyle = 'black';
        ctx.font = `${fontSize}px 'Cambria Math', 'Times New Roman', serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);

        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error('[MathRenderer] Failed to render math:', err);
        return null;
    }
};

/**
 * Process HTML text and replace math expressions with rendered images
 * Returns the HTML with math expressions replaced by <img> tags
 */
export const processMathInHtml = async (html: string): Promise<string> => {
    if (!html || !containsMathExpression(html)) return html;

    const expressions = extractMathExpressions(html);
    if (expressions.length === 0) return html;

    let result = html;
    for (const expr of expressions) {
        const imageDataUrl = await renderMathToImage(expr.expression);
        if (imageDataUrl) {
            const imgTag = `<img src="${imageDataUrl}" alt="${escapeHtml(expr.expression)}" class="math-expression-img" style="vertical-align: middle; max-height: 30px; margin: 0 2px;">`;
            result = result.replace(expr.original, imgTag);
        }
    }

    return result;
};

// Helper: convert characters to Unicode superscript
const SUPERSCRIPT_MAP: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 'a': 'ᵃ',
    'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
    'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ',
    'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ',
    't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'z': 'ᶻ',
};

const toSuperscript = (text: string): string => {
    return text.split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
};

// Helper: convert characters to Unicode subscript
const SUBSCRIPT_MAP: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
    'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
    'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
    'v': 'ᵥ', 'x': 'ₓ',
};

const toSubscript = (text: string): string => {
    return text.split('').map(c => SUBSCRIPT_MAP[c] || c).join('');
};

// Helper: escape HTML special characters
const escapeHtml = (text: string): string => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};
