// Make sure to replace with your publishable key
const stripe = Stripe('pk_test_51SC5QkC48JAKzKxdO5kYicSd2LSbaResAEUK5vptCgpdBHSoCvzfbqLveh6ck0aUsRDPPZlPkLw001jwJSXbTA8H00gBnpPoqI');

// This will hold the Stripe Elements instance
let elements;

// DOM elements
const paymentForm = document.getElementById('payment-form');
const orderSummaryEl = document.getElementById('order-summary');
const messageContainer = document.getElementById('payment-message');

// Get the beat ID from local storage
const selectedBeatId = localStorage.getItem('selectedBeatId');

// Immediately initialize the payment flow
initialize();

// Add submit listener to the form
paymentForm.addEventListener('submit', handleSubmit);


// ---- FUNCTIONS ---- //

// Fetches the payment intent client secret from the backend and initializes Stripe Elements
async function initialize() {
    if (!selectedBeatId) {
        orderSummaryEl.innerHTML = '<h2>Error: No beat selected. Please go back to the store.</h2>';
        return;
    }

    // 1. Display order details while we fetch the payment info
    displayOrderSummary(selectedBeatId);

    // 2. Create a Payment Intent on the server
    const response = await fetch('/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatId: selectedBeatId }),
    });
    const { clientSecret } = await response.json();

    // 3. Create an instance of Stripe Elements
    elements = stripe.elements({ clientSecret });

    // 4. Create and mount the Payment Element
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
}

// Handles the form submission
async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    // Trigger form validation and wallet collection
    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            // This is the URL the user will be redirected to after payment.
            return_url: `${window.location.origin}/success.html`, // We'll need to create this page
        },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`.
    if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
    } else {
        showMessage("An unexpected error occurred.");
    }

    setLoading(false);
}

// Fetches beat details from the server to show the user what they are buying
async function displayOrderSummary(beatId) {
    try {
        const response = await fetch('/api/beats');
        const beats = await response.json();
        const beat = beats.find(b => b.id === beatId);

        if (beat) {
            const priceInDollars = (beat.price / 100).toFixed(2);
            orderSummaryEl.innerHTML = `
                <div class="summary-card">
                    <img src="${beat.imageUrl}" alt="${beat.name}" class="summary-art">
                    <div class="summary-info">
                        <h3>${beat.name}</h3>
                        <p>${beat.genre}</p>
                    </div>
                    <div class="summary-price">$${priceInDollars}</div>
                </div>
            `;
        } else {
             orderSummaryEl.innerHTML = '<h2>Error: Beat details could not be found.</h2>';
        }
    } catch (error) {
        console.error("Failed to fetch beat details:", error);
    }
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
    const submitButton = document.getElementById('submit');
    if (isLoading) {
        submitButton.disabled = true;
        document.getElementById('button-text').innerText = "Processing...";
    } else {
        submitButton.disabled = false;
        document.getElementById('button-text').innerText = "Pay now";
    }
}