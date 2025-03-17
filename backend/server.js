const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();

// Enable CORS for a specific domain (your GitHub Pages URL)
const corsOptions = {
    origin: 'https://josephbeaureder.github.io',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Your Python execution route
app.post('/run-python', (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).send('Name is required');
    }
    
    // Execute the Python script with the name as an argument
    exec(`python script.py "${name}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Python script: ${error}`);
            return res.status(500).send('Error executing script');
        }
        if (stderr) {
            console.error(`Python script stderr: ${stderr}`);
        }
        
        // Send the output of the Python script
        res.send(stdout.trim());
    });
});

// Use PORT environment variable provided by Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});