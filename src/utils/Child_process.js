const EventEmitter = require('node:events');
class MyEmitter extends EventEmitter { }
const myEmitter = new MyEmitter();

const cron = require('node-cron');
const moment = require('moment-timezone');

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
        const { ReferralController } = require('../controllers')


        // This will calculate daily once at 12:01 am (IST)
        async function superBonus() {
            try {
                console.log("inside super bonus function")
                // Fetch all staking first
                let staking = await Staking.find({ status: 'RUNNING', user_id: '247066' });

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
                                update: { $inc: { paid: interest } }
                            }
                        })

                        // store all transaction in transaction array
                        bulkTransactions.push({
                            user_id: stake.user_id,
                            id: stake.id,
                            amount: interest,
                            staking_id: stake._id,
                            currency: stake.currency,
                            transaction_type: 'SNG SUPER BONUS',
                            status: "COMPLETE"
                        })

                        bulkWallet.push({
                            updateOne: {
                                filter: { user_id: stake.user_id },
                                update: { $inc: { usdt_balance: interest } }
                            }
                        })

                        //SNG LEVEL BONUS
                        // find upline for this single user to distribute level bonus
                        let upline = await ReferralController.getUplineTeam(stake.id)
                        let direct = await Referral.find({ sponser_id: stake.id });
                        let direct_count = direct.length
                        console.log(direct_count, "Log of direct length");

                        console.log(upline, `UPLINE TEAM OF USER ID ${stake.id}`);

                        if (upline.length > 0) {
                            for await (const up of upline) {
                                console.log(up, direct_count, "Up logss and direct count...");

                                let level_bonus;
                                if (up.level == 1 && direct_count >= 1) {
                                    level_bonus = interest * 10 / 100;
                                } else if (up.level == 2 && direct_count >= 2) {
                                    level_bonus = interest * 8 / 100;
                                } else if (up.level == 3 && direct_count >= 3) {
                                    level_bonus = interest * 5 / 100;
                                } else if (up.level == 4 && direct_count >= 4) {
                                    level_bonus = interest * 4 / 100;
                                } else if ((up.level == 5 || up.level == 6 || up.level == 7) && direct_count >= 5) {
                                    level_bonus = interest * 3 / 100;
                                } else if ((up.level == 8 || up.level == 9 || up.level == 10) && direct_count >= 7) {
                                    level_bonus = interest * 2 / 100;
                                } else if ((up.level == 11 || up.level == 12 || up.level == 13) && direct_count >= 8) {
                                    level_bonus = interest * 1 / 100;
                                } else if ((up.level == 11 || up.level == 12 || up.level == 13) && direct_count >= 10) {
                                    level_bonus = interest * 0.5 / 100;
                                } else {
                                    console.log(up.level)
                                }

                                bulkWallet.push({
                                    updateOne: {
                                        filter: { user_id: up.user_id },
                                        update: { $inc: { usdt_balance: level_bonus } }
                                    }
                                })

                                bulkTransactions.push({
                                    user_id: up.user_id,
                                    id: up.id,
                                    amount: level_bonus,
                                    staking_id: stake._id,
                                    currency: stake.currency,
                                    transaction_type: 'SNG SMART BONUS',
                                    status: "COMPLETE"
                                })
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

                // Execute bulk operations
                if (bulkStak.length > 0) {
                    await Staking.bulkWrite(bulkStak);
                }

                // Insert transactions in bulk
                if (bulkTransactions.length > 0) {
                    await Transaction.insertMany(bulkTransactions);
                }

                if (bulkWallet.length > 0) {
                    await Wallets.bulkWrite(bulkWallet)
                }
                console.log('superBonus DONE')
                return true;
            } catch (error) {
                throw new Error(error.message);
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
                                    status: "COMPLETE"
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
                                status: "COMPLETE"
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
                                    from: stake.user_id
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

        // This will also calculate daily once at 12:01 am
        async function carnivalRankRewards() {
            try {
                // first fetch all staking
                let users = await Users.find();
                for await (const user of users) {
                    // for every user we have to check their staking
                    // find last transaction
                    let last = await Transaction.findOne({ $and: [{ user_id: user.user_id }, { transaction_type: 'CARNIVAL RANK REWARD' }] }).sort({ createdAt: -1 }).lean()
                    let staking = await Staking.find({ $and: [{ user_id: user.user_id }, { status: 'RUNNING' }] })
                    let selfbusiness = staking.length > 0 ? staking.reduce((sum, staking) => sum + staking.amount, 0) : 0
                    let directCount = await Referral.countDocuments({ sponser_id: user._id })

                    // console.log(selfbusiness, " : selfbusiness")

                    // now we have to check team business for this particular user;
                    let team = await ReferralController.getDownlineTeam3(user._id, user.last_rank_achieve)
                    // console.log(team, " : team : ")
                    if (team.length > 0) {
                        team.sort((a, b) => b.stakingAmount - a.stakingAmount)
                        // console.log(team)
                        let [first, second, ...rest] = team
                        let first_business = first?.stakingAmount === undefined ? 0 : first?.stakingAmount;

                        let second_business = second?.stakingAmount === undefined ? 0 : second?.stakingAmount;

                        let rest_business = rest.reduce((sum, staking) => sum + staking.stakingAmount, 0)
                        let total_business = (first_business + second_business + rest_business) - user.carry_forward_business
                        // console.log(user.user_id, " : user.user_id ",selfbusiness, " : selfbusiness ",first_business, " : first_business :", rest_business, " : rest_business ", second_business, " : second_business ", total_business , " : total_business")
                        let obj = {
                            user_id: user.user_id,
                            self: selfbusiness,
                            first_leg: first_business,
                            second_leg: second_business,
                            rest_legs: rest_business,
                            total: total_business,
                            directCount: directCount
                        }
                        console.log(obj)

                        if (selfbusiness >= (total_business * 25 / 100)) {
                            let ranks = Object.keys(user.ranks)
                            for await (const rank of ranks) {
                                let qualify1 = user.ranks[`${rank}`].team_business * 30 / 100;
                                let qualify2 = user.ranks[`${rank}`].team_business * 40 / 100;
                                // let required_business = user.ranks[`${rank}`].team_business
                                let status = user.ranks[`${rank}`].rank_status
                                let direct_required = user.ranks[`${rank}`].direct_required
                                let required_business = user.ranks[`${rank}`].team_business;
                                let carryForward = total_business > user.ranks[`${rank}`].team_business ? total_business - user.ranks[`${rank}`].team_business : 0
                                let rank_path = `ranks.${rank}.rank_status`

                                if (directCount >= direct_required && status === 'PENDING' && total_business >= required_business) {
                                    console.log(rank_path, " : rank_path")
                                    await Users.updateOne(
                                        { user_id: user.user_id },
                                        {
                                            $set: {
                                                current_rank: rank,
                                                [rank_path]: 'QUALIFIED',
                                            },
                                            $inc: {
                                                carry_forward_business: carryForward
                                            }
                                        }
                                    )
                                }
                                /* if(directCount >= direct_required && status === 'PENDING' && first_business >= qualify1 && second_business >= qualify1 && rest_business >= qualify2) {
                                    // transfer the rank bonus
                                    let rank_bonus = user.ranks[`${rank}`].rank_reward
                                    console.log(rank_bonus, " : rank_bonus")
                                    let up_balance = await Wallets.updateOne(
                                        {user_id: user.user_id},
                                        {
                                            $inc: {
                                                balance: rank_bonus
                                            }
                                        }
                                    )
                                    if(up_balance.modifiedCount > 0) {
                                        // create transaction for this
                                        let obj = {
                                            user_id: user.user_id,
                                            id: user._id,
                                            amount: rank_bonus,
                                            staking_id: null,
                                            currency: 'USDT',
                                            self: selfbusiness,
                                            first_leg: first_business,
                                            second_leg: second_business,
                                            rest_legs: rest_business,
                                            total: total_business,
                                            carry_forward_business: user.carry_forward_business,
                                            rank_achieved: rank,
                                            transaction_type: 'CARNIVAL RANK REWARD',
                                            status: "COMPLETE"
                                        }
                                        await Transaction.create(obj);
                                    }
                                } */
                            }
                        }
                    }
                    await Users.updateOne(
                        { user_id: user.user_id },
                        {
                            $set: {
                                last_rank_achieve: new Date(),
                            },
                        }
                    )
                }
            } catch (error) {
                console.log(error, " : Error in carnivalRankRewards")
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
        };

        // Schedule the cron job
        cron.schedule('24 11 * * *', () => {
            console.log('Starting....');
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