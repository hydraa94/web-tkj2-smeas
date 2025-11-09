import { Elysia } from "elysia";
import { db } from "../firestore";

// Simple in-memory rate limiter (for demo / hobby use)
const rateLimitMap = new Map<string, { count: number; last: number }>();

function rateLimit(ip: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const data = rateLimitMap.get(ip);

  if (!data || now - data.last > windowMs) {
    rateLimitMap.set(ip, { count: 1, last: now });
    return false;
  }

  if (data.count >= limit) return true;

  data.count++;
  rateLimitMap.set(ip, data);
  return false;
}

// Helper: validate and sanitize SoundCloud URLs
function validateSoundCloudUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Allow only SoundCloud URLs
  if (!/^https?:\/\/(soundcloud\.com|on\.soundcloud\.com)\//i.test(trimmed)) {
    return null;
  }

  // Optional: prevent JS injection or weird query payloads
  try {
    const safeUrl = new URL(trimmed);
    return safeUrl.toString();
  } catch {
    return null;
  }
}

export const songfessRoutes = new Elysia({ prefix: "/songfess" })

  // POST: add new confession
  .post("/", async ({ body, request }) => {
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    // --- RATE LIMIT PROTECTION ---
    if (rateLimit(ip)) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Too many requests. Please wait a moment.",
        }),
        { status: 429 }
      );
    }

    const { message, songUrl, recipient } = body as {
      message?: string;
      songUrl?: string;
      recipient?: string;
    };

    // --- VALIDATION ---
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return new Response(
        JSON.stringify({ status: "error", error: "Message is required." }),
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Message too long (max 500 chars).",
        }),
        { status: 400 }
      );
    }

    const validSongUrl = validateSoundCloudUrl(songUrl);
    const safeRecipient =
      typeof recipient === "string" && recipient.trim().length > 0
        ? recipient.trim().slice(0, 50)
        : "Secret";

    // --- WRITE TO FIRESTORE ---
    try {
      const docRef = await db.collection("songfess").add({
        message: message.trim(),
        songUrl: validSongUrl || "",
        recipient: safeRecipient,
        createdAt: new Date().toISOString(),
        ipHash: Buffer.from(ip).toString("base64").slice(0, 16), // anonymized
      });

      return new Response(JSON.stringify({ status: "ok", id: docRef.id }), {
        status: 201,
      });
    } catch (err) {
      console.error("Firestore error:", err);
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Server error while saving confession.",
        }),
        { status: 500 }
      );
    }
  })

  // GET: list latest confessions
  .get("/", async ({ query }) => {
    const limit = Math.min(Number(query.limit) || 20, 100);

    try {
      const snapshot = await db
        .collection("songfess")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      const items: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();

        // Generate embeddable SoundCloud iframe if URL valid
        const embed =
          data.songUrl && data.songUrl.length > 0
            ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(
                data.songUrl
              )}`
            : null;

        items.push({
          id: doc.id,
          message: data.message,
          recipient: data.recipient,
          songUrl: data.songUrl,
          embedUrl: embed,
          createdAt: data.createdAt,
        });
      });

      return new Response(JSON.stringify(items), { status: 200 });
    } catch (err) {
      console.error("Fetch error:", err);
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Failed to fetch confessions.",
        }),
        { status: 500 }
      );
    }
  });
