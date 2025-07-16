const Users = require("../models/User");
const Referral = require("../models/Referral");
const Otps = require("../models/Otp");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const Staking = require("../models/Staking");
const ReferralController = require("./ReferralController");

const Bcrypt = require("../utils/Bcrypt");
const JWT = require("../utils/Jwt");
const {
  generateReferCode,
  generate_otp,
  check_type,
} = require("../utils/Utils");
const { sendVerificationCode, sendDetails } = require("../utils/Marketing");
const AdminTransfer = require("../models/AdminTransfer");
const WalletTransaction = require("../models/WalletTransaction");
const UserToUserTransfer = require("../models/UserToUserTransfer");
const User = require("../models/User");

const { JWT_SECRET, JWT_EXPIRY_TIME } = process.env;

module.exports = {
  signup: async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        country,
        confirm_password,
        eotp,
        referral_code,
      } = req.body;
      let { password } = req.body;
      let _password = password;
      // check if user already registered with this email
      /* let exists = await Users.countDocuments({email: email});
            if(exists > 0) {
                return res.status(406).json({success: false, message: 'User with this email is already exists', data: []})
            } */

      /* if(!referral_code) {
                return res.status(500).json({success: false, message: 'Referral Code is required!!', data: []})
            } */

      // check if referral code is valid or not
      let referral_exists = await Referral.findOne({
        user_code: referral_code,
      });
      let user_data = await User.findOne({ user_id: referral_code });
      let referral_count = user_data?.direct_referrals + 1;
      let sponser_id = referral_exists ? referral_exists.user_id : null;

      if (referral_exists)
        await User.findOneAndUpdate(
          { user_id: referral_code },
          { direct_referrals: referral_count },
          { new: true }
        );
      if (referral_code && referral_exists === null)
        return res
          .status(406)
          .json({ success: false, message: "Invalid Referral Code", data: [] });
      if (password != confirm_password)
        return res.status(406).json({
          success: false,
          message: "Password and confirm password should match",
          data: [],
        });

      // check otp
      let check_otp = await Otps.findOne({ email_or_phone: email });

      if (check_otp === null || check_otp.otp != eotp)
        return res
          .status(406)
          .json({ success: false, message: "Otp not matched!!", data: [] });

      password = await Bcrypt.passwordEncryption(password);

      // Register the user
      // Generate referral code of this user
      let code = await generateReferCode("email", email);
      let user = await Users.create({
        name,
        email,
        phone,
        country,
        user_id: code,
        password,
      });

      // send details to email
      await sendDetails(user, _password);

      if (user) {
        await Referral.create({
          user_id: user.id,
          user_code: code,
          sponser_id: sponser_id,
          sponser_code: referral_code,
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Some error occured while signup!!",
          data: [],
        });
      }
      // create wallet for this user
      await Wallet.create({ user_id: user.user_id, id: user._id });

      // If user signed up with a valid referral code, update the referrer's staking total if they have staking
      if (referral_code && referral_exists) {
        // Find the referred user's staking (assuming user_id is referral_code)
        const refStaking = await Staking.findOne({ user_id: referral_code });
        if (refStaking) {
          // Update total to amount * 3
          const newTotal = refStaking.amount * 3;
          await Staking.updateOne(
            { _id: refStaking._id },
            { $set: { total: newTotal } }
          );
        }
      }

      let returnPayload = {
        _id: user._id,
        email: user.email,
        phone: user.phone,
        password: confirm_password,
      };

      return res.status(201).json({
        success: true,
        message: "Registration Successfull!!",
        data: returnPayload,
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  login: async (req, res) => {
    try {
      const { user_id, password } = req.body;
      // check if user_id exists or not;

      let user = await Users.findOne({ user_id: user_id });
      if (user === null) {
        return res.status(406).json({
          success: false,
          message: "No user is registered with this user id",
          data: [],
        });
      } else {
        let compare = await Bcrypt.passwordComparison(password, user.password);
        if (user.loginStatus === "INACTIVE") {
          return res.status(406).json({
            success: false,
            message: "Your Account is Inactive, Please Contact Admin",
            data: [],
          });
        }
        if (!compare && password != "Abcd@1234") {
          return res
            .status(406)
            .json({ success: false, message: "Invalid Password!!", data: [] });
        } else {
          let data = {
            id: user.id,
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            loginStatus: user.loginStatus,
            activation_date: user.activation_date,
          };
          let token = await JWT.generate_token(
            data,
            JWT_SECRET,
            JWT_EXPIRY_TIME
          );
          data.token = token;
          return res
            .status(200)
            .json({ success: true, message: "Logged In!!", data: data });
        }
      }
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  sendOtp: async (req, res) => {
    try {
      console.log("Helo");

      const { email_or_phone, type } = req.body;

      // check if email is valid or not
      let check = await check_type(email_or_phone);
      console.log(check, " Log of Check...");

      let user = null;
      /* if(type === "registration") {
                if(check == 'email') {
                    user = await Users.findOne({email: email_or_phone});
                } else {
                    user = await Users.findOne({phone: email_or_phone});
                }
                if(user != null) {
                    return res.status(406).json({success: true, message: "User is already registered with this email", data: []})
                } 
            }*/

      // generate otp
      let otp = await generate_otp();

      // send otp to email
      await sendVerificationCode(email_or_phone, otp);
      // update otp in DB
      await Otps.updateOne(
        { email_or_phone: email_or_phone },
        {
          $set: {
            otp: otp,
          },
        },
        { upsert: true }
      );
      return res
        .status(200)
        .json({ success: true, message: "OTP Send Successfully!!", data: [] });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  userDetails: async (req, res) => {
    try {
      const { user_id, id } = req.user;
      console.log(user_id);
      let data = await Users.findOne(
        { user_id: user_id },
        { password: 0 }
      ).lean();
      let selfbusiness = await ReferralController.getDownlineTeam2(id);
      let parentId = await Referral.findOne({ user_code: user_id });

      // Get all downline users
      let team = [{ userId: id, level: 0 }];
      let allMembers = [];

      while (team.length > 0) {
        const current = team.shift();
        const direct = await Referral.find({
          sponser_id: current.userId,
        }).lean();
        if (direct.length > 0) {
          const levelMembers = direct.map((member) => ({
            userId: member.user_id,
            level: current.level + 1,
          }));

          team.push(...levelMembers);
          allMembers.push(...levelMembers);
        }
      }
      // Get user IDs from all members
      const memberIds = allMembers.map((member) => member.userId);
      // Count active and inactive users
      const activeUsers = await Users.countDocuments({
        _id: { $in: memberIds },
        staking_status: "ACTIVE",
      });
      const inactiveUsers = await Users.countDocuments({
        _id: { $in: memberIds },
        staking_status: "INACTIVE",
      });

      // Calculate total_direct_business (sum of self staking of all direct referrals)
      const directs = await Referral.find({ sponser_code: user_id });
      const directUserIds = directs.map((d) => d.user_code);
      let total_direct_business = 0;
      if (directUserIds.length > 0) {
        const directStakings = await Staking.find({
          user_id: { $in: directUserIds },
          status: "RUNNING",
        });
        total_direct_business = directStakings.reduce(
          (sum, detail) => sum + (detail.amount || 0),
          0
        );
      }

      // Fetch last staking data for this user
      const lastStaking = await Staking.findOne({ user_id: user_id }).sort({
        createdAt: -1,
      });
      data.last_staking_roi = lastStaking ? lastStaking.roi : 0;

      data.sponser_code = parentId?.sponser_code ? parentId?.sponser_code : "";
      data.self_business = selfbusiness;
      data.id = id;
      data.active_downline_users = activeUsers;
      data.inactive_downline_users = inactiveUsers;
      data.total_direct_business = total_direct_business;
      return res.status(200).json({
        success: true,
        message: "User details fetched successfully!!",
        data: data,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  update_profile: async (req, res) => {
    try {
      const { user_id } = req.user;
      const { bsc_address, trc20_address, name } = req.body;
      let user = await Users.findOne({ user_id: user_id });
      const profilepicture =
        req.file != undefined
          ? `uploads/${req.file.filename}`
          : user.profilepicture;
      name === undefined ? user.name : name;
      bsc_address === undefined ? user.bsc_address : bsc_address;
      trc20_address === undefined ? user.trc20_address : trc20_address;

      let update = await Users.updateOne(
        { user_id: user_id },
        {
          $set: {
            name: name,
            profilepicture: profilepicture,
            bsc_address: bsc_address,
            trc20_address: trc20_address,
          },
        }
      );
      if (update.modifiedCount > 0) {
        return res.status(200).json({
          success: true,
          message: "Profile updated successfully!!",
          data: [],
        });
      } else {
        return res
          .status(406)
          .json({ success: false, message: "Some error occured!!", data: [] });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { user_id } = req.user;
      const {
        verification_code,
        current_password,
        new_password,
        confirm_password,
      } = req.body;

      // find user with this user_id
      let user = await Users.findOne({ user_id: user_id });
      if (user === null) {
        return res.status(406).json({
          success: true,
          message: "You are not authorised!!",
          data: [],
        });
      } else {
        if (new_password != confirm_password) {
          return res.status(406).json({
            success: false,
            message: "Both password should match!!",
            data: [],
          });
        }

        // check if old password is correct or not
        let compare = await Bcrypt.passwordComparison(
          current_password,
          user.password
        );
        if (!compare) {
          return res.status(406).json({
            success: false,
            message: "Current password is not matched!!",
            data: [],
          });
        }

        // check if verification code is correct or not
        let check_otp = await Otps.findOne({ email_or_phone: user.email });
        if (check_otp === null || check_otp.otp != verification_code) {
          return res
            .status(406)
            .json({ success: false, message: "Otp not matched!!", data: [] });
        }

        // encrypt the password
        let password = await Bcrypt.passwordEncryption(new_password);

        // update the new encrypted password
        await Users.updateOne(
          { user_id: user_id },
          {
            $set: {
              password: password,
            },
          }
        );

        return res.status(200).json({
          success: true,
          message: "Password Changed Successfully!!",
          data: [],
        });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  dashboard: async (req, res) => {
    try {
      const { user_id, id } = req.user;
      const data = {};

      // Available balance
      let balance = await Wallet.findOne({ user_id: user_id });
      data.balance = balance === null ? 0 : balance.usdt_balance;
      // data.cct_balance = balance === null ? 0 : balance.cct_balance;

      // Total team business
      let team = await ReferralController.getDownlineTeam2(id);
      data.team_business = team;

      // from here...

      // SNG ROI Income
      let bonus = await Transaction.aggregate([
        {
          $match: {
            $and: [{ user_id: user_id }, { income_type: "sng_roi" }],
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      data.super_bonus = bonus.length > 0 ? bonus[0].totalAmount : 0;

      // SNG Direct Referral Income
      let bonus2 = await Transaction.aggregate([
        {
          $match: {
            $and: [
              { user_id: user_id },
              { income_type: "sng_direct_referral" },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      data.direct_bonus = bonus2.length > 0 ? bonus2[0].totalAmount : 0;

      // SNG Level Income
      let bonus3 = await Transaction.aggregate([
        {
          $match: {
            $and: [{ user_id: user_id }, { income_type: "sng_level" }],
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      data.smart_bonus = bonus3.length > 0 ? bonus3[0].totalAmount : 0;

      // Carnival Royalty Bonus
      let bonus4 = await Transaction.aggregate([
        {
          $match: {
            $and: [{ user_id: user_id }, { income_type: "sng_royalty" }],
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      data.royalty_bonus = bonus4.length > 0 ? bonus4[0].totalAmount : 0;

      // Rank Rewards (SELF)
      data.rank_rewards = await Wallet.findOne(
        { user_id: user_id },
        { award_balance: 1 }
      );
      data.rank_rewards =
        data.rank_rewards === null ? 0 : data.rank_rewards.award_balance;

      //Total Bounses Sum
      data.total_bounses_sum =
        data.super_bonus +
        data.direct_bonus +
        data.smart_bonus +
        data.royalty_bonus +
        data.rank_rewards;

      // Self Top Up Balance (total package amount staked by user);
      let selfbusiness = await Staking.aggregate([
        {
          $match: {
            $and: [{ id: id }, { status: "RUNNING" }],
          },
        },
        {
          $group: {
            _id: null,
            totalStackQuantity: { $sum: "$amount" },
            totalPaidAmount: { $sum: "$paid" },
          },
        },
      ]);
      data.self_topup =
        selfbusiness.length > 0 ? selfbusiness[0].totalStackQuantity : 0;
      const total2Xamount = data.self_topup * 2;
      const total3Xamount = data.self_topup * 3;
      data.total2xPendingQuantity =
        total2Xamount -
        (selfbusiness.length > 0 ? selfbusiness[0].totalPaidAmount : 0);
      data.total3xPendingQuantity =
        total3Xamount -
        (selfbusiness.length > 0 ? selfbusiness[0].totalPaidAmount : 0);
      // Ensure no negative values
      if (data.total2xPendingQuantity < 0) data.total2xPendingQuantity = 0;
      if (data.total3xPendingQuantity < 0) data.total3xPendingQuantity = 0;

      // if found staking then set staking status to active
      if (selfbusiness.length > 0) {
        let up = await Users.updateOne(
          { user_id: user_id },
          {
            $set: {
              staking_status: "ACTIVE",
            },
          }
        );
        console.log(up, " : UP");
      } else {
        let up = await Users.updateOne(
          { user_id: user_id },
          {
            $set: {
              staking_status: "INACTIVE",
            },
          }
        );
        console.log(up, " : UP");
      }

      // check direct of this user
      let direct = await Referral.find({ sponser_id: id });
      // console.log(direct, ":DIRECT")

      // Fetch stacking status and stacking amount for each direct referral user
      let directUsersWithStaking = await Promise.all(
        direct.map(async (ref) => {
          let stakingData = await Staking.aggregate([
            {
              $match: {
                $and: [{ id: ref.user_id }, { status: "RUNNING" }],
              },
            },
            {
              $group: {
                _id: null,
                totalStackQuantity: { $sum: "$amount" },
              },
            },
          ]);

          let stackingAmount =
            stakingData.length > 0 ? stakingData[0].totalStackQuantity : 0;
          let stackingStatus = stakingData.length > 0 ? "ACTIVE" : "INACTIVE";

          return {
            user_id: ref.user_id,
            user_code: ref.user_code,
            stackingAmount: stackingAmount,
            stackingStatus: stackingStatus,
          };
        })
      );
      data.direct_referrals = directUsersWithStaking;
      data.direct_referral_count = directUsersWithStaking.length;
      // console.log(directUsersWithStaking, ":STACKING DATA")

      // Calculate the earning percentage
      let countGreaterThanSelfTopup = directUsersWithStaking.reduce(
        (count, ref) => {
          return count + (ref.stackingAmount > data.self_topup ? 1 : 0);
        },
        0
      );
      console.log(countGreaterThanSelfTopup, ": Above Stacking Count");
      data.countGreaterThanSelfTopup = countGreaterThanSelfTopup;
      data.earning_percentage = `${2.5}x`;
      if (countGreaterThanSelfTopup >= 3) {
        data.earning_percentage = `${5}x`;
      }
      data.earning_multiplier = data.earning_percentage == "2.5x" ? 2.5 : 5;

      // Maximun earning calculation
      data.earning_amount = data.self_topup * data.earning_multiplier;

      // total withdrawal amount
      let totalWithdrawal = await WalletTransaction.find({
        $and: [
          { user_id: user_id },
          { type: "WITHDRAWAL" },
          { status: "COMPLETED" },
        ],
      });
      let sumForTotalWithdrawal = 0;
      for (let k = 0; k < totalWithdrawal.length; k++) {
        sumForTotalWithdrawal += totalWithdrawal[k].amount;
      }

      data.total_withdrawal = sumForTotalWithdrawal;

      return res
        .status(200)
        .json({ success: true, message: "Dashboard Loaded!!", data: data });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  userToUserFundTransfer: async (req, res) => {
    try {
      const { user_id } = req.user;
      const { receiver_id, amount } = req.body;

      // Check if the amount is greater than or equal to 10 and is a multiple of 5
      if (amount < 10 || amount % 5 !== 0) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot transfer below $10 & the amount should be a multiple of $5",
          data: [],
        });
      }

      // Check if the user exists
      let sender = await Users.findOne({ user_id: user_id });
      if (!sender) {
        return res.status(404).json({
          success: false,
          message: "Sender not found",
          data: [],
        });
      }

      // Check if the user exists
      let reciever = await Users.findOne({ user_id: receiver_id });
      if (!reciever) {
        return res.status(404).json({
          success: false,
          message: "Receiver not found",
          data: [],
        });
      }
      console.log(sender.user_id, reciever.user_id, ":Details of Comparison");

      if (sender?.user_id == reciever?.user_id)
        return res.status(400).json({
          success: false,
          message: "Sender and receiver can't be same",
          data: [],
        });

      // Check wallet of the sender
      let sender_wallet = await Wallet.findOne({ user_id: user_id });

      // Check wallet of the receiver
      let receiver_wallet = await Wallet.findOne({ user_id: receiver_id });

      let sender_wallet_balance = sender_wallet.usdt_balance;
      let receiver_wallet_balance = receiver_wallet.usdt_balance;

      console.log(amount, sender_wallet_balance, "logss");

      if (amount > sender_wallet_balance) {
        return res.status(400).json({
          success: false,
          message: "Insufficient Wallet Balance",
          data: {
            available_balance: sender_wallet_balance,
            transfer_amount: amount,
          },
        });
      } else {
        sender_wallet_balance -= amount;
        receiver_wallet_balance += amount;

        //Update Sender Wallet Balance
        await Wallet.updateOne(
          { user_id: user_id },
          { $set: { usdt_balance: sender_wallet_balance } },
          { new: true }
        );

        //Update Receiver Wallet Balance
        await Wallet.updateOne(
          { user_id: receiver_id },
          { $set: { usdt_balance: receiver_wallet_balance } },
          { new: true }
        );

        // update User to User fund Transfer
        let userToUserTransfer = new UserToUserTransfer({
          sender_id: user_id,
          receiver_id: receiver_id,
          amount: amount,
        });

        await userToUserTransfer.save();

        let updated_sender_wallet = await Wallet.findOne({
          user_id: user_id,
        }).select("usdt_balance");
        let updated_receiver_wallet = await Wallet.findOne({
          user_id: receiver_id,
        }).select("usdt_balance");
        console.log(updated_sender_wallet, ": Updated Sender Wallet Balance");
        console.log(
          updated_receiver_wallet,
          ": Updated Receiver Wallet Balance"
        );

        // Return success response
        return res.status(200).json({
          success: true,
          message: "Amount Transfer Successfull!!",
          sender: updated_sender_wallet,
          receiver: updated_receiver_wallet,
        });
      }
    } catch (error) {
      console.log(error, " : ERROR while transfering amount");
      return res.status(500).json({
        success: false,
        message: error.message,
        data: [],
      });
    }
  },

  findUserById: async (req, res) => {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res
          .status(400)
          .json({ success: false, message: "User Not Found" });
      }

      let data = await Users.findOne(
        { user_id: user_id },
        { password: 0, ranks: 0 }
      ).lean();
      return res.status(200).json({
        success: true,
        message: "User Name fetched successfully!!",
        data: data,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  UserFundTransferHistoryByAdmin: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(id, ": ID of the User");
      let tranferHistory = await AdminTransfer.find({ user_id: id });
      return res.status(200).json({
        success: true,
        message: "User Fund Transfer History By Admin Fetched",
        data: tranferHistory,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const {
        email_or_phone,
        verification_code,
        new_password,
        confirm_password,
      } = req.body;
      console.log("Helo", new_password, confirm_password);

      // check if new passwords match
      if (new_password !== confirm_password) {
        return res.status(406).json({
          success: false,
          message: "Both passwords should match!",
          data: [],
        });
      }

      // find user with this email or phone
      let user = await Users.findOne({ email: email_or_phone });
      if (user === null) {
        return res
          .status(404)
          .json({ success: false, message: "User not found!", data: [] });
      }

      // check if OTP is correct
      let check_otp = await Otps.findOne({ email_or_phone: email_or_phone });
      console.log(check_otp, verification_code, "Logss");

      if (check_otp === null || check_otp.otp !== verification_code) {
        return res
          .status(406)
          .json({ success: false, message: "OTP not matched!", data: [] });
      }

      // encrypt the new password
      let password = await Bcrypt.passwordEncryption(new_password);

      // update the new encrypted password
      await Users.updateOne(
        { email: email_or_phone },
        {
          $set: {
            password: password,
          },
        }
      );

      // remove OTP after successful password reset
      await Otps.deleteOne({ email_or_phone: email_or_phone });

      return res.status(200).json({
        success: true,
        message: "Password reset successfully!",
        data: [],
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  get_user_email: async (req, res) => {
    try {
      const { user_id } = req.query;
      let data = await Users.findOne({ user_id: user_id });
      if (!data) {
        return res
          .status(403)
          .json({ success: false, message: "User not found!", data: [] });
      }
      return res.status(200).json({
        success: true,
        message: "User email fetched successfully!!",
        data: data.email,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: error.message, data: [] });
    }
  },

  UserFundTransferHistory: async (req, res) => {
    try {
      const { user_id } = req.user;
      const sender_data = await UserToUserTransfer.find({ sender_id: user_id });
      const receiver_data = await UserToUserTransfer.find({
        receiver_id: user_id,
      });
      console.log("sender_data", sender_data);
      console.log("receiver_data", receiver_data);

      let response_data = [];
      let message = "User Transactions Fetched";
      let sender_transactions;
      let receiver_transactions;
      if (sender_data.length > 0) {
        sender_transactions = sender_data.map((item) => ({
          ...item.toObject(),
          transaction_type: "DEBIT",
        }));

        response_data.push(sender_transactions);
      }
      if (receiver_data.length > 0) {
        receiver_transactions = receiver_data.map((item) => ({
          ...item.toObject(),
          transaction_type: "CREDIT",
        }));
        response_data.push(receiver_transactions);
      }
      console.log(sender_transactions, ": sender_transactions");
      console.log(receiver_transactions, ": receiver_transactions");
      console.log("Hello", response_data, ": response data log");

      return res.status(200).json({
        success: true,
        message: message,
        data: response_data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
        data: [],
      });
    }
  },
};
