// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Set up the PostgreSQL connection pool
// The Pool will use the DATABASE_URL from our .env file or Render's environment
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // If you're deploying on Render, you might need to add this for SSL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());


// --- API ENDPOINTS --- //

// API Endpoint: Get a list of all beats from the database
app.get('/api/beats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM beats ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching beats from database');
    }
});

// API Endpoint: Create a payment intent for Stripe
app.post('/create-payment-intent', async (req, res) => {
    const { beatId } = req.body;

    try {
        // Fetch the specific beat from the database to get the price
        const result = await pool.query('SELECT price FROM beats WHERE id = $1', [beatId]);

        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'Beat not found' });
        }

        const beat = result.rows[0];
        const priceInCents = beat.price;

        // Create a PaymentIntent with the order amount and currency from the database
        const paymentIntent = await stripe.paymentIntents.create({
            amount: priceInCents,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Send the clientSecret back to the client
        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: error.message });
    }
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});