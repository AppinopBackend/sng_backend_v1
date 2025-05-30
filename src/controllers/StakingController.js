const { BSCSCAN_API } = process.env;
const Staking = require('../models/Staking')
const Wallet = require('../models/Wallet')
const Referral = require('../models/Referral')
const Transaction = require('../models/Transaction')
const Token = require('../models/Token')
const Users = require('../models/User');
const User = require('../models/User');

module.exports = {
    buyPackage: async(req, res) => {
        try {
            const { user_id, id } = req.user;
            const { amount } = req.body;
            
            // check if amount is greater then and equal to 25 or not
            if(amount < 100) return res.status(500).json({success: false, message: "You cannnot buy package below $100", data: []})

            // check if user have enough balance in the wallet
            let userbalance = await Wallet.findOne({user_id: user_id});
            console.log(userbalance.usdt_balance, ": User's Usdt Balance...");
            let user = await Users.findOne({user_id : user_id});
            if(userbalance === null || userbalance.usdt_balance < amount) return res.status(406).json({success: false, message: 'Insufficient Wallet Balance', data: []})
            

            // deduct balance from users wallet
            let deduct = await Wallet.updateOne(
                { user_id: user_id },
                {
                    $inc: {
                        usdt_balance: -amount
                    }
                }
            )

            let roi_value, rank;
            if(amount >= 100 && amount <= 500)  roi_value = 0.5, rank = "SILVER";
            else if (amount >= 501 && amount <= 1000) roi_value = 0.6, rank = "GOLD";
            else if (amount >= 1001 && amount <= 2500) roi_value = 0.7, rank = "PLATINUM";
            else if (amount >= 2501 && amount <= 5000) roi_value = 0.8, rank = "DIAMOND";
            else if (amount >= 5001) roi_value = 1, rank = "CROWN";
           

            if(deduct.modifiedCount > 0) {
                // Check if this is the user's first staking
                let existingStakes = await Staking.find({ user_id: user_id });
                let isFirstStaking = existingStakes.length === 0;
                let staking_value = user?.self_staking + Number(amount);

                // create a staking transaction
                // let token = await Token.findOne({short_name: 'CCT'});
                let obj = {
                    user_id: user_id,
                    id: id,
                    amount: amount,
                    roi: roi_value,
                    currency: 'USDT',
                    total: amount,
                    chain: 'BEP20',
                }
                let stake = await Staking.create(obj);

                // Update user's self-staking status
                let updateFields = { staking_status: 'ACTIVE', current_rank: rank, total_earning_potential: 300, self_staking: staking_value };
                if (isFirstStaking) {
                    updateFields.activation_date = new Date().toISOString();
                }
                await Users.updateOne(
                    { user_id: user_id },
                    { $set: updateFields }
                );

                //  DIRECT REFERRAL BONUS
                // 10% Direct Bonus to sponser 

                console.log("Hello");
                
                let sponser = await Referral.findOne({user_id: id});
                console.log(sponser, " : Sponser");
                
                if(sponser != null && sponser.sponser_id != null) {

                    console.log(sponser, " : SPONSER DATA")
                    // distribute direct bonus to sponsers wallet
                    let direct_bonus = amount * 10 / 100;
                    console.log(direct_bonus, " : Bonus");

                    // transfer bonus to sponsers wallet
                    await Wallet.updateOne(
                        { user_id: sponser.sponser_code},
                        {
                            $inc: {
                                usdt_balance: direct_bonus
                            }
                        }
                    )
                    console.log("Wallets updated...");

                    // create transaction for direct bonus for sponser
                    let obj = {
                        user_id: sponser.sponser_code,
                        id: sponser.sponser_id,
                        amount: direct_bonus,
                        staking_id: stake._id,
                        currency: 'USDT',
                        transaction_type: 'DIRECT REFERRAL BONUS',
                        status: "COMPLETED",
                        from: user_id
                    }

                    await Transaction.create(obj);
                    console.log("Transaction Created...");
                }
            } else {
                return res.status(500).json({success: false, message: 'Some error occured!!', data: []})
            }
            return res.status(200).json({success: true, message: 'Amount Staked!!', data: []})
        } catch (error) {
            console.log(error, " : ERROR while buying package")
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    userPackageList: async(req, res) => {
        try {
            const { user_id } = req.user;
            let data = await Staking.find({user_id: user_id}).sort({createdAt: -1});
            return res.status(200).json({success: true, message: 'Staking Transaction Fetched!!', data: data});
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    },

    rewardList: async(req, res) => {
        try {
            const { user_id } = req.user;
            const { type, skip, limit } = req.query;
            let data = [];
            let count = 0;
            if(type === 'DIRECT_BONUS') {
                data = await Transaction.find({$and: [{user_id: user_id},{transaction_type: 'DIRECT BONUS'}]}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({$and: [{user_id: user_id},{transaction_type: 'DIRECT BONUS'}]})
            } else if(type === 'CCT') {
                data = await Transaction.find({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL CORPORATE TOKEN'}]}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL CORPORATE TOKEN'}]})
            } else if(type === 'ALL') {
                data = await Transaction.find({user_id: user_id}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({user_id: user_id})
            } else if(type === 'ROI') {
                data = await Transaction.find({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL SUPER BONUS'}]}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL SUPER BONUS'}]})
            } else if(type === 'CARNIVAL_ROYALTY_BONUS') {
                data = await Transaction.find({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL ROYALTY BONUS'}]}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL ROYALTY BONUS'}]})
            } else if(type === 'CARNIVAL_SMART_BONUS') {
                data = await Transaction.find({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL SMART BONUS'}]}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL SMART BONUS'}]})
            } else if(type === 'CARNIVAL_RANK_REWARD') {
                data = await Transaction.find({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL RANK REWARD'}]}).skip(skip || 0).limit(limit || 10);
                count = await Transaction.countDocuments({$and: [{user_id: user_id},{transaction_type: 'CARNIVAL RANK REWARD'}]})
            }

            let user_name = await User.findOne({ user_id: user_id });
            data = data.map(userName => ({
                ...userName._doc,
                user_name: user_name.name
            }));
    
            return res.status(200).json({success: true, message: 'Transaction Fetched Successfully!!', data: data,total: count})
        } catch (error) {
            return res.status(500).json({success: false, message: error.message, data: []})
        }
    }
}