import { CheckCircle2, XCircle, AlertTriangle, Download, Lock, Sparkles, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PartAnalysis } from '@/services/validationService';
import { Question } from '@/components/QuestionDisplay';
import { ParseResult } from '@/services/htmlParser';
import { stripHtmlForAI, containsHtml } from '@/utils/htmlUtils';

interface VerificationError {
  part: string;
  questionNumber: string;
  issue: string;
  suggestion: string;
}

interface VerificationResultsProps {
  status: 'accepted' | 'rejected' | null;
  errors: VerificationError[];
  levelDistribution: {
    l1l2: number;
    l3: number;
    l4l5l6: number;
  };
  partAnalysis?: {
    partA: PartAnalysis;
    partB: PartAnalysis;
    partC?: PartAnalysis;
  };
  allErrorsFixed?: boolean;
  onDownload: () => void;
  parseResult?: ParseResult;
  iaType?: 'IA1' | 'IA2' | 'IA3';
  acceptedQuestions?: Question[];
  validationResult?: any;
  onFixAll?: () => void;
  onMatchDistribution?: () => void;
  isFixingAll?: boolean;
  isMatchingDistribution?: boolean;
  fixProgress?: { completed: number; total: number };
}

// Check if distribution meets the target (±10% tolerance)
const isDistributionMet = (dist: { l1l2: number; l3: number; l4l5l6: number }): boolean => {
  const tolerance = 10;
  const l1l2Ok = Math.abs(dist.l1l2 - 40) <= tolerance;
  const l3Ok = Math.abs(dist.l3 - 40) <= tolerance;
  const l4l5l6Ok = Math.abs(dist.l4l5l6 - 20) <= tolerance;
  return l1l2Ok && l3Ok && l4l5l6Ok;
};

const getDistCellClass = (actual: number, target: number): string => {
  const tolerance = 10;
  if (Math.abs(actual - target) <= tolerance) {
    return 'bg-success/10 border border-success/30';
  }
  return 'bg-destructive/10 border border-destructive/30';
};

const VerificationResults = ({
  status,
  errors,
  levelDistribution,
  partAnalysis,
  allErrorsFixed = false,
  onDownload,
  parseResult,
  iaType,
  acceptedQuestions = [],
  validationResult,
  onFixAll,
  onMatchDistribution,
  isFixingAll = false,
  isMatchingDistribution = false,
  fixProgress,
}: VerificationResultsProps) => {
  const navigate = useNavigate();

  if (status === null) return null;

  const distributionMet = isDistributionMet(levelDistribution);
  const hasErrors = errors.length > 0 && !allErrorsFixed;
  // Accept ONLY if: no question-level errors AND distribution targets are met
  // The paper should stay REJECTED until the user presses "Match % Target Distribution"
  const isAccepted = !hasErrors && distributionMet;
  const canDownload = isAccepted;

  const handleEnhance = () => {
    if (parseResult && iaType) {
      navigate('/enhance', {
        state: {
          parseResult,
          iaType,
          acceptedQuestions,
          validationResult
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Fix All ✨ Button - shown first when there are errors */}
      {hasErrors && onFixAll && (
        <div className="space-y-2">
          <Button
            onClick={onFixAll}
            disabled={isFixingAll || isMatchingDistribution}
            className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base"
          >
            {isFixingAll ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {fixProgress
                  ? `Fixing ${fixProgress.completed}/${fixProgress.total} questions...`
                  : 'Fixing All Questions...'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Fix All ✨
              </>
            )}
          </Button>
          {isFixingAll && fixProgress && fixProgress.total > 0 && (
            <div className="w-full bg-purple-200 dark:bg-purple-900/30 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.round((fixProgress.completed / fixProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Match % Target Distribution Button - shown right after Fix All */}
      {!distributionMet && onMatchDistribution && (
        <Button
          onClick={onMatchDistribution}
          disabled={isMatchingDistribution || isFixingAll || hasErrors}
          className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base"
        >
          {isMatchingDistribution ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Matching Target Distribution...
            </>
          ) : (
            <>
              <Target className="w-5 h-5 mr-2" />
              Match % Target Distribution
            </>
          )}
        </Button>
      )}

      {/* Disabled hint for Match Distribution when there are still errors */}
      {!distributionMet && hasErrors && onMatchDistribution && (
        <p className="text-xs text-center text-amber-600">
          Use "Fix All ✨" first to fix question errors, then match the target distribution
        </p>
      )}

      {/* Overall Level Distribution */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3">Overall Level Distribution</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className={`text-center p-3 rounded-lg ${getDistCellClass(levelDistribution.l1l2, 40)}`}>
            <p className="text-2xl font-bold text-primary">{levelDistribution.l1l2}%</p>
            <p className="text-xs text-muted-foreground">L1 & L2</p>
            <p className="text-xs text-muted-foreground">(Target: 40%)</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${getDistCellClass(levelDistribution.l3, 40)}`}>
            <p className="text-2xl font-bold text-primary">{levelDistribution.l3}%</p>
            <p className="text-xs text-muted-foreground">L3</p>
            <p className="text-xs text-muted-foreground">(Target: 40%)</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${getDistCellClass(levelDistribution.l4l5l6, 20)}`}>
            <p className="text-2xl font-bold text-primary">{levelDistribution.l4l5l6}%</p>
            <p className="text-xs text-muted-foreground">L4, L5 & L6</p>
            <p className="text-xs text-muted-foreground">(Target: 20%)</p>
          </div>
        </div>
      </div>

      {/* Part-wise Analysis */}
      {partAnalysis && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h4 className="font-semibold text-foreground mb-3">Part-wise Analysis</h4>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Part A */}
            <div className={`p-3 rounded-lg ${partAnalysis.partA.isValid ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Part A</span>
                {partAnalysis.partA.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{partAnalysis.partA.totalQuestions} questions</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(partAnalysis.partA.levelCounts).map(([level, count]) =>
                  count > 0 && (
                    <span key={level} className="text-xs bg-muted px-2 py-0.5 rounded">
                      {level}: {count}
                    </span>
                  )
                )}
              </div>
              {!partAnalysis.partA.isValid && (
                <p className="text-xs text-destructive mt-2">{partAnalysis.partA.errors.length} issue(s)</p>
              )}
            </div>

            {/* Part B */}
            <div className={`p-3 rounded-lg ${partAnalysis.partB.isValid ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Part B</span>
                {partAnalysis.partB.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{partAnalysis.partB.totalQuestions} questions</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(partAnalysis.partB.levelCounts).map(([level, count]) =>
                  count > 0 && (
                    <span key={level} className="text-xs bg-muted px-2 py-0.5 rounded">
                      {level}: {count}
                    </span>
                  )
                )}
              </div>
              {!partAnalysis.partB.isValid && (
                <p className="text-xs text-destructive mt-2">{partAnalysis.partB.errors.length} issue(s)</p>
              )}
            </div>

            {/* Part C (if exists) */}
            {partAnalysis.partC && (
              <div className={`p-3 rounded-lg ${partAnalysis.partC.isValid ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Part C</span>
                  {partAnalysis.partC.isValid ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{partAnalysis.partC.totalQuestions} questions</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(partAnalysis.partC.levelCounts).map(([level, count]) =>
                    count > 0 && (
                      <span key={level} className="text-xs bg-muted px-2 py-0.5 rounded">
                        {level}: {count}
                      </span>
                    )
                  )}
                </div>
                {!partAnalysis.partC.isValid && (
                  <p className="text-xs text-destructive mt-2">{partAnalysis.partC.errors.length} issue(s)</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Errors Section */}
      {hasErrors && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-destructive/10 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h4 className="font-semibold text-destructive">Issues Found</h4>
          </div>
          <div className="divide-y divide-border">
            {errors.map((error, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-destructive/10 text-destructive text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      Part {error.part}, Question {error.questionNumber}
                    </p>
                    <p className="text-sm text-destructive mt-1">{error.issue}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      💡 Suggestion: {error.suggestion}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "All Errors Are Fixed" Banner */}
      {allErrorsFixed && isAccepted && (
        <div className="rounded-xl p-4 flex items-center gap-4 bg-success/10 border border-success/30 animate-in fade-in slide-in-from-top-2 duration-500">
          <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
          <div>
            <h3 className="text-lg font-display font-bold text-success">
              ✅ All errors are fixed
            </h3>
            <p className="text-sm text-muted-foreground">
              This question paper has passed all RBT level, CO, and distribution validations. It is ready for download or enhancement.
            </p>
          </div>
        </div>
      )}

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-4 ${isAccepted
        ? 'bg-success/10 border border-success/30'
        : 'bg-destructive/10 border border-destructive/30'
        }`}>
        {isAccepted ? (
          <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
        ) : (
          <XCircle className="w-8 h-8 text-destructive shrink-0" />
        )}
        <div>
          <h3 className={`text-lg font-display font-bold ${isAccepted ? 'text-success' : 'text-destructive'
            }`}>
            STATUS: {isAccepted ? 'ACCEPTED' : 'REJECTED'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAccepted
              ? 'All verification checks passed successfully.'
              : hasErrors
                ? `${errors.length} issue(s) found. Use "Fix All ✨" to fix them.`
                : !distributionMet
                  ? 'Level distribution does not match the target (40% L1L2, 40% L3, 20% L4+). Press "Match % Target Distribution" to fix.'
                  : 'Issues need to be resolved before the paper can be accepted.'
            }
          </p>
        </div>
      </div>

      {/* Download and Enhance Buttons */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <Button
            onClick={onDownload}
            className="flex-1 btn-primary"
            disabled={!canDownload}
          >
            {canDownload ? (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Verified Paper
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Fix All Errors to Download
              </>
            )}
          </Button>

          {parseResult && iaType && (
            <Button
              onClick={handleEnhance}
              variant="outline"
              className={`flex-1 ${isAccepted
                ? 'border-primary text-primary hover:bg-primary/10'
                : 'border-muted-foreground/30 text-muted-foreground cursor-not-allowed opacity-60'
                }`}
              disabled={!isAccepted}
            >
              {isAccepted ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enhance the Questions
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Enhance the Questions
                </>
              )}
            </Button>
          )}
        </div>

        {!canDownload && (
          <p className="text-xs text-center text-muted-foreground">
            {hasErrors
              ? 'Use "Fix All ✨" to fix all question errors, then match the distribution'
              : 'Use "Match % Target Distribution" to achieve the required level balance before downloading or enhancing'
            }
          </p>
        )}
      </div>
    </div>
  );
};

export default VerificationResults;
