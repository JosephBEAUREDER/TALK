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

// // Create tables if they don't exist
// const createTables = async () => {
//     try {
//         // Create conversations table
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS conversations (
//                 id VARCHAR(255) PRIMARY KEY,
//                 title TEXT NOT NULL,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//                 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//             )
//         `);

//         // Create messages table
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS messages (
//                 id SERIAL PRIMARY KEY,
//                 conversation_id VARCHAR(255) NOT NULL,
//                 role VARCHAR(10) NOT NULL,
//                 content TEXT NOT NULL,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//             )
//         `);

//         // Create summaries table
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS summaries (
//                 id SERIAL PRIMARY KEY,
//                 text TEXT NOT NULL,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//             )
//         `);

//         console.log('Tables created or already exist');
//     } catch (err) {
//         console.error('Error creating tables:', err.message);
//     }
// };

// // Call the function to create tables
// createTables();

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Backend is running' });
});

/// Function to get the last summary from the database
const getLastSummary = async () => {
    try {
        const result = await pool.query(`
            SELECT text FROM summaries
            ORDER BY id DESC
            LIMIT 1
        `);
        return result.rows[0]?.text || ''; // Return the last summary or an empty string if no summaries exist
    } catch (err) {
        console.error('Error fetching last summary:', err.message);
        throw err; // Re-throw the error to handle it in the calling function
    }
};



// Endpoint to summarize the last 10 messages
app.post('/summarize', async (req, res) => {
    const { conversationId } = req.body;

    if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
    }

    try {
        // Fetch the last 10 messages
        const last10MessagesResult = await pool.query(
            'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
            [conversationId]
        );
        const last10Messages = last10MessagesResult.rows.reverse();

        // Fetch the last summary
        const lastSummary = await getLastSummary();

        // Serialize the last 10 messages as a JSON string
        const last10MessagesJson = JSON.stringify(last10Messages);

        // Call the summarize.py script
        exec(`/app/venv/bin/python summarize.py '${lastSummary}' '${last10MessagesJson}'`, async (error, stdout, stderr) => {
            if (error) {
                console.error('Summarize script execution error:', stderr);
                return res.status(500).json({ error: 'Summarization failed' });
            }

            const newSummary = stdout.trim();

            // Insert the new summary into the summaries table
            await pool.query(
                'INSERT INTO summaries (text) VALUES ($1)',
                [newSummary]
            );

            console.log('New summary created:', newSummary);
            res.json({ summary: newSummary });
        });
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to run Python script and store messages
app.post('/run-python', async (req, res) => {
    console.log('Received request body:', req.body); // Debug log
    const { messages, name, conversationId, isNewConversation } = req.body;

    // Handle both old (name) and new (messages) formats
    let messagesToProcess = [];
    if (messages && Array.isArray(messages) && messages.length > 0) {
        messagesToProcess = messages;
    } else if (name && typeof name === 'string') {
        messagesToProcess = [{ role: 'user', content: name }];
    } else {
        return res.status(400).json({ error: 'Either "messages" array or "name" string and Conversation ID are required' });
    }

    if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
    }

    try {
        // Create or update conversation
        if (isNewConversation) {
            const title = messagesToProcess[0].content.substring(0, 30) + (messagesToProcess[0].content.length > 30 ? '...' : '');
            await pool.query(
                'INSERT INTO conversations (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = CURRENT_TIMESTAMP',
                [conversationId, title]
            );
        }

        // Store all messages
        for (const msg of messagesToProcess) {
            await pool.query(
                'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [conversationId, msg.role || 'user', msg.content]
            );
        }

        // Only run the script if there's a user message
        const userMessages = messagesToProcess.filter(m => m.role === 'user');
        if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1].content;

            // Fetch the last summary from the database (system prompt)
            const lastSummary = await getLastSummary();

            // Fetch the conversation history
            const conversationHistory = await pool.query(
                'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
                [conversationId]
            );

            // Serialize the conversation history as a JSON string
            const historyJson = JSON.stringify(conversationHistory.rows);

            // Escape quotes in the arguments to avoid breaking the command
            const escapedLastSummary = lastSummary.replace(/'/g, "'\\''");
            const escapedHistoryJson = historyJson.replace(/'/g, "'\\''");
            const escapedUserMessage = lastUserMessage.replace(/'/g, "'\\''");

            // Call the Python script with the system prompt, conversation history, and user message
            exec(`/app/venv/bin/python script.py '${escapedLastSummary}' '${escapedHistoryJson}' '${escapedUserMessage}'`, async (error, stdout, stderr) => {
                if (error) {
                    console.error('Script execution error:', stderr);
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

                // Check if the number of messages is a multiple of 10
                const messageCountResult = await pool.query(
                    'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
                    [conversationId]
                );
                const messageCount = parseInt(messageCountResult.rows[0].count, 10);

                console.log('Total message count:', messageCount); // Debug log

                if (messageCount % 10 === 0) {
                    console.log('Triggering summarization for conversation:', conversationId); // Debug log

                    // Trigger the summarization endpoint
                    try {
                        const summarizationResponse = await fetch(`http://localhost:${PORT}/summarize`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ conversationId }),
                        });

                        const summarizationData = await summarizationResponse.json();
                        console.log('Summarization result:', summarizationData);
                    } catch (err) {
                        console.error('Error triggering summarization:', err);
                    }
                }

                // Send the response back to the client
                res.json({ response });
            });
        } else {
            res.json({ response: messagesToProcess[messagesToProcess.length - 1].content });
        }
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to fetch all conversations
app.get('/conversations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM conversations ORDER BY updated_at DESC');
        // console.log('Returning conversations:', result.rows);
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