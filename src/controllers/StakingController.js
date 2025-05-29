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
            const { amount, phase } = req.body;

            // check if amount is greater then and equal to 25 or not
            if(amount < 25 && amount % 5 != 0) {
                return res.status(500).json({success: false, message: "You cannnot buy package below $25 & amount should be multiple of $5", data: []})
            }

            // check if user have enough balance in the wallet
            let userbalance = await Wallet.findOne({user_id: user_id});
            if(userbalance === null || userbalance.balance < amount) {
                return res.status(406).json({success: false, message: 'You dont have enough balance in the wallet', data: []})
            }

            // deduct balance from users wallet
            let deduct = await Wallet.updateOne(
                { user_id: user_id },
                {
                    $inc: {
                        balance: -amount
                    }
                }
            )
            if(deduct.modifiedCount > 0) {
                // Check if this is the user's first staking
                let existingStakes = await Staking.find({ user_id: user_id });
                let isFirstStaking = existingStakes.length === 0;

                // create a staking transaction
                let token = await Token.findOne({short_name: 'CCT'});
                let obj = {
                    user_id: user_id,
                    id: id,
                    amount: amount,
                    roi: 0.4,
                    currency: 'USDT',
                    total: amount * 2.5,
                    chain: 'BEP20',
                    phase: phase
                }
                let stake = await Staking.create(obj);

                // Update user's self-staking status
                let updateFields = { staking_status: 'ACTIVE' };
                if (isFirstStaking) {
                    updateFields.activation_date = new Date();
                }
                await Users.updateOne(
                    { user_id: user_id },
                    { $set: updateFields }
                );

                // CARNIVAL DIRECT BONUS
                // 5% Direct Bonus to sponser 
                let sponser = await Referral.findOne({user_id: id});
                if(sponser != null && sponser.sponser_id != null) {
                    console.log(sponser, " : SPONSER DATA")
                    // distribute direct bonus to sponsers wallet
                    let direct_bonus = amount * 5 / 100;

                    // transfer bonus to sponsers wallet
                    await Wallet.updateOne(
                        { user_id: sponser.sponser_code},
                        {
                            $inc: {
                                balance: direct_bonus
                            }
                        }
                    )

                    // create transaction for direct bonus for sponser
                    let obj = {
                        user_id: sponser.sponser_code,
                        id: sponser.sponser_id,
                        amount: direct_bonus,
                        staking_id: stake._id,
                        currency: 'USDT',
                        transaction_type: 'DIRECT BONUS',
                        status: "COMPLETED",
                        from: user_id
                    }

                    await Transaction.create(obj);
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
            let data = await Staking.find({user_id: user_id});
            return res.status(200).json({success: true, message: 'Staking Transaction Fetched!!', data: data})
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