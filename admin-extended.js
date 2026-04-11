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
                <button onclick="updateImageOnWebsite('${section}', ${img.id})" style="width: 100%; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">🌐 Update Website</button>
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
    
    // Show loading state
    showImageSuccess('Updating website...');
    
    // Send to backend
    fetch('/api/update-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            page: 'studio', // or 'index' depending on which page
            elementId: `${section}-image-${id}`,
            imageUrl: image.data
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showImageSuccess(`✅ Website updated! Image "${image.name}" is now live.`);
        } else {
            showImageError(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        showImageError(`Failed to update: ${error.message}`);
    });
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

// ==================== CONTENT EDITOR ====================
function loadContentEditor() {
    const contentData = {
        'Home Page': {
            'Hero Title': 'Where Every Pet Gets Their Glow-Up',
            'Hero Subtitle': 'Premium grooming, daycare & boarding for dogs and cats',
            'CTA Button': 'Book an Appointment'
        },
        'Services': {
            'Section Title': 'Services Tailored for Your Furry Family',
            'Bath & Brush': 'A restorative wash-and-brush session',
            'Full Grooming': 'Organic bath, blow dry, hand-finished cut',
            'Daycare': 'Calm, supervised home-away-from-home'
        },
        'About': {
            'About Title': 'Family-Owned, Pet-Obsessed, Community-Proud',
            'About Description': 'Shiny Paws is a family- and minority-owned grooming salon',
            'Experience': '15+ Years Experience'
        }
    };
    const container = document.getElementById('contentSections');
    container.innerHTML = '';
    for (const [section, fields] of Object.entries(contentData)) {
        let sectionHTML = `<div class="content-section"><h3>${section}</h3>`;
        for (const [fieldName, fieldValue] of Object.entries(fields)) {
            const fieldId = `content_${section.replace(/\s+/g, '_')}_${fieldName.replace(/\s+/g, '_')}`;
            sectionHTML += `
                <div class="content-field">
                    <label>${fieldName}</label>
                    <textarea id="${fieldId}">${fieldValue}</textarea>
                </div>
            `;
        }
        sectionHTML += '</div>';
        container.innerHTML += sectionHTML;
    }
}

function saveAllContent() {
    const contentData = {};
    const fields = document.querySelectorAll('.content-field textarea');
    fields.forEach(field => {
        const id = field.id;
        const value = field.value;
        contentData[id] = value;
    });
    localStorage.setItem('websiteContent', JSON.stringify(contentData));
    const msg = document.createElement('div');
    msg.className = 'success-message show';
    msg.textContent = 'All content saved successfully!';
    document.querySelector('#content .card').appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

// ==================== PRICING EDITOR ====================
function loadPricingEditor() {
    const pricingData = [
        { service: 'Bath & Brush', duration: '45 min', price: '60' },
        { service: 'Bath & Trim', duration: '60 min', price: '85' },
        { service: 'Full Grooming', duration: '90 min', price: '100' },
        { service: 'Daycare', duration: 'Full Day', price: '45' }
    ];
    const tbody = document.getElementById('pricingTable');
    tbody.innerHTML = pricingData.map((item, index) => `
        <tr>
            <td><input type="text" id="service_${index}" value="${item.service}" /></td>
            <td><input type="text" id="duration_${index}" value="${item.duration}" /></td>
            <td><input type="number" id="price_${index}" value="${item.price}" step="0.01" /></td>
        </tr>
    `).join('');
}

function savePricing() {
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
    localStorage.setItem('pricingData', JSON.stringify(pricingData));
    const msg = document.getElementById('pricingSuccessMessage');
    msg.textContent = 'Pricing updated successfully!';
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

// ==================== DRAG AND DROP REORDERING ====================
let draggedItem = null;

function dragStart(event) {
    draggedItem = event.currentTarget;
    event.currentTarget.style.opacity = '0.5';
    event.dataTransfer.effectAllowed = 'move';
}

function dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const afterElement = getDragAfterElement(event.clientY);
    const grid = document.getElementById('imageGrid');
    if (afterElement == null) {
        grid.appendChild(draggedItem);
    } else {
        grid.insertBefore(draggedItem, afterElement);
    }
}

function getDragAfterElement(y) {
    const draggableElements = [...document.querySelectorAll('.image-item')];
    return draggableElements.reduce((closest, child) => {
        if (child === draggedItem) return closest;
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function dropImage(event) {
    event.preventDefault();
    event.stopPropagation();
    const section = draggedItem.getAttribute('data-section');
    const grid = document.getElementById('imageGrid');
    const imageItems = [...grid.querySelectorAll('.image-item')];
    const newOrder = imageItems.map(item => item.getAttribute('data-image-id'));
    const images = JSON.parse(localStorage.getItem(`images_${section}`) || '[]');
    const reorderedImages = newOrder.map(id => images.find(img => img.id === parseInt(id)));
    localStorage.setItem(`images_${section}`, JSON.stringify(reorderedImages));
    showImageSuccess('Images reordered successfully!');
    loadSectionImages();
}

function dragEnd(event) {
    event.currentTarget.style.opacity = '1';
    draggedItem = null;
}
