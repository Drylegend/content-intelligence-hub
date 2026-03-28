import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export function uploadAudioDataUri(dataUri, publicId) {
  return cloudinary.uploader.upload(dataUri, {
    resource_type: "video",
    folder: "content-intelligence-hub/audio",
    public_id: publicId
  });
}

export default cloudinary;
