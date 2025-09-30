// Import required packages
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // <-- IMPORTANT: Replace with your secret key

const app = express();
const port = 3000;

// This is a sample in-memory "database" of your beats.
// In a real application, you would fetch this from a database like MongoDB or PostgreSQL.
const beats = [
    {
        id: 'Rebound',
        name: 'Rebound',
        genre: 'Electronic',
        price: 0, // Price in cents ($0)
        imageUrl: '/images/IMG 1.PNG',
        audioUrl: '/audio/BANGERBABY.COM-REBOUND.mp3' // Replace with your audio file URL
    },
    {
        id: 'Storms',
        name: 'Storms',
        genre: 'Hip Hop',
        price: 3000, // Price in cents ($30.00)
        imageUrl: '/images/IMG 2.PNG',
        audioUrl: '/audio/BangerBaby-Storms.mp3' // Replace with your audio file URL
    },
    {
        id: 'Crybaby',
        name: 'Crybaby',
        genre: 'R&B',
        price: 3000, // Price in cents ($30.00)
        imageUrl: '/images/IMG 3.PNG',
        audioUrl: '/audio/BangerBaby-CryBaby.mp3' // Replace with your audio file URL
    },
    {
        id: 'YouveGotToBeg',
        name: 'Youve Got To Beg',
        genre: 'Pop',
        price: 2000, // Price in cents ($20.00)
        imageUrl: '/images/IMG 1.PNG',
        audioUrl: '/audio/BangerBaby-Youve Got To Beg.mp3' // Replace with your audio file URL
    },
    {
        id: 'WildInside',
        name: 'Wild Inside',
        genre: 'Electronic',
        price: 3000, // Price in cents ($30.00)
        imageUrl: '/images/IMG 2.PNG',
        audioUrl: '/audio/BangerBaby-WildInside.mp3' // Replace with your audio file URL
    },
];

// Serve static files from the 'public' directory (our frontend)
app.use(express.static('public'));
app.use(express.json());

// API Endpoint: Get a list of all beats
app.get('/api/beats', (req, res) => {
    res.json(beats);
});

// API Endpoint: Create a payment intent for Stripe
app.post('/create-payment-intent', async (req, res) => {
    const { beatId } = req.body; // Get the beat ID from the request

    const beat = beats.find(b => b.id === beatId);

    if (!beat) {
        return res.status(404).send({ error: 'Beat not found' });
    }

    try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: beat.price,
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
        res.status(500).send({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
