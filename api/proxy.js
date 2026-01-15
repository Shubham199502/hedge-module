// Vercel Serverless Function - API Proxy for Google Apps Script
// This bypasses CORS restrictions by making server-side requests

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwdm7GvLT81vvsWuhMQNWuZfYRT1S45-hju1YEpVKxcH-Qnzm91KJOtigBL-nV1JiTvTQ/exec';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Build URL with query params
        const url = new URL(GAS_API_URL);

        // Forward all query parameters
        Object.keys(req.query).forEach(key => {
            if (key !== 'path') { // Exclude Vercel's path param
                url.searchParams.append(key, req.query[key]);
            }
        });

        // Make request to GAS
        const response = await fetch(url.toString(), {
            method: 'GET',
            redirect: 'follow'
        });

        const data = await response.json();

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
}
