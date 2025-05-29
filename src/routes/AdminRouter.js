const express = require('express');
const router = express.Router();
const { AdminController } = require('../controllers');
const { upload } = require('../utils/Imageupload');

router

    // Admin Login
    .post('/v1/admin/login', AdminController.login)

    // Add new sub admin
    .post('/v1/admin/add-new-admin', AdminController.addNewAdmin)

    //Update sub admin
    .put('/v1/admin/update-subadmin', AdminController.updateSubadmin)

    //delete sub admin
    .delete('/v1/admin/delete-subadmin/:id', AdminController.deleteSubadmin)

    // Fetch all admin list
    .get('/v1/admin/admin-list', AdminController.adminList)

    // Fetch all users list
    .get('/v1/admin/user-list', AdminController.userList)

    // update users login status
    .post('/v1/admin/update-user-status', AdminController.updateLoginStatus)

    // fetch users details
    .get('/v1/admin/get-user-details', AdminController.getUserDetails)

    // Fetch all transactions by type
    .get('/v1/admin/wallettransaction-by-type', AdminController.transactionByType)

    // Update Deposit Transaction Status
    .post('/v1/admin/update-deposit-status', AdminController.updateDepositStatus)
    
    // Fetch all deposits
    .post('/v1/admin/all-deposits', AdminController.fetchAllDeposit)

    // Fetch all withdrawals
    .post('/v1/admin/all-withdrawals', AdminController.fetchAllWithdrawals)

    // Update Withdrawal Transaction Status
    .post('/v1/admin/update-withdrawal-status', AdminController.updateWithdrawalStatus)

    // Get Pending Withdrawal List
    .get('/v1/admin/pending-withdrawal-request', AdminController.pendingWithdrawalRequest)

    // dashboard api
    .get('/v1/admin/dashboard', AdminController.dashboard)

    // Get Staking list of all users
    .get('/v1/stake/stacking-history', AdminController.allUsersPackageList)

    // Add Funds
    .post('/v1/admin/add-funds', AdminController.addFunds)

    // Deduct Funds
    .post('/v1/admin/deduct-funds', AdminController.deductFunds)
   
    // Admin Fund Transfer History
    .get('/v1/admin/admin-fund-transfer-history', AdminController.fundTransferHistory)

    //Add User Stacking
    .post('/v1/admin/add-user-stacking', AdminController.addUserStacking)

    //Deduct User Stacking
    .post('/v1/admin/deduct-user-stacking', AdminController.deductUserStacking)
    
    //Admin Stacking Transfer History
    .get('/v1/admin/admin-stacking-transfer-history', AdminController.adminStakingTransferHistory)

    // Add Notification
    .post('/v1/admin/create-notification', AdminController.add_notification)

    // Notification List
    .get('/v1/admin/get-all-notification', AdminController.notification_list)

    // Delete Notification
    .delete('/v1/admin/delete-notification/:id', AdminController.delete_notification)

    // Add Classic News
    .post('/v1/admin/create-classic-news', upload.single('news_image'),AdminController.add_classic_news)

    // Classic News List
    .get('/v1/admin/get-all-classic-news', AdminController.classic_news_list)

    // Delete Classic News
    .delete('/v1/admin/delete-classic-news/:id', AdminController.delete_classic_news)

    // update Admin login status
    .post('/v1/admin/update-admin-status', AdminController.updateAdminLoginStatus)
    
    // User Backup API
    .get('/v1/admin/all-user-backup', AdminController.all_user_backup)
    
    // User Update Rank
    .put('/v1/admin/update-user-rank', AdminController.updateUserRank)

module.exports = router;