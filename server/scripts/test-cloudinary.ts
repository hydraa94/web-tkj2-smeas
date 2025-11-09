import cloudinary from "../src/cloudinary.js";

const runTest = async () => {
  try {
    const result = await cloudinary.uploader.upload(
      "https://pbs.twimg.com/media/GZ4rsPmb0AIHjWX.jpg",
      {
        folder: "web-tkj2/gallery",
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      }
    );
    console.log("Uploaded:", result.secure_url);
  } catch (err) {
    console.error("Upload failed:", err);
  }
};

runTest();
