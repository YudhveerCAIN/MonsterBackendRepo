import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret:process.env.CLOUDINARY_API_SECRET
});



const uploadOnCloudinary= async (localFilePath)=>{
    try {
        if(!localFilePath) return null
        //upload file to cloudinary
        const response=await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file uploaded successfully
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath)//remove locally saved temp file as upload failed
        return null;
    }
}

const deleteFromCloudinary = async (url) => {
  try {
    if (!url) return;

    // Extract public_id from Cloudinary URL
    const parts = url.split("/");
    const filename = parts.pop(); // e.g. "avatar_12345.jpg"
    const publicId = parts.slice(parts.indexOf("upload") + 1).join("/").replace(/\.[^/.]+$/, "");

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};
export {uploadOnCloudinary,deleteFromCloudinary}