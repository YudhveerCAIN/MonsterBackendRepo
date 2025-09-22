import dotenv from "dotenv";
import mongoose from "mongoose"
import connectDB from "./db/index.js"
import {app} from "./app.js"
dotenv.config({
    path:'./env'
})

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("error:",error);
    })
    app.listen(process.env.port||8000,()=>{
        console.log(`Server is running on port ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("mongo db error failed:",err)
});