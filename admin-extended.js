// Extended Admin Features: Images, Content, Pricing

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    if (tabName === 'images') {
        loadSectionImages();
    } else if (tabName === 'content') {
        loadContentEditor();
    } else if (tabName === 'pricing') {
        loadPricingEditor();
    }
}

// ==================== IMAGE MANAGER ====================
function uploadImage() {
    const fileInput = document.getElementById('imageUpload');
    const section = document.getElementById('imageSection').value;
    const file = fileInput.files[0];
    if (!file) {
        showImageError('Please select an image file');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        const timestamp = Date.now();
        const fileName = `${section}-${timestamp}-${file.name}`;
        const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
        images.push({
            id: timestamp,
            name: fileName,
            data: imageData,
            uploadedAt: new Date().toLocaleString()
        });
        localStorage.setItem(`images_${section}`, JSON.stringify(images));
        showImageSuccess('Image uploaded successfully!');
        fileInput.value = '';
        loadSectionImages();
    };
    reader.readAsDataURL(file);
}

function loadSectionImages() {
    const section = document.getElementById('imageSection').value;
    const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
    const grid = document.getElementById('imageGrid');
    if (images.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No images uploaded for this section yet</p></div>';
        return;
    }
    grid.innerHTML = images.map((img, index) => `
        <div class="image-item" draggable="true" data-image-id="${img.id}" data-section="${section}" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropImage(event)" ondragend="dragEnd(event)">
            <div style="position: relative;">
                <img src="${img.data}" alt="${img.name}" class="image-preview">
                <div style="position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">#${index + 1}</div>
            </div>
            <div class="image-info">
                <strong>${img.name}</strong>
                <br><small>${img.uploadedAt}</small>
            </div>
            <div style="padding: 10px; display: flex; gap: 5px; flex-direction: column;">
                <button onclick="updateImageOnWebsiteViaGitHub('${section}', ${img.id})" style="width: 100%; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">🌐 Update Website</button>
                <div style="display: flex; gap: 5px;">
                    <button onclick="deleteImage('${section}', ${img.id})" style="flex: 1; padding: 6px; background: #d32f2f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Delete</button>
                    <button onclick="useImage('${section}', ${img.id})" style="flex: 1; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Use</button>
                </div>
            </div>
        </div>
    `).join('');
    const instructions = document.createElement('div');
    instructions.style.cssText = 'background: #E3F2FD; color: #1976D2; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 13px; text-align: center;';
    instructions.innerHTML = '💡 <strong>Drag and drop images to reorder them</strong>';
    grid.parentNode.appendChild(instructions);
}

function deleteImage(section, id) {
    if (confirm('Are you sure you want to delete this image?')) {
        const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
        const filtered = images.filter(img => img.id !== id);
        localStorage.setItem(`images_${section}`, JSON.stringify(filtered));
        loadSectionImages();
        showImageSuccess('Image deleted successfully!');
    }
}

function useImage(section, id) {
    const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
    const image = images.find(img => img.id === id);
    if (image) {
        console.log('Using image:', image.name);
        showImageSuccess(`Image "${image.name}" is ready to use.`);
    }
}

function updateImageOnWebsite(section, id) {
    const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
    const image = images.find(img => img.id === id);
    if (!image) {
        showImageError('Image not found');
        return;
    }
    
    // This function is deprecated - use updateImageOnWebsiteViaGitHub instead
    showImageError('Please use the GitHub integration to update images.');
}

function showImageSuccess(message) {
    const msg = document.getElementById('imageSuccessMessage');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

function showImageError(message) {
    const msg = document.getElementById('imageErrorMessage');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

/**
 * SECURE GitHub Integration Functions
 * Token is prompted each time and never stored
 */

/**
 * Update content on website via GitHub (SECURE - prompts for token)
 */
async function updateContentOnWebsiteViaGitHub() {
    try {
        // Show loading state
        const msg = document.createElement('div');
        msg.className = 'success-message show';
        msg.textContent = '🔐 Enter your GitHub token to continue...';
        document.querySelector('#content .card').appendChild(msg);
        
        // Prompt for token (secure - not stored)
        let token;
        try {
            token = promptForGitHubToken();
        } catch (error) {
            msg.className = 'error-message show';
            msg.textContent = `❌ ${error.message}`;
            setTimeout(() => msg.remove(), 4000);
            return;
        }
        
        // Get current content from form
        const contentData = {};
        const fields = document.querySelectorAll('.content-field textarea');
        fields.forEach(field => {
            contentData[field.id] = field.value;
        });
        
        // Load website files
        msg.textContent = '📥 Fetching website files from GitHub...';
        const files = await loadWebsiteFiles(token);
        
        // Update HTML with new content
        msg.textContent = '✏️ Updating HTML content...';
        let updatedStudio = files.studio;
        
        // Replace content in the HTML
        for (const [fieldId, value] of Object.entries(contentData)) {
            // Find and replace content by looking for common patterns
            updatedStudio = updatedStudio.replace(
                new RegExp(`(<[^>]*id="${fieldId}"[^>]*>)([^<]*)(<)`, 'g'),
                `$1${value}$3`
            );
        }
        
        // Upload to GitHub
        msg.textContent = '📤 Uploading to GitHub...';
        
        const result = await uploadFileToGitHub(
            'studio.html',
            updatedStudio,
            generateCommitMessage('Update content'),
            token
        );
        
        // Clear token from memory
        clearSensitiveData(token);
        token = null;
        
        msg.className = 'success-message show';
        msg.textContent = '✅ Website updated! Changes will appear in 1-2 minutes.';
        setTimeout(() => msg.remove(), 5000);
        
    } catch (error) {
        console.error('Update error:', error);
        const msg = document.createElement('div');
        msg.className = 'error-message show';
        msg.textContent = `❌ Error: ${error.message}`;
        document.querySelector('#content .card').appendChild(msg);
        setTimeout(() => msg.remove(), 5000);
    }
}

/**
 * Update pricing on website via GitHub (SECURE - prompts for token)
 */
async function updatePricingOnWebsiteViaGitHub() {
    try {
        // Show loading state
        const msg = document.getElementById('pricingSuccessMessage');
        msg.className = 'success-message show';
        msg.textContent = '🔐 Enter your GitHub token to continue...';
        
        // Prompt for token (secure - not stored)
        let token;
        try {
            token = promptForGitHubToken();
        } catch (error) {
            msg.className = 'error-message show';
            msg.textContent = `❌ ${error.message}`;
            setTimeout(() => msg.classList.remove('show'), 4000);
            return;
        }
        
        // Get pricing data from form
        const pricingData = [];
        const rows = document.querySelectorAll('#pricingTable tr');
        rows.forEach((row, index) => {
            const service = document.getElementById(`service_${index}`).value;
            const duration = document.getElementById(`duration_${index}`).value;
            const price = document.getElementById(`price_${index}`).value;
            if (service && price) {
                pricingData.push({ service, duration, price });
            }
        });
        
        // Load website files
        msg.textContent = '📥 Fetching website files from GitHub...';
        const files = await loadWebsiteFiles(token);
        
        // Update HTML with new pricing
        msg.textContent = '✏️ Updating pricing...';
        let updatedIndex = files.index;
        
        // Replace pricing in the HTML
        pricingData.forEach(item => {
            // Find and replace price for each service
            updatedIndex = updatedIndex.replace(
                new RegExp(`(${item.service}[^<]*<[^>]*>\\s*\\$)[\\d.]+`, 'g'),
                `$1${item.price}`
            );
        });
        
        // Upload to GitHub
        msg.textContent = '📤 Uploading to GitHub...';
        
        const result = await uploadFileToGitHub(
            'index.html',
            updatedIndex,
            generateCommitMessage('Update pricing'),
            token
        );
        
        // Clear token from memory
        clearSensitiveData(token);
        token = null;
        
        msg.className = 'success-message show';
        msg.textContent = '✅ Pricing updated! Changes will appear in 1-2 minutes.';
        setTimeout(() => msg.classList.remove('show'), 5000);
        
    } catch (error) {
        console.error('Update error:', error);
        const msg = document.getElementById('pricingSuccessMessage');
        msg.className = 'error-message show';
        msg.textContent = `❌ Error: ${error.message}`;
        setTimeout(() => msg.classList.remove('show'), 5000);
    }
}

/**
 * Update images on website via GitHub (SECURE - prompts for token)
 */
async function updateImageOnWebsiteViaGitHub(section, imageId) {
    let msg = null;
    try {
        // Show loading state
        msg = document.createElement('div');
        msg.className = 'success-message show';
        msg.textContent = '🔐 Enter your GitHub token to continue...';
        const imagesCard = document.querySelector('#images .card');
        if (imagesCard) {
            imagesCard.appendChild(msg);
        }
        
        // Prompt for token (secure - not stored)
        let token;
        try {
            token = promptForGitHubToken();
        } catch (error) {
            if (msg) {
                msg.className = 'error-message show';
                msg.textContent = `❌ ${error.message}`;
                setTimeout(() => msg.remove(), 4000);
            }
            return;
        }
        
        if (!token) {
            if (msg) {
                msg.className = 'error-message show';
                msg.textContent = '❌ Token is required';
                setTimeout(() => msg.remove(), 4000);
            }
            return;
        }
        
        // Get the image data
        const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
        const image = images.find(img => img.id === imageId);
        
        if (!image) {
            throw new Error('Image not found');
        }
        
        // Load website files
        if (msg) msg.textContent = '📥 Fetching website files...';
        let files;
        try {
            files = await loadWebsiteFiles(token);
        } catch (error) {
            console.error('Failed to load files:', error);
            if (msg) {
                msg.className = 'error-message show';
                msg.textContent = `❌ Failed to load files: ${error.message}`;
                setTimeout(() => msg.remove(), 5000);
            }
            return;
        }
        
        if (!files || !files.index) {
            if (msg) {
                msg.className = 'error-message show';
                msg.textContent = '❌ Failed to load index.html';
                setTimeout(() => msg.remove(), 4000);
            }
            return;
        }
        
        // Update HTML with new image
        if (msg) msg.textContent = '✏️ Updating image in HTML...';
        let updatedIndex = files.index;
        
        // The image.data is already a base64 data URL (data:image/png;base64,...)
        // We use it directly in the HTML - no need to re-encode
        const imageUrl = image.data;
        
        // Replace hero image URL in the HTML
        // Look for the hero image and replace its src
        if (section === 'hero') {
            // Find and replace hero image
            updatedIndex = updatedIndex.replace(
                /(<img[^>]*id="hero-poodle"[^>]*src=")[^"]*(")[^>]*>/g,
                `$1${imageUrl}$2>`
            );
            
            // Also try to replace by class if id doesn't work
            updatedIndex = updatedIndex.replace(
                /(<img[^>]*class="[^"]*hero[^"]*"[^>]*src=")[^"]*(")[^>]*>/g,
                `$1${imageUrl}$2>`
            );
        }
        
        // Upload to GitHub
        if (msg) msg.textContent = '📤 Uploading to GitHub...';
        
        const result = await uploadFileToGitHub(
            'index.html',
            updatedIndex,
            generateCommitMessage(`Update ${section} image`),
            token
        );
        
        // Clear token from memory
        clearSensitiveData(token);
        token = null;
        
        if (msg) {
            msg.className = 'success-message show';
            msg.textContent = `✅ Image "${image.name}" updated! Changes will appear in 1-2 minutes.`;
            setTimeout(() => msg.remove(), 5000);
        }
        
    } catch (error) {
        console.error('Update error:', error);
        if (!msg) {
            msg = document.createElement('div');
            const imagesCard = document.querySelector('#images .card');
            if (imagesCard) {
                imagesCard.appendChild(msg);
            }
        }
        if (msg) {
            msg.className = 'error-message show';
            msg.textContent = `❌ Error: ${error.message}`;
            setTimeout(() => msg.remove(), 5000);
        }
    }
}

/**
 * Log update action (for security audit trail)
 */
function logUpdateAction(action, details) {
    const log = {
        timestamp: new Date().toISOString(),
        action: action,
        details: details,
        userAgent: navigator.userAgent
    };
    
    // Store in localStorage for audit trail
    const logs = JSON.parse(localStorage.getItem('update_logs') || '[]');
    logs.push(log);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
        logs.shift();
    }
    
    localStorage.setItem('update_logs', JSON.stringify(logs));
    console.log('Update logged:', log);
}

/**
 * View update logs (for debugging)
 */
function viewUpdateLogs() {
    const logs = JSON.parse(localStorage.getItem('update_logs') || '[]');
    console.table(logs);
    return logs;
}

/**
 * Clear all update logs
 */
function clearUpdateLogs() {
    localStorage.removeItem('update_logs');
    console.log('Update logs cleared');
}

// Add debugging to console
console.log('Admin panel loaded');
console.log('GitHub functions available:', typeof updateContentOnWebsiteViaGitHub);
console.log('GitHub API functions:', typeof getFileFromGitHub, typeof uploadFileToGitHub);
