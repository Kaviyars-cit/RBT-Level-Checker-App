import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RBT Level action verbs mapping - updated with user's specific verbs
const RBT_VERBS: Record<string, string[]> = {
  L1: ['Identify', 'Label', 'List', 'State', 'Define', 'Name', 'Recognize'],
  L2: ['Describe', 'Compare', 'Restate', 'Illustrate', 'Explain', 'Summarize', 'Interpret'],
  L3: ['Calculate', 'Apply', 'Solve', 'Demonstrate', 'Compute', 'Use', 'Determine'],
  L4: ['Break down', 'Categorize', 'Outline', 'Simplify', 'Analyze', 'Differentiate', 'Examine'],
  L5: ['Select', 'Rate', 'Defend', 'Verify', 'Evaluate', 'Justify', 'Critique'],
  L6: ['Plan', 'Modify', 'Propose', 'Develop', 'Design', 'Create', 'Construct']
};

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to make API call with retry logic
async function callAIWithRetry(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 5
): Promise<{ success: boolean; data?: unknown; error?: string; retryAfter?: number }> {
  let lastError = "";
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Longer exponential backoff: 3s, 6s, 12s, 24s
      const waitTime = Math.pow(2, attempt) * 1500;
      console.log(`Retry attempt ${attempt + 1}, waiting ${waitTime}ms`);
      await delay(waitTime);
    }

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
        lastError = "Rate limit exceeded";
        console.log(`Rate limited, retry-after: ${retryAfter}s`);
        
        if (attempt < maxRetries - 1) {
          await delay(retryAfter * 1000);
          continue;
        }
        return { success: false, error: "Rate limit exceeded. Please wait a moment and try again.", retryAfter };
      }

      if (response.status === 402) {
        return { success: false, error: "Payment required. Please add credits to your workspace." };
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      lastError = `AI gateway error: ${response.status}`;
    } catch (err) {
      console.error("Fetch error:", err);
      lastError = err instanceof Error ? err.message : "Network error";
    }
  }

  return { success: false, error: lastError || "Failed after multiple retries" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionText, currentLevel, targetLevel, convertToSingle, subdivisionLevels } = await req.json();
    
    if (!questionText || !currentLevel || !targetLevel) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: questionText, currentLevel, targetLevel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;

    // Check if we need to convert subdivisions to a single question
    if (convertToSingle) {
      const targetVerbs = RBT_VERBS[targetLevel] || RBT_VERBS.L4;
      
      systemPrompt = `You are an expert at restructuring academic questions according to Bloom's Revised Taxonomy.

YOUR TASK: Convert a question that has subdivisions (i, ii, etc.) into a SINGLE unified question.

ABSOLUTE REQUIREMENTS:
1. Output MUST be a SINGLE question (NO subdivisions, NO i), ii), iii) parts)
2. The question MUST target ${targetLevel} level
3. Keep the SAME TOPIC as the original question
4. Combine all sub-parts into ONE comprehensive question

RBT LEVELS AND ACTION VERBS (USE EXACTLY):
- L1 (Recall): ${RBT_VERBS.L1.join(', ')}
- L2 (Explain): ${RBT_VERBS.L2.join(', ')}
- L3 (Solve): ${RBT_VERBS.L3.join(', ')}
- L4 (Inspect): ${RBT_VERBS.L4.join(', ')}
- L5 (Judge): ${RBT_VERBS.L5.join(', ')}
- L6 (Build): ${RBT_VERBS.L6.join(', ')}

EXAMPLE:
Input: "i) List the junction capacitances present in a BJT. ii) Explain their effect on frequency response."
Target: L4
Output: "Analyze the impact of BJT junction capacitances on the high-frequency response by differentiating their individual contributions to the overall gain reduction."

RULES:
- Return ONLY a single question sentence
- NO subdivisions, NO roman numerals, NO multiple parts
- Start with an action verb for ${targetLevel}
- NO explanations, NO prefixes, NO extra text`;

      userPrompt = `Convert this subdivided question into a SINGLE ${targetLevel} question:

ORIGINAL: "${questionText}"

TARGET LEVEL: ${targetLevel}
USE ONE OF THESE VERBS: ${targetVerbs.join(', ')}

OUTPUT (single question only, no subdivisions):`;
    } else {
      // Standard level change
      const targetVerbs = RBT_VERBS[targetLevel] || RBT_VERBS.L2;
      const verbList = targetVerbs.join(', ');

      systemPrompt = `You are an expert in Bloom's Revised Taxonomy (RBT) levels for educational assessments.
Your task is to modify a question from one cognitive level to another while preserving the core meaning and topic.

RBT Levels and their Action Verbs:
- L1 (Recall): ${RBT_VERBS.L1.join(', ')}
- L2 (Explain): ${RBT_VERBS.L2.join(', ')}
- L3 (Solve): ${RBT_VERBS.L3.join(', ')}
- L4 (Inspect): ${RBT_VERBS.L4.join(', ')}
- L5 (Judge): ${RBT_VERBS.L5.join(', ')}
- L6 (Build): ${RBT_VERBS.L6.join(', ')}

Rules:
1. Keep the core subject matter and topic exactly the same
2. Change only the action verb and modify the question structure to match the target level
3. The difficulty should appropriately match the target level
4. MUST start the question with an action verb from the target level
5. Use DIFFERENT action verbs each time - vary your choice
6. Return ONLY the modified question text, nothing else`;

      userPrompt = `Original question (${currentLevel}): "${questionText}"

Modify this question to ${targetLevel} level.
USE ONE OF THESE VERBS: ${verbList}

Return ONLY the modified question text starting with an appropriate action verb.`;
    }

    const result = await callAIWithRetry(LOVABLE_API_KEY, systemPrompt, userPrompt);

    if (!result.success) {
      const status = result.error?.includes("Rate limit") ? 429 : 
                     result.error?.includes("Payment") ? 402 : 500;
      return new Response(
        JSON.stringify({ error: result.error, retryAfter: result.retryAfter }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = result.data as { choices?: Array<{ message?: { content?: string } }> };
    const fixedQuestion = data.choices?.[0]?.message?.content?.trim() || questionText;

    return new Response(
      JSON.stringify({ 
        success: true,
        originalQuestion: questionText,
        fixedQuestion,
        originalLevel: currentLevel,
        targetLevel,
        convertedToSingle: convertToSingle || false,
        subdivisionLevels: subdivisionLevels || null
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fix-question error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
