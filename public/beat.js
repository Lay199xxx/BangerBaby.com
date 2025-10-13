document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('beat-detail-content');

    // Get the beat ID from the URL path (e.g., /beat/4)
    const path = window.location.pathname;
    const parts = path.split('/');
    const beatId = parts[parts.length - 1];

    if (!beatId || isNaN(beatId)) {
        mainContent.innerHTML = '<h2>Beat not found</h2><p>The beat ID is missing or invalid.</p>';
        return;
    }

    // Fetch the specific beat's data from our new API endpoint
    fetch(`/api/beat/${beatId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Beat not found');
            }
            return response.json();
        })
        .then(beat => {
            renderBeat(beat);
        })
        .catch(error => {
            console.error('Error fetching beat:', error);
            mainContent.innerHTML = '<h2>Beat Not Found</h2><p>Sorry, we couldn\'t find the beat you were looking for.</p>';
        });
});

function renderBeat(beat) {
    const mainContent = document.getElementById('beat-detail-content');
    const priceInDollars = (Number(beat.price) / 100).toFixed(2);
    
    // Update the page title
    document.title = `${beat.name} | My Beat Store`;

    // Populate the main content with the beat's details
    mainContent.innerHTML = `
        <div class="detail-container">
            <img src="${beat.image_url}" alt="${beat.name}" class="detail-art">
            <div class="detail-info">
                <h1>${beat.name}</h1>
                <p class="genre">${beat.genre}</p>
                <audio controls src="${beat.preview_url}"></audio>
                <p class="price">$${priceInDollars}</p>
                <a href="#" id="purchase-btn" class="purchase-button">Purchase</a>
            </div>
        </div>
    `;

    // Add event listener to the new purchase button
    const purchaseButton = document.getElementById('purchase-btn');
    purchaseButton.addEventListener('click', (e) => {
        e.preventDefault();
        // Use the same localStorage method to go to the checkout page
        localStorage.setItem('selectedBeatId', beat.id);
        window.location.href = '/checkout.html';
    });
}