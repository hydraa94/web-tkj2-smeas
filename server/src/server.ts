import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import "dotenv/config";
import { galleryRoutes } from "./routes/gallery";
import { songfessRoutes } from "./routes/songfess";

const app = new Elysia()
  .use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }))
  .use(galleryRoutes)
  .use(songfessRoutes)
  .get("/", () => "Hello Elysia 🦊")
  .listen({ port: 3000, hostname: "0.0.0.0" });

console.log(`🦊 Server running at http://${app.server?.hostname}:${app.server?.port}`);
