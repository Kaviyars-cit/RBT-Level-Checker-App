const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const parserService = require('../services/parserService');

// IA1 → HTML only
router.post('/ia1', upload.single('file'), async (req, res) => {
  if (!req.file.originalname.endsWith('.html')) {
    return res.status(400).json({ error: "IA1 accepts only .html files" });
  }
  const parsed = await parserService.parseHTML(req.file.path);
  res.json(parsed);
});

// IA2 → PDF, DOCX
router.post('/ia2', upload.single('file'), async (req, res) => {
  const ext = req.file.originalname.split('.').pop();
  if (!['pdf', 'docx'].includes(ext)) {
    return res.status(400).json({ error: "IA2 accepts only .pdf or .docx files" });
  }
  const parsed = await parserService.parseFile(req.file.path, ext);
  res.json(parsed);
});

// IA3 → PDF, DOCX, HTML
router.post('/ia3', upload.single('file'), async (req, res) => {
  const ext = req.file.originalname.split('.').pop();
  if (!['pdf', 'docx', 'html'].includes(ext)) {
    return res.status(400).json({ error: "IA3 accepts .pdf, .docx, .html files" });
  }
  const parsed = await parserService.parseFile(req.file.path, ext);
  res.json(parsed);
});

module.exports = router;