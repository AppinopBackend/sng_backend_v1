const express = require('express');
const router = express.Router()
const { StakingController } = require('../controllers')
const { token_verification } = require('../middleware/TokenVerification')

router
    // Stake package
    .post('/v1/stake/buy-package', [token_verification], StakingController.buyPackage)

    // Get Staking list
    .get('/v1/stake/user-package-list', [token_verification], StakingController.userPackageList)

    // get staking reward list
    .get('/v1/stake/income-list', [token_verification], StakingController.rewardList)
module.exports = router;