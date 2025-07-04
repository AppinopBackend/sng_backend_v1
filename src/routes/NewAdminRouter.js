const express = require('express');
const router = express.Router();
const { NewAdminController } = require('../controllers');
const { upload } = require('../utils/Imageupload');
const { admin_verification } = require('../middleware/TokenVerification');

router

    // Admin Login
    .get('/v1/admin/all-rewards', [admin_verification], NewAdminController.getAllRewards)

    // Get Reward for User
    .get('/v1/admin/reward-for-user', [admin_verification], NewAdminController.getRewardForUser)

    // Get Booster Income
    .get('/v1/admin/booster-income', [admin_verification], NewAdminController.getBoosterIncome)

    // Get Total Income
    .get('/v1/admin/total-income', [admin_verification], NewAdminController.getTotalIncome)

    // Get Total Income for User
    .get('/v1/admin/total-income-for-user', [admin_verification], NewAdminController.getTotalIncomeForUser)

    // Get User Direct Referred
    .get('/v1/admin/user-direct-referred', [admin_verification], NewAdminController.userDirectReferred)

    // Update User Staking Status
    .post('/v1/admin/update-user-staking-status', [admin_verification], NewAdminController.updateUserStakingStatus)



module.exports = router;