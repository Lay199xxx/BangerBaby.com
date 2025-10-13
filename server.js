/**
 * server.js
 * Main backend file for the beat store application.
 */

// This MUST be the very first line to ensure all environment variables are loaded before any other code uses them.
require('dotenv').config();

// --- IMPORTS ---
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const nodemailer = require('nodemailer');
const path = require('path');

// --- INITIALIZATIONS ---
const app = express();
const port = 3000;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- SERVICE CONFIGURATIONS ---

// Configure PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configure AWS S3 Client
const s3 = new S3Client({
    region: process.env.AWS_S3_REGION, // e.g., 'us-east-2'
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

// Configure Nodemailer for sending emails
let transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: {
        user: 'apikey', // This is the literal string 'apikey' for SendGrid
        pass: process.env.SENDGRID_API_KEY,
    },
});


// --- MIDDLEWARE & ROUTING ---

// IMPORTANT: The Stripe webhook endpoint must be placed BEFORE app.use(express.json())
// This is because Stripe requires the raw, unparsed request body for signature verification,
// and express.json() would modify it. We use a special raw parser just for this one route.
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed:`, err.message);
        return res.sendStatus(400);
    }

    // Handle the payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const customerEmail = paymentIntent.receipt_email;
        const purchasedBeatId = paymentIntent.metadata.beatId;

        console.log(`Webhook received: Fulfilling order for beat ${purchasedBeatId} to ${customerEmail}`);

        try {
    const beatResult = await pool.query('SELECT * FROM beats WHERE id = $1', [purchasedBeatId]);
    if (beatResult.rows.length === 0) {
        throw new Error(`Purchased beat with ID ${purchasedBeatId} not found in database.`);
    }
    const beat = beatResult.rows[0];

    // --- THIS IS THE CORRECTED LINE ---
    const s3Key = decodeURIComponent(new URL(beat.audio_url).pathname.substring(1));

    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
    });
    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 86400 });

    await transporter.sendMail({
        from: '"BangerBaby" <layman.sledge@bangerbaby.com>',
        to: customerEmail,
        subject: 'Your Beat Purchase & Download Link',
        html: `<h1>Thank you for your purchase!</h1>
       <p>You can download your beat using the secure link below. This link will expire in 24 hours.</p>
       <p><a href="${downloadUrl}" style="font-size: 18px; font-weight: bold;">Download ${beat.name} (WAV)</a></p>
       <p style="font-size: 12px; color: #888; margin-top: 25px;">
           Having trouble? <a href="https://bangerbaby.com/instructions/">Click here for download instructions.</a>
       </p>
       <hr>
       <p>Your license agreement can be found here: <a href="https://bangerbaby.com/licenses/">License Terms</a></p>`,
 });

            console.log(`Successfully sent download link for beat ${purchasedBeatId} to ${customerEmail}`);
        } catch (err) {
            console.error('Error during fulfillment process:', err);
        }
    }

    res.json({ received: true });
});


// Serve static files from the 'public' directory (HTML, CSS, Frontend JS)
app.use(express.static('public'));

// Use the JSON middleware for all other API routes that need it
app.use(express.json());


// --- API ROUTES ---

// API ROUTE: Get a SINGLE beat by its ID
app.get('/api/beat/:id', async (req, res) => {
    const { id } = req.params; // req.params gets the :id from the URL
    try {
        const result = await pool.query('SELECT * FROM beats WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Beat not found' });
        }
        res.json(result.rows[0]); // Send back the single beat object
    } catch (err) {
        console.error('Error fetching single beat:', err);
        res.status(500).json({ error: 'Error fetching beat' });
    }
});

// PAGE ROUTE: Serve the beat detail page for any beat ID
app.get('/beat/:id', (req, res) => {
    // This sends our generic beat.html template to the browser
    res.sendFile(path.join(__dirname, 'public', 'beat.html'));
});

// Get all beats for the store page
app.get('/api/beats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM beats ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching beats from database:', err);
        res.status(500).send('Error fetching beats from database');
    }
});

// Create a payment intent for a specific beat
app.post('/create-payment-intent', async (req, res) => {
    // Email is now optional in the request body
    const { beatId, email } = req.body;
    try {
        const result = await pool.query('SELECT price FROM beats WHERE id = $1', [beatId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Beat not found' });
        }
        const beat = result.rows[0];
        const priceInCents = beat.price;

        const paymentIntentParams = {
            amount: priceInCents,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: { beatId: beatId }
        };

        // Only add receipt_email if it was provided
        if (email) {
            paymentIntentParams.receipt_email = email;
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fulfill a free order
app.post('/fulfill-free-order', async (req, res) => {
    const { beatId, email } = req.body;

    console.log(`Fulfilling FREE order for beat ${beatId} to ${email}`);

    try {
        // 1. Find the beat in the database to get the S3 URL
        const beatResult = await pool.query('SELECT * FROM beats WHERE id = $1 AND price = 0', [beatId]);
        if (beatResult.rows.length === 0) {
            throw new Error(`Free beat with ID ${beatId} not found or is not free.`);
        }
        const beat = beatResult.rows[0];
        const s3Key = beat.audio_url.split('/').pop();

        // 2. Generate a secure, temporary download link
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: s3Key,
        });
        const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 86400 });

        // 3. Send the fulfillment email
        await transporter.sendMail({
            from: '"BangerBaby" <layman.sledge@bangerbaby.com>',
            to: email,
            subject: 'Your Free Beat Download!',
           html: `<h1>Here is your free beat!</h1>
       <p>Thank you for checking out the store. You can download your beat using the secure link below. This link will expire in 24 hours.</p>
       <p><a href="${downloadUrl}" style="font-size: 18px; font-weight: bold;">Download ${beat.name} (WAV)</a></p>
       <p style="font-size: 12px; color: #888; margin-top: 25px;">
           Having trouble? <a href="https://bangerbaby.com/instructions/">Click here for download instructions.</a>
       </p>
       <hr>
       <p>Your use of this beat is subject to our terms. The license agreement can be found here: <a href="https://bangerbaby.com/licenses/">License Terms</a></p>`,
        });

        res.status(200).json({ success: true });

    } catch (err) {
        console.error('Error during free fulfillment:', err);
        res.status(500).json({ error: 'Failed to fulfill order.' });
    }
});


// --- SERVER LISTENER ---
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});