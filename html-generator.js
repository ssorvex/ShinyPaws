/**
 * HTML Generator for Shiny Paws
 * Generates updated HTML files with edited content
 */

/**
 * Load current website HTML files
 */
async function loadWebsiteFiles(token) {
  try {
    const indexHtml = await getFileFromGitHub('index.html', token);
    const studioHtml = await getFileFromGitHub('studio.html', token);
    
    return {
      index: indexHtml,
      studio: studioHtml
    };
  } catch (error) {
    console.error('Failed to load website files:', error);
    throw error;
  }
}

/**
 * Update content in HTML
 */
function updateHtmlContent(html, updates) {
  let updated = html;

  // Update text content by ID or class
  for (const [selector, newContent] of Object.entries(updates)) {
    // Try to find by id first
    const idRegex = new RegExp(`id="${selector}"[^>]*>([^<]*)<`, 'g');
    updated = updated.replace(idRegex, `id="${selector}">${newContent}<`);

    // Try to find by class
    const classRegex = new RegExp(`class="[^"]*${selector}[^"]*"[^>]*>([^<]*)<`, 'g');
    updated = updated.replace(classRegex, (match) => {
      return match.replace(/>[^<]*</, `>${newContent}<`);
    });
  }

  return updated;
}

/**
 * Update images in HTML
 */
function updateHtmlImages(html, imageUpdates) {
  let updated = html;

  for (const [selector, imageUrl] of Object.entries(imageUpdates)) {
    // Update img src attributes
    const imgRegex = new RegExp(`<img[^>]*id="${selector}"[^>]*src="[^"]*"`, 'g');
    updated = updated.replace(imgRegex, (match) => {
      return match.replace(/src="[^"]*"/, `src="${imageUrl}"`);
    });

    // Update background images
    const bgRegex = new RegExp(`background-image:\\s*url\\([^)]*${selector}[^)]*\\)`, 'g');
    updated = updated.replace(bgRegex, `background-image: url(${imageUrl})`);
  }

  return updated;
}

/**
 * Update pricing in HTML
 */
function updateHtmlPricing(html, pricingUpdates) {
  let updated = html;

  for (const service of pricingUpdates) {
    // Find and replace pricing for each service
    const serviceRegex = new RegExp(
      `${service.name}[^<]*<[^>]*>\\s*\\$[\\d.]+`,
      'gi'
    );
    updated = updated.replace(serviceRegex, (match) => {
      return match.replace(/\$[\d.]+/, `$${service.price}`);
    });
  }

  return updated;
}

/**
 * Generate updated index.html with content changes
 */
function generateUpdatedIndex(originalHtml, contentData) {
  let html = originalHtml;

  if (contentData.heroTitle) {
    html = updateHtmlContent(html, { 'hero-title': contentData.heroTitle });
  }

  if (contentData.heroSubtitle) {
    html = updateHtmlContent(html, { 'hero-subtitle': contentData.heroSubtitle });
  }

  if (contentData.services) {
    // Update service cards
    contentData.services.forEach((service, index) => {
      html = updateHtmlContent(html, {
        [`service-title-${index}`]: service.title,
        [`service-price-${index}`]: service.price,
        [`service-description-${index}`]: service.description
      });
    });
  }

  if (contentData.heroImage) {
    html = updateHtmlImages(html, { 'hero-image': contentData.heroImage });
  }

  return html;
}

/**
 * Generate updated studio.html with gallery changes
 */
function generateUpdatedStudio(originalHtml, galleryImages, contentData) {
  let html = originalHtml;

  // Update gallery images
  if (galleryImages && galleryImages.length > 0) {
    galleryImages.forEach((imageUrl, index) => {
      html = updateHtmlImages(html, { [`gallery-image-${index}`]: imageUrl });
    });
  }

  // Update about section content
  if (contentData) {
    if (contentData.aboutTitle) {
      html = updateHtmlContent(html, { 'about-title': contentData.aboutTitle });
    }
    if (contentData.aboutDescription) {
      html = updateHtmlContent(html, { 'about-description': contentData.aboutDescription });
    }
  }

  return html;
}

/**
 * Create a downloadable HTML file
 */
function downloadHtmlFile(filename, content) {
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
 * Create a preview of changes
 */
function createPreview(originalHtml, updatedHtml) {
  // Simple diff preview - show what changed
  const changes = [];
  
  // Find text differences
  const originalText = originalHtml.replace(/<[^>]*>/g, '');
  const updatedText = updatedHtml.replace(/<[^>]*>/g, '');
  
  if (originalText !== updatedText) {
    changes.push('Content has been updated');
  }

  return changes;
}
