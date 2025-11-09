import { Elysia } from "elysia";
import { db } from "../firestore";

// ============================================================
// Verbose ASCII Logger
// ============================================================
function log(section: string, message: string, data?: any) {
  const time = new Date().toISOString();
  console.log(`[${time}] [${section}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

// ============================================================
// Simple per-IP rate limiter
// ============================================================
const rateLimitMap = new Map<string, { count: number; last: number }>();

function rateLimit(ip: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const data = rateLimitMap.get(ip);

  if (!data || now - data.last > windowMs) {
    rateLimitMap.set(ip, { count: 1, last: now });
    return false;
  }

  if (data.count >= limit) {
    log("RATE_LIMIT", `IP ${ip} exceeded limit (${limit}/${windowMs}ms)`);
    return true;
  }

  data.count++;
  rateLimitMap.set(ip, data);
  return false;
}

// ============================================================
// Spotify URL Validation
// ============================================================
function validateSpotifyUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /^https?:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/
  );
  if (match) return `https://open.spotify.com/track/${match[1]}`;
  if (/^https?:\/\/spotify\.link\//i.test(trimmed)) return trimmed;
  return null;
}

// ============================================================
// Spotify Token Cache + Request
// ============================================================
let cachedToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expires > now) {
    log("SPOTIFY_TOKEN", "Using cached Spotify token");
    return cachedToken.token;
  }

  log("SPOTIFY_TOKEN", "Requesting new Spotify token...");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    log("SPOTIFY_ERROR", "Failed to obtain token", { response: text });
    throw new Error("Spotify token request failed");
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expires: now + data.expires_in * 1000 - 60_000,
  };

  log("SPOTIFY_TOKEN", "New token obtained successfully", {
    expiresInSec: data.expires_in,
  });

  return cachedToken.token;
}

// ============================================================
// Main Songfess Routes
// ============================================================
export const songfessRoutes = new Elysia({ prefix: "/songfess" })

  // ==========================================================
  // POST /songfess : Submit new confession
  // ==========================================================
  .post("/", async ({ body, request }) => {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    log("REQUEST", `POST /songfess from IP ${ip}`);

    if (rateLimit(ip)) {
      log("RATE_LIMIT", `Blocked IP ${ip}`);
      return new Response(
        JSON.stringify({ status: "error", error: "Too many requests." }),
        { status: 429 }
      );
    }

    const { message, songUrl, recipient } = body as {
      message?: string;
      songUrl?: string;
      recipient?: string;
    };

    if (!message?.trim()) {
      log("VALIDATION", "Missing message field");
      return new Response(
        JSON.stringify({ status: "error", error: "Message is required." }),
        { status: 400 }
      );
    }

    if (message.length > 500) {
      log("VALIDATION", "Message too long");
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Message too long (max 500 chars).",
        }),
        { status: 400 }
      );
    }

    const validSongUrl = validateSpotifyUrl(songUrl);
    const safeRecipient = recipient?.trim()
      ? recipient.trim().slice(0, 50)
      : "Secret";

    const trackMeta = {
      url: validSongUrl || "",
      embedUrl: "",
      id: "",
      name: "",
      artist: "",
      coverImage: "",
    };

    // ----------------------------------------------------------
    // Fetch Spotify track metadata
    // ----------------------------------------------------------
    if (validSongUrl) {
      const match = validSongUrl.match(/\/track\/([a-zA-Z0-9]+)/);
      if (match) {
        const trackId = match[1];
        trackMeta.id = trackId;
        trackMeta.embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
        log("SPOTIFY", `Fetching metadata for track ${trackId}`);

        try {
          const token = await getSpotifyToken(
            process.env.SPOTIFY_CLIENT_ID!,
            process.env.SPOTIFY_CLIENT_SECRET!
          );

          const trackRes = await fetch(
            `https://api.spotify.com/v1/tracks/${trackId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (trackRes.ok) {
            const t = await trackRes.json();
            trackMeta.name = t.name ?? "";
            trackMeta.artist =
              t.artists?.map((a: any) => a.name).join(", ") ?? "";
            trackMeta.coverImage = t.album?.images?.[0]?.url ?? "";
            log("SPOTIFY", "Fetched track details successfully", {
              track: trackMeta,
            });
          } else {
            const errText = await trackRes.text();
            log("SPOTIFY_ERROR", "Track fetch failed", { response: errText });
          }
        } catch (err) {
          log("SPOTIFY_ERROR", "Error fetching metadata", {
            error: String(err),
          });
        }
      }
    }

    // ----------------------------------------------------------
    // Save confession to Firestore
    // ----------------------------------------------------------
    try {
      const docRef = await db.collection("songfess").add({
        message: message.trim(),
        recipient: safeRecipient,
        track: trackMeta,
        createdAt: new Date().toISOString(),
        ipHash: Buffer.from(ip).toString("base64").slice(0, 16),
      });

      log("FIRESTORE", "Saved new confession", { id: docRef.id });
      return new Response(JSON.stringify({ status: "ok", id: docRef.id }), {
        status: 201,
      });
    } catch (err) {
      log("FIRESTORE_ERROR", "Error saving confession", { error: String(err) });
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Server error while saving.",
        }),
        { status: 500 }
      );
    }
  })

  // ==========================================================
  // GET /songfess/search : Spotify search proxy
  // ==========================================================
  .get("/search", async ({ query, request }) => {
    const q = query.q;
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    log("REQUEST", `GET /songfess/search?q=${q} from IP ${ip}`);

    if (!q || typeof q !== "string") {
      log("VALIDATION", "Missing or invalid query");
      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (rateLimit(ip, 40, 30_000)) {
      log("RATE_LIMIT", `Too many search requests from ${ip}`);
      return new Response(
        JSON.stringify({ status: "error", error: "Too many search requests." }),
        { status: 429 }
      );
    }

    try {
      const token = await getSpotifyToken(
        process.env.SPOTIFY_CLIENT_ID!,
        process.env.SPOTIFY_CLIENT_SECRET!
      );

      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          q
        )}&type=track&limit=7`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const text = await res.text();
        log("SPOTIFY_ERROR", "Search failed", { response: text });
        return new Response(JSON.stringify([]), { status: 200 });
      }

      const data = await res.json();
      const tracks =
        data.tracks?.items?.map((track: any) => ({
          id: track.id,
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(", "),
          image: track.album.images?.[0]?.url ?? "",
          url: track.external_urls.spotify,
          embedUrl: `https://open.spotify.com/embed/track/${track.id}`,
        })) ?? [];

      log("SPOTIFY", `Found ${tracks.length} results for query "${q}"`);
      return new Response(JSON.stringify(tracks), { status: 200 });
    } catch (err) {
      log("SPOTIFY_ERROR", "Search handler failed", { error: String(err) });
      return new Response(JSON.stringify([]), { status: 200 });
    }
  })

  // ==========================================================
  // GET /songfess : Recent confessions
  // ==========================================================
  .get("/", async ({ query }) => {
    const limit = Math.min(Number(query.limit) || 20, 100);
    log("REQUEST", `GET /songfess?limit=${limit}`);

    try {
      const snapshot = await db
        .collection("songfess")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      const items: any[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({
          id: doc.id,
          message: d.message,
          recipient: d.recipient,
          track: d.track,
          createdAt: d.createdAt,
        });
      });

      log("FIRESTORE", `Fetched ${items.length} recent confessions`);
      return new Response(JSON.stringify(items), { status: 200 });
    } catch (err) {
      log("FIRESTORE_ERROR", "Failed to fetch confessions", {
        error: String(err),
      });
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Failed to fetch confessions.",
        }),
        { status: 500 }
      );
    }
  });
