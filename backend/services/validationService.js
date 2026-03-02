const { countLevels, calculatePercentages, validateOrPair, makeError } = require('../utils/helpers');

exports.validateIA1 = (questions) => {
  const errors = [];
  const partA = questions.filter(q => q.part === 'A');
  const partB = questions.filter(q => q.part === 'B');

  // PART A: CO1 only, L1 (60%), L2 (40%)
  partA.forEach(q => {
    if (q.co !== 'CO1') {
      errors.push(makeError('A', q.questionNo, 'Wrong CO', 'CO1', q.co));
    }
    if (!['L1', 'L2'].includes(q.level)) {
      errors.push(makeError('A', q.questionNo, 'Invalid Level', 'L1 or L2', q.level));
    }
  });

  // PART B: L2–L5 (12×2), L4–L6 (16×1), OR choices must match level
  partB.forEach(q => {
    if (!['L2', 'L3', 'L4', 'L5'].includes(q.level)) {
      errors.push(makeError('B', q.questionNo, 'Invalid Level', 'L2–L5', q.level));
    }
  });

  // OVERALL DISTRIBUTION
  const levelCounts = countLevels(questions);
  const total = questions.length;
  const percentages = calculatePercentages(levelCounts, total);

  const low = (percentages.L1 || 0) + (percentages.L2 || 0);
  const mid = percentages.L3 || 0;
  const high = (percentages.L4 || 0) + (percentages.L5 || 0) + (percentages.L6 || 0);

  if (low < 35 || low > 45) {
    errors.push(makeError('-', '-', 'L1 & L2 distribution off', '≈40%', `${low.toFixed(1)}%`));
  }
  if (mid < 35 || mid > 45) {
    errors.push(makeError('-', '-', 'L3 distribution off', '≈40%', `${mid.toFixed(1)}%`));
  }
  if (high < 15 || high > 25) {
    errors.push(makeError('-', '-', 'L4–L6 distribution off', '≈20%', `${high.toFixed(1)}%`));
  }

  return errors.length ? { status: 'REJECTED', errors } : { status: 'ACCEPTED', errors: [] };
};

exports.validateIA2 = (questions) => {
  const errors = [];
  const partA = questions.filter(q => q.part === 'A');
  const partB = questions.filter(q => q.part === 'B');

  // PART A: CO2 & CO3 only, L1 & L2 only
  partA.forEach(q => {
    if (!['CO2', 'CO3'].includes(q.co)) {
      errors.push(makeError('A', q.questionNo, 'Wrong CO', 'CO2 or CO3', q.co));
    }
    if (!['L1', 'L2'].includes(q.level)) {
      errors.push(makeError('A', q.questionNo, 'Invalid Level', 'L1 or L2', q.level));
    }
  });

  // PART B: OR questions must match level and CO
  for (let i = 0; i < partB.length; i += 2) {
    const q1 = partB[i];
    const q2 = partB[i + 1];
    if (q1 && q2) {
      const pairErrors = validateOrPair(q1, q2);
      errors.push(...pairErrors);
    }
  }

  // OVERALL DISTRIBUTION same as IA1
  const levelCounts = countLevels(questions);
  const total = questions.length;
  const percentages = calculatePercentages(levelCounts, total);

  const low = (percentages.L1 || 0) + (percentages.L2 || 0);
  const mid = percentages.L3 || 0;
  const high = (percentages.L4 || 0) + (percentages.L5 || 0) + (percentages.L6 || 0);

  if (low < 35 || low > 45) {
    errors.push(makeError('-', '-', 'L1 & L2 distribution off', '≈40%', `${low.toFixed(1)}%`));
  }
  if (mid < 35 || mid > 45) {
    errors.push(makeError('-', '-', 'L3 distribution off', '≈40%', `${mid.toFixed(1)}%`));
  }
  if (high < 15 || high > 25) {
    errors.push(makeError('-', '-', 'L4–L6 distribution off', '≈20%', `${high.toFixed(1)}%`));
  }

  return errors.length ? { status: 'REJECTED', errors } : { status: 'ACCEPTED', errors: [] };
};

exports.validateIA3 = (questions) => {
  const errors = [];
  const partA = questions.filter(q => q.part === 'A');
  const partB = questions.filter(q => q.part === 'B');
  const partC = questions.filter(q => q.part === 'C');

  // PART A: 10 questions, CO1–CO5 twice, 1 L1 + 1 L2 per CO
  const coMap = {};
  partA.forEach(q => {
    if (!coMap[q.co]) coMap[q.co] = [];
    coMap[q.co].push(q.level);
  });

  for (let i = 1; i <= 5; i++) {
    const co = `CO${i}`;
    const levels = coMap[co] || [];
    const hasL1 = levels.includes('L1');
    const hasL2 = levels.includes('L2');
    if (!hasL1 || !hasL2) {
      errors.push(makeError('A', '-', `CO${i} missing L1 or L2`, 'L1 & L2', levels.join(', ') || 'None'));
    }
  }

  // PART B: OR pairs, L2–L5, same CO and level
  for (let i = 0; i < partB.length; i += 2) {
    const q1 = partB[i];
    const q2 = partB[i + 1];
    if (q1 && q2) {
      const pairErrors = validateOrPair(q1, q2);
      if (!['L2', 'L3', 'L4', 'L5'].includes(q1.level)) {
        pairErrors.push(makeError('B', q1.questionNo, 'Invalid Level', 'L2–L5', q1.level));
      }
      errors.push(...pairErrors);
    }
  }

  // PART C: 2 questions, L4–L6, different COs
  if (partC.length !== 2) {
    errors.push(makeError('C', '-', 'Incorrect number of questions', '2', partC.length));
  } else {
    const [q1, q2] = partC;
    if (q1.co === q2.co) {
      errors.push(makeError('C', `${q1.questionNo}/${q2.questionNo}`, 'COs must differ', 'Different COs', `${q1.co}, ${q2.co}`));
    }
    [q1, q2].forEach(q => {
      if (!['L4', 'L5', 'L6'].includes(q.level)) {
        errors.push(makeError('C', q.questionNo, 'Invalid Level', 'L4–L6', q.level));
      }
    });
  }

  // OVERALL DISTRIBUTION
  const levelCounts = countLevels(questions);
  const total = questions.length;
  const percentages = calculatePercentages(levelCounts, total);

  const low = (percentages.L1 || 0) + (percentages.L2 || 0);
  const mid = percentages.L3 || 0;
  const high = (percentages.L4 || 0) + (percentages.L5 || 0) + (percentages.L6 || 0);

  if (low < 35 || low > 45) {
    errors.push(makeError('-', '-', 'L1 & L2 distribution off', '≈40%', `${low.toFixed(1)}%`));
  }
  if (mid < 35 || mid > 45) {
    errors.push(makeError('-', '-', 'L3 distribution off', '≈40%', `${mid.toFixed(1)}%`));
  }
  if (high < 15 || high > 25) {
    errors.push(makeError('-', '-', 'L4–L6 distribution off', '≈20%', `${high.toFixed(1)}%`));
  }

  return errors.length ? { status: 'REJECTED', errors } : { status: 'ACCEPTED', errors: [] };
};
