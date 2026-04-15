// Netlify serverless function: proxy GitHub commits so the GitHub token
// never leaves the server. The admin panel sends the admin password; this
// function verifies it and uses the server-side GITHUB_TOKEN env var.

const GITHUB_OWNER  = 'ssorvex';
const GITHUB_REPO   = 'ShinyPaws';
const GITHUB_BRANCH = 'main';

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { password, filePath, content, message } = body;

    // Verify admin password
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured (missing GITHUB_TOKEN env var)' }) };
    }

    if (!filePath || content === undefined) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'filePath and content are required' }) };
    }

    try {
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
        const authHeaders = {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        // Get current SHA (needed for updates)
        let sha = null;
        const shaRes = await fetch(apiUrl, { headers: authHeaders });
        if (shaRes.ok) {
            const shaData = await shaRes.json();
            sha = shaData.sha;
        }

        // Encode content to base64
        // content can be a plain string (HTML) or already a base64 string (images)
        let base64Content;
        if (body.isBase64) {
            base64Content = content; // already base64 (image uploads)
        } else {
            // UTF-8 string → base64
            const encoded = Buffer.from(content, 'utf8').toString('base64');
            base64Content = encoded;
        }

        const putBody = {
            message: message || `Update ${filePath}`,
            content: base64Content,
            branch: GITHUB_BRANCH
        };
        if (sha) putBody.sha = sha;

        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify(putBody)
        });

        if (!putRes.ok) {
            const errData = await putRes.json();
            return { statusCode: putRes.status, headers, body: JSON.stringify({ error: errData.message || putRes.statusText }) };
        }

        const result = await putRes.json();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, sha: result.content && result.content.sha })
        };

    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};
