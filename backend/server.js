const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require('child_process');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
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

app.get('/', (req, res) => {
    res.json({ status: 'Backend is running' });
});

app.post('/run-python', async (req, res) => {
    const { name, conversationId, isNewConversation } = req.body;
    if (!name || !conversationId) {
        return res.status(400).json({ error: 'Name and Conversation ID are required' });
    }

    try {
        if (isNewConversation) {
            const title = name.substring(0, 30) + (name.length > 30 ? '...' : '');
            await pool.query(
                'INSERT INTO conversations (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = CURRENT_TIMESTAMP',
                [conversationId, title]
            );
        }

        await pool.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [conversationId, 'user', name]
        );

        exec(`python script.py "${name}" || python3 script.py "${name}"`, async (error, stdout, stderr) => {
            if (error) {
                return res.status(500).json({ error: 'Script execution failed' });
            }

            const response = stdout.trim();
            await pool.query(
                'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [conversationId, 'ai', response]
            );
            await pool.query(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [conversationId]
            );

            res.json({ response, logs: ['Script executed successfully'] });
        });
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ error: 'Database error', logs: [`Error: ${err.message}`] });
    }
});

app.get('/conversations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM conversations ORDER BY updated_at DESC');
        res.json({ conversations: result.rows });
    } catch (err) {
        console.error('Error fetching conversations:', err.message);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});



