// Local proxy for the two external services the app talks to:
// - USDA FoodData Central (nutrition data)
// - OpenAI (the chatbot)
//
// Why this exists: FoodData Central does not support CORS, and neither key
// should be shipped inside client-side code anyway. This tiny server (Node
// built-ins only, no extra npm installs) holds both keys server-side.
//
// Setup:
//   1. USDA (free): https://fdc.nal.usda.gov/api-key-signup/
//   2. OpenAI (pay-per-use, needed only for the chatbot): https://platform.openai.com/api-keys
//   3. Create a `.env` file at the project root:
//        USDA_FDC_API_KEY=yourkeyhere
//        OPENAI_API_KEY=yourkeyhere
//   4. Run this alongside the app in a separate terminal: `npm run server`
//      (the app itself keeps running via `npm run dev` as usual)
//
// Without a USDA key, nutrition lookups still work via USDA's public
// DEMO_KEY (capped at 30/hour, 50/day). There's no equivalent free fallback
// for the chatbot - without OPENAI_API_KEY, the Chat tab just shows a
// message explaining it isn't configured yet.

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeNutrients, pickBestMatch } from "./nutrients.js";
import { callOpenAIChat } from "./chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(__dirname, "..", ".env"));

const PORT = Number(process.env.PORT || process.env.NUTRITION_PROXY_PORT) || 8787;
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, "..", "dist");
const shouldServeStatic =
  process.env.SERVE_STATIC === "1" ||
  (process.env.NODE_ENV === "production" && existsSync(path.join(STATIC_DIR, "index.html")));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const API_KEY = process.env.USDA_FDC_API_KEY || "DEMO_KEY";
const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

if (API_KEY === "DEMO_KEY") {
  console.warn(
    "[nutrition-proxy] No USDA_FDC_API_KEY found - using USDA's public DEMO_KEY " +
      "(30 requests/hour, 50/day). Get a free key at " +
      "https://fdc.nal.usda.gov/api-key-signup/ and put it in a .env file " +
      "at the project root as USDA_FDC_API_KEY=yourkeyhere."
  );
}

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Server-side cache on top of the client's own localStorage cache - mostly
// so a "refresh nutrition for all foods" pass doesn't re-hit USDA for the
// same ingredient twice in one run (several dishes share e.g. "paneer").
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

async function cachedFetchJson(cacheKey, url) {
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`USDA API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  cache.set(cacheKey, { data, at: Date.now() });
  return data;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function resolveStaticPath(urlPath) {
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const filePath = path.normalize(path.join(STATIC_DIR, relative));
  if (!filePath.startsWith(STATIC_DIR)) return null;
  return filePath;
}

function serveStaticFile(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return true;
  }

  let filePath = resolveStaticPath(url.pathname);
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(STATIC_DIR, "index.html");
  }
  if (!existsSync(filePath)) return false;

  const ext = path.extname(filePath);
  const body = readFileSync(filePath);
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  if (req.method === "HEAD") res.end();
  else res.end(body);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) req.destroy(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/api/nutrition/search" && req.method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) return sendJson(res, 400, { error: "Missing ?q= search term" });
      const searchUrl =
        `${FDC_BASE}/foods/search?api_key=${API_KEY}&pageSize=10` +
        `&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&query=${encodeURIComponent(q)}`;
      const data = await cachedFetchJson(`search:${q.toLowerCase()}`, searchUrl);
      const foods = data.foods || [];
      const candidates = foods.map((f) => ({ fdcId: f.fdcId, description: f.description, dataType: f.dataType }));
      const best = pickBestMatch(foods);
      return sendJson(res, 200, { query: q, candidates, bestMatchFdcId: best ? best.fdcId : null });
    }

    const foodMatch = url.pathname.match(/^\/api\/nutrition\/food\/(\d+)$/);
    if (foodMatch && req.method === "GET") {
      const fdcId = foodMatch[1];
      const detailUrl = `${FDC_BASE}/food/${fdcId}?api_key=${API_KEY}`;
      const data = await cachedFetchJson(`food:${fdcId}`, detailUrl);
      return sendJson(res, 200, {
        fdcId: data.fdcId,
        description: data.description,
        dataType: data.dataType,
        per100g: normalizeNutrients(data),
      });
    }

    if (url.pathname === "/api/nutrition/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true, usingDemoKey: API_KEY === "DEMO_KEY" });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true, static: shouldServeStatic });
    }

    if (url.pathname === "/api/chat/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: !!process.env.OPENAI_API_KEY });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = await readJsonBody(req);
      try {
        const data = await callOpenAIChat({
          apiKey: process.env.OPENAI_API_KEY,
          messages: body.messages,
          tools: body.tools,
          model: body.model || process.env.OPENAI_CHAT_MODEL,
        });
        return sendJson(res, 200, data);
      } catch (err) {
        const status = err.code === "NO_API_KEY" ? 501 : err.code === "BAD_REQUEST" ? 400 : err.status || 502;
        return sendJson(res, status, { error: err.message });
      }
    }

    if (shouldServeStatic && !url.pathname.startsWith("/api/") && serveStaticFile(req, res, url)) {
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[proxy] error:", err.message);
    sendJson(res, 502, { error: "Upstream API error", detail: err.message });
  }
});

server.listen(PORT, () => {
  const mode = shouldServeStatic ? "app + API" : "API proxy only";
  console.log(`[server] listening on http://localhost:${PORT} (${mode}: USDA FoodData Central + OpenAI chat)`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "[proxy] No OPENAI_API_KEY found - the Chat tab won't work until you add one to .env. " +
        "Get a key at https://platform.openai.com/api-keys"
    );
  }
});
