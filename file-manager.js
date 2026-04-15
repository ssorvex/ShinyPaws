/**
 * File Manager for Shiny Paws Admin Panel
 * Handles file downloads, previews, and local management
 */

/**
 * Download file to user's computer
 */
function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Download all updated files as a ZIP
 */
async function downloadAllUpdatedFiles() {
    try {
        const msg = document.createElement('div');
        msg.className = 'success-message show';
        msg.textContent = '⏳ Preparing files...';
        document.body.appendChild(msg);

        // Load website files
        msg.textContent = '📥 Fetching website files...';
        const files = await loadWebsiteFiles();

        // Get current edits
        const contentData = {};
        const fields = document.querySelectorAll('.content-field textarea');
        fields.forEach(field => {
            contentData[field.id] = field.value;
        });

        // Create a simple text file with all updates
        const updateSummary = `
SHINY PAWS WEBSITE UPDATES
Generated: ${new Date().toLocaleString()}

CONTENT UPDATES:
${Object.entries(contentData).map(([key, value]) => `${key}: ${value}`).join('\n')}

PRICING UPDATES:
${Array.from(document.querySelectorAll('#pricingTable tr')).map((row, index) => {
    const service = document.getElementById(`service_${index}`).value;
    const price = document.getElementById(`price_${index}`).value;
    return `${service}: $${price}`;
}).join('\n')}

IMAGES:
${JSON.stringify(JSON.parse(localStorage.getItem('images_gallery') || '[]'), null, 2)}

INSTRUCTIONS:
1. Review the changes above
2. Upload the updated HTML files to GitHub
3. Or use the "Update Website" button to push automatically
        `;

        // Download the summary
        downloadFile('UPDATES_SUMMARY.txt', updateSummary);

        msg.textContent = '✅ Summary downloaded! Review it and click "Update Website" to push changes.';
        setTimeout(() => msg.remove(), 4000);

    } catch (error) {
        const msg = document.createElement('div');
        msg.className = 'error-message show';
        msg.textContent = `❌ Error: ${error.message}`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 4000);
    }
}

/**
 * Preview changes before uploading
 */
async function previewChanges() {
    try {
        const msg = document.createElement('div');
        msg.className = 'success-message show';
        msg.textContent = '⏳ Loading files for preview...';
        document.body.appendChild(msg);

        // Load website files
        const files = await loadWebsiteFiles();

        // Get current edits
        const contentData = {};
        const fields = document.querySelectorAll('.content-field textarea');
        fields.forEach(field => {
            contentData[field.id] = field.value;
        });

        // Create preview
        const preview = document.createElement('div');
        preview.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const previewContent = document.createElement('div');
        previewContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;

        let html = '<h2>Preview of Changes</h2>';
        html += '<p><strong>Content Updates:</strong></p>';
        html += '<ul>';
        for (const [key, value] of Object.entries(contentData)) {
            html += `<li><strong>${key}:</strong> ${value.substring(0, 50)}...</li>`;
        }
        html += '</ul>';

        html += '<p><strong>Pricing Updates:</strong></p>';
        html += '<ul>';
        Array.from(document.querySelectorAll('#pricingTable tr')).forEach((row, index) => {
            const service = document.getElementById(`service_${index}`).value;
            const price = document.getElementById(`price_${index}`).value;
            html += `<li>${service}: $${price}</li>`;
        });
        html += '</ul>';

        previewContent.innerHTML = html;
        previewContent.innerHTML += `
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="this.closest('div').parentElement.remove()" style="flex: 1; padding: 10px; background: #999; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
                <button onclick="updateContentOnWebsiteViaGitHub(); this.closest('div').parentElement.remove()" style="flex: 1; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;">✅ Confirm & Upload</button>
            </div>
        `;

        preview.appendChild(previewContent);
        document.body.appendChild(preview);

        msg.remove();

    } catch (error) {
        const msg = document.createElement('div');
        msg.className = 'error-message show';
        msg.textContent = `❌ Error: ${error.message}`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 4000);
    }
}

/**
 * Export all data as JSON
 */
function exportDataAsJSON() {
    const data = {
        timestamp: new Date().toISOString(),
        content: {},
        pricing: [],
        images: {}
    };

    // Export content
    const fields = document.querySelectorAll('.content-field textarea');
    fields.forEach(field => {
        data.content[field.id] = field.value;
    });

    // Export pricing
    Array.from(document.querySelectorAll('#pricingTable tr')).forEach((row, index) => {
        const service = document.getElementById(`service_${index}`).value;
        const duration = document.getElementById(`duration_${index}`).value;
        const price = document.getElementById(`price_${index}`).value;
        if (service) {
            data.pricing.push({ service, duration, price });
        }
    });

    // Export images
    ['gallery', 'hero', 'about'].forEach(section => {
        const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
        data.images[section] = images.map(img => ({
            name: img.name,
            uploadedAt: img.uploadedAt
        }));
    });

    // Download JSON
    const json = JSON.stringify(data, null, 2);
    downloadFile('shiny-paws-backup.json', json);
}

/**
 * Import data from JSON
 */
function importDataFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);

                // Import content
                for (const [fieldId, value] of Object.entries(data.content)) {
                    const field = document.getElementById(fieldId);
                    if (field) {
                        field.value = value;
                    }
                }

                // Import pricing
                data.pricing.forEach((item, index) => {
                    const serviceField = document.getElementById(`service_${index}`);
                    const durationField = document.getElementById(`duration_${index}`);
                    const priceField = document.getElementById(`price_${index}`);
                    if (serviceField) serviceField.value = item.service;
                    if (durationField) durationField.value = item.duration;
                    if (priceField) priceField.value = item.price;
                });

                const msg = document.createElement('div');
                msg.className = 'success-message show';
                msg.textContent = '✅ Data imported successfully!';
                document.body.appendChild(msg);
                setTimeout(() => msg.remove(), 3000);

            } catch (error) {
                const msg = document.createElement('div');
                msg.className = 'error-message show';
                msg.textContent = `❌ Error importing file: ${error.message}`;
                document.body.appendChild(msg);
                setTimeout(() => msg.remove(), 3000);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

/**
 * Create a backup of current state
 */
function createBackup() {
    const backup = {
        timestamp: new Date().toISOString(),
        content: localStorage.getItem('websiteContent'),
        pricing: localStorage.getItem('pricingData'),
        images: {
            gallery: localStorage.getItem('images_gallery'),
            hero: localStorage.getItem('images_hero'),
            about: localStorage.getItem('images_about')
        }
    };

    localStorage.setItem('backup_' + Date.now(), JSON.stringify(backup));

    const msg = document.createElement('div');
    msg.className = 'success-message show';
    msg.textContent = '✅ Backup created successfully!';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

/**
 * Restore from backup
 */
function restoreFromBackup() {
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('backup_')) {
            backups.push(key);
        }
    }

    if (backups.length === 0) {
        alert('No backups found');
        return;
    }

    const backupKey = backups[backups.length - 1]; // Get most recent
    const backup = JSON.parse(localStorage.getItem(backupKey));

    if (backup.content) localStorage.setItem('websiteContent', backup.content);
    if (backup.pricing) localStorage.setItem('pricingData', backup.pricing);
    if (backup.images.gallery) localStorage.setItem('images_gallery', backup.images.gallery);
    if (backup.images.hero) localStorage.setItem('images_hero', backup.images.hero);
    if (backup.images.about) localStorage.setItem('images_about', backup.images.about);

    const msg = document.createElement('div');
    msg.className = 'success-message show';
    msg.textContent = '✅ Restored from backup!';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}
