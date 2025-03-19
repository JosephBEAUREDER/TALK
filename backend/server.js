const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require('child_process');
const app = express();

app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Create tables if they don't exist
const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id VARCHAR(255) PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(255) NOT NULL,
                role VARCHAR(10) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tables created or already exist');
    } catch (err) {
        console.error('Error creating tables:', err.message);
    }
};

createTables();

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Backend is running' });
});

// Endpoint to run Python script and store messages
app.post('/run-python', async (req, res) => {
    const { name, conversationId, isNewConversation } = req.body;
    if (!name || !conversationId) {
        return res.status(400).json({ error: 'Name and Conversation ID are required' });
    }

    try {
        // Create or update conversation
        if (isNewConversation) {
            const title = name.substring(0, 30) + (name.length > 30 ? '...' : '');
            await pool.query(
                'INSERT INTO conversations (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = CURRENT_TIMESTAMP',
                [conversationId, title]
            );
        }

        // Store user message
        await pool.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [conversationId, 'user', name]
        );

        // Execute Python script
        exec(`python script.py "${name}" || python3 script.py "${name}"`, async (error, stdout, stderr) => {
            if (error) {
                return res.status(500).json({ error: 'Script execution failed' });
            }

            const response = stdout.trim();

            // Store AI response
            await pool.query(
                'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [conversationId, 'ai', response]
            );

            // Update conversation timestamp
            await pool.query(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [conversationId]
            );

            res.json({ response });
        });
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to fetch all conversations
app.get('/conversations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM conversations ORDER BY updated_at DESC');
        console.log('Returning conversations:', result.rows); // Add this
        res.json({ conversations: result.rows });
    } catch (err) {
        console.error('Error fetching conversations:', err.message);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Endpoint to fetch messages for a specific conversation
app.get('/conversations/:conversationId/messages', async (req, res) => {
    const { conversationId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [conversationId]
        );
        res.json({ messages: result.rows });
    } catch (err) {
        console.error('Error fetching messages:', err.message);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});