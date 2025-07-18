const axios = require("axios");

const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");
const Otps = require("../models/Otp");

const { BSCSCAN_API } = process.env;

module.exports = {
  getBalance: async (req, res) => {
    try {
      const { user_id } = req.user;

      let wallet = await Wallet.findOne({ user_id: user_id });
      wallet = wallet !== null ? wallet : [];
      return res
        .status(200)
        .json({
          success: true,
          message: "Balance Fetched Successfully!!",
          data: wallet,
        });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  deposit: async (req, res) => {
    try {
      const { user_id, id } = req.user;
      const { amount, transaction_hash, chain, currency } = req.body;
      // const deposit_slip = req.file.filename;

      // check if this transaction hash already exists
      let check_transaction = await WalletTransaction.countDocuments({
        transaction_hash: transaction_hash,
      });
      if (check_transaction > 0) {
        return res
          .status(406)
          .json({
            success: false,
            message: "Deposit with this transaction is already exists",
          });
      }
      if (currency == "USDT") {
        let wallet = await Wallet.findOne({ user_id: user_id });
        // add balance
        await Wallet.updateOne(
          { user_id: user_id },
          {
            $inc: {
              usdt_balance: amount,
            },
          }
        );
        // create a transaction for this hash in db
        let obj = {
          user_id: user_id,
          id: id,
          amount: amount,
          transaction_hash: transaction_hash,
          chain: chain || "BEP20",
          type: "DEPOSIT",
          currency: currency || "USDT",
          status: "APPROVED",
          finalAmount: amount,
        };
        await WalletTransaction.create(obj);
      } else if (currency == "SNG") {
        let wallet = await Wallet.findOne({ user_id: user_id });
        // add balance
        await Wallet.updateOne(
          { user_id: user_id },
          {
            $inc: {
              sng_balance: amount,
            },
          }
        );
        // create a transaction for this hash in db
        let obj = {
          user_id: user_id,
          id: id,
          amount: amount,
          transaction_hash: transaction_hash,
          chain: chain || "BEP20",
          type: "DEPOSIT",
          currency: currency || "USDT",
          status: "APPROVED",
          finalAmount: amount,
        };
        await WalletTransaction.create(obj);
      } else {
        return res.status(406).json({ success: false, message: "Invalid currency", data: [] });
      }

      // check on bscscan
      //   let check;
      // if (chain === 'BEP20') {
      //     try {
      //         check = await axios.get(`https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${transaction_hash}&apikey=${BSCSCAN_API}`)
      //         if (check.data.result.hash == transaction_hash) {
      //             // create a transaction for this hash in db
      // let obj = {
      //     user_id: user_id,
      //     id: id,
      //     amount: amount,
      //     // deposit_slip: deposit_slip,
      //     transaction_hash: transaction_hash,
      //     chain: chain,
      //     type: "DEPOSIT"
      // }
      // await WalletTransaction.create(obj);
      //         }
      //     } catch (error) {
      //         return res.status(500).json({ success: false, message: "Transaction Hash is Invalid", data: [] })
      //     }
      // } else {
      //     try {
      //         check = await axios.get(`https://apilist.tronscanapi.com/api/transaction-info?hash=${transaction_hash}`)
      //         console.log(check.data.hash, " : TRC20")
      //         if (check.data.hash != undefined && check.data.hash == transaction_hash) {
      //             // create a transaction for this hash in db
      //             let obj = {
      //                 user_id: user_id,
      //                 id: id,
      //                 amount: amount,
      //                 // deposit_slip: deposit_slip,
      //                 transaction_hash: transaction_hash,
      //                 chain: chain,
      //                 type: "DEPOSIT"
      //             }
      //             await WalletTransaction.create(obj);
      //         } else {
      //             return res.status(500).json({ success: false, message: 'Transaction Hash is Invalid', data: [] })
      //         }
      // } catch (error) {
      //     return res.status(500).json({ success: false, message: "Transaction Hash is Invalid", data: [] })
      // }
      // }

      return res
        .status(200)
        .json({ success: true, message: "Deposit Successfull!!" });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message });
    }
  },

  withdrawal: async (req, res) => {
    const { user_id, id } = req.user;
    const { currency, amount, chain, withdrawal_address, verification_code } =
      req.body;

    // Minimum withdrawal is $10
    if (amount < 10) {
      return res
        .status(406)
        .json({
          success: false,
          message: `Minimum withdrawal is 10 ${currency}`,
          data: [],
        });
    }

    // find user details
    let user = await User.findOne({ _id: id });

    // check otp
    let check_otp = await Otps.findOne({ email_or_phone: user.email });
    if (check_otp === null || check_otp.otp != verification_code) {
      return res
        .status(406)
        .json({ success: false, message: "Otp not matched!!", data: [] });
    }

    let wallet = await Wallet.findOne({ user_id: user_id });
    let deduction = amount * 0.1;
    let finalAmount = amount - deduction;
    if (currency == "USDT") {
      if (wallet == null || wallet.balance < amount) {
        return res
          .status(406)
          .json({
            success: false,
            message: "Insufficient balance to withdrawal USDT",
            data: [],
          });
      }

      // deduct balance
      await Wallet.updateOne(
        { user_id: user_id },
        {
          $inc: {
            usdt_balance: -amount,
          },
        }
      );
    } else if (currency == "SNG") {
      if (wallet == null || wallet.sng_balance < amount) {
        return res
          .status(406)
          .json({
            success: false,
            message: "Insufficient balance to withdrawal SNG",
            data: [],
          });
      }

      // deduct balance
      await Wallet.updateOne(
        { user_id: user_id },
        {
          $inc: {
            sng_balance: -amount,
          },
        }
      );
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Invalid Currency", data: [] });
    }

    // create withdrawal transaction
    let obj = {
      user_id: user_id,
      id: id,
      amount: amount,
      finalAmount: finalAmount,
      currency: currency,
      chain: chain,
      withdrawal_address: withdrawal_address,
      type: "WITHDRAWAL",
      tax_deduction_amount: deduction
    };

    await WalletTransaction.create(obj);
    return res
      .status(200)
      .json({
        success: true,
        message: "Request saved withdrawal will be initiated within 24 hours",
        data: [],
      });
  },

  walletHistory: async (req, res) => {
    try {
      const { user_id } = req.user;
      const { type } = req.query;
      let data = await WalletTransaction.find({
        $and: [{ user_id: user_id }, { type: type }],
      });
      return res
        .status(200)
        .json({
          success: true,
          message: "Transaction fetched successfully!!",
          data: data,
        });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  // not in use as of now
  walletZero: async (req, res) => {
    try {
      // const { user_id } = req.user;
      // const { type } = req.query;
      let data = await Wallet.updateMany(
        {},
        { $set: { usdt_balance: 0, sng_balance: 0 } }
      );

      return res
        .status(200)
        .json({
          success: true,
          message: "All wallet balance made zero!!",
          data: data,
        });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  depositEntry: async (req, res) => {
    try {
      const { user_id, id } = req.user;
      console.log(req.user, " : REQ BODY");
      const { amount, transaction_hash, chain, currency, status } = req.body;
      if (!amount || !transaction_hash) {
        return res
          .status(406)
          .json({
            success: false,
            message: "All fields are required",
            data: [],
          });
      }
      // check if this transaction hash already exists
      let check_transaction = await WalletTransaction.countDocuments({
        transaction_hash: transaction_hash,
      });
      if (check_transaction > 0) {
        return res
          .status(406)
          .json({
            success: false,
            message: "Deposit with this transaction is already exists",
            data: [],
          });
      }
      // create a transaction for this hash in db
      let obj = {
        user_id: user_id,
        id: id,
        amount: amount,
        transaction_hash: transaction_hash,
        chain: chain || "BEP20",
        type: "DEPOSIT",
        currency: currency || "USDT",
        status: status || "PENDING",
        finalAmount: amount,
      };
      await WalletTransaction.create(obj);
      return res
        .status(200)
        .json({
          success: true,
          message: "Deposit entry created successfully!!",
          data: [],
        });
    } catch (error) {
      console.log(error, " : ERROR while depositing entry");
      return res
        .status(500)
        .json({
          success: false,
          message: "Some error occurred on server",
          data: [],
        });
    }
  },
};
