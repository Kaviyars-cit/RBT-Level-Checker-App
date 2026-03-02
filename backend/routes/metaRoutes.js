const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    institution: "Chennai Institute of Technology",
    logoUrl: "/assets/logo.png",
    dateTime: new Date().toISOString()
  });
});

module.exports = router;