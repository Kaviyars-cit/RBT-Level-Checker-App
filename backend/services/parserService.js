const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

async function parseDocx(filePath) {
  const imageDir = path.join("uploads", "images");
  if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

  const result = await mammoth.convertToHtml(
    { path: filePath },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const imageName = `img_${Date.now()}.png`;
        const imagePath = path.join(imageDir, imageName);

        fs.writeFileSync(imagePath, buffer);

        return {
          src: `http://localhost:5000/uploads/images/${imageName}`
        };
      })
    }
  );

  return result.value; // HTML with <img src="...">
}

module.exports = { parseDocx };