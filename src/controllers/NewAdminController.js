const Users = require("../models/User");
const Wallet = require("../models/Wallet");
const Admin = require("../models/Admin");
const Otps = require("../models/Otp");
const Staking = require("../models/Staking");
const Transaction = require("../models/Transaction");

const JWT = require("../utils/Jwt");
const Bcrypt = require("../utils/Bcrypt");
const WalletTransaction = require("../models/WalletTransaction");
const {
  updateBalance,
  update_locked_balance,
} = require("../controllers/WalletController");
const { ObjectId } = require("mongodb");
const Notification = require("../models/Notification");
const AdminTransfer = require("../models/AdminTransfer");
const ClassicNews = require("../models/ClassicNews");
const { JWT_SECRET, JWT_EXPIRY_TIME } = process.env;
const mongoose = require("mongoose");
const Referral = require("../models/Referral");
const User = require("../models/User");

module.exports = {
  async getAllRewards(req, res) {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;
      const skip = (page - 1) * limit;
      let userFilter = {};

      // If search is provided, find matching users by name or email
      if (search) {
        const userRegex = new RegExp(search, "i");
        const matchingUsers = await User.find({
          $or: [
            { name: { $regex: userRegex } },
            { email: { $regex: userRegex } },
          ],
        }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        userFilter.user = { $in: userIds };
      }

      // Add reward filters
      const rewardFilter = {
        status: "COMPLETE",
        income_type: "sng_rewards",
        ...userFilter,
      };

      const total = await Transaction.countDocuments(rewardFilter);

      const rewards = await Transaction.find(rewardFilter)
        // .populate('user', 'name email') // Removed because Transaction does not support population
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const rewardsData = rewards.map((reward) => {
        return {
          id: reward._id,
          user_id: reward.user_id,
          amount: reward.amount,
          staking_id: reward.staking_id,
          from: reward.from,
          rank_achieved: reward.rank_achieved,
          currency: reward.currency,
          self: reward.self,
          first_leg: reward.first_leg,
          second_leg: reward.second_leg,
          rest_legs: reward.rest_legs,
          total: reward.total,
          carry_forward_business: reward.carry_forward_business,
          income_type: reward.income_type,
          transaction_type: reward.transaction_type,
          status: reward.status,
          level: reward.level,
          package_name: reward.package_name,
          package_amount: reward.package_amount,
          description: reward.description,
          metadata: reward.metadata,
          from_user_id: reward.from_user_id,
          from_user_name: reward.from_user_name,
          createdAt: reward.createdAt ? reward.createdAt.toLocaleString() : null,
          updatedAt: reward.updatedAt ? reward.updatedAt.toLocaleString() : null,
        };
      });

      // Calculate total income from rewards
      const totalIncomeAgg = await Transaction.aggregate([
        { $match: rewardFilter },
        { $group: { _id: null, totalIncome: { $sum: "$amount" } } }
      ]);
      const totalIncome = totalIncomeAgg[0]?.totalIncome || 0;

      return res.status(200).json({
        success: true,
        message: "Rewards fetched successfully",
        data: rewardsData,
        total,
        totalIncome,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  },
  async getRewardForUser(req, res) {
    try {
      const { user_id, page = 1, limit = 10 } = req.query;
      const user = await User.findOne({ user_id: user_id });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      const userName = user.name;
      const userEmail = user.email;

      const skip = (page - 1) * limit;
      const filter = { user_id, income_type: "sng_rewards" };
      const total = await Transaction.countDocuments(filter);
      const reward = await Transaction.find(filter)
        .skip(skip)
        .limit(Number(limit));
      // Attach user_name and user_email to each reward
      const rewardsData = reward.map(r => ({
        ...r.toObject(),
        user_name: userName,
        user_email: userEmail,
      }));
      // Calculate total income for this user
      const totalIncomeAgg = await Transaction.aggregate([
        { $match: filter },
        { $group: { _id: null, totalIncome: { $sum: "$amount" } } }
      ]);
      const totalIncome = totalIncomeAgg[0]?.totalIncome || 0;
      return res.status(200).json({
        success: true,
        message: "Reward fetched successfully",
        data: rewardsData,
        total,
        totalIncome,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  },
};
