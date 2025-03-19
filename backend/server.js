const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();

// Enable CORS for GitHub Pages
const corsOptions = {
    // Allow requests from GitHub Pages and also from local development
    origin: ['https://josephbeaureder.github.io', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Simple health check route
app.get('/', (req, res) => {
    console.log('Received connection test request');
    res.json({ 
        status: 'Backend is running',
        timestamp: new Date().toISOString(),
        logs: ['Backend connection test successful']
    });
});

// Route to run Python script
app.post('/run-python', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required', logs: ['Name parameter is missing'] });
    
    console.log('Received request to run Python script with input:', name);
    
    // Execute Python script
    exec('python --version || python3 --version', (error, stdout, stderr) => {
        if (error) {
            console.error('Error checking Python version:', error);
            return res.status(500).json({ error: 'Python is not installed', logs: ['Python version check failed'] });
        }
        
        console.log('Python version check successful:', stdout.trim());
        
        exec(`python script.py "${name}" || python3 script.py "${name}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Python script: ${error}`);
                return res.status(500).json({ error: 'Script execution failed', logs: [`Python script error: ${error.message}`] });
            }
            
            const response = stdout.trim();
            console.log('Python script output:', response);
            
            // Simply return the response from the Python script
            res.json({
                response: response,
                logs: [
                    'Python script executed successfully',
                    `Python output: ${response}`
                ]
            });
        });
    });
});

// Server start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Backend ready at http://localhost:${PORT}`);
});