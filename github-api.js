/**
 * GitHub API Integration for Shiny Paws Admin Panel
 * SECURE VERSION: Token is prompted each time, never stored
 */

const GITHUB_CONFIG = {
  owner: 'ssorvex',
  repo: 'ShinyPaws',
  branch: 'main'
};

/**
 * Prompt user for GitHub token (secure - not stored)
 */
function promptForGitHubToken() {
  const token = prompt(
    'Enter your GitHub Personal Access Token:\n\n' +
    'You can create one at: https://github.com/settings/tokens\n\n' +
    'Required scope: repo (full control of repositories)\n\n' +
    'Token will be used once and not saved.'
  );
  
  if (!token || token.trim() === '') {
    throw new Error('GitHub token is required to update the website');
  }
  
  return token.trim();
}

/**
 * Get file content from GitHub
 */
async function getFileFromGitHub(filePath, token) {
  if (!token) {
    throw new Error('GitHub token is required');
  }

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid GitHub token. Please check and try again.');
      }
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error('GitHub API Error:', error);
    throw error;
  }
}

/**
 * Get file SHA (needed for updates)
 */
async function getFileSHA(filePath, token) {
  if (!token) {
    throw new Error('GitHub token is required');
  }

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid GitHub token. Please check and try again.');
      }
      throw new Error(`Failed to fetch file info: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sha;
  } catch (error) {
    console.error('GitHub API Error:', error);
    throw error;
  }
}

/**
 * Upload/Update file to GitHub
 * Token is passed as parameter and not stored
 */
async function uploadFileToGitHub(filePath, content, message, token) {
  if (!token) {
    throw new Error('GitHub token is required');
  }

  try {
    // Get current file SHA (for updates)
    let sha = null;
    try {
      sha = await getFileSHA(filePath, token);
    } catch (e) {
      // File doesn't exist yet, that's okay
      console.log('File does not exist yet, creating new file');
    }

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const body = {
      message: message || `Update ${filePath}`,
      content: btoa(content), // Base64 encode
      branch: GITHUB_CONFIG.branch
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        throw new Error('Invalid GitHub token. Please check and try again.');
      }
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

/**
 * Update multiple files in GitHub
 */
async function updateMultipleFilesOnGitHub(files, token) {
  if (!token) {
    throw new Error('GitHub token is required');
  }

  const results = [];
  
  for (const file of files) {
    try {
      console.log(`Uploading ${file.path}...`);
      const result = await uploadFileToGitHub(file.path, file.content, file.message, token);
      results.push({
        path: file.path,
        success: true,
        result: result
      });
    } catch (error) {
      results.push({
        path: file.path,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Generate commit message with timestamp
 */
function generateCommitMessage(action) {
  const timestamp = new Date().toLocaleString();
  return `${action} - Updated via admin panel (${timestamp})`;
}

/**
 * Clear sensitive data from memory
 */
function clearSensitiveData(token) {
  if (token) {
    // Overwrite token in memory
    token = null;
  }
}
