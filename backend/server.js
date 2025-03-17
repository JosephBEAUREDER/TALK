const express = require('express');
const cors = require('cors'); // Import the CORS middleware

const app = express();

// Enable CORS for a specific domain (your GitHub Pages URL)
const corsOptions = {
    origin: 'https://josephbeaureder.github.io/TALK/frontend/', // Replace with your actual GitHub Pages URL
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type',
};

app.use(cors(corsOptions)); // Enable CORS for the specific domain

// Your existing routes
app.post('/run-python', (req, res) => {
    // Your code to run the Python function
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
