import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Question } from '@/components/QuestionDisplay';
import { stripHtmlForAI, reattachImages, containsHtml } from '@/utils/htmlUtils';
import { ParseResult, generateCorrectedHTML } from '@/services/htmlParser';
import { generateHtmlDocument } from '@/services/htmlDocumentGenerator';
import { supabase } from '@/integrations/supabase/client';

interface EnhancePageState {
  parseResult: ParseResult;
  iaType: 'IA1' | 'IA2' | 'IA3';
  acceptedQuestions: Question[];
  validationResult?: any;
}

const EnhancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as EnhancePageState | null;

  const [parseResult, setParseResult] = useState<ParseResult | null>(state?.parseResult || null);
  const [iaType] = useState<'IA1' | 'IA2' | 'IA3'>(state?.iaType || 'IA1');
  const [acceptedQuestions, setAcceptedQuestions] = useState<Question[]>(state?.acceptedQuestions || []);
  const [validationResult] = useState(state?.validationResult || null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedCount, setEnhancedCount] = useState(0);
  const [allEnhanced, setAllEnhanced] = useState(false);
  // Flags to track whether the user explicitly started enhancement flows
  const [startedEnhancement, setStartedEnhancement] = useState(false);
  const [startedReEnhancement, setStartedReEnhancement] = useState(false);
  const [enhancedQuestionsList, setEnhancedQuestionsList] = useState<Array<{ original: string; enhanced: string; level: string; questionNumber: string; co: string; marks: number }>>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  // Ref to scroll to comparison table
  const comparisonTableRef = useRef<HTMLDivElement>(null);

  // ---- Local enhancement fallback (works without backend) ----
  const RBT_VERBS: Record<string, string[]> = {
    'L1': ['Identify', 'Label', 'List', 'State', 'Define', 'Name', 'Recognize', 'Recall'],
    'L2': ['Describe', 'Compare', 'Restate', 'Illustrate', 'Explain', 'Summarize', 'Interpret', 'Discuss'],
    'L3': ['Calculate', 'Apply', 'Solve', 'Demonstrate', 'Compute', 'Use', 'Determine', 'Execute'],
    'L4': ['Break down', 'Categorize', 'Outline', 'Simplify', 'Analyze', 'Differentiate', 'Examine', 'Distinguish'],
    'L5': ['Select', 'Rate', 'Defend', 'Verify', 'Evaluate', 'Justify', 'Critique', 'Assess'],
    'L6': ['Plan', 'Modify', 'Propose', 'Develop', 'Design', 'Create', 'Construct', 'Invent']
  };

  const enhanceLocally = (questionText: string, level: string, useAlt = false): string => {
    const verbs = RBT_VERBS[level] || RBT_VERBS['L2'];
    const firstWord = questionText.split(' ')[0].toLowerCase();
    // Filter out the current starting verb to get a different one
    let candidates = verbs.filter(v => v.toLowerCase() !== firstWord);
    if (useAlt && candidates.length > 1) {
      // For re-enhancement, also exclude the second verb to ensure variety
      candidates = candidates.slice(1);
    }
    const selectedVerb = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : verbs[0];

    // Strip existing leading verb if it matches any RBT verb
    let cleaned = questionText;
    for (const v of verbs) {
      if (cleaned.toLowerCase().startsWith(v.toLowerCase())) {
        cleaned = cleaned.substring(v.length).trim();
        break;
      }
    }
    cleaned = cleaned.replace(/^(the|a|an)\s+/i, '');
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    let enhanced = `${selectedVerb} ${cleaned}`;
    if (!enhanced.endsWith('.') && !enhanced.endsWith('?')) enhanced += '.';
    return enhanced;
  };

  const enhanceQuestionsLocalFallback = (questions: { questionText: string; level: string; questionNumber: string; useAlternativeVerb?: boolean }[]) => {
    return questions.map((q, i) => ({
      questionIndex: i + 1,
      questionNumber: q.questionNumber || '',
      enhancedQuestion: enhanceLocally(q.questionText, q.level || 'L2', q.useAlternativeVerb || false)
    }));
  };

  // Generate the corrected HTML preview - this shows the fixed paper
  const correctedHtmlPreview = useMemo(() => {
    if (!parseResult) return '';
    return generateCorrectedHTML(parseResult, iaType, `${iaType} Corrected Question Paper`);
  }, [parseResult, iaType]);

  // Filter to only show accepted questions that weren't fixed (original accepted questions only)
  // Exclude: questions with errors, questions that were fixed, questions already enhanced
  const questionsToEnhance = useMemo(() => {
    return acceptedQuestions.filter(q =>
      !q.hasError &&
      !q.isFixed &&
      !q.isEnhanced
    );
  }, [acceptedQuestions]);

  // Check if all questions are already enhanced (paper already enhanced)
  const isAlreadyEnhanced = useMemo(() => {
    if (acceptedQuestions.length === 0) return false;
    // Check if all questions in the paper (excluding fixed ones) are enhanced
    const questionsToCheck = acceptedQuestions.filter(q => !q.isFixed);
    return questionsToCheck.length > 0 && questionsToCheck.every(q => q.isEnhanced);
  }, [acceptedQuestions]);

  // Auto-scroll to comparison table when enhancements appear
  useEffect(() => {
    if (enhancedQuestionsList.length > 0 && comparisonTableRef.current) {
      setTimeout(() => {
        comparisonTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [enhancedQuestionsList.length]);

  // Check if state exists on mount
  useEffect(() => {
    if (!state) {
      navigate('/');
    }
  }, [state, navigate]);

  const handleEnhanceAll = async () => {
    if (!parseResult || questionsToEnhance.length === 0) return;
    // mark that the user started enhancement so UI renders simplified comparison
    setStartedEnhancement(true);

    setIsEnhancing(true);
    setEnhancedCount(0);
    setEnhancedQuestionsList([]);

    try {
      const subjectContext = parseResult.metadata.subjectName || parseResult.metadata.subjectCode;
      let successCount = 0;

      // Call backend API instead of Supabase function
      const callBackendEnhance = async (payload: any, timeout = 90000) => {
        return await Promise.race([
          fetch('http://localhost:5000/api/enhance-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(res => res.json()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Enhancement request timed out')), timeout))
        ]);
      };

      try {
        const questionsPayload = questionsToEnhance.map(q => ({ questionText: stripHtmlForAI(q.text), level: q.detectedLevel, questionNumber: q.questionNumber }));
        let payload: any;
        try {
          payload = await callBackendEnhance({ questions: questionsPayload, subjectContext });
        } catch (err) {
          console.warn('Backend unavailable, using local enhancement fallback:', err);
          // Fallback: enhance locally instead of failing
          const localResults = enhanceQuestionsLocalFallback(questionsPayload);
          payload = { success: true, enhancedQuestions: localResults };
        }

        if (payload?.error || !payload?.success) {
          console.error('Backend enhance error:', payload);
          setEnhancedQuestionsList(questionsToEnhance.map(q => ({ original: q.originalHtml || q.text, enhanced: '<Failed to enhance>', level: q.detectedLevel, questionNumber: q.questionNumber, co: q.co, marks: q.marks })));
          toast({ title: 'Enhancement Failed', description: payload?.error || 'Enhancement failed. Please try again.' });
          setRawResponse(JSON.stringify(payload));
        } else {
          const enhancedArr = payload?.enhancedQuestions || [];
          // If empty, treat as failure
          if (!Array.isArray(enhancedArr) || enhancedArr.length === 0) {
            console.warn('Empty enhanced array returned');
            setEnhancedQuestionsList(questionsToEnhance.map(q => ({ original: q.originalHtml || q.text, enhanced: '<Failed to enhance>', level: q.detectedLevel, questionNumber: q.questionNumber, co: q.co, marks: q.marks })));
            toast({ title: 'Enhancement Failed', description: 'No enhancements were returned. Please retry.' });
            setRawResponse(JSON.stringify(payload));
          } else {
            setRawResponse(JSON.stringify(payload));
            enhancedArr.forEach((item: any) => {
              const matchByNumber = item.questionNumber ? questionsToEnhance.find(q => q.questionNumber === item.questionNumber) : null;
              const q = matchByNumber || (typeof item.questionIndex === 'number' ? questionsToEnhance[item.questionIndex - 1] : null);
              if (q) {
                const enhancedText = item.enhancedQuestion || item.enhanced || q.text;

                setEnhancedQuestionsList(prev => [...prev, {
                  original: q.originalHtml || q.text,
                  enhanced: enhancedText,
                  level: q.detectedLevel,
                  questionNumber: q.questionNumber,
                  co: q.co,
                  marks: q.marks
                }]);

                // Update parseResult and acceptedQuestions
                setParseResult(prev => {
                  if (!prev) return prev;
                  const updateQuestion = (qq: Question) => qq.id === q.id ? { ...qq, text: reattachImages(enhancedText, qq.originalHtml), isEnhanced: true, originalHtml: qq.originalHtml } : qq;
                  return { ...prev, partA: prev.partA.map(updateQuestion), partB: prev.partB.map(updateQuestion), partC: prev.partC?.map(updateQuestion) };
                });

                setAcceptedQuestions(prev => prev.map(qq => qq.id === q.id ? { ...qq, text: reattachImages(enhancedText, qq.originalHtml), isEnhanced: true, originalHtml: qq.originalHtml } : qq));

                successCount++;
                setEnhancedCount(successCount);
              }
            });
          }
        }
      } catch (err) {
        console.error('Batch enhance error:', err);
      }

      // Enhancement loop complete. Only mark `allEnhanced` true when every question
      // that needed enhancement was actually enhanced successfully.
      console.log(`[Enhancement] Enhancement loop complete. Success: ${successCount}/${questionsToEnhance.length}`);

      if (successCount === questionsToEnhance.length) {
        toast({
          title: "Enhancement Complete",
          description: `Successfully enhanced ${successCount} questions.`,
        });
        // Small delay to ensure state updates are processed
        setTimeout(() => {
          setAllEnhanced(true);
        }, 500);
      } else {
        toast({
          title: "Partial Enhancement",
          description: `Enhanced ${successCount} out of ${questionsToEnhance.length} questions. Please retry the remaining ones.`,
        });
        // Keep allEnhanced as false so download / further enhancement remain blocked
      }
    } catch (error) {
      toast({
        title: "Enhancement Failed",
        description: error instanceof Error ? error.message : "Failed to enhance questions.",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleEnhanceFurther = async () => {
    if (!parseResult) return;

    setIsEnhancing(true);
    setEnhancedCount(0);
    setAllEnhanced(false); // Reset to show progress bar and re-enhancement UI
    setStartedReEnhancement(true);

    try {
      const subjectContext = parseResult.metadata.subjectName || parseResult.metadata.subjectCode;

      // Re-enhance all already enhanced questions with different verbs
      const questionsToReEnhance = acceptedQuestions.filter(q => q.isEnhanced && !q.isFixed);

      let reSuccessCount = 0;
      // Call backend API instead of Supabase function
      const callBackendEnhance = async (payload: any, timeout = 90000) => {
        return await Promise.race([
          fetch('http://localhost:5000/api/enhance-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(res => res.json()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Enhancement request timed out')), timeout))
        ]);
      };

      try {
        const questionsPayload = questionsToReEnhance.map(q => ({ questionText: stripHtmlForAI(q.text), level: q.detectedLevel, questionNumber: q.questionNumber, useAlternativeVerb: true }));
        let payload: any;
        try {
          payload = await callBackendEnhance({ questions: questionsPayload, subjectContext });
        } catch (err) {
          console.warn('Backend unavailable for re-enhancement, using local fallback:', err);
          // Fallback: re-enhance locally instead of failing
          const localResults = enhanceQuestionsLocalFallback(questionsPayload);
          payload = { success: true, enhancedQuestions: localResults };
        }

        if (payload?.error || !payload?.success) {
          console.error('Backend re-enhance error:', payload);
          setEnhancedQuestionsList(prev => prev.map(p => ({ ...p, enhanced: p.enhanced || '<Failed to re-enhance>' })));
          toast({ title: 'Re-Enhancement Failed', description: payload?.error || 'Re-enhancement failed. Please try again.' });
        } else {
          const enhancedArr = payload?.enhancedQuestions || [];
          if (!Array.isArray(enhancedArr) || enhancedArr.length === 0) {
            console.warn('Empty re-enhanced array returned');
            setEnhancedQuestionsList(prev => prev.map(p => ({ ...p, enhanced: p.enhanced || '<Failed to re-enhance>' })));
            toast({ title: 'Re-Enhancement Failed', description: 'No re-enhancements were returned. Please retry.' });
            setRawResponse(JSON.stringify(payload));
          } else {
            setRawResponse(JSON.stringify(payload));
            enhancedArr.forEach((item: any) => {
              const matchByNumber = item.questionNumber ? questionsToReEnhance.find(q => q.questionNumber === item.questionNumber) : null;
              const q = matchByNumber || (typeof item.questionIndex === 'number' ? questionsToReEnhance[item.questionIndex - 1] : null);
              if (q) {
                const enhancedText = item.enhancedQuestion || item.enhanced || q.text;

                setEnhancedQuestionsList(prev => prev.map(eq => eq.questionNumber === q.questionNumber ? { ...eq, enhanced: enhancedText } : eq));

                setParseResult(prev => {
                  if (!prev) return prev;
                  const updateQuestion = (qq: Question) => qq.id === q.id ? { ...qq, text: reattachImages(enhancedText, qq.originalHtml), originalHtml: qq.originalHtml } : qq;
                  return { ...prev, partA: prev.partA.map(updateQuestion), partB: prev.partB.map(updateQuestion), partC: prev.partC?.map(updateQuestion) };
                });

                setAcceptedQuestions(prev => prev.map(qq => qq.id === q.id ? { ...qq, text: reattachImages(enhancedText, qq.originalHtml), originalHtml: qq.originalHtml } : qq));

                reSuccessCount++;
                setEnhancedCount(reSuccessCount);
              }
            });
          }
        }
      } catch (err) {
        console.error('Batch re-enhance error:', err);
      }

      toast({
        title: "Re-Enhancement Complete",
        description: `Successfully re-enhanced ${questionsToReEnhance.length} questions with different action verbs.`,
      });

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        setAllEnhanced(true);
      }, 500);
    } catch (error) {
      toast({
        title: "Re-Enhancement Failed",
        description: error instanceof Error ? error.message : "Failed to re-enhance questions.",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleDownload = async () => {
    if (!parseResult) return;

    try {
      const blob = await generateHtmlDocument(parseResult, iaType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${iaType}_Enhanced_Paper.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: "The enhanced question paper has been downloaded as an HTML document with images.",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: "Failed to generate the HTML document.",
        variant: "destructive",
      });
    }
  };

  if (!state || !parseResult) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <button
          onClick={() => {
            // Navigate back to the specific IA page with state preserved
            const iaRoute = `/${iaType.toLowerCase()}`;
            navigate(iaRoute, {
              state: {
                returnFromEnhance: true,
                parseResult,
                validationResult,
                acceptedQuestions
              }
            });
          }}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to {iaType} Verification</span>
        </button>

        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Enhance the Questions according to the levels
          </h1>
          <div className="bg-primary/10 rounded-xl p-6 max-w-2xl mx-auto">
            <p className="text-xl font-semibold text-primary mb-2">
              Welcome Faculty! 👋
            </p>
            <p className="text-muted-foreground">
              Enhance your question paper with AI assistance. Our intelligent system will refine each question
              to be more professional, clearer, and student-friendly while maintaining the appropriate
              difficulty level. This ensures your students can understand the questions without
              increasing the complexity.
            </p>
          </div>
        </div>

        {/* Already Enhanced Status */}
        {isAlreadyEnhanced && (
          <div className="mb-8 p-4 bg-success/10 rounded-xl border border-success/30">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-success" />
              <div>
                <p className="font-semibold text-success">Already Enhanced Paper</p>
                <p className="text-sm text-muted-foreground">
                  This question paper has already been enhanced. You can download it directly or enhance it further.
                </p>
              </div>
            </div>
          </div>
        )}



        {/* Corrected Question Paper Preview */}
        <div className="mb-8 bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-muted px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Corrected Question Paper Preview</h3>
            <span className="text-sm text-muted-foreground">
              {iaType} • {parseResult.metadata.subjectCode || 'Question Paper'}
            </span>
          </div>
          <div className="p-2 max-h-[700px] overflow-auto">
            <div
              className="max-w-none w-full"
              style={{ width: '100%' }}
              dangerouslySetInnerHTML={{
                __html: `
                    <style>
                      table { border-collapse: collapse !important; width: 100% !important; max-width: 100% !important; border: 1px solid black; }
                      td, th { border: 1px solid black; padding: 8px; }
                      img { max-width: 100% !important; height: auto !important; }
                      div, section { max-width: 100% !important; }
                    </style>
                    ${correctedHtmlPreview}
                  `
              }}
            />
          </div>
        </div>

        {/* Questions to Enhance - Only non-fixed accepted questions */}
        {questionsToEnhance.length > 0 && !isAlreadyEnhanced && !allEnhanced && (
          <div className="mb-8 bg-card rounded-xl border border-border overflow-hidden">
            <div className="bg-accent/50 px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground">
                Accepted Questions to Enhance ({questionsToEnhance.length} questions)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                These are the originally accepted questions (not corrected by AI Fix) that will be enhanced
              </p>
            </div>
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {questionsToEnhance.map((question, index) => (
                <div key={question.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Q.{question.questionNumber}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {question.detectedLevel}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {question.co}
                        </span>
                      </div>
                      {containsHtml(question.text) || containsHtml(question.originalHtml || '') ? (
                        <div
                          className="text-foreground question-html-content"
                          dangerouslySetInnerHTML={{ __html: question.originalHtml || question.text }}
                        />
                      ) : (
                        <p className="text-foreground">{question.text}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show simplified comparison ONLY when user pressed Enhance or Enhance it Further */}
        {(startedEnhancement || startedReEnhancement) && (
          <div ref={comparisonTableRef} className="mb-8 bg-card rounded-xl border border-success/30 overflow-hidden">
            <div className="bg-success/10 px-4 py-3 border-b border-success/30">
              <h3 className="font-semibold text-success">Original vs Enhanced Questions Comparison</h3>
              <p className="text-sm text-muted-foreground mt-1">Answers appear as they are produced — original (left) and enhanced (right)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="border border-border px-4 py-3 text-left font-semibold text-sm" style={{ width: '8%' }}>Q.No</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-sm" style={{ width: '46%' }}>Original</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-sm" style={{ width: '46%' }}>Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  {enhancedQuestionsList.map((eq, index) => {
                    const originalContent = eq.original;
                    const enhancedContent = eq.enhanced;

                    return (
                      <tr key={`${eq.questionNumber}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                        <td className="border border-border px-4 py-3 text-sm font-medium">Q.{eq.questionNumber}</td>
                        <td className="border border-border px-4 py-3 text-sm align-top">
                          <div className="overflow-y-auto">
                            {containsHtml(originalContent) ? (
                              <div className="question-html-content text-foreground" dangerouslySetInnerHTML={{ __html: originalContent }} />
                            ) : (
                              <p className="text-foreground">{originalContent}</p>
                            )}
                          </div>
                        </td>
                        <td className="border border-border px-4 py-3 text-sm align-top bg-success/5">
                          <div className="overflow-y-auto">
                            {enhancedContent && enhancedContent !== '<Failed to enhance>' ? (
                              containsHtml(enhancedContent) ? (
                                <div className="question-html-content text-foreground" dangerouslySetInnerHTML={{ __html: enhancedContent }} />
                              ) : (
                                <p className="text-foreground">{enhancedContent}</p>
                              )
                            ) : enhancedContent === '<Failed to enhance>' ? (
                              <p className="text-red-500 italic">Failed to enhance</p>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Enhancing...</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No questions to enhance message */}
        {questionsToEnhance.length === 0 && !isAlreadyEnhanced && !allEnhanced && (
          <div className="mb-8 p-6 bg-muted/50 rounded-xl text-center">
            <p className="text-muted-foreground">
              No questions available to enhance. All questions were either corrected by AI Fix or the paper is already enhanced.
            </p>
          </div>
        )}

        {/* Enhancement Status and Button Section */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {isEnhancing && (
            <div className="text-center">
              <p className="text-muted-foreground mb-2">
                Enhancing questions... {enhancedCount}/{questionsToEnhance.length > 0 ? questionsToEnhance.length : acceptedQuestions.filter(q => q.isEnhanced).length}
              </p>
              <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(enhancedCount / (questionsToEnhance.length > 0 ? questionsToEnhance.length : acceptedQuestions.filter(q => q.isEnhanced).length)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Show Enhance All button if there are questions to enhance and not all enhanced yet */}
          {!allEnhanced && !isAlreadyEnhanced && questionsToEnhance.length > 0 && (
            <Button
              onClick={handleEnhanceAll}
              disabled={isEnhancing || questionsToEnhance.length === 0}
              className="btn-primary h-12 px-8"
              size="lg"
            >
              {isEnhancing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Enhance All Questions
                </>
              )}
            </Button>
          )}

          {/* Blocking message: Show if not all enhanced yet */}
          {!allEnhanced && !isAlreadyEnhanced && (startedEnhancement || startedReEnhancement) && questionsToEnhance.length > 0 && enhancedCount < questionsToEnhance.length && (
            <div className="w-full max-w-2xl p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-1">
                    ⏳ Enhancement in Progress
                  </p>
                  <p className="text-sm text-amber-800">
                    {questionsToEnhance.length - enhancedCount} out of {questionsToEnhance.length} questions still need to be enhanced.
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Please wait for all questions to be enhanced before downloading or enhancing further.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success message and show Download + Enhance Further buttons ONLY when all enhanced */}
          {(allEnhanced || isAlreadyEnhanced) && (
            <div className="space-y-4 w-full max-w-md">
              {!isAlreadyEnhanced && allEnhanced && (
                <div className="text-center p-4 bg-success/10 rounded-xl border border-success/30">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="font-semibold text-success">All questions enhanced successfully! ✓</p>
                  <p className="text-xs text-muted-foreground mt-1">You can now download or enhance further</p>
                </div>
              )}

              <Button
                onClick={handleDownload}
                className="w-full btn-primary h-12"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Enhanced Question Paper
              </Button>

              <Button
                onClick={handleEnhanceFurther}
                variant="outline"
                className="w-full h-12 border-primary text-primary hover:bg-primary/10"
                disabled={isEnhancing}
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Re-enhancing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Enhance it Further
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-display font-bold text-foreground mb-4">How Enhancement Works</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold text-foreground mb-2">🎯 Maintains Difficulty</p>
              <p className="text-muted-foreground">
                Questions stay at the same RBT level - we only improve clarity, not complexity.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold text-foreground mb-2">✨ Professional Wording</p>
              <p className="text-muted-foreground">
                Academic language, proper grammar, and unambiguous phrasing for better understanding.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold text-foreground mb-2">📝 Student-Friendly</p>
              <p className="text-muted-foreground">
                Clearer instructions that help students understand exactly what's being asked.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EnhancePage;
