const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require('child_process');
const app = express();

// Enable CORS for GitHub Pages
const corsOptions = {
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

// PostgreSQL setup using Pool for better connection management
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('Database connection error:', err.message);
        console.log('Application will continue without database storage');
    } else {
        console.log('Successfully connected to PostgreSQL at:', result.rows[0].now);
        
        // Create tables if they don't exist
        pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_input TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        .then(() => console.log('Messages table created or already exists'))
        .catch(err => console.error('Error creating table:', err.message));
    }
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

// Route to run Python script and store messages
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
            
            // Store message in PostgreSQL
            pool.query(
                'INSERT INTO messages (user_input, response) VALUES ($1, $2) RETURNING id',
                [name, response],
                (err, result) => {
                    if (err) {
                        console.error('Error storing message:', err.message);
                        // Return response even if DB storage fails
                        return res.json({
                            response: response,
                            logs: [
                                'Python script executed successfully',
                                `Python output: ${response}`,
                                `Database error: ${err.message}`
                            ]
                        });
                    }
                    
                    const messageId = result?.rows?.[0]?.id;
                    console.log('Message stored with ID:', messageId);
                    res.json({
                        response: response,
                        messageId: messageId,
                        logs: [
                            'Python script executed successfully',
                            `Python output: ${response}`,
                            `Message stored with ID: ${messageId}`
                        ]
                    });
                }
            );
        });
    });
});

// Route to get all messages
app.get('/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
        console.log(`Fetched ${result.rows.length} messages`);
        res.json({
            messages: result.rows,
            logs: [`Successfully fetched ${result.rows.length} messages`]
        });
    } catch (err) {
        console.error('Error fetching messages:', err.message);
        res.status(500).json({ error: 'Failed to fetch messages', logs: [`Database error: ${err.message}`] });
    }
});

// Server start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Backend ready at http://localhost:${PORT}`);
});