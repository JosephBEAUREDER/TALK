const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Call Python script
app.post("/run-python", (req, res) => {
  const name = req.body.name || "World";
  
  exec(`python3 script.py ${name}`, (error, stdout, stderr) => {
    if (error) return res.status(500).send(error.message);
    res.send(stdout.trim());
  });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
