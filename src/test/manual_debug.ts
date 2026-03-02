
import { validateIA1 } from '../services/validationService';
import { Question } from '../components/QuestionDisplay';

const fixedQuestion: Question = {
    id: 'q1',
    questionNumber: '11',
    text: 'Explain something',
    marks: 16,
    detectedLevel: 'L2',
    expectedLevel: 'L4',
    co: 'CO1',
    hasError: false,
    isFixed: true,
    errorMessage: undefined
};

const partA: Question[] = [];
const partB: Question[] = [fixedQuestion];

console.log('--- Starting Manual Validation ---');
try {
    const result = validateIA1({ partA, partB });
    console.log('--- Validation Complete ---');
    console.log('Part B Valid:', result.partAnalysis.partB.isValid);
    if (!result.partAnalysis.partB.isValid) {
        console.log('Part B Errors:', JSON.stringify(result.partAnalysis.partB.errors, null, 2));
    }
} catch (e) {
    console.error('--- CRASH ---');
    console.error(e);
}
