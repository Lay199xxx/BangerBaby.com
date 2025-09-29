document.addEventListener('DOMContentLoaded', async () => {
    // IMPORTANT: Replace with your publishable key
    const stripe = Stripe('pk_test_51SC5QkC48JAKzKxdO5kYicSd2LSbaResAEUK5vptCgpdBHSoCvzfbqLveh6ck0aUsRDPPZlPkLw001jwJSXbTA8H00gBnpPoqI'); 

    const beatContainer = document.getElementById('beat-container');
    let currentAudio = null; // Keep track of the currently playing audio

    // Function to fetch beats from our backend
    const fetchBeats = async () => {
        try {
            const response = await fetch('/api/beats');
            const beats = await response.json();
            renderBeats(beats);
        } catch (error) {
            console.error('Error fetching beats:', error);
            beatContainer.innerHTML = '<p>Could not load beats. Please try again later.</p>';
        }
    };

    // Function to display beats on the page
    const renderBeats = (beats) => {
        beatContainer.innerHTML = ''; // Clear existing content

        beats.forEach(beat => {
            const beatCard = document.createElement('div');
            beatCard.className = 'beat-card';

            const priceInDollars = (beat.price / 100).toFixed(2);

            beatCard.innerHTML = `
                <img src="${beat.imageUrl}" alt="${beat.name}" class="beat-art">
                <div class="beat-info">
                    <h3>${beat.name}</h3>
                    <p>${beat.genre}</p>
                </div>
                <div class="audio-player">
                    <audio src="${beat.audioUrl}" preload="metadata"></audio>
                    <button class="play-button">Play</button>
                </div>
                <button class="buy-button" data-beat-id="${beat.id}" data-price="${priceInDollars}">
                    Purchase - $${priceInDollars}
                </button>
            `;

            beatContainer.appendChild(beatCard);
        });
    };

    // Event Delegation: Handle clicks on play and buy buttons
    beatContainer.addEventListener('click', async (event) => {
        // --- Play/Pause Logic ---
        if (event.target.classList.contains('play-button')) {
            const button = event.target;
            const audio = button.previousElementSibling;

            if (currentAudio && currentAudio !== audio) {
                // Stop other audio if a new one is played
                currentAudio.pause();
                currentAudio.currentTime = 0;
                const otherPlayButton = document.querySelector('.play-button[data-playing="true"]');
                if (otherPlayButton) {
                    otherPlayButton.textContent = 'Play';
                    otherPlayButton.removeAttribute('data-playing');
                }
            }

            if (audio.paused) {
                audio.play();
                button.textContent = 'Pause';
                button.setAttribute('data-playing', 'true');
                currentAudio = audio;
            } else {
                audio.pause();
                button.textContent = 'Play';
                button.removeAttribute('data-playing');
                currentAudio = null;
            }
        }

        // --- Purchase Logic ---
        if (event.target.classList.contains('buy-button')) {
            const beatId = event.target.dataset.beatId;
            alert(`Initiating purchase for beat ID: ${beatId}. A payment form would appear next.`);
            
            // In a real app, you would pop up a modal with the Stripe payment element.
            // For simplicity, we are just showing an alert.
            // The full Stripe flow would involve:
            // 1. Fetching the clientSecret from your backend
            // 2. Creating a Stripe Elements instance
            // 3. Mounting the payment element to your page
            // 4. Calling stripe.confirmPayment()
            
            // Example of backend call:
            /*
            try {
                const response = await fetch('/create-payment-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ beatId: beatId }),
                });
                const { clientSecret } = await response.json();
                
                // Now you would use this clientSecret to show the Stripe payment form
                console.log('Received client secret:', clientSecret);

            } catch (error) {
                console.error('Payment initialization failed:', error);
            }
            */
        }
    });

    // Initial load of beats
    fetchBeats();
});
