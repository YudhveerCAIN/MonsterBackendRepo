import {asyncHandler} from "../utils/asyncHandler.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {uploadOnCloudinary,deleteFromCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { subscribe } from "firebase/data-connect"
const generateAccessAndRefreshTokens=async(userId)=>{
    try {
        const user =await User.findById(userId);
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,`Something went wrong while generating refresh and access token+${error.message}`)
    }
}
const registerUser=asyncHandler(async (req,res)=>{
        const {fullname,email,username,password}=req.body;
        if([
            fullname,email,username,password
        ].some((field)=>{
            field?.trim()===""
        })){
            throw new ApiError(400,"All fields are required")
        }
        const existingUser=await User.findOne({
            $or:[{email},{username}]
        })
        if(existingUser){
            throw new ApiError(409,"Existing user with email or username")
        }
        const avatarLocalPath=req.files?.avatar[0]?.path;
        // const coverImageLocalPath=req.files?.coverImage[0]?.path;
        let coverImageLocalPath
        if(req.files && Array.isArray(req.files.coverImage)&& req.files.coverImage.length>0)
            coverImageLocalPath=req.files.coverImage[0].path;
        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar file is required")
        }
        const avatar=await uploadOnCloudinary(avatarLocalPath);
        const coverImage=await uploadOnCloudinary(coverImageLocalPath)
        if(!avatar){
            throw new ApiError(400,"Avatar file is required")
        }
        const user=new User({fullname,avatar:avatar.url,coverImage:coverImage?.url||" ",email,username:username.toLowerCase(),password})
        await user.save();
        const createdUser=await User.findById(user._id).select("-password -refreshToken")
        if(!createdUser){
            throw new ApiError(500,"Something went wrong while registering new user")
        }
        return res.status(200).json(
            new ApiResponse(200,createdUser,"User registered successfully")
        ) 
})

const loginUser=asyncHandler(async (req,res)=>{
    console.log(req.body)
    const {email,username,password}=req.body;
    
    if(!(username||email)){
        throw new ApiError(400,"username or email is required")
    }
    const user=await User.findOne({$or:[{username},{email}]})
    if(!user){
        throw new ApiError(404,"user does not exist");
    }
    const isPasswordValid=await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"invalid user credentials");
    }
    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)
    const loggedInUser=await User.findById(user._id).select("-password -refreshToken") 
    const options={
        httpOnly:true,
        secure:true
    }   
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user:loggedInUser,accessToken,refreshToken
        },"user logged in successfully")
    )
})
const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(req.user._id,{$set:{refreshToken:undefined}},{new:true})
    const options={
        httpOnly:true,
        secure:true
    } 
    return res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out "))
})

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken||req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const user =await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"refresh token expired")
        }
        const options={
            httpOnly:true,
            secure:true
        } 
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,{accessToken,refreshToken:newRefreshToken},"access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message|"invalid refresh token")
    }



})

const changeCurrentPassword=asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword}=req.body;
    const user=await User.findById(req.user?._id);
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400,"Invalid old password")
    }
    user.password=newPassword
    await user.save({validateBeforeSave:false});
    return res.status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))

})

const getCurrentUser=asyncHandler(async (req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user,"Current User fetched Successfully"))
})
const updateAccountDetails=asyncHandler(async (req,res)=>{
    const {fullName,email}=req.body
    if(!fullName||!email){
        throw new ApiError(400,"All fields required")
    }
    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new:true}
    ).select("-password")
    
    return res.status(200).json(new ApiResponse(200,user,"account details updated successfully"))
})

const updateUserAvatar=asyncHandler(async (req,res)=>{
    const avatarLocalPath=req.file?.path
    const oldUser=await User.findById(req.user?._id)
    const oldAvatarPath=oldUser.avatar;
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar =await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
    await deleteFromCloudinary(oldAvatarPath)
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")
    
    return res.status(200).json(new ApiResponse(200,user,"avatar image updated successfully"))
})

const updateUserCoverImage=asyncHandler(async (req,res)=>{
    const coverImageLocalPath=req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"cover image file is missing")
    }
    const coverImage =await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on cover image")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")
    return res.status(200).json(new ApiResponse(200,user,"cover  image updated successfully"))

})

const getUserChannelProfile=asyncHandler(async (req,res)=>{
    const {username}=req.params
    if(!username?.trim()) throw new ApiError(400,"Username is missing")
    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$susbcribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1

            }
        }
    ])
    if(!channel?.length) throw new ApiError(404,"channel does not exists")
        return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully")
    )

    
})

const getWatchHistory=asyncHandler(async (req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addField:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(new ApiResponse(200,user[0].watchHistory),"watch history fetched successfully")

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    updateUserAvatar,
    updateUserCoverImage,
    changeCurrentPassword,
    updateAccountDetails,
    getUserChannelProfile,
    getWatchHistory
}