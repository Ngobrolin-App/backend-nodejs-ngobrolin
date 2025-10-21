const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { randomUUID } = require('crypto');

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, name, password } = req.body;

        // Validation
        if (!username || !name || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if username already exists
        const existingUser = await pool.query(
            'SELECT id FROM tbluser WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const newUser = await pool.query(
            'INSERT INTO tbluser (id, username, name, password) VALUES ($1, $2, $3, $4) RETURNING id, username, name',
            [randomUUID(), username, name, hashedPassword]
        );

        // Generate token
        const token = generateToken({ userId: newUser.rows[0].id });

        res.status(201).json({
            message: 'User registered successfully',
            user: newUser.rows[0],
            token
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const user = await pool.query(
            'SELECT id, username, name, password FROM tbluser WHERE username = $1',
            [username]
        );

        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await comparePassword(password, user.rows[0].password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken({ userId: user.rows[0].id });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user.rows[0];

        res.json({
            message: 'Login successful',
            user: userWithoutPassword,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;