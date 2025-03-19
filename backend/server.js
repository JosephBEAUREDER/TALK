const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const { exec } = require('child_process');
const app = express();

// Enable CORS for GitHub Pages
const corsOptions = {
    origin: 'https://josephbeaureder.github.io',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors()); 
app.use(express.json());

// PostgreSQL setup
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway.app')
});
client.connect().then(() => {
    console.log('Connected to PostgreSQL');
    client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            response TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}).catch(err => console.error('Connection error:', err.stack));

// Route to run Python and save the conversation
app.post('/run-python', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send('Name is required');

    // Execute Python script
    exec('python --version || python3 --version', () => {
        exec(`python script.py "${name}" || python3 script.py "${name}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Python: ${error}`);
                return res.status(500).send('Script execution failed');
            }

            const response = stdout.trim();
            console.log('Python output:', response);

            // Store in PostgreSQL
            client.query(
                'INSERT INTO conversations (name, response) VALUES ($1, $2) RETURNING id',
                [name, response],
                (err, result) => {
                    if (err) {
                        console.error('Error storing conversation:', err.message);
                        return res.status(500).send('Failed to store conversation');
                    }
                    console.log('Stored with ID:', result.rows[0].id);
                    res.send(response);
                }
            );
        });
    });
});

// Route to get all conversations
app.get('/conversations', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM conversations ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching conversations:', err.message);
        res.status(500).send('Failed to fetch conversations');
    }
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
