import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: CLOUDINARY_API_SECRET
});



const uploadOnCloudinary= async (localFilePath)=>{
    try {
        if(!localFilePath) return null
        //upload file to cloudinary
        const response=await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file uploaded successfully
        console.log("file uploaded with response :",response.url)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath)//remove locally saved temp file as upload failed
        return null;
    }
}

export {uploadOnCloudinary}