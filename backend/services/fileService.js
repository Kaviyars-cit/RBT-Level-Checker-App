const { Document, Packer, Paragraph, TextRun, ImageRun } = require("docx");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

async function fetchImageBuffer(url) {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    return Buffer.from(base64, 'base64');
  }
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
}

async function generateDocxFromHtml(html) {
  const paragraphs = [];

  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  let lastIndex = 0;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const beforeText = html
      .substring(lastIndex, match.index)
      .replace(/<[^>]*>/g, "")
      .trim();

    if (beforeText) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(beforeText)]
        })
      );
    }

    try {
      const imageUrl = match[1];
      const buffer = await fetchImageBuffer(imageUrl);

      paragraphs.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: buffer,
              transformation: {
                width: 400,
                height: 250
              }
            })
          ]
        })
      );
    } catch (err) {
      console.error(`[DocGen] Failed to fetch image:`, err);
    }

    lastIndex = imgRegex.lastIndex;
  }

  const remainingText = html
    .substring(lastIndex)
    .replace(/<[^>]*>/g, "")
    .trim();

  if (remainingText) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun(remainingText)]
      })
    );
  }

  const doc = new Document({
    sections: [{ children: paragraphs }]
  });

  return await Packer.toBuffer(doc);
}

// Keep the specific generateDocx the user was working on
async function generateDocx(paperId) {
  const children = [new Paragraph(`Corrected Paper for ID: ${paperId}`)];
  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

module.exports = { generateDocxFromHtml, generateDocx, fetchImageBuffer };