// const express = require('express');
// const cors = require('cors');
// const { Client } = require('pg');
// const { exec } = require('child_process');
// const app = express();

// // Enable CORS for GitHub Pages
// const corsOptions = {
//     origin: 'https://josephbeaureder.github.io',
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//     credentials: true,
//     optionsSuccessStatus: 204
// };
// app.use(cors(corsOptions));
// app.use(express.json());

// // PostgreSQL setup
// const client = new Client({
//     connectionString: process.env.DATABASE_URL,
//     ssl: process.env.DATABASE_URL.includes('railway.app')
// });
// client.connect().then(() => {
//     console.log('Connected to PostgreSQL');
//     client.query(`
//         CREATE TABLE IF NOT EXISTS conversations (
//             id SERIAL PRIMARY KEY,
//             name TEXT NOT NULL,
//             response TEXT NOT NULL,
//             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//         )
//     `);
// }).catch(err => console.error('Connection error:', err.stack));

// // Route to run Python and save the conversation
// app.post('/run-python', (req, res) => {
//     const { name } = req.body;
//     if (!name) return res.status(400).json({ error: 'Name is required', logs: ['Name parameter is missing'] });

//     console.log('Received request to run Python script with input:', name);

//     // Execute Python script
//     exec('python --version || python3 --version', (error, stdout, stderr) => {
//         if (error) {
//             console.error('Error checking Python version:', error);
//             return res.status(500).json({ error: 'Python is not installed', logs: ['Python version check failed'] });
//         }

//         console.log('Python version check successful:', stdout.trim());

//         exec(`python script.py "${name}" || python3 script.py "${name}"`, (error, stdout, stderr) => {
//             if (error) {
//                 console.error(`Error executing Python script: ${error}`);
//                 return res.status(500).json({ error: 'Script execution failed', logs: [`Python script error: ${error.message}`] });
//             }

//             const response = stdout.trim();
//             console.log('Python script output:', response);

//             // Store in PostgreSQL
//             client.query(
//                 'INSERT INTO conversations (name, response) VALUES ($1, $2) RETURNING id',
//                 [name, response],
//                 (err, result) => {
//                     if (err) {
//                         console.error('Error storing conversation:', err.message);
//                         return res.status(500).json({ error: 'Failed to store conversation', logs: [`Database error: ${err.message}`] });
//                     }

//                     console.log('Conversation stored with ID:', result.rows[0].id);
//                     res.json({
//                         response: response,
//                         logs: [
//                             'Python script executed successfully',
//                             `Python output: ${response}`,
//                             `Conversation stored with ID: ${result.rows[0].id}`
//                         ]
//                     });
//                 }
//             );
//         });
//     });
// });

// // Route to get all conversations
// app.get('/conversations', async (req, res) => {
//     try {
//         const result = await client.query('SELECT * FROM conversations ORDER BY created_at DESC');
//         console.log('Fetched conversations:', result.rows);
//         res.json({
//             conversations: result.rows,
//             logs: ['Conversations fetched successfully']
//         });
//     } catch (err) {
//         console.error('Error fetching conversations:', err.message);
//         res.status(500).json({ error: 'Failed to fetch conversations', logs: [`Database error: ${err.message}`] });
//     }
// });

// // Server start
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });



const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
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

// SQLite database setup
const db = new sqlite3.Database('./conversations.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            response TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
});

app.post('/run-python', async (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).send('Name is required');
    }
    
    console.log('Attempting to execute Python script with name:', name);
    
    // Try to check if Python is available
    exec('python --version || python3 --version', (error, stdout, stderr) => {
        console.log('Python version check:', stdout || stderr || 'No output');
        
        // Execute the Python script with the name as an argument
        exec(`python script.py "${name}" || python3 script.py "${name}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Python script: ${error}`);
                return res.status(500).send('Error executing script');
            }
            if (stderr) {
                console.error(`Python script stderr: ${stderr}`);
            }
            
            console.log('Python output:', stdout);
            const response = stdout.trim();
            
            // Store conversation in the database
            db.run('INSERT INTO conversations (name, response) VALUES (?, ?)', [name, response], function(err) {
                if (err) {
                    console.error('Error storing conversation in the database:', err.message);
                } else {
                    console.log('Conversation stored in the database with ID:', this.lastID);
                }
            });
            
            res.send(response);
        });
    });
});

// Use PORT environment variable provided by Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});