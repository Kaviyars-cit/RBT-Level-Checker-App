// utils/helpers.js

/**
 * Count how many questions fall into each cognitive level (L1–L6).
 * @param {Array} questions - Array of question objects
 * @returns {Object} levelCounts - { L1: x, L2: y, ... }
 */
exports.countLevels = (questions) => {
  const counts = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 };
  questions.forEach(q => {
    if (counts[q.level] !== undefined) {
      counts[q.level]++;
    }
  });
  return counts;
};

/**
 * Calculate percentage distribution of levels.
 * @param {Object} levelCounts - { L1: x, L2: y, ... }
 * @param {Number} total - total number of questions
 * @returns {Object} percentages - { L1: %, L2: %, ... }
 */
exports.calculatePercentages = (levelCounts, total) => {
  let percentages = {};
  for (let level in levelCounts) {
    percentages[level] = total > 0 ? (levelCounts[level] / total) * 100 : 0;
  }
  return percentages;
};

/**
 * Validate if OR pair questions match in level and CO.
 * @param {Object} q1 - first question
 * @param {Object} q2 - second question
 * @returns {Array} errors - list of mismatch issues
 */
exports.validateOrPair = (q1, q2) => {
  let errors = [];
  if (q1.level !== q2.level) {
    errors.push({
      part: q1.part,
      questionNo: `${q1.questionNo}/${q2.questionNo}`,
      issue: "Level mismatch in OR pair",
      expected: q1.level,
      found: q2.level
    });
  }
  if (q1.co !== q2.co) {
    errors.push({
      part: q1.part,
      questionNo: `${q1.questionNo}/${q2.questionNo}`,
      issue: "CO mismatch in OR pair",
      expected: q1.co,
      found: q2.co
    });
  }
  return errors;
};

/**
 * Utility to create error objects consistently.
 */
exports.makeError = (part, questionNo, issue, expected, found) => {
  return { part, questionNo, issue, expected, found };
};
