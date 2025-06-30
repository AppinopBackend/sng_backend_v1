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
      let { page = 1, limit } = req.query;
      page = Number(page);
      limit = limit !== undefined ? Number(limit) : undefined;
      let skip = 0;
      if (limit && limit > 0) skip = (page - 1) * limit;

      let userFilter = {};
      if (req.query.search) {
        const userRegex = new RegExp(req.query.search, "i");
        const matchingUsers = await User.find({
          $or: [
            { name: { $regex: userRegex } },
            { email: { $regex: userRegex } },
          ],
        }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        userFilter.user = { $in: userIds };
      }

      const rewardFilter = {
        status: "COMPLETE",
        income_type: "sng_rewards",
        ...userFilter,
      };

      const total = await Transaction.countDocuments(rewardFilter);

      let rewardsQuery = Transaction.find(rewardFilter).sort({ createdAt: -1 });
      if (limit && limit > 0) rewardsQuery = rewardsQuery.skip(skip).limit(limit);
      const rewards = await rewardsQuery;

      // Get unique user IDs from rewards
      const userIds = [...new Set(rewards.map(reward => reward.user_id))];
      
      // Fetch user data for all users
      const users = await User.find({ user_id: { $in: userIds } }).select('user_id name');
      const userMap = {};
      users.forEach(user => {
        userMap[user.user_id] = user.name;
      });

      // Fetch first staking dates for all users
      const firstStakingDates = await Staking.aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { 
          _id: "$user_id", 
          firstStakingDate: { $min: "$createdAt" } 
        }}
      ]);
      
      const stakingDateMap = {};
      firstStakingDates.forEach(item => {
        stakingDateMap[item._id] = item.firstStakingDate;
      });

      const rewardsData = rewards.map((reward) => {
        return {
          id: reward._id,
          user_id: reward.user_id,
          user_name: userMap[reward.user_id] || null,
          user_activation_date: stakingDateMap[reward.user_id] ? stakingDateMap[reward.user_id].toLocaleString() : null,
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
      let { user_id, page = 1, limit } = req.query;
      page = Number(page);
      limit = limit !== undefined ? Number(limit) : undefined;
      let skip = 0;
      if (limit && limit > 0) skip = (page - 1) * limit;

      const user = await User.findOne({ user_id: user_id });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      const userName = user.name;
      const userEmail = user.email;

      // Get user's first staking date
      const firstStaking = await Staking.findOne({ user_id: user_id }).sort({ createdAt: 1 });
      const userActivationDate = firstStaking ? firstStaking.createdAt.toLocaleString() : null;

      const filter = { user_id, income_type: "sng_rewards" };
      const total = await Transaction.countDocuments(filter);

      let rewardQuery = Transaction.find(filter);
      if (limit && limit > 0) rewardQuery = rewardQuery.skip(skip).limit(limit);
      const reward = await rewardQuery;

      // Attach user_name, user_email, and user_activation_date to each reward
      const rewardsData = reward.map(r => ({
        ...r.toObject(),
        user_name: userName,
        user_email: userEmail,
        user_activation_date: userActivationDate,
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
  async getBoosterIncome(req, res) {
    try {
      let { page = 1, limit } = req.query;
      page = Number(page);
      limit = limit !== undefined ? Number(limit) : undefined;
      let skip = 0;
      if (limit && limit > 0) skip = (page - 1) * limit;

      let crownStakingsQuery = Staking.find({ roi: 1 });
      if (limit && limit > 0) crownStakingsQuery = crownStakingsQuery.skip(skip).limit(limit);
      const crownStakings = await crownStakingsQuery;

      // Booster eligible users (roi = 1 in Staking)
      const userIds = [...new Set(crownStakings.map(s => s.user_id))];
      
      // Fetch user data for all booster eligible users
      const users = await User.find({ user_id: { $in: userIds } }).select('user_id name');
      const userMap = {};
      users.forEach(user => {
        userMap[user.user_id] = user.name;
      });

      // Fetch first staking dates for all users
      const firstStakingDates = await Staking.aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { 
          _id: "$user_id", 
          firstStakingDate: { $min: "$createdAt" } 
        }}
      ]);
      
      const stakingDateMap = {};
      firstStakingDates.forEach(item => {
        stakingDateMap[item._id] = item.firstStakingDate;
      });

      // Add user_name and user_activation_date to each staking record
      const boosterEligibleUsers = crownStakings.map(stake => ({
        ...stake._doc,
        user_name: userMap[stake.user_id] || null,
        user_activation_date: stakingDateMap[stake.user_id] ? stakingDateMap[stake.user_id].toLocaleString() : null,
      }));
      
      const total = await Staking.countDocuments({ roi: 1 }); 
      
      return res.status(200).json({
        success: true,
        message: "Booster income fetched successfully",
        data: boosterEligibleUsers,
        page: Number(page),
        limit: Number(limit),
        boosterEligibleUserCount: userIds.length,
        total
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  },
  async getTotalIncome(req, res) {
    try {
      let { income_type, page = 1, limit } = req.query;
      let skip = 0;
      if (limit && limit > 0) skip = (page - 1) * limit;

      if (!income_type) {
        let incomeListAgg = Transaction.aggregate([
          {
            $group: {
              _id: "$income_type",
              totalIncome: { $sum: "$amount" }
            }
          },
          {
            $project: {
              _id: 0,
              income_type: "$_id",
              totalIncome: { $round: ["$totalIncome", 2] }
            }
          }
        ]);
        if (limit && limit > 0) incomeListAgg = incomeListAgg.skip(skip).limit(limit);
        const incomeList = await incomeListAgg;
        const total = incomeList.length;
        return res.status(200).json({
          success: true,
          message: "All income types with totals fetched successfully",
          data: incomeList,
          total,
          page,
          limit: limit || total,
        });
      }

      const filter = { income_type };
      const total = await Transaction.countDocuments(filter);

      let transactionsQuery = Transaction.find(filter);
      if (limit && limit > 0) transactionsQuery = transactionsQuery.skip(skip).limit(limit);
      const transactions = await transactionsQuery;

      // --- Add user info to each transaction ---
      const userIds = [...new Set(transactions.map(tx => tx.user_id))];
      const users = await User.find({ user_id: { $in: userIds } }).select('user_id name createdAt');
      const userMap = {};
      users.forEach(user => {
        userMap[user.user_id] = { name: user.name, registration_date: user.createdAt };
      });
      // Fetch first staking dates for all users
      const firstStakingDates = await Staking.aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { _id: "$user_id", firstStakingDate: { $min: "$createdAt" } } }
      ]);
      const stakingDateMap = {};
      firstStakingDates.forEach(item => {
        stakingDateMap[item._id] = item.firstStakingDate;
      });
      // Attach user info to each transaction
      const transactionsWithUser = transactions.map(tx => ({
        ...tx.toObject(),
        user_name: userMap[tx.user_id]?.name || null,
        user_registration_date: userMap[tx.user_id]?.registration_date || null,
        user_activation_date: stakingDateMap[tx.user_id] || null,
      }));

      // Calculate total income for this income_type
      const totalIncomeAgg = await Transaction.aggregate([
        { $match: filter },
        { $group: { _id: null, totalIncome: { $sum: "$amount" } } }
      ]);
      const totalIncome = totalIncomeAgg[0]?.totalIncome || 0;

      return res.status(200).json({
        success: true,
        message: "Transactions for income type fetched successfully",
        data: transactionsWithUser,
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
  async getTotalIncomeForUser(req, res) {
    try {
      const { income_type, user_id } = req.query;
      if (!income_type) {
        return res.status(400).json({
          success: false,
          message: "Income type is required",
        });
      }
      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      let { page = 1, limit } = req.query;
      page = Number(page);
      limit = limit !== undefined ? Number(limit) : undefined;
      let skip = 0;
      if (limit && limit > 0) skip = (page - 1) * limit;

      const filter = { user_id, income_type };
      const total = await Transaction.countDocuments(filter);

      let query = Transaction.find(filter);
      if (limit && limit > 0) query = query.skip(skip).limit(limit);
      const transactions = await query;

      // Fetch user info
      const user = await User.findOne({ user_id }).select('name createdAt');
      // Fetch first staking date
      const firstStaking = await Staking.findOne({ user_id }).sort({ createdAt: 1 });
      const user_activation_date = firstStaking ? firstStaking.createdAt : null;
      // Attach user info to each transaction
      const transactionsWithUser = transactions.map(tx => ({
        ...tx.toObject(),
        user_name: user?.name || null,
        user_registration_date: user?.createdAt || null,
        user_activation_date: user_activation_date || null,
      }));

      return res.status(200).json({
        success: true,
        message: "Transactions for user fetched successfully",
        data: transactionsWithUser,
        total,
        page,
        limit: limit || total, // If no limit, return total as limit
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  },
  async userDirectReferred(req, res) {
    try {
      const { id, index } = req.query;
      const members = await Referral.find({ sponser_id: id });
      const userIds = members.map(member => member.user_id);
      const userCodes = members.map(member => member.user_code);
      
      const users = await Users.find({ _id: { $in: userIds } }, { password: 0, ranks: 0 }).lean();
      const stacking_details = await Staking.find({ user_id: { $in: userCodes } });

      // Calculate total package amount for all direct referrals
      const totalPackageAmount = stacking_details
        .filter(detail => detail.status === "RUNNING")
        .reduce((sum, detail) => sum + (detail.amount || 0), 0);

      // Create a map to hold the running staking package count for each user
      const selfBusinessMap = {};

      // Helper function to get downline team business (simulate getDownlineTeam2)
      async function getDownlineTeam2(userId) { 
        const directRefs = await Referral.find({ sponser_code: userId });
        const directUserCodes = directRefs.map(d => d.user_code);
        const directStakings = await Staking.find({ user_id: { $in: directUserCodes }, status: "RUNNING" });
        return directStakings.reduce((sum, detail) => sum + (detail.amount || 0), 0);
      }

      for await (const userId of userIds) {
        const selfBusiness = await getDownlineTeam2(userId);
        selfBusinessMap[userId] = selfBusiness;
      }

      // Map users with additional data including staking amount
      const data = await Promise.all(users.map(async user => {
        // Find direct referrals for this user
        const directs = await Referral.find({ sponser_code: user.user_id });
        const directUserCodes = directs.map(d => d.user_code);

        // Sum self staking of all direct referrals (status RUNNING)
        let userDirectBusiness = 0;
        if (directUserCodes.length > 0) {
          const directStakings = await Staking.find({ user_id: { $in: directUserCodes }, status: "RUNNING" });
          userDirectBusiness = directStakings.reduce((sum, detail) => sum + (detail.amount || 0), 0);
        }

        return {
          ...user,
          id: user._id,
          sponser_id: id,
          index: index,
          staking_status: user.staking_status || 'INACTIVE',
          self_business: selfBusinessMap[user._id] || 0,
          total_direct_business: userDirectBusiness,
          user_registration_date: user.createdAt,
        };
      }));

      return res.status(200).json({
        success: true,
        message: 'Direct referred fetched (admin)!!',
        data: data,
        total_package_amount: totalPackageAmount
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
        data: []
      });
    }
  },
  async updateUserStakingStatus(req, res) {
    try {
      const { user_id, staking_status } = req.body;
      if (!user_id || !staking_status) {
        return res.status(400).json({
          success: false,
          message: "user_id and staking_status are required",
        });
      }
      const validStatuses = ["ACTIVE", "INACTIVE"];
      if (!validStatuses.includes(staking_status)) {
        return res.status(400).json({
          success: false,
          message: "staking_status must be either 'ACTIVE' or 'INACTIVE'",
        });
      }
      const user = await User.findOneAndUpdate(
        { user_id },
        { staking_status },
        { new: true }
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      return res.status(200).json({
        success: true,
        message: `User staking_status updated to ${staking_status}`,
        data: { user_id: user.user_id, staking_status: user.staking_status },
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
