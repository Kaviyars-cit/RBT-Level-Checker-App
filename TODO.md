# Code Corrections Plan

## Information Gathered
- The validation service checks for distribution ranges but does not enforce exact targets.
- Current validation allows L1&L2 35-45%, L3 35-45%, L4-L6 15-25%.
- User requires exact: Part A L1 50%, L2 40%, L3 10%; Overall L1&L2 40%, L3 40%, L4-L6 20%.
- Need to modify validation to adjust question levels to meet targets while respecting part-specific rules.

## Plan
- Modified validationService.js to include correction logic:
  - After initial validation, calculate current distribution.
  - If off target, adjust levels of questions in Part A and overall to meet exact percentages.
  - For Part A: Adjust within L1/L2/L3 (for IA3) to reach 50% L1, 40% L2, 10% L3.
  - For overall: Adjust levels across all parts to reach 40% L1&L2, 40% L3, 20% L4-L6.
  - Ensure adjustments don't violate CO and part rules.
- Added helper functions in helpers.js for distribution calculation and adjustment.

## Dependent Files to be Edited
- backend/services/validationService.js
- backend/utils/helpers.js

## Followup Steps
- Test validation with sample question sets.
- Verify corrections maintain question validity.
- Run ESLint to check for errors.
