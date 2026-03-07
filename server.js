const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(ROOT_DIR, 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const SCHEDULE_EMBED_FILE = path.join(DATA_DIR, 'schedule_data.js');
const CHANGE_LOG_FILE = path.join(DATA_DIR, 'change_logs.json');
const MAX_CHANGE_LOGS = 2000;
const ALLOWED_ORIGINS_RAW = String(process.env.ALLOWED_ORIGINS || '').trim();
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW
    ? ALLOWED_ORIGINS_RAW
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : ['*'];

const FLOOR_ORDER = { '二层': 1, '三层': 2, '四层': 3 };

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(SCHEDULE_FILE)) {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify({}, null, 2), 'utf8');
    }

    if (!fs.existsSync(CHANGE_LOG_FILE)) {
        fs.writeFileSync(CHANGE_LOG_FILE, JSON.stringify([], null, 2), 'utf8');
    }

    if (!fs.existsSync(SCHEDULE_EMBED_FILE)) {
        syncEmbeddedScheduleFile();
    }
}

function readJson(filePath, fallbackValue) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        return fallbackValue;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function writeEmbeddedScheduleFile(schedule) {
    const content = `window.__SCHEDULE_DATA__ = ${JSON.stringify(schedule, null, 2)};\n`;
    fs.writeFileSync(SCHEDULE_EMBED_FILE, content, 'utf8');
}

function inferSlotFromTime(time) {
    const normalized = String(time || '').replace(/\s+/g, '');
    if (!normalized) return 1;
    if (normalized.includes('19:00-21:00') || normalized.includes('19:00')) return 2;
    return 1;
}

function normalizeSchedule(schedule) {
    const normalized = {};

    if (!schedule || typeof schedule !== 'object') {
        return normalized;
    }

    for (const [date, entries] of Object.entries(schedule)) {
        if (!Array.isArray(entries)) {
            normalized[date] = [];
            continue;
        }

        const cleaned = entries
            .filter((item) => item && typeof item === 'object' && FLOOR_ORDER[item.floor])
            .map((item) => {
                const slot = Number.parseInt(item.slot, 10);
                const safeSlot = slot === 1 || slot === 2 ? slot : inferSlotFromTime(item.time);

                return {
                    floor: item.floor,
                    time: String(item.time || '暂无').trim(),
                    name: String(item.name || '暂无').trim(),
                    slot: safeSlot
                };
            })
            .sort((a, b) => {
                const floorDiff = FLOOR_ORDER[a.floor] - FLOOR_ORDER[b.floor];
                if (floorDiff !== 0) return floorDiff;

                const slotDiff = a.slot - b.slot;
                if (slotDiff !== 0) return slotDiff;

                const timeDiff = a.time.localeCompare(b.time, 'zh-CN');
                if (timeDiff !== 0) return timeDiff;

                return a.name.localeCompare(b.name, 'zh-CN');
            });

        normalized[date] = cleaned;
    }

    return Object.fromEntries(
        Object.entries(normalized).sort((a, b) => a[0].localeCompare(b[0]))
    );
}

function syncEmbeddedScheduleFile() {
    const schedule = normalizeSchedule(readJson(SCHEDULE_FILE, {}));
    writeEmbeddedScheduleFile(schedule);
}

function createChangeLog(log) {
    const now = new Date().toISOString();
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: log.type || 'swap',
        timestamp: log.timestamp || now,
        source: log.source || {},
        target: log.target || {}
    };
}

function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function sendText(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(message);
}

function resolveAllowedOrigin(requestOrigin) {
    if (!requestOrigin) {
        return null;
    }

    if (ALLOWED_ORIGINS.includes('*')) {
        return '*';
    }

    return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

function applyCorsHeaders(req, res) {
    const requestOrigin = req.headers.origin;
    const allowedOrigin = resolveAllowedOrigin(requestOrigin);

    if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Vary', 'Origin');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) {
                reject(new Error('请求体过大'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('JSON 格式错误'));
            }
        });
        req.on('error', reject);
    });
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html':
            return 'text/html; charset=utf-8';
        case '.css':
            return 'text/css; charset=utf-8';
        case '.js':
            return 'application/javascript; charset=utf-8';
        case '.json':
            return 'application/json; charset=utf-8';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.svg':
            return 'image/svg+xml';
        case '.ico':
            return 'image/x-icon';
        case '.xlsx':
            return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        default:
            return 'application/octet-stream';
    }
}

function safeResolveStaticPath(urlPathname) {
    const decoded = decodeURIComponent(urlPathname);
    const relativePath = decoded === '/' ? '/index.html' : decoded;
    const absolutePath = path.resolve(ROOT_DIR, `.${relativePath}`);

    if (!absolutePath.startsWith(ROOT_DIR)) {
        return null;
    }

    return absolutePath;
}

async function handleApiRequest(req, res, pathname) {
    if (pathname === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, { ok: true, now: new Date().toISOString() });
        return true;
    }

    if (pathname === '/api/schedule' && req.method === 'GET') {
        const schedule = normalizeSchedule(readJson(SCHEDULE_FILE, {}));
        sendJson(res, 200, {
            schedule,
            updatedAt: new Date().toISOString()
        });
        return true;
    }

    if (pathname === '/api/schedule' && req.method === 'POST') {
        try {
            const body = await parseRequestBody(req);
            const incomingSchedule = body && typeof body === 'object' ? body.schedule : null;
            if (!incomingSchedule || typeof incomingSchedule !== 'object') {
                sendJson(res, 400, { error: '缺少 schedule 对象' });
                return true;
            }

            const normalized = normalizeSchedule(incomingSchedule);
            writeJson(SCHEDULE_FILE, normalized);
            writeEmbeddedScheduleFile(normalized);
            sendJson(res, 200, {
                ok: true,
                dates: Object.keys(normalized).length,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            sendJson(res, 400, { error: error.message });
        }
        return true;
    }

    if (pathname === '/api/change-logs' && req.method === 'GET') {
        const logs = readJson(CHANGE_LOG_FILE, []);
        sendJson(res, 200, { logs: Array.isArray(logs) ? logs : [] });
        return true;
    }

    if (pathname === '/api/change-logs' && req.method === 'POST') {
        try {
            const body = await parseRequestBody(req);
            const incomingLog = body && body.log ? body.log : body;
            if (!incomingLog || typeof incomingLog !== 'object') {
                sendJson(res, 400, { error: '缺少日志数据' });
                return true;
            }

            const logs = readJson(CHANGE_LOG_FILE, []);
            const normalizedLogs = Array.isArray(logs) ? logs : [];
            normalizedLogs.unshift(createChangeLog(incomingLog));

            if (normalizedLogs.length > MAX_CHANGE_LOGS) {
                normalizedLogs.length = MAX_CHANGE_LOGS;
            }

            writeJson(CHANGE_LOG_FILE, normalizedLogs);
            sendJson(res, 200, { ok: true, count: normalizedLogs.length });
        } catch (error) {
            sendJson(res, 400, { error: error.message });
        }
        return true;
    }

    if (pathname === '/api/change-logs' && req.method === 'DELETE') {
        writeJson(CHANGE_LOG_FILE, []);
        sendJson(res, 200, { ok: true });
        return true;
    }

    return false;
}

const server = http.createServer(async (req, res) => {
    ensureDataFiles();
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    try {
        if (pathname.startsWith('/api/')) {
            const handled = await handleApiRequest(req, res, pathname);
            if (!handled) {
                sendJson(res, 404, { error: 'API 不存在' });
            }
            return;
        }

        const filePath = safeResolveStaticPath(pathname);
        if (!filePath) {
            sendText(res, 403, 'Forbidden');
            return;
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            sendText(res, 404, 'Not Found');
            return;
        }

        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': getContentType(filePath) });
        res.end(data);
    } catch (error) {
        console.error('Server error:', error);
        sendJson(res, 500, { error: '服务器内部错误' });
    }
});

server.listen(PORT, HOST, () => {
    ensureDataFiles();
    syncEmbeddedScheduleFile();
    console.log(`Duty schedule server running on http://localhost:${PORT}`);
    console.log(`DATA_DIR=${DATA_DIR}`);
    console.log(`ALLOWED_ORIGINS=${ALLOWED_ORIGINS.join(',')}`);
});
