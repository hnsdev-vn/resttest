const http = require("http");

const pools = new Map();

function computeQuantile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const rank = (percentile / 100) * (n - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);

    if (lower === upper) return sorted[lower];

    const fraction = rank - lower;
    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

function sendJson(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
        sendJson(res, 405, { error: "Only POST allowed" });
        return;
    }

    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
        try {
            const data = JSON.parse(body);

            if (req.url === "/pool") {
                const { poolId, poolValues } = data;

                if (typeof poolId !== "number" || !Array.isArray(poolValues)) {
                    sendJson(res, 400, { error: "Invalid payload format" });
                    return;
                }

                const existing = pools.get(poolId);
                if (existing) {
                    existing.push(...poolValues);
                    sendJson(res, 200, { status: "appended" });
                } else {
                    pools.set(poolId, [...poolValues]);
                    sendJson(res, 201, { status: "inserted" });
                }
            }

            else if (req.url === "/query") {
                const { poolId, percentile } = data;

                if (typeof poolId !== "number" || typeof percentile !== "number") {
                    sendJson(res, 400, { error: "Invalid payload format" });
                    return;
                }

                const values = pools.get(poolId);
                if (!values) {
                    sendJson(res, 404, { error: "Pool not found" });
                    return;
                }

                const quantile = computeQuantile(values, percentile);
                sendJson(res, 200, {
                    quantile,
                    count: values.length,
                });
            }

            else {
                sendJson(res, 404, { error: "Unknown endpoint" });
            }
        } catch (e) {
            sendJson(res, 400, { error: "Invalid JSON input" });
        }
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
