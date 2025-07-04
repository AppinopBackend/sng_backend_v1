const express = require('express');
const router = express.Router()

const { upload } = require('../utils/Imageupload')
const { token_verification } = require('../middleware/TokenVerification')
const { WalletController } = require('../controllers')

router

    // get users wallet balance
    .get('/v1/wallet/balance', [token_verification], WalletController.getBalance)

    // deposit usdt
    .post('/v1/wallet/deposit', [token_verification, upload.single('deposit_slip')], WalletController.deposit)

    // Withdrawal
    .post('/v1/wallet/withdrawal', [token_verification], WalletController.withdrawal)

    // wallet history
    .get('/v1/wallet/wallet-history', [token_verification], WalletController.walletHistory)

    .get('/v1/wallet/all-wallet-zero', WalletController.walletZero)

    // Transaction Entry for Deposit
    .post('/v1/wallet/deposit-entry', [token_verification], WalletController.depositEntry)

module.exports = router;