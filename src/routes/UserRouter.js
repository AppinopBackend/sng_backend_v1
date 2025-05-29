const express = require('express');
const router = express.Router()
const { upload } = require('../utils/Imageupload')
const UserController = require('../controllers').UserController
const { token_verification } = require('../middleware/TokenVerification')

router
    .get('/', async(req, res, next) => {
        return res.status(200).send({success: true, welcome: "Welcome to Spark Net Global"})
    })

    // signup route
    .post('/v1/user/signup', UserController.signup)

    // login route
    .post('/v1/user/login', UserController.login)

    // Send Otp Route
    .post('/v1/user/send-otp', UserController.sendOtp)

    // get details route
    .get('/v1/user/user-details', [token_verification], UserController.userDetails)

    // update users profile
    .put('/v1/user/update-profile', [token_verification, upload.single('profilepicture')], UserController.update_profile)

    // Change Password
    .post('/v1/user/change-password', [token_verification], UserController.changePassword)

    //User Dashboard API (not checked yet)
    .get('/v1/user/dashboard', [token_verification], UserController.dashboard)

    // User to User Fund Transfer
    .post('/v1/user/user-fund-transfer', [token_verification], UserController.userToUserFundTransfer)

    // User Fund Transfer History By Admin
    .get('/v1/admin/fund-transfer-history-by-admin/:id', UserController.UserFundTransferHistoryByAdmin)


    // Find User Profile Details By UserId
    .get('/v1/user/user-profile/:user_id', [token_verification], UserController.findUserById)

    // forgot password
    .post('/v1/user/forgot-password', UserController.forgotPassword)

    // get details route
    .get('/v1/user/get-user-email', UserController.get_user_email)

    // User to User Fund Transfer
    .get('/v1/user/user-to-user-transfer-history', [token_verification], UserController.UserFundTransferHistory)
    
module.exports = router;