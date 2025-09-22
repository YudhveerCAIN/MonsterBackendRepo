import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
const connectDB=async ()=>{
    try {
        const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        console.log(`\n Mongodb connected !! DB HOST :${connectionInstance}`)
    } catch (error) { 
        console.log("connection failed at db intilisation ",error)
        process.exit(1);
    }
}
  
export default connectDB;