// routes/downloadRoutes.js

const express = require('express');
const router = express.Router();
const fileService = require('../services/fileService');
const { generateDocxFromHtml } = require('../services/fileService');

/**
 * GET /api/download/:paperId
 * Generates corrected HTML for the given paperId
 * and triggers a file download in the browser.
 */
router.get('/:paperId', async (req, res) => {
  try {
    const { paperId } = req.params;
    if (!paperId) {
      return res.status(400).json({ error: "Paper ID required" });
    }

    const docBuffer = await fileService.generateDocx(paperId);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="corrected.docx"'
    );
    res.send(docBuffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed", details: err.message });
  }
});

router.post("/download", async (req, res) => {
  const { html } = req.body;

  const buffer = await generateDocxFromHtml(html);

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Corrected_Question_Paper.docx"
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  res.send(buffer);
});

module.exports = router;