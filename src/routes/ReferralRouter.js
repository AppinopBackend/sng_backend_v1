const express = require('express');
const router = express.Router()
const ReferralController = require('../controllers').ReferralController
const { token_verification } = require('../middleware/TokenVerification')

router

    // Find all direct referrals
    .get('/v1/referral/direct_referral',[token_verification], ReferralController.directReferred)

    // Find all downline team for the user
    .get('/v1/referral/team', [token_verification], ReferralController.getDownlineTeam)

    // Find all upline team for the user
    .get('/v1/referral/upline_team', ReferralController.getUplineTeam);

module.exports = router;