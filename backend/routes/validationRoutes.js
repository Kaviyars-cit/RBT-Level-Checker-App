// routes/validationRoutes.js

const express = require('express');
const router = express.Router();
const validationService = require('../services/validationService');

// ✅ IA1 Validation
router.post('/ia1', (req, res) => {
  const questions = req.body.questions; // Expect JSON array of parsed questions
  const result = validationService.validateIA1(questions);
  res.json(result);
});

// ✅ IA2 Validation
router.post('/ia2', (req, res) => {
  const questions = req.body.questions;
  const result = validationService.validateIA2(questions);
  res.json(result);
});

// ✅ IA3 Validation
router.post('/ia3', (req, res) => {
  const questions = req.body.questions;
  const result = validationService.validateIA3(questions);
  res.json(result);
});

module.exports = router;