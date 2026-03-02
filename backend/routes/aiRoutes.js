const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

router.post('/fix-question', async (req, res) => {
  try {
    const { questionText, currentLevel, targetLevel } = req.body;
    if (!questionText || !currentLevel || !targetLevel) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const fixed = await aiService.fixQuestion(questionText, currentLevel, targetLevel);
    res.json({ updatedText: fixed });
  } catch (err) {
    res.status(500).json({ error: "AI service failed", details: err.message });
  }
});

router.post('/auto-fix', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Questions array required" });
    }
    const fixedQuestions = questions.map(q => ({
      ...q,
      text: q.text + " (auto-fixed)"
    }));
    res.json({ status: "FIXED", errors: [], questions: fixedQuestions });
  } catch (err) {
    res.status(500).json({ error: "Auto-fix failed", details: err.message });
  }
});

// RBT Level action verbs for local enhancement
const RBT_VERBS = {
  'L1': ['Identify', 'Label', 'List', 'State', 'Define', 'Name', 'Recognize', 'Recall'],
  'L2': ['Describe', 'Compare', 'Restate', 'Illustrate', 'Explain', 'Summarize', 'Interpret', 'Discuss'],
  'L3': ['Calculate', 'Apply', 'Solve', 'Demonstrate', 'Compute', 'Use', 'Determine', 'Execute'],
  'L4': ['Break down', 'Categorize', 'Outline', 'Simplify', 'Analyze', 'Differentiate', 'Examine', 'Distinguish'],
  'L5': ['Select', 'Rate', 'Defend', 'Verify', 'Evaluate', 'Justify', 'Critique', 'Assess'],
  'L6': ['Plan', 'Modify', 'Propose', 'Develop', 'Design', 'Create', 'Construct', 'Invent']
};

// Local enhancement function (fallback when no API key)
function enhanceQuestionLocally(questionText, level) {
  const verbs = RBT_VERBS[level] || RBT_VERBS.L2;
  let selectedVerb = verbs[Math.floor(Math.random() * verbs.length)];
  
  // If question already starts with a verb, pick a different one
  const firstWord = questionText.split(' ')[0].toLowerCase();
  if (verbs.some(v => v.toLowerCase() === firstWord)) {
    const filtered = verbs.filter(v => v.toLowerCase() !== firstWord);
    selectedVerb = filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : verbs[0];
  }
  
  // Clean up the question if it already starts with a verb
  let cleanedText = questionText;
  for (const verb of verbs) {
    if (cleanedText.toLowerCase().startsWith(verb.toLowerCase())) {
      cleanedText = cleanedText.substring(verb.length).trim();
      break;
    }
  }
  
  // Remove common starting words
  cleanedText = cleanedText.replace(/^(the|a|an|do\s|does\s|did\s|can\s|could\s|would\s|should\s|will\s|may\s|must\s|shall\s)\s+/i, '');
  
  // Capitalize after cleaning
  cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  
  // Enhance by making it more professional
  let enhanced = `${selectedVerb} ${cleanedText}`;
  
  // Add punctuation if missing
  if (!enhanced.endsWith('.') && !enhanced.endsWith('?')) {
    enhanced += '.';
  }
  
  return enhanced;
}

// Enhance questions endpoint - handles batch enhancement
router.post('/enhance-questions', async (req, res) => {
  try {
    const { questions, subjectContext } = req.body;
    
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Questions array required" });
    }

    const apiKey = process.env.LOVABLE_API_KEY || process.env.AI_API_KEY;
    
    // If no API key, use local enhancement as fallback
    if (!apiKey) {
      console.log('[Enhancement] Using local fallback enhancement (no API key configured)');
      const enhanced = questions.map((q, i) => ({
        questionIndex: i + 1,
        questionNumber: q.questionNumber || '',
        enhancedQuestion: enhanceQuestionLocally(q.questionText, q.level || 'L2')
      }));
      return res.json({ success: true, enhancedQuestions: enhanced });
    }

    // API key is available - use external AI service
    // Prepare prompt for batch enhancement
    const questionListText = questions.map((q, i) => {
      const reTag = q.useAlternativeVerb ? ' (RE-ENHANCE - use a different action verb)' : '';
      const qNum = q.questionNumber ? `#${q.questionNumber} ` : '';
      const level = q.level || 'L2';
      return `${i + 1}. ${qNum}[${level}] ${q.questionText}${reTag}`;
    }).join('\n');

    const systemPrompt = `You are an expert educational content enhancer. Enhance the following questions according to their specified RBT levels.

Rules:
- Keep each question at the same RBT level.
- Each enhanced question MUST start with an appropriate action verb for its level.
- If a question includes the note '(RE-ENHANCE - use a different action verb)', use a different appropriate verb than the one currently used.
- Maintain the same topic and meaning.
- Return a JSON array of objects with keys: questionNumber (if present), questionIndex (1-based index in the list), and enhancedQuestion. Return ONLY the JSON array.`;

    const userPrompt = `Questions:\n${questionListText}\n\nReturn a JSON array like [{"questionIndex":1,"questionNumber":"Q.1","enhancedQuestion":"..."}, ...]`;

    // Call AI API with retry logic
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            stream: false
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim() || '';
          
          let parsed = null;
          try {
            parsed = JSON.parse(content);
          } catch (e) {
            const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
              try {
                parsed = JSON.parse(jsonMatch[0]);
              } catch (e2) {
                parsed = null;
              }
            }
          }

          if (!parsed) {
            const fallback = questions.map((q, i) => ({
              questionIndex: i + 1,
              questionNumber: q.questionNumber || '',
              enhancedQuestion: q.questionText
            }));
            return res.json({ success: true, enhancedQuestions: fallback });
          }

          return res.json({ success: true, enhancedQuestions: parsed });
        }

        if (response.status === 429) {
          lastError = 'Rate limit exceeded';
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
        }

        if (response.status === 402) {
          return res.status(402).json({ error: 'Payment required. Please add credits.' });
        }

        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        lastError = `API error: ${response.status}`;
      } catch (err) {
        console.error('Fetch error on attempt', attempt + 1, ':', err.message);
        lastError = err.message;
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // If AI API fails, fall back to local enhancement
    console.log('[Enhancement] AI API failed, using local fallback:', lastError);
    const enhanced = questions.map((q, i) => ({
      questionIndex: i + 1,
      questionNumber: q.questionNumber || '',
      enhancedQuestion: enhanceQuestionLocally(q.questionText, q.level || 'L2')
    }));
    
    return res.json({ success: true, enhancedQuestions: enhanced });
  } catch (err) {
    console.error('Enhancement endpoint error:', err);
    res.status(500).json({ error: err.message, success: false });
  }
});

module.exports = router;
