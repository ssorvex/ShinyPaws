// ... (keep everything before this function the same)

// SIMPLIFIED IMAGE UPDATE - Upload PNG file separately, then update HTML reference
async function updateImageOnWebsiteViaGitHub(imageId, section = 'hero') {
    const msg = document.createElement('div');
    msg.className = 'info-message show';
    msg.textContent = '🔄 Starting image update...';
    const imagesCard = document.querySelector('#images .card');
    if (imagesCard) imagesCard.appendChild(msg);
    
    try {
        const token = prompt('Enter your GitHub token:');
        if (!token) {
            throw new Error('GitHub token is required');
        }
        
        // Get the image data
        const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
        const image = images.find(img => img.id === imageId);
        
        if (!image) {
            throw new Error('Image not found');
        }
        
        // Step 1: Extract base64 from data URL
        if (msg) msg.textContent = '✏️ Processing image...';
        const base64Data = image.data.split(',')[1]; // Remove 'data:image/png;base64,' prefix
        
        if (!base64Data) {
            throw new Error('Invalid image data');
        }
        
        // Step 2: Upload image as PNG file to GitHub
        if (msg) msg.textContent = '📤 Uploading image file to GitHub...';
        const imagePath = `images/hero-poodle.png`;
        
        // Note: uploadFileToGitHub expects base64-encoded content for the GitHub API
        // So we pass the base64Data as-is (it's already base64)
        const imageResult = await uploadFileToGitHub(
            imagePath,
            base64Data,
            `Update ${section} image`,
            token
        );
        
        if (!imageResult) {
            throw new Error('Failed to upload image file');
        }
        
        // Step 3: Load current HTML
        if (msg) msg.textContent = '📥 Loading HTML file...';
        let files;
        try {
            files = await loadWebsiteFiles(token);
        } catch (error) {
            throw new Error(`Failed to load HTML: ${error.message}`);
        }
        
        if (!files || !files.index) {
            throw new Error('Failed to load index.html');
        }
        
        // Step 4: Update HTML to reference the new image URL
        if (msg) msg.textContent = '✏️ Updating HTML reference...';
        let updatedIndex = files.index;
        const imageUrl = 'images/hero-poodle.png';
        
        if (section === 'hero') {
            // Replace hero image src with new URL (simple approach)
            updatedIndex = updatedIndex.replace(
                /src="[^"]*hero[^"]*\.png"/g,
                `src="${imageUrl}"`
            );
            
            // Also try data URLs
            updatedIndex = updatedIndex.replace(
                /src="data:image[^"]*"/g,
                `src="${imageUrl}"`
            );
        }
        
        // Step 5: Upload updated HTML to GitHub
        if (msg) msg.textContent = '📤 Uploading HTML to GitHub...';
        
        const htmlResult = await uploadFileToGitHub(
            'index.html',
            updatedIndex,
            `Update ${section} image reference`,
            token
        );
        
        if (!htmlResult) {
            throw new Error('Failed to upload HTML file');
        }
        
        // Clear token from memory
        clearSensitiveData(token);
        token = null;
        
        if (msg) {
            msg.className = 'success-message show';
            msg.textContent = `✅ Image updated successfully! Website will update in 1-2 minutes.`;
            setTimeout(() => msg.remove(), 5000);
        }
        
    } catch (error) {
        console.error('Update error:', error);
        if (msg) {
            msg.className = 'error-message show';
            msg.textContent = `❌ Error: ${error.message}`;
            setTimeout(() => msg.remove(), 5000);
        }
    }
}

// ... (keep everything after this function the same)
