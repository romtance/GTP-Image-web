const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            return;
        }

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex === -1) {
            return;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim();
        envVars[key] = value;
    });
}

const API_BASE_URL = envVars.BASE_URL || '';
const API_KEY = envVars.API_KEY || '';
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/$/, '');
const API_ENDPOINT = !NORMALIZED_API_BASE_URL
    ? ''
    : NORMALIZED_API_BASE_URL.endsWith('/v1/images/generations')
        ? NORMALIZED_API_BASE_URL
        : NORMALIZED_API_BASE_URL.endsWith('/v1')
            ? `${NORMALIZED_API_BASE_URL}/images/generations`
            : `${NORMALIZED_API_BASE_URL}/v1/images/generations`;
const API_ORIGIN = API_ENDPOINT ? new URL(API_ENDPOINT).origin : '';

const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');

function readHistory() {
    try {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')).map(item => ({
            ...item,
            likes: Number.isFinite(item.likes) && item.likes >= 0 ? item.likes : 0
        }));
    } catch {
        return [];
    }
}

function writeHistory(data) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function sortHistory(history, sort) {
    if (sort === 'likes') {
        return [...history].sort((a, b) => {
            const likeDiff = (b.likes || 0) - (a.likes || 0);
            if (likeDiff !== 0) return likeDiff;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
    }

    return [...history].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
}

function getPaginatedHistory(history, page, pageSize, sort) {
    const total = history.length;
    const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50;
    const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedPageSize);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedPage = totalPages === 0
        ? 1
        : Math.min(safePage, totalPages);
    const startIndex = (normalizedPage - 1) * normalizedPageSize;
    const items = history.slice(startIndex, startIndex + normalizedPageSize);

    return {
        items,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages,
        sort
    };
}

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

// Serve static files
function serveStaticFile(req, res) {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
}

// CORS headers helper
function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Save base64 image to file and return URL
function saveImageToFile(base64Data, index) {
    const timestamp = Date.now();
    const filename = `img_${timestamp}_${index}.png`;
    const filepath = path.join(IMAGES_DIR, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);
    return `/api/images/${filename}`;
}

function getImageExtension(contentType, imageUrl) {
    if (contentType === 'image/jpeg') return '.jpg';
    if (contentType === 'image/gif') return '.gif';
    if (contentType === 'image/webp') return '.webp';
    if (contentType === 'image/svg+xml') return '.svg';
    if (contentType === 'image/png') return '.png';

    const pathname = new URL(imageUrl).pathname;
    const ext = path.extname(pathname);
    return ext || '.png';
}

function downloadImageFromUrl(imageUrl, index, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(imageUrl);
        const httpModule = parsedUrl.protocol === 'https:' ? https : http;

        const request = httpModule.get(parsedUrl, (response) => {
            const statusCode = response.statusCode || 500;

            if (statusCode >= 300 && statusCode < 400 && response.headers.location && redirectCount < 3) {
                const redirectUrl = new URL(response.headers.location, imageUrl).toString();
                response.resume();
                resolve(downloadImageFromUrl(redirectUrl, index, redirectCount + 1));
                return;
            }

            if (statusCode !== 200) {
                response.resume();
                reject(new Error(`图片下载失败: ${statusCode}`));
                return;
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const contentType = response.headers['content-type'];
                const ext = getImageExtension(contentType, imageUrl);
                const filename = `img_${Date.now()}_${index}${ext}`;
                const filepath = path.join(IMAGES_DIR, filename);
                fs.writeFileSync(filepath, Buffer.concat(chunks));
                resolve(`/api/images/${filename}`);
            });
        });

        request.on('error', (error) => {
            reject(new Error('图片下载失败: ' + error.message));
        });
    });
}

async function normalizeImageItem(item, index) {
    if (item.b64_json) {
        const url = saveImageToFile(item.b64_json, index);
        return { url, file_id: item.file_id, revised_prompt: item.revised_prompt };
    }

    if (item.url) {
        const remoteUrl = new URL(item.url, API_ORIGIN).toString();
        const url = await downloadImageFromUrl(remoteUrl, index);
        return { url, file_id: item.file_id, revised_prompt: item.revised_prompt };
    }

    return item;
}

// Proxy API requests
function proxyAPIRequest(req, res) {
    if (!API_ENDPOINT) {
        setCORSHeaders(res);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: '未配置 BASE_URL，请先在 .env 中设置上游图片接口地址' } }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const parsedUrl = new URL(API_ENDPOINT);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const proxyReq = httpModule.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => {
                data += chunk;
            });

            proxyRes.on('end', async () => {
                try {
                    const response = JSON.parse(data);
                    if (proxyRes.statusCode === 200 && response.data) {
                        response.data = await Promise.all(
                            response.data.map((item, index) => normalizeImageItem(item, index))
                        );
                    }
                    setCORSHeaders(res);
                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(response));
                } catch (e) {
                    setCORSHeaders(res);
                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
        });

        proxyReq.on('error', (error) => {
            console.error('Proxy error:', error);
            setCORSHeaders(res);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: '代理请求失败: ' + error.message } }));
        });

        proxyReq.write(body);
        proxyReq.end();
    });
}

const server = http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res);
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle API proxy
    if (req.url === '/api/generate' && req.method === 'POST') {
        proxyAPIRequest(req, res);
        return;
    }

    // Serve images
    if (req.url.startsWith('/api/images/') && req.method === 'GET') {
        const filename = req.url.split('/').pop();
        const filepath = path.join(IMAGES_DIR, filename);
        if (fs.existsSync(filepath)) {
            setCORSHeaders(res);
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(fs.readFileSync(filepath));
        } else {
            res.writeHead(404);
            res.end('Image not found');
        }
        return;
    }

    // History API
    if (req.url.startsWith('/api/history') && req.method === 'GET') {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (requestUrl.pathname !== '/api/history') {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const page = parseInt(requestUrl.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(requestUrl.searchParams.get('pageSize') || '50', 10);
        const sort = requestUrl.searchParams.get('sort') === 'likes' ? 'likes' : 'time';
        const sortedHistory = sortHistory(readHistory(), sort);
        const pagination = getPaginatedHistory(sortedHistory, page, pageSize, sort);
        setCORSHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pagination));
        return;
    }

    if (req.url === '/api/history' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const history = readHistory();
            const historyItem = JSON.parse(body);
            history.unshift({
                ...historyItem,
                likes: Number.isFinite(historyItem.likes) && historyItem.likes >= 0 ? historyItem.likes : 0
            });
            writeHistory(history);
            setCORSHeaders(res);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(history));
        });
        return;
    }

    if (req.url.startsWith('/api/history/') && req.method === 'POST') {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const match = requestUrl.pathname.match(/^\/api\/history\/(\d+)\/like$/);
        if (!match) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const id = parseInt(match[1], 10);
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { liked } = JSON.parse(body || '{}');
            const history = readHistory();
            const item = history.find(entry => entry.id === id);

            if (!item) {
                setCORSHeaders(res);
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'History item not found' }));
                return;
            }

            item.likes = Math.max(0, (item.likes || 0) + (liked ? 1 : -1));
            writeHistory(history);
            setCORSHeaders(res);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(item));
        });
        return;
    }

    if (req.url === '/api/history' && req.method === 'DELETE') {
        writeHistory([]);
        setCORSHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
    }

    if (req.url.startsWith('/api/history/') && req.method === 'DELETE') {
        const id = parseInt(req.url.split('/').pop());
        const history = readHistory().filter(item => item.id !== id);
        writeHistory(history);
        setCORSHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(history));
        return;
    }

    // Serve static files
    serveStaticFile(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API endpoint configured: ${API_ENDPOINT ? 'yes' : 'no'}`);
    console.log(`Authorization header configured: ${API_KEY ? 'yes' : 'no'}`);
});
