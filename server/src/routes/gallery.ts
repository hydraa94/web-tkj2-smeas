import { Elysia } from "elysia";
import crypto from "crypto";
import cloudinary from "../cloudinary";
import { db } from "../firestore";

function signCloudinary(paramsToSign: Record<string, any>, apiSecret: string) {
  const sorted = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(sorted + apiSecret)
    .digest("hex");
}

export const galleryRoutes = new Elysia({ prefix: "/gallery" })
  // Return signature for direct client upload
  .get("/upload-signature", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "web-tkj2/gallery";
    const apiSecret = cloudinary.config().api_secret!;

    const signature = signCloudinary({ timestamp, folder }, apiSecret);

    return {
      signature,
      timestamp,
      folder,
      apiKey: cloudinary.config().api_key,
      cloudName: cloudinary.config().cloud_name,
    };
  })

  // Save metadata after upload
  .post("/record", async ({ body }) => {
    const { public_id, secure_url, original_filename } = body as any;

    if (!public_id || !secure_url) {
      return { error: "Missing Cloudinary data" };
    }

    const docRef = await db.collection("gallery").add({
      public_id,
      secure_url,
      original_filename: original_filename || null,
      createdAt: new Date().toISOString(),
    });

    return { id: docRef.id, status: "ok" };
  })

  // List gallery images
  .get("/", async () => {
    const snapshot = await db
      .collection("gallery")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    const items: any[] = [];
    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
    return items;
  });
