// Make sure to replace with your publishable key
const stripe = Stripe('pk_live_51SC5QaCLs3t3rxKpDlVEuweUTyUkX6aDlegz31itcoM8EqhYd57EIEHiUORBaa48vTvUtP7Dtc6wPSnwn2Gn2gV600kiy58f7h');

// This will hold the Stripe Elements instance
let elements;

// DOM elements
const paymentForm = document.getElementById('payment-form');
const orderSummaryEl = document.getElementById('order-summary');
const messageContainer = document.getElementById('payment-message');
const submitButton = document.getElementById('submit');

// Get the beat ID from local storage
const selectedBeatId = localStorage.getItem('selectedBeatId');

// Immediately initialize the checkout flow
initialize();

// ---- FUNCTIONS ---- //

// Main function to decide the checkout flow (Free vs. Paid)
async function initialize() {
    if (!selectedBeatId) {
        orderSummaryEl.innerHTML = '<h2>Error: No beat selected. Please go back to the store.</h2>';
        paymentForm.style.display = 'none'; // Hide form if no beat is selected
        return;
    }

    // 1. Fetch the beat details first to check the price
    const beat = await getBeatDetails(selectedBeatId);
    if (!beat) {
        orderSummaryEl.innerHTML = '<h2>Error: Beat details could not be found.</h2>';
        paymentForm.style.display = 'none';
        return;
    }

    // 2. Always display the order summary
    displayOrderSummary(beat);

    // 3. *** THE NEW LOGIC ***
    // Check if the beat is free or paid
    if (beat.price > 0) {
        // IT'S A PAID BEAT: Initialize Stripe
        await initializeStripeCheckout(beat.id);
    } else {
        // IT'S A FREE BEAT: Bypass Stripe
        setupFreeCheckout();
    }
}

// Sets up the page for a paid order using Stripe
async function initializeStripeCheckout(beatId) {
    // Create a Payment Intent on the server
    const response = await fetch('/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatId: beatId }),
    });

    // Handle potential errors from the server (like the $0.00 error)
    if (!response.ok) {
        const { error } = await response.json();
        showMessage(error || 'Could not initialize payment.');
        setLoading(false);
        submitButton.style.display = 'none'; // Hide button on failure
        return;
    }

    const { clientSecret } = await response.json();

    // Create and mount the Stripe Payment Element
    elements = stripe.elements({ clientSecret });
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    // Add the submit listener for the payment form
    paymentForm.addEventListener('submit', handleSubmit);
}

// Sets up the page for a free order
function setupFreeCheckout() {
    document.getElementById('payment-element').style.display = 'none'; // Hide the Stripe form area
    document.getElementById('button-text').innerText = 'Claim For Free'; // Change button text

    // Add a simple click listener to the button that goes to the success page
    submitButton.addEventListener('click', (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate a short delay then redirect
        setTimeout(() => {
            window.location.href = '/success.html';
        }, 1000);
    });
}

// Handles the form submission for PAID orders
async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: `${window.location.origin}/success.html`,
        },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
    } else {
        showMessage("An unexpected error occurred.");
    }
    setLoading(false);
}

// Helper function to fetch details for a single beat
async function getBeatDetails(beatId) {
    try {
        const response = await fetch('/api/beats');
        const beats = await response.json();
        return beats.find(b => b.id == beatId);
    } catch (error) {
        console.error("Failed to fetch beats:", error);
        return null;
    }
}

// Displays the order summary on the page
function displayOrderSummary(beat) {
    const priceInDollars = (beat.price / 100).toFixed(2);
    orderSummaryEl.innerHTML = `
        <div class="summary-card">
            <img src="${beat.image_url}" alt="${beat.name}" class="summary-art">
            <div class="summary-info">
                <h3>${beat.name}</h3>
                <p>${beat.genre}</p>
            </div>
            <div class="summary-price">$${priceInDollars}</div>
        </div>
    `;
}

// ---- UI HELPERS ---- //
function showMessage(messageText) {
    messageContainer.style.display = 'block';
    messageContainer.textContent = messageText;
    setTimeout(() => {
        messageContainer.style.display = 'none';
        messageContainer.textContent = '';
    }, 4000);
}

function setLoading(isLoading) {
    if (isLoading) {
        submitButton.disabled = true;
        document.getElementById('button-text').innerText = "Processing...";
    } else {
        submitButton.disabled = false;
        document.getElementById('button-text').innerText = "Pay now";
    }
}