const express = require('express');
const router = express.Router();
const { AdminController } = require('../controllers');
const { upload } = require('../utils/Imageupload');
const { admin_verification } = require('../middleware/TokenVerification');

router

    // Admin Login
    .post('/v1/admin/login', AdminController.login)

    // Add new sub admin
    .post('/v1/admin/add-new-admin', [admin_verification], AdminController.addNewAdmin)

    //Update sub admin
    .put('/v1/admin/update-subadmin', [admin_verification], AdminController.updateSubadmin)

    //delete sub admin
    .delete('/v1/admin/delete-subadmin/:id', [admin_verification], AdminController.deleteSubadmin)

    // Fetch all admin list
    .get('/v1/admin/admin-list', [admin_verification], AdminController.adminList)

    // Fetch all users list
    .get('/v1/admin/user-list', [admin_verification], AdminController.userList)

    // update users login status
    .post('/v1/admin/update-user-status', [admin_verification], AdminController.updateLoginStatus)

    // fetch users details
    .get('/v1/admin/get-user-details', [admin_verification], AdminController.getUserDetails)

    // Fetch all transactions by type
    .get('/v1/admin/wallettransaction-by-type', [admin_verification], AdminController.transactionByType)

    // Update Deposit Transaction Status
    .post('/v1/admin/update-deposit-status', [admin_verification], AdminController.updateDepositStatus)
    
    // Fetch all deposits
    .post('/v1/admin/all-deposits', [admin_verification], AdminController.fetchAllDeposit)

    // Fetch all withdrawals
    .post('/v1/admin/all-withdrawals', [admin_verification], AdminController.fetchAllWithdrawals)

    // Update Withdrawal Transaction Status
    .post('/v1/admin/update-withdrawal-status', [admin_verification], AdminController.updateWithdrawalStatus)

    // Get Pending Withdrawal List
    .get('/v1/admin/pending-withdrawal-request', [admin_verification], AdminController.pendingWithdrawalRequest)

    // dashboard api
    .get('/v1/admin/dashboard', [admin_verification], AdminController.dashboard)

    // Get Staking list of all users
    .get('/v1/stake/stacking-history', [admin_verification], AdminController.allUsersPackageList)

    // Add Funds
    .post('/v1/admin/add-funds', [admin_verification], AdminController.addFunds)

    // Deduct Funds
    .post('/v1/admin/deduct-funds', [admin_verification], AdminController.deductFunds)
   
    // Admin Fund Transfer History
    .get('/v1/admin/admin-fund-transfer-history', [admin_verification], AdminController.fundTransferHistory)

    //Add User Stacking
    .post('/v1/admin/add-user-stacking', [admin_verification], AdminController.addUserStacking)

    //Deduct User Stacking
    // .post('/v1/admin/deduct-user-stacking', AdminController.deductUserStacking)
    
    //Admin Stacking Transfer History
    .get('/v1/admin/admin-stacking-transfer-history', [admin_verification], AdminController.adminStakingTransferHistory)

    // Add Notification
    .post('/v1/admin/create-notification', [admin_verification], AdminController.add_notification)

    // Notification List
    .get('/v1/admin/get-all-notification', [admin_verification], AdminController.notification_list)

    // Delete Notification
    .delete('/v1/admin/delete-notification/:id', [admin_verification], AdminController.delete_notification)

    // Add Classic News
    .post('/v1/admin/create-classic-news', [admin_verification, upload.single('news_image')], AdminController.add_classic_news)

    // Classic News List
    .get('/v1/admin/get-all-classic-news', [admin_verification], AdminController.classic_news_list)

    // Delete Classic News
    .delete('/v1/admin/delete-classic-news/:id', [admin_verification], AdminController.delete_classic_news)

    // update Admin login status
    .post('/v1/admin/update-admin-status', [admin_verification], AdminController.updateAdminLoginStatus)
    
    // User Backup API
    .get('/v1/admin/all-user-backup', [admin_verification], AdminController.all_user_backup)
    
    // User Update Rank
    .put('/v1/admin/update-user-rank', [admin_verification], AdminController.updateUserRank)

module.exports = router;