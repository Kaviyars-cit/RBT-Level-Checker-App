
import { describe, it, expect } from 'vitest';
import { validateIA1, ValidationResult, ValidationError } from '../services/validationService';
import { Question } from '../components/QuestionDisplay';

describe('Verification Issue Reproduction', () => {
    it('should invalidate Part B if a fixed question still violates rules', () => {
        // Setup a Part B question that violates the "16 marks -> L4/L5/L6" rule
        // BUT simulate that it has been "fixed" by the user/AI (isFixed: true)
        // The issue is that validateIA1 might still flag it, causing isValid: false in partAnalysis.

        const fixedQuestion: Question = {
            id: 'q1',
            questionNumber: '11',
            text: 'Explain something',
            marks: 16,
            detectedLevel: 'L2', // Still invalid level for 16 marks (should be L4+)
            expectedLevel: 'L4',
            co: 'CO1',
            hasError: false, // cleared by fix
            isFixed: true,   // marked as fixed
            errorMessage: undefined
        };

        const partA: Question[] = []; // empty part A for simplicity (might trigger missing part error but we focus on Part B analysis)
        const partB: Question[] = [fixedQuestion];

        // Run validation
        const result = validateIA1({ partA, partB });

        // EXPECTATION: 
        // If validation ignores isFixed, it will flag this question as error.
        // result.partAnalysis.partB.isValid will be FALSE.
        // result.errors will contain the error.

        // In the frontend, handleFixAllQuestions uses the result from validateIA1 
        // and tries to patch it. But if validateIA1 returns isValid: false, 
        // and the patch logic doesn't override it correctly for all cases, 
        // we get the red box.

        // Specifically, let's see if validateIA1 respects isFixed.
        if (!result.partAnalysis.partB.isValid) {
            console.error('Validation failed with errors:', JSON.stringify(result.partAnalysis.partB.errors, null, 2));
        }
        expect(result.partAnalysis.partB.isValid).toBe(true);
        // If this fails, then our hypothesis is confirmed: validateIA1 flags fixed questions.
    });
});
