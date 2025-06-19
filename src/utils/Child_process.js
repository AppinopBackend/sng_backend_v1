const EventEmitter = require('node:events');
class MyEmitter extends EventEmitter { }
const myEmitter = new MyEmitter();
const mongoose = require('mongoose');

const cron = require('node-cron');
const moment = require('moment-timezone');
const { logToDb, logRewardUser } = require('./Logger');

console.log('Cron job scheduled to run at 12:01 AM IST');


process.on('message', async (message) => {
    try {
        require('dotenv').config({ path: '../src/config/.env' });
        const config = require("../config/config");
        const { ENV } = process.env;
        require("../db/mongoose")(config["databases"][ENV])
        const Users = require('../models/User');
        const Staking = require('../models/Staking')
        const Transaction = require('../models/Transaction')
        const Token = require('../models/Token')
        const User = require('../models/User');
        const Wallets = require('../models/Wallet')
        const Referral = require('../models/Referral')
        const { ReferralController } = require('../controllers');
        const { getDownlineTeam2 } = require('../controllers/ReferralController');


        // This will calculate daily once at 12:01 am (IST) SNG ROI BONUS
        async function superBonus() {
            try {
                console.log("inside super bonus function")
                // Fetch all staking first
                let staking = await Staking.find({ status: 'RUNNING'  /*user_id: '424772' */ })

                const bulkStak = [];
                const bulkTransactions = [];
                const bulkWallet = [];
                for (const stake of staking) {
                    console.log(stake, "Log of Single Stake");

                    let totalpaid = (stake.paid + stake.amount);
                    console.log(totalpaid, " : Total Paid Value");
                    if (totalpaid < stake.total) {
                        // Calculate interest
                        let interest = stake.amount * stake.roi / 100;
                        console.log(interest, "interest");
                        // store all staking related operation in bulkOps
                        bulkStak.push({
                            updateOne: {
                                filter: { _id: stake._id },
                                update: { $inc: { paid: interest, roi_paid: interest } }
                            }
                        })

                        // store all transaction in transaction array
                        bulkTransactions.push({
                            user_id: stake.user_id,
                            id: stake.id,
                            amount: interest,
                            staking_id: stake._id,
                            currency: stake.currency,
                            income_type: 'sng_roi',
                            transaction_type: 'SNG SUPER BONUS (ROI INCOME)',
                            status: "COMPLETE",
                            package_amount: stake.amount,
                            description: `Daily ROI income of ${interest} ${stake.currency} credited for staking amount ${stake.amount} at ROI ${stake.roi}%`
                        })

                        bulkWallet.push({
                            updateOne: {
                                filter: { user_id: stake.user_id },
                                update: { $inc: { usdt_balance: interest } }
                            }
                        })

                        // ROI (super bonus) logging
                        await logRewardUser({
                            user_id: stake.user_id,
                            user_code: stake.user_code || '',
                            type: 'roi',
                            details: {
                                interest,
                                staking_id: stake._id,
                                amount: stake.amount,
                                roi: stake.roi,
                                currency: stake.currency,
                                description: `Daily ROI income of ${interest} ${stake.currency} credited for staking amount ${stake.amount} at ROI ${stake.roi}%`
                            }
                        });

                        //SNG LEVEL BONUS
                        // find upline for this single user to distribute level bonus
                        let upline = await ReferralController.getUplineTeam(stake.id); // Closest first
                        let direct = await Referral.find({ sponser_id: stake.id });
                        let direct_count = direct.length
                        // Only the closest 15 uplines are eligible
                        if (upline.length > 15) {
                            upline = upline.slice(0, 15); // Keep only the closest 15 uplines
                        }
                        for (let i = 0; i < upline.length; i++) {
                            const up = upline[i];
                            // Check if this upline user has required number of directs based on their level
                            let upDirects = await Referral.find({ sponser_code: up.user_id });
                            console.log(upDirects, ">>>>>>>>>>>UPDIRECTS")
                            let hasRequiredDirects = false;
                            let level_bonus;
                            console.log(hasRequiredDirects, ">>>>>>>>>>>>>>>>>>>>>>>>>>>True OR false")
                            // Check if user meets the minimum direct requirement for their level
                            if (up.level === 1 && upDirects.length >= 1) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 10 / 100;
                            } else if (up.level === 2 && upDirects.length >= 2) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 8 / 100;
                            } else if (up.level === 3 && upDirects.length >= 3) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 5 / 100;
                            } else if (up.level === 4 && upDirects.length >= 4) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 4 / 100;
                            } else if ((up.level === 5 || up.level === 6 || up.level === 7) && upDirects.length >= 5) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 3 / 100;
                            } else if ((up.level === 8 || up.level === 9 || up.level === 10) && upDirects.length >= 7) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 2 / 100;
                            } else if ((up.level === 11 || up.level === 12 || up.level === 13) && upDirects.length >= 8) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 1 / 100;
                            } else if ((up.level === 14 || up.level === 15) && upDirects.length >= 10) {
                                hasRequiredDirects = true;
                                level_bonus = interest * 0.5 / 100;
                            }
                            console.log(level_bonus, ">................>>>>>>>level bonus outside")

                            if (hasRequiredDirects && level_bonus !== undefined) {
                                console.log(level_bonus, ">................>>>>>>>level bonus")

                                // Find the latest staking record for the upline user
                                const uplineStaking = await Staking.findOne({ id: up.id }).sort({ createdAt: -1 });

                                if (uplineStaking) {
                                    // If upline has a staking record, update it
                                    bulkStak.push({
                                        updateOne: {
                                            filter: { _id: uplineStaking._id },
                                            update: { $inc: { level_bonus_paid: level_bonus, paid: level_bonus } }
                                        }
                                    });
                                } else {
                                    // If upline has no staking record, create a transaction record for the level bonus
                                    await Transaction.create({
                                        user_id: up.user_id,
                                        id: up.id,
                                        amount: level_bonus,
                                        currency: 'USDT',
                                        income_type: 'sng_level',
                                        transaction_type: 'LEVEL BONUS',
                                        status: "COMPLETED",
                                        from: stake.user_id,
                                        from_user_name: stake.user_name,
                                        package_amount: stake.amount,
                                        description: `Level ${up.level} bonus from downline staking`
                                    });
                                }

                                bulkWallet.push({
                                    updateOne: {
                                        filter: { user_id: up.user_id },
                                        update: { $inc: { usdt_balance: level_bonus } }
                                    }
                                });
                                bulkTransactions.push({
                                    user_id: up.user_id,
                                    id: up.id,
                                    amount: level_bonus,
                                    staking_id: stake._id,
                                    currency: stake.currency,
                                    income_type: 'sng_level',
                                    transaction_type: 'SNG SMART BONUS (LEVEL INCOME)',
                                    status: "COMPLETE",
                                    level: up.level,
                                    package_amount: stake.amount,
                                    from_user_id: stake.user_id,
                                    from_user_name: stake.user_id,
                                    description: `Level ${up.level} income of ${level_bonus} ${stake.currency} credited from downline user ${stake.user_id} staking ${stake.amount}`
                                });

                                // Level income logging
                                await logRewardUser({
                                    user_id: up.user_id,
                                    user_code: up.user_code || '',
                                    type: 'levelIncome',
                                    details: {
                                        level: up.level,
                                        level_bonus,
                                        from_user_id: stake.user_id,
                                        from_user_name: stake.user_name,
                                        staking_id: stake._id,
                                        amount: stake.amount,
                                        roi: stake.roi,
                                        currency: stake.currency,
                                        description: `Level ${up.level} income of ${level_bonus} ${stake.currency} credited from downline user ${stake.user_id} staking ${stake.amount}`
                                    }
                                });
                            }
                        }
                    } else {
                        console.log("Inside else condition in super bonus")
                        // store all staking related operation in bulkStak
                        bulkStak.push({
                            updateOne: {
                                filter: { _id: stake._id },
                                update: { $set: { status: 'COMPLETE' } }
                            }
                        })
                    }
                }
                // console.log(bulkStak, " : bulkStak")
                // console.log(bulkTransactions, " : bulkTransactions")
                // console.log(bulkWallet, " : bulkWallet")
                // Execute bulk operations
                if (bulkStak.length > 0) await Staking.bulkWrite(bulkStak);

                // Insert transactions in bulk
                if (bulkTransactions.length > 0) await Transaction.insertMany(bulkTransactions);

                if (bulkWallet.length > 0) await Wallets.bulkWrite(bulkWallet)

                console.log('SuperBonus Done...');
                return true;
            } catch (error) {
                throw new Error(error, ": Error");
            }
        }

        // This will calculate daily once at 12:01 am but distributed on weekly basis 
        // code when CCT will be generated on first day
        // async function carnivalCorporateToken() {
        //     try {
        //         // fetch token details
        //         console.log("inside carnival corporate token bonus function")
        //         let token = await Token.findOne({short_name: 'CCT'});
        //         let staking = await Staking.find({status: 'RUNNING'})

        //         const bulkTransactions = [];
        //         const bulkStak = [];
        //         const bulkWallet = []
        //         for await (const stake of staking) {
        //             // check last transaction date;
        //             let last = await Transaction.find(
        //                 {
        //                     $and: [
        //                         { id: stake.id },
        //                         {staking_id: stake._id},
        //                         {currency: 'CCT'}
        //                     ]
        //                 }
        //             ).sort({createdAt: -1}).limit(1);

        //             if(last.length > 0) {
        //                 let lastDate = new Date(last[0].createdAt); // Convert to Date object if not already
        //                 let currentDate = new Date();

        //                 // Calculate the difference in milliseconds
        //                 let diffInMilliseconds = currentDate - lastDate;

        //                 // Convert milliseconds to days
        //                 let diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24);

        //                 if(diffInDays >= 7) {
        //                     let interest = stake.amount * token.cct_roi / 100;
        //                     interest = interest / token.cct_price
        //                     console.log(interest, ": interest")
        //                     // update this interest into this staking
        //                     bulkStak.push({
        //                         updateOne: {
        //                             filter: { _id: stake._id },
        //                             update: { $inc: { cctpaid: interest }}
        //                         }
        //                     })
        //                     bulkTransactions.push({
        //                         user_id: stake.user_id,
        //                         id: stake.id,
        //                         amount: interest,
        //                         staking_id: stake._id,
        //                         currency: 'CCT',
        //                         transaction_type: 'CARNIVAL CORPORATE TOKEN',
        //                         status: "COMPLETE"
        //                     })
        //                     bulkWallet.push({
        //                         updateOne: {
        //                             filter: { user_id: stake.user_id },
        //                             update: { $inc: { cct_balance: interest }}
        //                         }
        //                     })
        //                 }
        //             } else if(last.length === 0) {
        //                 let interest = stake.amount * token.cct_roi / 100;
        //                 interest = interest / token.cct_price
        //                     console.log(interest, ": interest")
        //                 bulkStak.push({
        //                     updateOne: {
        //                         filter: { _id: stake._id },
        //                         update: { $inc: { cctpaid: interest }}
        //                     }
        //                 })
        //                 bulkTransactions.push({
        //                     user_id: stake.user_id,
        //                     id: stake.id,
        //                     amount: interest,
        //                     staking_id: stake._id,
        //                     currency: 'CCT',
        //                     transaction_type: 'CARNIVAL CORPORATE TOKEN',
        //                     status: "COMPLETE"
        //                 })
        //                 bulkWallet.push({
        //                     updateOne: {
        //                         filter: { user_id: stake.user_id },
        //                         update: { $inc: { cct_balance: interest }}
        //                     }
        //                 })
        //             }
        //         }
        //         // Execute bulk operations
        //         if (bulkStak.length > 0) {
        //             await Staking.bulkWrite(bulkStak);
        //         }

        //         // Insert transactions in bulk
        //         if (bulkTransactions.length > 0) {
        //             await Transaction.insertMany(bulkTransactions);
        //         }

        //         if(bulkWallet.length > 0) {
        //             await Wallets.bulkWrite(bulkWallet)
        //         }
        //         console.log('carnivalCorporateToken DONE')
        //         return true
        //     } catch (error) {
        //         throw new Error(error.message)
        //     }
        // }

        //Code for generating CCT on 7th day after Staking Creation


        // This will calculate daily once at 12:01 am but distributed on weekly basis 
        // code when CCT will be generated on seventh day
        async function carnivalCorporateToken() {
            try {
                // fetch token details
                console.log("inside carnival corporate token bonus function");
                let token = await Token.findOne({ short_name: 'CCT' });
                let staking = await Staking.find({ status: 'RUNNING' });

                const bulkTransactions = [];
                const bulkStak = [];
                const bulkWallet = [];

                for await (const stake of staking) {
                    // Fetch the user to get the activation_date
                    let user = await User.findOne({ user_id: 'CARN919175' });
                    console.log("user data:", user);
                    if (!user || !user.activation_date) {
                        console.log(`User with id ${stake.user_id} does not have an activation_date`);
                        continue; // Skip this stake if user or activation_date is not found
                    }

                    let activationDate = new Date(user.activation_date);
                    console.log("activationDate:", activationDate);
                    let currentDate = new Date();
                    console.log("currentDate:", currentDate);

                    // Check the last transaction date
                    let last = await Transaction.find(
                        {
                            $and: [
                                { id: stake.id },
                                { staking_id: stake._id },
                                { currency: 'CCT' }
                            ]
                        }
                    ).sort({ createdAt: -1 }).limit(1);
                    console.log("last:", last);

                    let referenceDate;
                    if (last.length > 0) {
                        referenceDate = new Date(last[0].createdAt);
                    } else {
                        referenceDate = activationDate;
                    }
                    console.log("referenceDate:", referenceDate);

                    let diffInMilliseconds = currentDate - referenceDate;
                    let diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24);
                    console.log("diffInDays:", diffInDays);
                    // Only proceed if at least 7 days have passed since staking start date
                    if (diffInDays >= 7) {
                        // console.log(": INSIDE DIFFERENCE IN DAYS CONDITION");
                        let interest = stake.amount * token.cct_roi / 100;
                        interest = interest / token.cct_price;
                        console.log(interest, ": interest");

                        // Check if there has been a previous CCT transaction for this staking
                        if (last.length > 0) {
                            let lastDate = new Date(last[0].createdAt); // Convert to Date object if not already
                            diffInMilliseconds = currentDate - lastDate;
                            diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24);
                            console.log("diffInDays:", diffInDays);

                            // console.log(": PREVIOUS CCT CONDITION");
                            // console.log(diffInDays, ": DIFFERENCE IN DAYS");

                            if (diffInDays >= 7) {
                                // Update interest and record transaction if 7 days have passed since last transaction
                                bulkStak.push({
                                    updateOne: {
                                        filter: { _id: stake._id },
                                        update: { $inc: { cctpaid: interest } }
                                    }
                                });
                                bulkTransactions.push({
                                    user_id: stake.user_id,
                                    id: stake.id,
                                    amount: interest,
                                    staking_id: stake._id,
                                    currency: 'CCT',
                                    transaction_type: 'CARNIVAL CORPORATE TOKEN',
                                    status: "COMPLETE",
                                    package_name: stake.rank,
                                    package_amount: stake.amount
                                });
                                bulkWallet.push({
                                    updateOne: {
                                        filter: { user_id: stake.user_id },
                                        update: { $inc: { cct_balance: interest } }
                                    }
                                });
                            }
                        } else {
                            console.log(": INSIDE NO PREVIOUS CCT CONDITION");
                            // If no previous CCT transaction, generate the first one after 7 days from staking start date
                            bulkStak.push({
                                updateOne: {
                                    filter: { _id: stake._id },
                                    update: { $inc: { cctpaid: interest } }
                                }
                            });
                            bulkTransactions.push({
                                user_id: stake.user_id,
                                id: stake.id,
                                amount: interest,
                                staking_id: stake._id,
                                currency: 'CCT',
                                transaction_type: 'CARNIVAL CORPORATE TOKEN',
                                status: "COMPLETE",
                                package_name: stake.rank,
                                package_amount: stake.amount
                            });
                            bulkWallet.push({
                                updateOne: {
                                    filter: { user_id: stake.user_id },
                                    update: { $inc: { cct_balance: interest } }
                                }
                            });
                        }
                    }
                }

                // Execute bulk operations
                if (bulkStak.length > 0) {
                    await Staking.bulkWrite(bulkStak);
                }

                // Insert transactions in bulk
                if (bulkTransactions.length > 0) {
                    await Transaction.insertMany(bulkTransactions);
                }

                if (bulkWallet.length > 0) {
                    await Wallets.bulkWrite(bulkWallet);
                }

                console.log('carnivalCorporateToken DONE');
                return true;
            } catch (error) {
                throw new Error(error.message);
            }
        }


        // This will calculate daily once at 12:01 am but distributed on monthly basis
        async function carnivalRoyaltyBonus() {
            try {
                // Fetch all staking first
                console.log("inside carnival royalty bonus function")
                let staking = await Staking.find({ status: 'RUNNING' });

                const bulkTransactions = [];
                const bulkWallet = [];

                // Fetch the user to get the activation_date
                let user = await User.findOne({ user_id: "CARN919175" });
                // console.log("user:", user);
                if (!user || !user.activation_date) {
                    console.log(`User with id CARN919175 does not have an activation_date`);
                    return false; // Exit if user or activation_date is not found
                }

                let activationDate = new Date(user.activation_date);
                console.log("activationDate:", activationDate);

                for await (const stake of staking) {
                    // find upline for this single user to distribute level bonus
                    let upline = await ReferralController.getUplineTeam(stake.id)
                    console.log(upline, "DATA OF UPLINE IN ROYALITY BONUS");
                    if (upline.length > 0) {
                        for await (const up of upline) {
                            // check last transaction date;
                            let last = await Transaction.find(
                                {
                                    $and: [
                                        { id: stake.id },
                                        { staking_id: stake._id },
                                        { transaction_type: 'CARNIVAL ROYALTY BONUS' }
                                    ]
                                }
                            ).sort({ createdAt: -1 }).limit(1);
                            console.log(last, " : last")


                            let referenceDate;
                            if (last.length > 0) {
                                referenceDate = new Date(last[0].createdAt);
                            } else {
                                referenceDate = activationDate;
                            }
                            console.log("referenceDate:", referenceDate);

                            let currentDate = new Date();
                            let diffInMilliseconds = currentDate - referenceDate;
                            let diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24);
                            console.log("diffInDays:", diffInDays);

                            if (diffInDays >= 30) {
                                let royalty_bonus;
                                if (up.level === 1) {
                                    royalty_bonus = stake.amount * 2 / 100;
                                } else if (up.level === 2) {
                                    royalty_bonus = stake.amount * 1 / 100;
                                } else if (up.level === 3) {
                                    royalty_bonus = stake.amount * 0.5 / 100;
                                } else if (up.level === 4) {
                                    royalty_bonus = stake.amount * 0.25 / 100;
                                } else if (up.level >= 5 && up.level <= 10) {
                                    royalty_bonus = stake.amount * 0.20 / 100;
                                } else if (up.level >= 11 && up.level <= 20) {
                                    royalty_bonus = stake.amount * 0.15 / 100;
                                } else if (up.level >= 21 && up.level <= 30) {
                                    royalty_bonus = stake.amount * 0.10 / 100;
                                } else {
                                    console.log(up.level);
                                    continue;
                                }

                                bulkWallet.push({
                                    updateOne: {
                                        filter: { user_id: up.user_id },
                                        update: { $inc: { balance: royalty_bonus } }
                                    }
                                })

                                bulkTransactions.push({
                                    user_id: up.user_id,
                                    id: stake.id,
                                    amount: royalty_bonus,
                                    staking_id: stake._id,
                                    currency: stake.currency,
                                    transaction_type: 'CARNIVAL ROYALTY BONUS',
                                    status: "COMPLETE",
                                    from: stake.user_id,
                                    package_name: stake.rank,
                                    package_amount: stake.amount
                                })
                            }
                        }
                    }
                }

                // Insert transactions in bulk
                if (bulkTransactions.length > 0) {
                    await Transaction.insertMany(bulkTransactions);
                }

                if (bulkWallet.length > 0) {
                    await Wallets.bulkWrite(bulkWallet)
                }
                console.log('carnivalRoyaltyBonus DONE')
                return true
            } catch (error) {
                console.log(error, " : error in carnival royalty bonus")
            }
        }

        // Reward tiers configuration
        const REWARD_TIERS = {
            2500: { reward: 100, description: '100 USDT' },
            5000: { reward: 250, description: '250 USDT' },
            10000: { reward: 500, description: '500 USDT or Goa Trip (Indian)' },
            20000: { reward: 1100, description: '1100 USDT or Bangkok Trip' },
            50000: { reward: 2500, description: '2500 USDT or Dubai Trip' },
            100000: { reward: 5000, description: '5000 USDT or Singapore Trip or Alto Car' },
            250000: { reward: 11000, description: '11000 USDT or Vietnam Trip or Swift Car' },
            500000: { reward: 21000, description: '21000 USDT or Tata Nexon Car' },
            1000000: { reward: 50000, description: '50000 USDT or Tata Harrier' },
            15000000: { reward: 100000, description: '100000 USDT or Toyota Fortuner' }
        };

        // Function to calculate total downline business recursively
        const calculateTotalDownlineBusiness = async (userId) => {
            // Get all direct referrals of this user
            const downlines = await Referral.find({ sponser_id: userId });
            
            let totalDownlineBusiness = 0;
            let countedStakingIds = [];
            
            // For each downline
            for (const downline of downlines) {
                // Get their staking amounts that haven't been counted
                const stakingAmounts = await Staking.find({
                    id: downline.user_id,
                    rank_reward_counted: false,
                    status: "RUNNING"
                });
                
                // Add their staking to total
                const downlineStaking = stakingAmounts.reduce((sum, staking) => sum + (staking.amount || 0), 0);
                totalDownlineBusiness += downlineStaking;
                
                // Store the staking IDs that were counted
                countedStakingIds = [...countedStakingIds, ...stakingAmounts.map(stake => stake._id)];
                
                // Recursively get their downline business
                const { total: nestedTotal, stakingIds: nestedStakingIds } = await calculateTotalDownlineBusiness(downline.user_id);
                totalDownlineBusiness += nestedTotal;
                countedStakingIds = [...countedStakingIds, ...nestedStakingIds];
            }
            
            return { total: totalDownlineBusiness, stakingIds: countedStakingIds };
        };

        async function carnivalRankRewards() {
            try {
                // Get all users with more than 2 direct referrals
                const users = await Users.find({ direct_referrals: { $gte: 2 } });
                console.log(`Found ${users.length} users with more than 2 direct referrals`);
                logToDb('info', 'Found users with more than 2 direct referrals', { count: users.length });

                let allRewardedStakingIds = [];

                for (const user of users) {
                    console.log(user.user_id, " : user")
                    logToDb('info', 'Processing user', { user_id: user.user_id });
                    // Get direct referrals
                    const directRefs = await Referral.find({ sponser_id: user._id });
                    console.log(directRefs, " : directRefs")
                    logToDb('info', 'Direct referrals', { directRefs });

                    // Calculate total business for each direct referral
                    const directRefsIncome = await Promise.all(directRefs.map(async (ref) => {
                        // Get only uncounted staking amounts for the direct
                        const directStakingAmounts = await Staking.find({
                            id: ref.user_id,
                            rank_reward_counted: false,
                            status: "RUNNING"
                        });

                        // Log individual staking amounts
                        console.log(`\n=== Staking Details for User ${ref.user_code} ===`);
                        directStakingAmounts.forEach(stake => {
                            console.log(`Staking ID: ${stake._id}`);
                            console.log(`Amount: ${stake.amount} USDT`);
                            console.log(`Package: ${stake.rank}`);
                            console.log(`Created At: ${stake.createdAt}`);
                            console.log('---');
                        });

                        const selfStaking = directStakingAmounts.reduce((sum, staking) => sum + (staking.amount || 0), 0);
                        
                        // Get only uncounted staking amounts for downline
                        const { total: downlineStaking, stakingIds: downlineStakingIds } = await calculateTotalDownlineBusiness(ref.user_id);
                        const total = selfStaking + downlineStaking;

                        console.log(`\n=== Business Summary for User ${ref.user_code} ===`);
                        console.log(`Self Staking: ${selfStaking} USDT`);
                        console.log(`Downline Staking: ${downlineStaking} USDT`);
                        console.log(`Total Business: ${total} USDT`);
                        console.log('================================\n');

                        return {
                            user_id: ref.user_id,
                            user_code: ref.user_code,
                            selfStaking,
                            downlineStaking,
                            total,
                            stakingIds: [...directStakingAmounts.map(stake => stake._id), ...downlineStakingIds],
                            stakingDetails: directStakingAmounts.map(stake => ({
                                id: stake._id,
                                amount: stake.amount,
                                package: stake.rank,
                                createdAt: stake.createdAt
                            }))
                        };
                    }));

                    console.log("\n=== Direct Referrals Income Summary ===");
                    directRefsIncome.forEach(ref => {
                        console.log(`\nUser ${ref.user_code}:`);
                        console.log(`Self Staking: ${ref.selfStaking} USDT`);
                        console.log(`Downline Staking: ${ref.downlineStaking} USDT`);
                        console.log(`Total: ${ref.total} USDT`);
                        console.log('Staking Details:');
                        ref.stakingDetails.forEach(stake => {
                            console.log(`- ID: ${stake.id}`);
                            console.log(`  Amount: ${stake.amount} USDT`);
                            console.log(`  Package: ${stake.package}`);
                            console.log(`  Created: ${stake.createdAt}`);
                        });
                    });
                    console.log('================================\n');

                    // Find the highest earning direct referral
                    const highestEarningDirect = directRefsIncome.reduce((highest, current) => 
                        current.total > highest.total ? current : highest
                    , directRefsIncome[0]);

                    console.log(highestEarningDirect, " : highestEarningDirect (self+downline)");

                    // Calculate 50% of highest earning direct's business
                    const highestEarningSum = highestEarningDirect.total;
                    const fiftyPercentOfHighest = highestEarningSum * 0.5;

                    // Calculate total business for other directs
                    const otherDirectsSum = directRefsIncome
                        .filter(ref => ref.user_id !== highestEarningDirect.user_id)
                        .reduce((sum, ref) => sum + ref.total, 0);

                    // Get previous remaining amounts
                    const highestTeamRemaining = user.highest_team_remaining_business || 0;
                    const otherTeamRemaining = user.other_team_remaining_business || 0;

                    // Add remaining amounts to current calculation
                    const totalHighestTeam = fiftyPercentOfHighest + highestTeamRemaining;
                    const totalOtherTeam = otherDirectsSum + otherTeamRemaining;

                    // Initialize remaining amounts
                    let highestRemainingAmount = 0;
                    let otherRemainingAmount = 0;

                    console.log("\n=== DEBUG VALUES ===");
                    console.log("Previous Remaining - Highest:", highestTeamRemaining, "Other:", otherTeamRemaining);
                    console.log("Current Business - Highest:", fiftyPercentOfHighest, "Other:", otherDirectsSum);
                    console.log("Total Business - Highest:", totalHighestTeam, "Other:", totalOtherTeam);

                    // Find the highest tier that user qualifies for
                    let applicableTier = null;
                    const userHighestAchieved = parseInt(user.highest_sng_reward_achieved || '0');
                    
                    for (const [threshold, tier] of Object.entries(REWARD_TIERS).sort((a, b) => b[0] - a[0])) {
                        const thresholdValue = parseInt(threshold);
                        
                        // Skip if this tier is lower than or equal to what user has already achieved
                        if (thresholdValue <= userHighestAchieved) {
                            console.log(`Skipping tier ${thresholdValue} as user already achieved ${userHighestAchieved}`);
                            continue;
                        }
                        
                        const tierFiftyPercent = thresholdValue * 0.5;
                        
                        console.log("\n=== DEBUG VALUES ===");
                        console.log("User's Highest Achieved:", userHighestAchieved);
                        console.log("Current Tier Threshold:", thresholdValue);
                        console.log("Fifty Percent Threshold:", tierFiftyPercent);
                        console.log("Highest Earning Sum:", highestEarningSum);
                        console.log("Fifty Percent of Highest:", fiftyPercentOfHighest);
                        console.log("Total Highest Team:", totalHighestTeam);
                        console.log("Other Directs Sum:", otherDirectsSum);
                        console.log("Other Team Full Amount:", totalOtherTeam);

                        if (totalHighestTeam >= tierFiftyPercent && totalOtherTeam >= tierFiftyPercent) {
                            applicableTier = { threshold: thresholdValue, ...tier };
                            break;
                        }
                    }

                    if (applicableTier) {
                        const tierFiftyPercent = applicableTier.threshold * 0.5;
                        
                        // For Highest Team
                        if (totalHighestTeam > tierFiftyPercent) {
                            highestRemainingAmount = totalHighestTeam - tierFiftyPercent;
                        }
                        
                        // For Other Team
                        if (totalOtherTeam > tierFiftyPercent) {
                            otherRemainingAmount = totalOtherTeam - tierFiftyPercent;
                        }

                        console.log("\n=== REMAINING AMOUNTS CALCULATION ===");
                        console.log("Tier Threshold:", applicableTier.threshold);
                        console.log("Tier Fifty Percent:", tierFiftyPercent);
                        console.log("Highest Team 50%:", fiftyPercentOfHighest);
                        console.log("Other Team Total:", otherDirectsSum);
                        console.log("Highest Remaining:", highestRemainingAmount);
                        console.log("Other Remaining:", otherRemainingAmount);

                        // Create reward transaction
                        const transaction = await Transaction.create({
                            id: user.user_id,
                            user_id: user.user_id,
                            transaction_type: 'CARNIVAL RANK REWARD',
                            income_type: 'sng_rewards',
                            amount: applicableTier.reward,
                            staking_id: null,
                            from: null,
                            rank_achieved: applicableTier.description,
                            currency: 'USDT',
                            self: applicableTier.reward,
                            total: applicableTier.reward,
                            status: 'COMPLETE',
                            package_name: applicableTier.description,
                            package_amount: applicableTier.reward,
                            description: `${highestTeamRemaining} USDT`,
                            metadata: {
                                threshold_achieved: applicableTier.threshold.toString(),
                                fifty_percent_threshold: tierFiftyPercent,
                                direct_refs_count: directRefs.length,
                                highest_earning_user_id: highestEarningDirect.user_code,
                                highest_earning_total: highestEarningDirect.total,
                                highest_earning_self: highestEarningDirect.selfStaking,
                                highest_earning_team: highestEarningDirect.downlineStaking,
                                fifty_percent_of_highest: fiftyPercentOfHighest,
                                highest_team_remaining: highestTeamRemaining,
                                other_directs_sum: otherDirectsSum,
                                other_team_remaining: otherTeamRemaining,
                                new_highest_remaining: highestRemainingAmount,
                                new_other_remaining: otherRemainingAmount
                            }
                        });

                        if (transaction) {
                            // Update user's remaining amounts
                            await Users.findByIdAndUpdate(user._id, {
                                highest_team_remaining_business: highestRemainingAmount,
                                other_team_remaining_business: otherRemainingAmount,
                                highest_sng_reward_achieved: applicableTier.threshold.toString()
                            });

                            // Instead of updating here, collect the IDs
                            allRewardedStakingIds.push(...directRefsIncome.reduce((ids, ref) => {
                                return [...ids, ...ref.stakingIds];
                            }, []));
                            console.log(`Reward of ${applicableTier.reward} USDT given to user ${user.user_id}`);
                            console.log(`Updated remaining amounts - Highest: ${highestRemainingAmount}, Other: ${otherRemainingAmount}`);
                        }
                    } else {
                        // If no reward given, keep existing remaining amounts unchanged
                        console.log("No applicable tier found for user - keeping existing remaining amounts unchanged");
                        console.log("Current remaining amounts - Highest:", user.highest_team_remaining_business, "Other:", user.other_team_remaining_business);
                    }
                    console.log(applicableTier, " : applicableTier");
                    console.log(highestRemainingAmount, " : highestRemainingAmount");
                    console.log(otherRemainingAmount, " : otherRemainingAmount");
                    console.log(user.user_id, " : user.user_id");
                }

                // After all users are processed, update all rewarded staking IDs
                if (allRewardedStakingIds.length > 0) {
                    await Staking.updateMany(
                        {
                            _id: { $in: allRewardedStakingIds },
                            rank_reward_counted: false,
                            status: "RUNNING"
                        },
                        {
                            $set: { rank_reward_counted: true }
                        }
                    );
                }

                console.log('Carnival Rank Rewards distribution completed');
                return true;
            } catch (error) {
                console.error('Error in carnivalRankRewards:', error);
                throw error;
            }
        }

        //Cron Configurations
        // Function to run at 12:01 AM IST
        const task = async () => {
            console.log(`Cron job executed at ${moment().tz('Asia/Kolkata').format()}`);

            // Add your task logic here
            await superBonus();
            // await carnivalRoyaltyBonus();
            // await carnivalCorporateToken();
            await carnivalRankRewards();
        };

        // Schedule the cron job
        // cron.schedule("1 0 * * *", () => {
            //  cron.schedule("0 * * * *", () => {
        cron.schedule("*/50 * * * * *", () => {
            console.log('Starting....');
            logToDb('info', 'Starting....');
            task(); 
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata"
        });


        myEmitter.on('distribute', async () => {
            // await superBonus();
            // await carnivalRoyaltyBonus();
            // await carnivalCorporateToken();
            // await carnivalRankRewards();
        })
        myEmitter.emit('distribute');
    } catch (error) {
        console.log(error.message, " : Some error occured in child process function")
    }
})

process.on('disconnect', async () => {
    console.log('Child process is disconnected. Exiting...');
    process.stdin.pause();
    process.kill(process.pid);
    process.exit(0);
});