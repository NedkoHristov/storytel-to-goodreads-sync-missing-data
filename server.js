const path = require("path");
const express = require("express");
const compression = require("compression");

const app = express();
const PORT = process.env.PORT || 4173;
const publicDir = path.join(__dirname, "public");

app.use(compression());
app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Storytel ⇄ Goodreads tool running on port ${PORT}`);
});
