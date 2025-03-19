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
            CREATE TABLE IF NOT EXISTS conversations (
                id VARCHAR(255) PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        .then(() => console.log('Conversations table created or already exists'))
        .catch(err => console.error('Error creating conversations table:', err.message));

        pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(255) NOT NULL,
                role VARCHAR(10) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        `)
        .then(() => console.log('Messages table created or already exists'))
        .catch(err => console.error('Error creating messages table:', err.message));
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
app.post('/run-python', async (req, res) => {
    const { name, conversationId, isNewConversation } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required', logs: ['Name parameter is missing'] });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID is required', logs: ['Conversation ID is missing'] });
    
    console.log('Received request to run Python script with input:', name);
    console.log('Conversation ID:', conversationId);
    
    try {
        // If this is a new conversation, create it in the database
        if (isNewConversation) {
            const title = name.substring(0, 30) + (name.length > 30 ? '...' : '');
            await pool.query(
                'INSERT INTO conversations (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = CURRENT_TIMESTAMP',
                [conversationId, title]
            );
            console.log('Created new conversation:', conversationId);
        }
        
        // Store user message
        await pool.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [conversationId, 'user', name]
        );
        console.log('Stored user message for conversation:', conversationId);
        
        // Execute Python script
        exec('python --version || python3 --version', (error, stdout, stderr) => {
            if (error) {
                console.error('Error checking Python version:', error);
                return res.status(500).json({ error: 'Python is not installed', logs: ['Python version check failed'] });
            }
            
            console.log('Python version check successful:', stdout.trim());
            
            exec(`python script.py "${name}" || python3 script.py "${name}"`, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing Python script: ${error}`);
                    return res.status(500).json({ error: 'Script execution failed', logs: [`Python script error: ${error.message}`] });
                }
                
                const response = stdout.trim();
                console.log('Python script output:', response);
                
                try {
                    // Store AI response
                    await pool.query(
                        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                        [conversationId, 'ai', response]
                    );
                    console.log('Stored AI response for conversation:', conversationId);
                    
                    // Update conversation last updated timestamp
                    await pool.query(
                        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                        [conversationId]
                    );
                    
                    res.json({
                        response: response,
                        logs: [
                            'Python script executed successfully',
                            `Python output: ${response}`,
                            `Message stored for conversation: ${conversationId}`
                        ]
                    });
                } catch (err) {
                    console.error('Error storing message:', err.message);
                    res.json({
                        response: response,
                        logs: [
                            'Python script executed successfully',
                            `Python output: ${response}`,
                            `Database error: ${err.message}`
                        ]
                    });
                }
            });
        });
    } catch (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: 'Database error', logs: [`Database error: ${err.message}`] });
    }
});

// Route to get all conversations
app.get('/conversations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM conversations ORDER BY updated_at DESC');
        console.log(`Fetched ${result.rows.length} conversations`);
        res.json({
            conversations: result.rows,
            logs: [`Successfully fetched ${result.rows.length} conversations`]
        });
    } catch (err) {
        console.error('Error fetching conversations:', err.message);
        res.status(500).json({ error: 'Failed to fetch conversations', logs: [`Database error: ${err.message}`] });
    }
});

// Route to get messages for a specific conversation
app.get('/conversations/:conversationId/messages', async (req, res) => {
    const { conversationId } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [conversationId]
        );
        console.log(`Fetched ${result.rows.length} messages for conversation ${conversationId}`);
        res.json({
            messages: result.rows,
            logs: [`Successfully fetched ${result.rows.length} messages for conversation ${conversationId}`]
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