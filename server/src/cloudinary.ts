import { v2 as cloudinary } from "cloudinary";

// Cloudinary automatically picks up CLOUDINARY_URL from .env
cloudinary.config({ secure: true });

// Optional sanity log (only for local debugging)
console.log("Cloudinary configured:", cloudinary.config().cloud_name);

export default cloudinary;
