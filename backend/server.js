const express = require('express');
const cors = require('cors');
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

// Your existing routes
app.post('/run-python', (req, res) => {
    // Your code to run the Python function
    res.send('Python function executed!');
});

// Use PORT environment variable provided by Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});