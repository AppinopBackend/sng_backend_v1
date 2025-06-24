const express = require('express');
const router = express.Router();
const { NewAdminController } = require('../controllers');
const { upload } = require('../utils/Imageupload');

router

    // Admin Login
    .get('/v1/admin/all-rewards', NewAdminController.getAllRewards)

    // Get Reward for User
    .get('/v1/admin/reward-for-user', NewAdminController.getRewardForUser)
    
module.exports = router;