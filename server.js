import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "./index.js";

const PORT = process.env.PORT ?? 4000;
const BASE = process.env.BASE_PATH ?? "";
const __dir = dirname(fileURLToPath(import.meta.url));

const STATIC = {
  "/": { file: "docs/landing.html", mime: "text/html" },
  "/docs": { file: "docs/index.html", mime: "text/html" },
  "/style.css": { file: "docs/style.css", mime: "text/css" },
  "/logo.svg": { file: "docs/logo.svg", mime: "image/svg+xml" },
};

function serveStatic(res, entry) {
  try {
    const body = readFileSync(join(__dir, entry.file));
    res.writeHead(200, {
      "Content-Type": entry.mime + "; charset=utf-8",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
    res.end("Not found");
  }
}

async function nodeToRequest(req) {
  const host = req.headers["host"] ?? `localhost:${PORT}`;
  const stripped = BASE && req.url.startsWith(BASE) ? req.url.slice(BASE.length) || "/" : req.url;
  const url = `http://${host}${stripped}`;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : null;

  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body?.length ? body : undefined,
    duplex: "half",
  });
}

const server = http.createServer(async (req, res) => {
  console.log(`→ ${req.method} ${req.url}`);

  // DEEP FIX: Global CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // DEEP FIX: Robust CORS Proxy for HLS Streams (m3u8 / ts)
  if (req.url.startsWith("/proxy")) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const target = urlObj.searchParams.get("url");
    
    if (!target) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Missing url parameter" }));
      return;
    }

    let referer = urlObj.searchParams.get("referer");
    const targetObj = new URL(target);

    // Auto-inject Referers for known hosts if missing
    if (!referer && targetObj.hostname.includes("krussdomi.com")) {
      referer = "https://krussdomi.com/";
    } else if (!referer && targetObj.hostname.includes("flixcloud")) {
      referer = "https://flixcloud.cc/";
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site"
    };

    if (referer) {
      headers["Referer"] = referer;
      headers["Origin"] = new URL(referer).origin;
    }

    try {
      const upstream = await fetch(target, { headers });
      const ct = upstream.headers.get("content-type") || "";

      res.writeHead(upstream.status, {
        "Content-Type": ct,
      });

      const isM3U8 = ct.includes("mpegurl") || ct.includes("x-mpegurl") || target.includes(".m3u8");
      
      if (isM3U8) {
        const text = await upstream.text();
        
        // ONLY rewrite if it's actually an M3U8 file! (Could be Cloudflare HTML or encrypted text otherwise)
        if (text.trim().startsWith("#EXTM3U")) {
          const lines = text.split("\n");
          const rewritten = lines.map(line => {
            const t = line.trim();
            if (t.startsWith("#") || t === "") return line; // preserve exact line (including CR) if not URL
            
            let absoluteUrl = t;
            if (!t.startsWith("http")) {
               absoluteUrl = new URL(t, target).toString();
            }
            
            // Guarantee all query params (like token) are preserved on every segment link
            const resolved = new URL(absoluteUrl);
            const targetParsed = new URL(target);
            for (const [k, v] of targetParsed.searchParams) {
               if (!resolved.searchParams.has(k)) {
                 resolved.searchParams.set(k, v);
               }
            }
            
            let proxyUrl = `http://localhost:${PORT}/proxy?url=${encodeURIComponent(resolved.toString())}`;
            if (referer) {
               proxyUrl += `&referer=${encodeURIComponent(referer)}`;
            }
            return proxyUrl;
          }).join("\n");
          res.end(rewritten);
        } else {
          // Return as is (likely HTML 403 or encrypted bytes)
          res.end(text);
        }
      } else {
        // Stream video chunks instead of buffering to memory to avoid timeouts/Network Errors
        if (upstream.body) {
          const { Readable } = await import('node:stream');
          Readable.fromWeb(upstream.body).pipe(res);
        } else {
          res.end();
        }
      }
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Proxy Error", message: e.message }));
    }
    return;
  }

  const pathname = req.url.split("?")[0];
  const staticEntry = STATIC[pathname];

  if (req.method === "GET" && staticEntry) {
    return serveStatic(res, staticEntry);
  }

  try {
    const request = await nodeToRequest(req);
    const response = await worker.fetch(request, {});

    res.statusCode = response.status;
    for (const [k, v] of response.headers) {
      // Don't override our global CORS headers
      if (k.toLowerCase() !== "access-control-allow-origin") {
        res.setHeader(k, v);

      }
    }

    const buf = await response.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error("Unhandled error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Anifox dev server → http://localhost:${PORT}`);
});
