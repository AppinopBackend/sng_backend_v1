const Users = require('../models/User')
const Wallet = require('../models/Wallet');
const Admin = require('../models/Admin');
const Otps = require('../models/Otp');
const Staking = require('../models/Staking')
const Transaction = require('../models/Transaction')

const JWT = require("../utils/Jwt");
const Bcrypt = require('../utils/Bcrypt')
const WalletTransaction = require('../models/WalletTransaction');
const {updateBalance, update_locked_balance} = require('../controllers/WalletController')
const { ObjectId } = require('mongodb');
const Notification = require('../models/Notification');
const AdminTransfer = require('../models/AdminTransfer');
const ClassicNews = require('../models/ClassicNews');
const { JWT_SECRET, JWT_EXPIRY_TIME } = process.env;
const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const User = require('../models/User');

module.exports = {
    login: async(req, res) => {
        try {
            const { email, password, verification_code } = req.body;

            // first check if this email is exists or not
            let user = await Admin.findOne({email: email});
            if(user === null) {
                return res.status(500).json({success: false, message: "Invalid Admin User!!", data: []})
            } else if(user.status != 'ACTIVE') {
                return res.status(401).json({success: false, message: "Your account is deactivated please contact admin!!", data: []})
            }

           /*  // check otp 
            let otp = await Otps.findOne({email_or_phone: email});
            if(otp === null || otp.otp != verification_code) {
                return res.status(500).json({success: false, message: 'Verification Code Not Matched!!', data: []})
            } */

            let compare = await Bcrypt.passwordComparison(password, user.password);
            if(!compare) {
                return res.status(500).json({success: false, message: 'Password not matched!!', data: []})
            } else {
                let data = {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    admin_type: user.admin_type,
                    status: user.status,
                    permissions: user.permissions
                };

                let token = await JWT.generate_token(
                    data,
                    JWT_SECRET,
                    JWT_EXPIRY_TIME
                );
                data.token = token;
                return res.status(200).json({success: true, message: 'Logged in!!', data: data})
            }


        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    addNewAdmin: async(req, res) => {
        try {
            const { email, name, admin_type, permissions } = req.body;
            let { password } = req.body;

            // check if user with this email is already exists or not
            let exists = await Admin.countDocuments({email: email})
            if(exists > 0) {
                return res.status(500).json({success: false, message: 'Admin with this email is already exists!!', data: []})
            }

            password = await Bcrypt.passwordEncryption(password);
            let data = await Admin.create({email, name, admin_type, permissions, password});
            return res.status(201).json({success: true, message: 'Admin Created Successfully!!', data: data})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    // fetching sub admins list
    adminList: async(req, res) => {
        try {
            let data = await Admin.find({admin_type: 0}).sort({createdAt: -1});
            return res.status(200).json({success: true, message: 'Sub admin list fetched successfully!!', data: data})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    // update sub admin
    updateSubadmin: async(req, res) => {
        try {
            const { id, name, email, permissions } = req.body;
            let update_data = await Admin.findByIdAndUpdate(
                id,
                {
                    $set: {
                        email: email,
                        name: name,
                        permissions: permissions,
                    }
                },
                { new : true }
            )
            if (update_data) {
                return res.status(200).json({ success: true, message: 'Sub admin updatted successfully', data: update_data })
            } else {
                return res.status(200).json({ success: false, message: 'Some error occured while updating sub admin', data: [] })
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: 'some error occured on server', data: [] })
        }
    },

    // delete sub admin
    deleteSubadmin: async (req, res) => {
        try {
            const { id } = req.params;
    
            let deletedData = await Admin.findByIdAndDelete(id);
    
            if (deletedData) {
                return res.status(200).json({ 
                    success: true, 
                    message: 'Subadmin deleted successfully', 
                    data: deletedData 
                });
            } else {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Subadmin not found', 
                    data: [] 
                });
            }
        } catch (error) {
            console.error(error, " : ERROR while deleting subadmin");
            return res.status(500).json({ 
                success: false, 
                message: 'Some error occurred on server', 
                data: [] 
            });
        }
    },
    
    fetchAllDeposit: async(req, res) => {
        try {
            const { status } = req.body;
            console.log(status, ":STATUS")

            if(!status){    
                let depositData = await WalletTransaction.find({ type : "DEPOSIT" });
                const userIds = depositData.map(item => item.user_id);
                const users = await Users.find({ user_id: { $in: userIds } });
    
                const userMap = users.reduce((acc, user) => {
                acc[user.user_id] = user.name;
                return acc;
                }, {});
    
                depositData = depositData.map(item => {
                return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                    };
                });
                return res.status(200).json({ success : true, message : "All Deposits Fetched Successfully", data : depositData});
            }
            else {
                console.log("inside else")
                let depositData = await WalletTransaction.find({
                    $and: [
                      { type: "DEPOSIT" },
                      { status: status }
                    ]
                  });
                  const userIds = depositData.map(item => item.user_id);
                  const users = await Users.find({ user_id: { $in: userIds } });
    
                  const userMap = users.reduce((acc, user) => {
                    acc[user.user_id] = user.name;
                    return acc;
                    }, {});
    
                  depositData = depositData.map(item => {
                  return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                    };
                   });
                  
                return res.status(200).json({ success : true, message : `Deposits with status ${status} Fetched Successfully`, data : depositData}); 
            }
            return res.status(200).json({success: true, message: 'Transaction updated successfully!!', data: []})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    updateDepositStatus: async(req, res) => {
        try {
            const { _id, status } = req.body;

            // check if this transaction exists or not
            let transaction = await WalletTransaction.findOne({_id: _id});
            if(transaction === null) {
                return res.status(406).json({success: false, message: 'No transaction found with this id', data: []})
            } else if(transaction.status != 'PENDING') {
                return res.status(406).json({success: false, message: 'This transaction is already completed', data: []})
            }
            console.log(transaction, " : transaction")
            if(status === 'COMPLETED') {
                transaction.amount = transaction.amount
            } else {
                transaction.amount = 0;
            }
            // update transaction balance to users wallet
            let updatebalance = await Wallet.updateOne(
                {user_id: transaction.user_id},
                {
                    $inc: {
                        balance: transaction.amount
                    }
                }
            )
            console.log(updatebalance, " : updatebalance")
            if(updatebalance.modifiedCount > 0) {
                // update this transaction status
                await WalletTransaction.updateOne(
                    { _id: transaction._id },
                    {
                        $set: {
                            status: status
                        }
                    }
                )
            } else {
                return res.status(500).json({success: false, message: 'Some error occured', data: []})
            }
            return res.status(200).json({success: true, message: 'Transaction updated successfully!!', data: []})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    userList: async(req, res) => {
        try {
            let data = await Users.find({},{password: 0, ranks: 0});
            return res.status(200).json({success: true, message: 'Users list fetched successfully!!', data: data})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    updateLoginStatus: async(req, res) => {
        try {
            const { user_id, status } = req.body;
            let data = await Users.updateOne(
                { user_id: user_id },
                {
                    $set: {
                        loginStatus: status
                    }
                }
            );
            if(data.modifiedCount > 0) {
                return res.status(200).json({success: true, message: `Users status set to ${status}`, data: []})
            }
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    getUserDetails: async(req, res) => {
        try {
            const { user_id } = req.query;
            // user details
            let data = await Users.findOne({user_id: user_id}, {password: 0}).lean();

            // user wallet details
            let wallet = await Wallet.findOne({user_id: user_id});

            // Users Staking Details
            let staking = await Staking.find({user_id: user_id});

             // Calculate the total staking amount
            let totalStakingAmount = staking.reduce((total, stake) => total + stake.amount, 0);
            console.log(totalStakingAmount, "STACKING KA TOTAL")
            // Users deposit request
            let deposit = await Transaction.find({$and: [{user_id: user_id}, {transaction_type: 'DEPOSIT'}]})

            // Users withdraw request
            let withdraw = await Transaction.find({$and: [{user_id: user_id}, {transaction_type: 'WITHDRAWAL'}]})

            data = data != null ? data : []
            data.wallet = wallet ?? []
            data.staking = staking
            data.total_staking = totalStakingAmount;
            data.deposit_transaction = deposit;
            data.withdraw_transaction = withdraw;
            return res.status(200).json({success: true, message: 'User details fetched!!', data: data})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    transactionByType: async(req, res) => {
        try {
            const { type, skip, limit } = req.query;
            let data = await WalletTransaction.find({transaction_type: type}).sort({createdAt: 1}).skip(skip || 0).limit(limit || 10);
            return res.status(200).json({success: true, message: 'Transaction Fetched Successfully!!', data: data})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    fetchAllWithdrawals: async(req, res) => {
        try {
            const { status } = req.body;
           

            if(!status){    
                let depositData = await WalletTransaction.find({ type : "WITHDRAWAL" });
                const userIds = depositData.map(item => item.user_id);
                const users = await Users.find({ user_id: { $in: userIds } });
    
                const userMap = users.reduce((acc, user) => {
                acc[user.user_id] = user.name;
                return acc;
                }, {});
    
                depositData = depositData.map(item => {
                return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                    };
                });
                
                return res.status(200).json({ success : true, message : "All Withdrawals Fetched Successfully", data : depositData});
            }
            else {
                console.log("inside else")
                let depositData = await WalletTransaction.find({
                    $and: [
                      { type: "WITHDRAWAL" },
                      { status: status }
                    ]
                  });

                  const userIds = depositData.map(item => item.user_id);
                  const users = await Users.find({ user_id: { $in: userIds } });
    
                  const userMap = users.reduce((acc, user) => {
                  acc[user.user_id] = user.name;
                  return acc;
                  }, {});
    
                 depositData = depositData.map(item => {
                 return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                    };
                 });
                  
                return res.status(200).json({ success : true, message : `Withdrawals with status ${status} Fetched Successfully`, data : depositData}); 
            }
           
            return res.status(200).json({success: true, message: 'Transaction updated successfully!!', data: []})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    updateWithdrawalStatus: async(req, res) => {
        try {
            // REJECTED, COMPLETED
            const { _id, status, transaction_hash } = req.body;
             
            let find_withdrawal_transaction = await WalletTransaction.findOne({
                $and: [{ _id: _id, transaction_type: "WITHDRAWAL" }]
            })

            if (!find_withdrawal_transaction) {
                return res.status(500)
                    .json({
                        success: false,
                        message: "No Transaction found with this ID",
                        data: []
                    })
            }

            let withdrawalData;
            let userId = find_withdrawal_transaction.id;
            console.log(userId, ":USER_ID")
            let amount1 = find_withdrawal_transaction.amount;
            console.log(amount1, ": AMOUNT1")      
            if (find_withdrawal_transaction.status != 'PENDING') {
                return res.status(500)
                    .json({
                        success: false,
                        message: "Transaction status already completed"
                    })
            }

            if (status == 'REJECTED') {
                console.log("inside rejected ______*********____");
                details = await WalletTransaction.updateOne(
                    { _id: _id },
                    {
                        $set: { status: status, transaction_hash : transaction_hash }
                    },
                    { upsert: true }
                );
                
            } 

            if(status == "COMPLETED"){
                details = await WalletTransaction.updateOne(
                    { _id: _id },
                    {
                        $set: { status: status, transaction_hash : transaction_hash}
                    },
                    { upsert: true }
                );

            let balance = await Wallet.findOne({ id : userId});
            console.log(balance, "BALANCE DATA")
            let final_balance = parseInt(balance.balance - amount1);
            console.log(final_balance, ":FINAL BALANCE");
            await Wallet.updateOne({id:userId}, {$set : {balance : final_balance}}, {new:true});
        }
        let transactionData = await WalletTransaction.findOne({_id : _id});
        console.log(transactionData);
            return res.status(200)
                .json({
                    success: true,
                    message: 'Withdrawal Status Updatted',
                    data: transactionData,
                })
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    dashboard: async(req, res) => {
        try {
            // count total users
            const obj = {};
            obj.totalUsers = await Users.countDocuments();
            obj.totalDeposit = await WalletTransaction.countDocuments({type: "DEPOSIT"})
            obj.totalWithdrawal = await WalletTransaction.countDocuments({type: "WITHDRAWAL"})
            let business = await Staking.aggregate([
                {
                    $match: {}
                },
                {
                    $group: {
                        _id: null,
                        totalStackQuantity: { $sum: "$amount" }
                    }
                }
            ]);
            obj.totalStakingAmount = business.length > 0 ? business[0].totalStackQuantity : 0 ;

            // total withdrawal amount of users
            let totalWithdrawal = await WalletTransaction.find({$and: [{type: "WITHDRAWAL"}, {status:"COMPLETED"}]});
            let sumForTotalWithdrawal = 0;
            for(let k=0; k< totalWithdrawal.length;k++){
                sumForTotalWithdrawal += totalWithdrawal[k].amount
            }
            obj.total_withdrawal = sumForTotalWithdrawal;
            return res.status(200).json({success: true, message: 'Dashboard data fetched!!', data: obj})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    allUsersPackageList: async (req, res) => {
        try {
            let data = await Staking.find();

            // adding username 
            const userIds = data.map(item => item.user_id);
            const users = await Users.find({ user_id: { $in: userIds } });
    
            const userMap = users.reduce((acc, user) => {
                acc[user.user_id] = user.name;
                return acc;
            }, {});
    
            data = data.map(item => {
                return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                };
            });
            return res.status(200).json({ success: true, message: 'All Staking Transaction Fetched!!', data: data })
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] })
        }
    },

    addFunds: async (req, res) => {
        try {
            const { user_id, amount } = req.body; // Assuming userid and amount are sent in the request body
            
             // Check if the amount is greater than or equal to 25 and is a multiple of 5
            //  if (amount < 25 || amount % 5 !== 0) {
            //     return res.status(400).json({
            //         success: false,
            //         message: "You cannot stack below $25 & the amount should be a multiple of $5",
            //         data: []
            //     });
            // }

            let funds = await Wallet.findOne({user_id : user_id });
            console.log(funds, ":FUNDS BEFORE TRANSFER")

            const add_funds = await Wallet.updateOne(
                { user_id : user_id }, 
                { 
                    $inc: { usdt_balance: amount } 
                }, 
                { upsert: true }
            );
            let updatedFunds = await Wallet.findOne({user_id : user_id });
            console.log(updatedFunds, ":FUNDS AFETR TRANSFER")

            if (add_funds) {
                let funds2 = await Wallet.findOne({user_id : user_id });
                let transferObj = {};
                transferObj.user_id = user_id;
                transferObj.amount = amount;
                transferObj.previous_balance = funds.usdt_balance;
                transferObj.final_balance = updatedFunds.usdt_balance;
                transferObj.type = "CREDITED_BY_ADMIN";

                let adminTransfer = await AdminTransfer.create(transferObj);
                // console.log(adminTransfer, "LOG OF TEST");
                return res.status(200).json({ success: true, message: 'Funds added successfully!', data: funds2, transferDetails : adminTransfer });
            } else {
                return res.status(400).json({ success: false, message: 'Failed to add funds', data: [] });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }
    },

    deductFunds: async (req, res) => {
        try {
            const { user_id, amount } = req.body; // Assuming userid and amount are sent in the request body
            
            let funds = await Wallet.findOne({user_id : user_id });

            const deduct_funds = await Wallet.updateOne(
                { user_id : user_id }, 
                { 
                    $inc: { usdt_balance: -amount } 
                }, 
                { upsert: true }
            );
            let updatedFunds = await Wallet.findOne({user_id : user_id });
            // console.log(updatedFunds, ": FUNDS AFTER TRANSFER");
    
            if (deduct_funds) {
                let funds2 = await Wallet.findOne({user_id : user_id });
                let transferObj = {};
                transferObj.user_id = user_id;
                transferObj.amount = amount;
                transferObj.previous_balance = funds.usdt_balance;
                transferObj.final_balance = updatedFunds.usdt_balance;
                transferObj.type = "DEBITED_BY_ADMIN";

                let adminTransfer = await AdminTransfer.create(transferObj);
                // console.log(adminTransfer, "LOG OF TEST");
             
                return res.status(200).json({ success: true, message: 'Funds deducted successfully!', data: funds2, transferDetails : adminTransfer });
            } else {
                return res.status(400).json({ success: false, message: 'Failed to deduct funds', data: [] });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }
    },

    fundTransferHistory : async (req, res) => {
        try {
            let tranferHistory = await AdminTransfer.find();

            // adding user name
            const userIds = tranferHistory.map(item => item.user_id);
            const users = await Users.find({ user_id: { $in: userIds } });
            const userMap = users.reduce((acc, user) => {
                acc[user.user_id] = user.name;
                return acc;
            }, {});
            
            tranferHistory = tranferHistory.map(item => {
                return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                };
            });
            return res.status(200).json({ success : true, message : "Admin Fund Transfer History Fetched", data : tranferHistory})
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }

    },

    pendingWithdrawalRequest: async (req, res) => {
        try {
            const totalCount = await WalletTransaction.countDocuments({ type: "WITHDRAWAL", status: "PENDING" });
    
            let deposit_data = await WalletTransaction.aggregate([
                { $match: { type: "WITHDRAWAL", status: "PENDING" } },
                { $addFields: { userObjId: { $toObjectId: "$id" } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userObjId',
                        foreignField: '_id',
                        as: 'userData'
                    },
                },
                { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } }, // Ensure documents are not dropped
                {
                    $addFields: {
                        name: '$userData.name',
                        email: "$userData.email",
                        phone: "$userData.phone"
                    }
                }, {
                    $project: {
                      _id: 1, 
                      user_id : 1,
                      id : 1,
                      type: 1,
                      amount: 1,
                      currency: 1,
                      chain: 1,
                      status: 1,
                      transaction_hash: 1,
                      withdrawal_address: 1,
                      createdAt: 1, 
                      name: '$userData.name',
                      email: '$userData.email',
                      phone: '$userData.phone'
                    }
                  },
                
                { $sort: { createdAt: -1 } }
            ]);
    
            return res.status(200).json({
                success: true,
                message: 'Pending Withdrawal List',
                data: deposit_data,
                totalCount: totalCount
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
                data: []
            });
        }
    },

    addUserStacking: async (req, res) => {
        try {
            const { user_id, amount } = req.body;

            // Check if the amount is greater than or equal to 100
            if (amount < 100) return res.status(400).json({ success: false, message: "Staking amount must be greater than 100", data: [] });

            // Check if the user exists
            let user = await Users.findOne({ user_id: user_id });
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found", data: [] });
            }
            console.log(user, "User Log");

            // Check if user has enough balance in the wallet
            let userbalance = await Wallet.findOne({ user_id: user_id });
            if (userbalance === null || userbalance.usdt_balance < amount) {
                return res.status(406).json({ success: false, message: 'Insufficient Wallet Balance', data: [] });
            }

            // Deduct balance from user's wallet
            let deduct = await Wallet.updateOne(
                { user_id: user_id },
                { $inc: { usdt_balance: -amount } }
            );
            if (!deduct || deduct.modifiedCount === 0) {
                return res.status(400).json({ success: false, message: "Unable to deduct user wallet balance", data: [] });
            }

            // ROI and rank logic
            let roi_value, rank;
            if (amount >= 100 && amount <= 500) roi_value = 0.5, rank = "SILVER";
            else if (amount >= 501 && amount <= 1000) roi_value = 0.6, rank = "GOLD";
            else if (amount >= 1001 && amount <= 2500) roi_value = 0.7, rank = "PLATINUM";
            else if (amount >= 2501 && amount <= 5000) roi_value = 0.8, rank = "DIAMOND";
            else if (amount >= 5001) roi_value = 1, rank = "CROWN";

            // Check if this is the user's first staking
            let existingStakes = await Staking.find({ user_id: user_id });
            let isFirstStaking = existingStakes.length === 0;
            let staking_value = user?.self_staking + Number(amount);

            // Find direct referrals
            let direct = await Referral.find({ sponser_id: user._id });
            console.log(direct, "Log of direct");

            // Create a staking transaction
            let obj = {
                user_id: user_id,
                id: user._id,
                amount: amount,
                roi: roi_value,
                currency: 'USDT',
                total: direct?.length > 0 ? amount * 3 : amount * 2,
                chain: 'BEP20',
                type: "ADMIN_STAKING"
            };
            let stake = await Staking.create(obj);

            // Update user's self-staking status
            let updateFields = {
                staking_status: 'ACTIVE',
                current_rank: rank,
                total_earning_potential: direct?.length > 0 ? 300 : 200,
                self_staking: staking_value
            };
            if (isFirstStaking) {
                updateFields.activation_date = new Date();
            }
            await Users.updateOne(
                { user_id: user_id },
                { $set: updateFields }
            );

            // Update all previous stakes' total if direct referrals exist
            if (direct.length) {
                let allStakes = await Staking.find({ user_id });
                for (let stakeItem of allStakes) {
                    if (stakeItem.total != (3 * stakeItem.amount)) {
                        let updatedTotal = 3 * stakeItem.amount;
                        await Staking.findByIdAndUpdate(stakeItem?._id, { total: updatedTotal }, { new: true });
                    }
                }
            }
            console.log("All Existing stakes updated accordingly...");

            // DIRECT REFERRAL BONUS (10% to sponsor)
            let sponser = await Referral.findOne({ user_id: user._id });
            let sponser_user = await User.findById(user._id);
            let sponser_user_staking = await Staking.findOne({ id: sponser?.sponser_id }).sort({ createdAt: -1 });
            let sponse_user_total = sponser_user_staking?.total;
            let sponser_user_paid = sponser_user_staking?.paid;

            if (sponser != null && sponser.sponser_id != null) {
                let direct_bonus = amount * 10 / 100;
                let updatedPaid = (sponser_user_paid || 0) + direct_bonus;

                // Transfer bonus to sponsor's wallet
                await Wallet.updateOne(
                    { user_id: sponser.sponser_code },
                    { $inc: { usdt_balance: direct_bonus } }
                );

                // Update paid value in sponsor user latest staking transaction
                if (sponse_user_total > sponser_user_paid) {
                    await Staking.findByIdAndUpdate(
                        sponser_user_staking?._id,
                        { direct_bonus_paid: updatedPaid },
                        { new: true }
                    );
                }

                // Create transaction for direct bonus for sponsor
                let bonusObj = {
                    user_id: sponser.sponser_code,
                    id: sponser.sponser_id,
                    amount: direct_bonus,
                    staking_id: stake._id,
                    currency: 'USDT',
                    transaction_type: 'DIRECT REFERRAL BONUS',
                    status: "COMPLETED",
                    from: user_id,
                    income_type: 'sng_direct_referral',
                    package_amount: amount
                };
                await Transaction.create(bonusObj);
            }

            // Return success response
            return res.status(200).json({
                success: true,
                message: 'Amount Staked!!',
                data: stake
            });
        } catch (error) {
            console.log(error, " : ERROR while buying package");
            return res.status(500).json({
                success: false,
                message: error.message,
                data: []
            });
        }
    },
    

    deductUserStacking: async (req, res) => {
        try {
            const { user_id, amount, phase } = req.body;
    
            // Check if the amount is greater than or equal to 25 and is a multiple of 5
            // if (amount < 25 || amount % 5 !== 0) {
            //     return res.status(400).json({
            //         success: false,
            //         message: "You cannot deduct below $25 & the amount should be a multiple of $5",
            //         data: []
            //     });
            // }
    
            // Check if the user exists
            let user = await Users.findOne({ user_id: user_id }).sort({ createdAt: -1 });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                    data: []
                });
            }

            // Check if stacking record exists for the user
            let stakes = await Staking.find({ user_id: user_id }).sort({ createdAt: -1 });
            if (!stakes.length) {
                return res.status(404).json({
                    success: false,
                    message: "No stacking record found for the user",
                    data: []
                });
            }

            // Calculate the total staked amount
            let totalStakedAmount = stakes.reduce((total, stake) => total + stake.amount, 0);

            // Check if the amount to be deducted is greater than the total staked amount
            if (amount > totalStakedAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot Deduct! Deduction amount exceeds the total stacked amount",
                    data: {
                        total_staked_amount: totalStakedAmount,
                        deduct_amount: amount
                    }
                });
            }

            let remainingAmount = amount;

            for (let stake of stakes) {
                if (remainingAmount <= 0) break;

                if (remainingAmount > stake.amount) {
                    remainingAmount -= stake.amount;
                    stake.deduct_amount = stake.amount;
                    stake.amount = 0;
                    stake.type = 'ADMIN_DEDUCT_STAKING';
                } else {
                    stake.deduct_amount = remainingAmount;
                    stake.amount -= remainingAmount;
                    remainingAmount = 0;
                    stake.phase = phase;
                    stake.type = 'ADMIN_DEDUCT_STAKING';
                }

                stake.total = stake.amount * 2.5;
                
                if (stake.amount === 0) {
                    // Remove the document from the Staking collection if the amount is 0
                    await Staking.deleteOne({ _id: stake._id });
    
                    // Optionally, update user's self-staking status if needed
                    let activeStakes = await Staking.find({ user_id: user_id });
                    if (activeStakes.length === 0) {
                        await Users.updateOne(
                            { user_id: user_id },
                            {
                                $set: { staking_status: 'INACTIVE' },
                                $unset: { activation_date: "" }
                            }
                        );
                    }
                } else {
                    await stake.save();
                }
            }

            // Return success response
            return res.status(200).json({
                success: true,
                message: 'Amount Deducted!!',
                data: stakes
            });
        } catch (error) {
            console.log(error, " : ERROR while deducting stacking amount");
            return res.status(500).json({
                success: false,
                message: error.message,
                data: []
            });
        }
    },

    adminStakingTransferHistory : async (req, res) => {
        try {
            let tranferHistory = await Staking.find({ $or : [{type : 'ADMIN_DEDUCT_STAKING'}, {type :'ADMIN_STAKING'}]});
            // adding user name
            const userIds = tranferHistory.map(item => item.user_id);
            const users = await Users.find({ user_id: { $in: userIds } });
            const userMap = users.reduce((acc, user) => {
                acc[user.user_id] = user.name;
                return acc;
            }, {});
            
            tranferHistory = tranferHistory.map(item => {
                return {
                    ...item._doc,
                    user_name: userMap[item.user_id]
                };
            });
            return res.status(200).json({ success : true, message : "Admin Fund Transfer History Fetched", data : tranferHistory})
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }

    },

    add_notification : async (req, res) => {
        try {
            const { title , message } = req.body;
            let add_notification = await Notification.create(req.body)
            return res.status(200).json({success: true, message: "Notification Sent Successfully!", data: add_notification})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    notification_list : async (req, res) => {
        try {
            let notification_list = await Notification.find()
            return res.status(200).json({success: true, message: "Notification List Fetched", data: notification_list})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    delete_notification : async (req, res) => {
        try {
            const { id } = req.params;

            let delete_notification = await Notification.findByIdAndDelete({_id : id})

            return res.status(200).json({success: true, message: "Notification Deleted Successfully", data: delete_notification })
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: [] })
            
        }
    },

    add_classic_news : async (req, res) => {
        try {
            const { title , description } = req.body;
            const news_image = req.file != undefined ? `uploads/${req.file.filename}` : " ";
            
            let add_classic_news = await ClassicNews.create({title, description, news_image});
            return res.status(200).json({success: true, message: "Classic News Sent Successfully!", data: add_classic_news});
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []});
        }
    },

    classic_news_list : async (req, res) => {
        try {
            let classic_news_list = await ClassicNews.find();
            return res.status(200).json({success: true, message: "Classic News List Fetched", data: classic_news_list});
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []});
        }
    },

    delete_classic_news : async (req, res) => {
        try {
            const { id } = req.params;
            let delete_classic_news = await ClassicNews.findByIdAndDelete({_id : id});

            return res.status(200).json({success: true, message: "Classic News Deleted Successfully", data: delete_classic_news });
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: [] });
            
        }
    },
    
    updateAdminLoginStatus: async(req, res) => {
        try {
            const { _id,status } = req.body;
            let data = await Admin.updateOne(
                { _id: new ObjectId(_id) },
                {
                    $set: {
                        status: status
                    }
                },
                {new:true}
            );
            if(data.modifiedCount > 0) {
                return res.status(200).json({success: true, message: `Admin status set to ${status}`, data: []})
            }
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    
    all_user_backup: async (req, res) => {
        try {
            let data = [];
            let all_users = await Users.find().select('user_id activation_date createdAt');
    
            for (let user of all_users) {
                // Fetch staking data for each user
                // console.log(user, ":User");
                let staking_data = await Staking.find({ user_id: user.user_id }).sort('createdAt');
    
                // Extract first staking createdAt date and total staking amount
                let first_staking_date = staking_data.length > 0 ? staking_data[0].createdAt : null;
                let total_staking = staking_data.reduce((sum, staking) => sum + staking.amount, 0);
    
                // Fetch transaction data for each user and sum the amounts for "CARNIVAL SUPER BONUS"
                let transactions = await Transaction.find({ user_id: user.user_id, transaction_type: "CARNIVAL SUPER BONUS" });
                let total_roi_bonus = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    
                // Combine user data, staking data, and transaction data into a new object
                let user_data = {
                    user_id: user.user_id,
                    activation_date: user.activation_date,
                    registration_date : user.createdAt,
                    first_staking_date: first_staking_date,
                    total_staking: total_staking,
                    total_roi: total_roi_bonus
                };
    
                // Push the combined data into the final array
                data.push(user_data);
            }
    
            return res.status(200).json({ success: true, message: "User Data Backup Fetched", data: data });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }
    },

    //Update User Rank
    updateUserRank: async(req, res) => {
        try {
            const { id, rank } = req.body;
            let data = await Users.updateOne(
                { user_id: id },
                {
                    $set: {
                        current_rank: rank
                    }
                },
                {new:true}
            );
            if(data.modifiedCount > 0) {
                return res.status(200).json({success: true, message: `User Rank Updated to ${rank}`, data: []})
            }
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

}