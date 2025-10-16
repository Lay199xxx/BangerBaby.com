const stripe = Stripe('pk_live_51SC5QaCLs3t3rxKpDlVEuweUTyUkX6aDlegz31itcoM8EqhYd57EIEHiUORBaa48vTvUtP7Dtc6wPSnwn2Gn2gV600kiy58f7h'); // <-- PASTE YOUR LIVE KEY HERE
let elements;
const paymentForm = document.getElementById('payment-form');
const orderSummaryEl = document.getElementById('order-summary');
const messageContainer = document.getElementById('payment-message');
const submitButton = document.getElementById('submit');
const selectedBeatId = localStorage.getItem('selectedBeatId');

initialize();

async function initialize() {
    if (!selectedBeatId) {
        orderSummaryEl.innerHTML = '<h2>Error: No beat selected. Please go back to the store.</h2>';
        paymentForm.style.display = 'none';
        return;
    }

    const beat = await getBeatDetails(selectedBeatId);
    if (!beat) {
        orderSummaryEl.innerHTML = '<h2>Error: Beat details could not be found.</h2>';
        paymentForm.style.display = 'none';
        return;
    }

    displayOrderSummary(beat);

    if (Number(beat.price) > 0) {
        const response = await fetch('/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beatId: selectedBeatId }),
        });
        const { clientSecret, error } = await response.json();

        if (error) {
            showMessage(error);
            return;
        }

        elements = stripe.elements({ clientSecret });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

        paymentForm.addEventListener('submit', handlePaidSubmit);
    } else {
        setupFreeCheckout();
    }
}

async function handlePaidSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const checkbox = document.getElementById('terms-checkbox');
    if (!checkbox.checked) {
        showMessage("You must agree to the license agreement to proceed.");
        setLoading(false);
        return;
    }

    const email = document.getElementById('email-input').value;
    if (!email) {
        showMessage("Please enter a valid email address.");
        setLoading(false);
        return;
    }

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: `${window.location.origin}/success.html`,
            receipt_email: email,
        },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
    } else {
        showMessage("An unexpected error occurred.");
    }
    setLoading(false);
}

function setupFreeCheckout() {
    document.getElementById('payment-element').style.display = 'none';
    document.getElementById('button-text').innerText = 'Claim For Free';
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);

        const checkbox = document.getElementById('terms-checkbox');
        if (!checkbox.checked) {
            showMessage("You must agree to the license agreement to proceed.");
            setLoading(false);
            return;
        }
        
        const email = document.getElementById('email-input').value;
        if (!email) {
            showMessage("Please enter your email to receive the download link.");
            setLoading(false);
            return;
        }
        const response = await fetch('/fulfill-free-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beatId: selectedBeatId, email: email }),
        });
        if (response.ok) {
            window.location.href = '/success.html';
        } else {
            showMessage("Something went wrong. Please try again.");
            setLoading(false);
        }
    });
}

async function getBeatDetails(beatId) {
    try {
        const response = await fetch('/api/beats');
        const beats = await response.json();
        return beats.find(b => b.id == beatId);
    } catch (error) { console.error("Failed to fetch beats:", error); return null; }
}

function displayOrderSummary(beat) {
    const priceInDollars = (Number(beat.price) / 100).toFixed(2);
    orderSummaryEl.innerHTML = `<div class="summary-card"><img src="${beat.image_url}" alt="${beat.name}" class="summary-art"><div class="summary-info"><h3>${beat.name}</h3><p>${beat.genre}</p></div><div class="summary-price">$${priceInDollars}</div></div>`;
}

function showMessage(messageText) {
    messageContainer.style.display = 'block';
    messageContainer.textContent = messageText;
    setTimeout(() => { messageContainer.style.display = 'none'; messageContainer.textContent = ''; }, 4000);
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