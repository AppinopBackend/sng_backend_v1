const EventEmitter = require('node:events');
class MyEmitter extends EventEmitter { }
const myEmitter = new MyEmitter();
const mongoose = require('mongoose');

const cron = require('node-cron');
const moment = require('moment-timezone');
const { logToDb, logRewardUser } = require('./Logger');

const Referral = require('../models/Referral');

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


        async function superBonus() {
            const runId = `run_${Date.now()}`;
            const startedAt = new Date();
            let finishedAt = null;
            let status = 'started';
            let errorMsg = null;
            const logs = [];
            const summary = {
                roiCredited: 0,
                roiUsers: 0,
                levelBonuses: 0,
                levelBonusUsers: 0,
                completedStakes: 0,
                errors: []
            };
            function addLog(msg, meta = {}) {
                const entry = { timestamp: new Date().toISOString(), msg, ...meta };
                logs.push(entry);
                console.log(msg, meta);
            }
            try {
                addLog(`[SuperBonus][${runId}] ===== STARTING PROCESS =====`);
                addLog(`[SuperBonus][${runId}] Fetching all active stakings at ${startedAt.toISOString()}`);

                // 1. Fetch all active stakings, sorted by createdAt (oldest first)
                const stakingRecords = await Staking.find({ status: 'RUNNING' }).sort({ createdAt: 1 });
                addLog(`[SuperBonus][${runId}] Total RUNNING stakings found: ${stakingRecords.length}`);

                const bulkStak = [];
                const bulkTransactions = [];
                const bulkWallet = [];

                // Track users for whom we've already processed level income this run
                const levelIncomeProcessedUsers = new Set();

                // 2. Process ALL RUNNING stakings for ROI
                for (const stake of stakingRecords) {
                    const totalPaid = stake.paid;
                    if (totalPaid < stake.total) {
                        // 3. Calculate ROI for the staker
                        const interest = stake.amount * stake.roi / 100;
                        addLog(`[SuperBonus][ROI][${runId}] Processing staking: _id=${stake._id}, user_id=${stake.user_id}, amount=${stake.amount}, roi=${stake.roi}, interest=${interest}`);

                        // Add ROI to staker
                        bulkStak.push({
                            updateOne: {
                                filter: { _id: stake._id },
                                update: { $inc: { paid: interest, roi_paid: interest } }
                            }
                        });

                        // Add ROI transaction for the staker
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
                        });

                        // Update wallet for the staker
                        bulkWallet.push({
                            updateOne: {
                                filter: { user_id: stake.user_id },
                                update: { $inc: { usdt_balance: interest } }
                            }
                        });

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
                        addLog(`[SuperBonus][ROI][${runId}] Credited ROI income to user_id=${stake.user_id}, amount=${interest} ${stake.currency}`);
                        summary.roiCredited += interest;
                        summary.roiUsers += 1;

                        // 4. Process downline-based level income for this staker
                        // Only process level income for the first RUNNING staking per user per run
                        if (!levelIncomeProcessedUsers.has(stake.user_id)) {
                            addLog(`[SuperBonus][LevelIncome][${runId}] Processing level income for user_id=${stake.user_id}, stake_id=${stake._id}`);
                            // Find all downlines up to 15 levels
                            const downlines = await getDownlines(stake.id, 15);
                            addLog(`[SuperBonus][LevelIncome][${runId}] Found ${downlines.length} downlines for user_id=${stake.user_id}`);
                            for (const { userId: downlineId, level, user_code } of downlines) {
                                // For each staking of the downline
                                const downlineStakings = await Staking.find({ id: downlineId, status: 'RUNNING' });
                                addLog(`[SuperBonus][LevelIncome][${runId}] Downline user_id=${downlineId}, level=${level}, active stakings=${downlineStakings.length}`);
                                for (const downlineStake of downlineStakings) {
                                    // Check if staker qualifies for this level
                                    // Count only directs with RUNNING staking
                                    const directRefs = await Referral.find({ sponser_code: stake.user_id });
                                    let activeDirects = 0;
                                    for (const ref of directRefs) {
                                        const hasActiveStaking = await Staking.exists({ user_id: ref.user_code, status: 'RUNNING' });
                                        if (hasActiveStaking) activeDirects++;
                                    }
                                    let qualifies = false;
                                    let requirementMsg = '';
                                    if (level === 1 && activeDirects >= 1) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 1+)`;
                                    } else if (level === 2 && activeDirects >= 2) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 2+)`;
                                    } else if (level === 3 && activeDirects >= 3) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 3+)`;
                                    } else if (level === 4 && activeDirects >= 4) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 4+)`;
                                    } else if ((level >= 5 && level <= 7) && activeDirects >= 5) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 5+)`;
                                    } else if ((level >= 8 && level <= 10) && activeDirects >= 7) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 7+)`;
                                    } else if ((level >= 11 && level <= 13) && activeDirects >= 8) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 8+)`;
                                    } else if ((level === 14 || level === 15) && activeDirects >= 10) {
                                        qualifies = true;
                                        requirementMsg = `qualified: has ${activeDirects} active directs (needs 10+)`;
                                    } else {
                                        requirementMsg = `NOT qualified: has ${activeDirects} active directs (needs more for level ${level})`;
                                    }
                                    if (qualifies) {
                                        // Calculate bonus (same as before)
                                        const downlineInterest = downlineStake.amount * downlineStake.roi / 100;
                                        let levelBonus = 0;
                                        if (level === 1) levelBonus = downlineInterest * 10 / 100;
                                        else if (level === 2) levelBonus = downlineInterest * 8 / 100;
                                        else if (level === 3) levelBonus = downlineInterest * 5 / 100;
                                        else if (level === 4) levelBonus = downlineInterest * 4 / 100;
                                        else if (level >= 5 && level <= 7) levelBonus = downlineInterest * 3 / 100;
                                        else if (level >= 8 && level <= 10) levelBonus = downlineInterest * 2 / 100;
                                        else if (level >= 11 && level <= 13) levelBonus = downlineInterest * 1 / 100;
                                        else if (level === 14 || level === 15) levelBonus = downlineInterest * 0.5 / 100;

                                        if (levelBonus > 0) {
                                            addLog(`[SuperBonus][LevelIncome][PAID][${runId}] user_id=${stake.user_id} level=${level} from_downline=${user_code} amount=${levelBonus} (${requirementMsg})`);

                                            bulkStak.push({
                                                updateOne: {
                                                    filter: { _id: stake._id },
                                                    update: { $inc: { paid: levelBonus, level_bonus_paid: levelBonus } }
                                                }
                                            });
                                            bulkTransactions.push({
                                                user_id: stake.user_id,
                                                id: stake.id,
                                                amount: levelBonus,
                                                staking_id: downlineStake._id,
                                                currency: downlineStake.currency,
                                                income_type: 'sng_level',
                                                transaction_type: `LEVEL ${level} BONUS (downline)`,
                                                status: "COMPLETE",
                                                package_amount: downlineStake.amount,
                                                from_user_id: user_code,
                                                level: level,
                                                description: `Level ${level} bonus (${levelBonus} ${downlineStake.currency}) from downline ${user_code}`
                                            });
                                            bulkWallet.push({
                                                updateOne: {
                                                    filter: { user_id: stake.user_id },
                                                    update: { $inc: { usdt_balance: levelBonus } }
                                                }
                                            });
                                            summary.levelBonuses += levelBonus;
                                            summary.levelBonusUsers += 1;
                                        } else {
                                            addLog(`[SuperBonus][LevelIncome][NOT PAID][${runId}] user_id=${stake.user_id} level=${level} from_downline=${user_code} reason=qualified but bonus is 0 (${requirementMsg})`);
                                        }
                                    } else {
                                        addLog(`[SuperBonus][LevelIncome][NOT PAID][${runId}] user_id=${stake.user_id} level=${level} from_downline=${user_code} reason=${requirementMsg}`);
                                    }
                                }
                            }
                            // Mark this user as processed for level income this run
                            levelIncomeProcessedUsers.add(stake.user_id);
                        }
                    } else {
                        addLog(`[SuperBonus][StakeComplete][${runId}] Stake _id=${stake._id} for user_id=${stake.user_id} reached total payout, marking as COMPLETE`);
                        bulkStak.push({
                            updateOne: {
                                filter: { _id: stake._id },
                                update: { $set: { status: 'COMPLETE' } }
                            }
                        });
                        // Also update the user's staking_status to INACTIVE
                        await Users.updateOne(
                            { user_id: stake.user_id },
                            { $set: { staking_status: 'INACTIVE' } }
                        );
                        addLog(`[SuperBonus][StakeComplete][${runId}] Updated user_id=${stake.user_id} staking_status to INACTIVE`);
                        summary.completedStakes += 1;
                    }
                }

                // 5. Execute all bulk operations
                addLog(`[SuperBonus][${runId}] Executing bulk operations...`);
                addLog(`[SuperBonus][${runId}] - Staking updates: ${bulkStak.length} operations`);
                addLog(`[SuperBonus][${runId}] - Transactions: ${bulkTransactions.length} records`);
                addLog(`[SuperBonus][${runId}] - Wallet updates: ${bulkWallet.length} operations`);

                if (bulkStak.length > 0) {
                    await Staking.bulkWrite(bulkStak);
                    addLog(`[SuperBonus][${runId}] Staking bulkWrite completed.`);
                } else {
                    addLog(`[SuperBonus][${runId}] No staking updates to process.`);
                }
                if (bulkTransactions.length > 0) {
                    await Transaction.insertMany(bulkTransactions);
                    addLog(`[SuperBonus][${runId}] Transaction insertMany completed.`);
                } else {
                    addLog(`[SuperBonus][${runId}] No transactions to insert.`);
                }
                if (bulkWallet.length > 0) {
                    await Wallets.bulkWrite(bulkWallet);
                    addLog(`[SuperBonus][${runId}] Wallets bulkWrite completed.`);
                } else {
                    addLog(`[SuperBonus][${runId}] No wallet updates to process.`);
                }

                finishedAt = new Date();
                status = 'success';
                addLog(`[SuperBonus][${runId}] ===== PROCESS COMPLETED SUCCESSFULLY =====`);
                addLog(`[SuperBonus][${runId}] Finished at ${finishedAt.toISOString()}`);
                // Store the run log in DB
                await logToDb('info', 'superBonus run', {
                    runId,
                    startedAt,
                    finishedAt,
                    status,
                    logs,
                    summary
                });
                return true;

            } catch (error) {
                finishedAt = new Date();
                status = 'error';
                errorMsg = error.message;
                summary.errors.push(errorMsg);
                addLog(`[SuperBonus][${runId}] !!!!! PROCESS FAILED !!!!!`, { error: errorMsg });
                addLog(`[SuperBonus][${runId}] Error:`, { error });
                addLog(`[SuperBonus][${runId}] Stack:`, { stack: error.stack });
                // Store the run log in DB
                await logToDb('error', 'superBonus run', {
                    runId,
                    startedAt,
                    finishedAt,
                    status,
                    errorMsg,
                    logs,
                    summary
                });
                throw error;
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
                // Get all users with at least 3 direct referrals
                const users = await Users.find({ direct_referrals: { $gte: 3 } });
                console.log(`Found ${users.length} users with at least 3 direct referrals`);

                // Royalty bonus tiers (staking amount : bonus)
                const ROYALTY_TIERS = [
                    { min: 1000, max: 1999, bonus: 10 },
                    { min: 2000, max: 2999, bonus: 20 },
                    { min: 3000, max: 4999, bonus: 30 },
                    { min: 5000, max: 9999, bonus: 50 },
                    { min: 10000, max: 19999, bonus: 100 },
                    { min: 20000, max: 49999, bonus: 200 },
                    { min: 50000, max: 99999, bonus: 500 },
                    { min: 100000, max: 249999, bonus: 1100 },
                    { min: 250000, max: 499999, bonus: 2500 },
                    { min: 500000, max: 9999999, bonus: 5000 },
                    { min: 10000000, max: 19999999, bonus: 8100 },
                    { min: 20000000, max: Infinity, bonus: 15000 },
                ];

                let allRoyaltyStakingIds = [];

                for (const user of users) {
                    console.log(`\n[Royalty] Processing user: ${user.user_id}`);
                    // Get direct referrals
                    const directRefs = await Referral.find({ sponser_id: user._id });
                    console.log(`[Royalty] Direct referrals found: ${directRefs.length}`);
                    if (directRefs.length < 3) {
                        console.log(`[Royalty] Skipping user ${user.user_id}: Not enough directs.`);
                        continue;
                    }

                    // Calculate total business for each direct referral
                    const directRefsIncome = await Promise.all(directRefs.map(async (ref) => {
                        const directStakingAmounts = await Staking.find({
                            id: ref.user_id,
                            royalty_reward_counted: false,
                            status: "RUNNING"
                        });
                        const selfStaking = directStakingAmounts.reduce((sum, staking) => sum + (staking.amount || 0), 0);
                        const { total: downlineStaking, stakingIds: downlineStakingIds } = await calculateTotalDownlineBusiness(ref.user_id, 'royalty_reward_counted');
                        const totalBusiness = selfStaking + downlineStaking;
                        const allStakingIds = [...directStakingAmounts.map(s => s._id), ...downlineStakingIds];
                        console.log(`[Royalty] Direct ${ref.user_code}: Self business: ${selfStaking}, Downline business: ${downlineStaking}, Total business: ${totalBusiness}, Staking IDs: ${JSON.stringify(allStakingIds)}`);
                        return {
                            user_id: ref.user_code,
                            total: totalBusiness,
                            stakingIds: allStakingIds
                        };
                    }));

                    // Sort directs by total business
                    const sortedDirects = [...directRefsIncome].sort((a, b) => b.total - a.total);
                    const highest = sortedDirects[0] || { total: 0, user_id: null };
                    const secondHighest = sortedDirects[1] || { total: 0, user_id: null };
                    const others = sortedDirects.slice(2);
                    const othersSum = others.reduce((sum, ref) => sum + ref.total, 0);
                    const othersIds = others.map(ref => ref.user_id);
                    console.log(`[Royalty] Highest: ${highest.total} (User: ${highest.user_id}), 2nd Highest: ${secondHighest.total} (User: ${secondHighest.user_id}), Others Total: ${othersSum} (Users: ${othersIds})`);

                    // Get previous remaining amounts
                    const highestTeamRemaining = user.royalty_highest_team_remaining_business || 0;
                    const secondHighestTeamRemaining = user.royalty_second_highest_team_remaining_business || 0;
                    const otherTeamRemaining = user.royalty_other_team_remaining_business || 0;

                    // Calculate business for this cycle
                    const highestTeamBusiness = highest.total * 0.5 + highestTeamRemaining;
                    const secondHighestTeamBusiness = secondHighest.total * 0.3 + secondHighestTeamRemaining;
                    const otherTeamBusiness = othersSum * 0.2 + otherTeamRemaining;
                    console.log(`[Royalty] Business: HighestTeam ${highestTeamBusiness} (remaining: ${highestTeamRemaining}), 2ndHighestTeam ${secondHighestTeamBusiness} (remaining: ${secondHighestTeamRemaining}), OtherTeam ${otherTeamBusiness} (remaining: ${otherTeamRemaining})`);

                    // Find the highest royalty tier the user qualifies for
                    let applicableTier = null;
                    for (const tier of ROYALTY_TIERS.slice().reverse()) {
                        const reqHighest = tier.min * 0.5;
                        const reqSecond = tier.min * 0.3;
                        const reqOther = tier.min * 0.2;
                        console.log(`[Royalty] Checking tier ${tier.min}-${tier.max}: Required Highest: ${reqHighest}, 2nd: ${reqSecond}, Other: ${reqOther}`);
                        if (
                            highestTeamBusiness >= reqHighest &&
                            secondHighestTeamBusiness >= reqSecond &&
                            otherTeamBusiness >= reqOther
                        ) {
                            applicableTier = tier;
                            console.log(`[Royalty] User ${user.user_id} qualifies for tier: ${tier.min}-${tier.max} (bonus: ${tier.bonus})`);
                            break;
                        }
                    }
                    if (!applicableTier) {
                        console.log(`[Royalty] User ${user.user_id} does not qualify for any tier.`);
                    }

                    // Get user's current royalty bonus period info
                    const now = new Date();
                    let startDate = user.royalty_bonus_start_date;
                    let endDate = user.royalty_bonus_end_date;
                    let currentTier = user.royalty_bonus_current_tier;

                    // If user qualifies for a new (higher) tier, or never had a period, start new 10-week period
                    let shouldStartNewPeriod = false;
                    if (applicableTier) {
                        if (!currentTier || !startDate || !endDate) {
                            shouldStartNewPeriod = true;
                        } else {
                            const currentTierObj = ROYALTY_TIERS.find(t => `${t.min}-${t.max}` === currentTier);
                            if (!currentTierObj || applicableTier.min > currentTierObj.min) {
                                shouldStartNewPeriod = true;
                            }
                        }
                    }

                    if (shouldStartNewPeriod) {
                        startDate = now;
                        endDate = new Date(now.getTime() + 10 * 7 * 24 * 60 * 60 * 1000); // 10 weeks from now
                        currentTier = `${applicableTier.min}-${applicableTier.max}`;
                        await Users.findByIdAndUpdate(user._id, {
                            royalty_bonus_start_date: startDate,
                            royalty_bonus_end_date: endDate,
                            royalty_bonus_current_tier: currentTier
                        });
                        console.log(`[Royalty] Started new 10-week period for user ${user.user_id} at tier ${currentTier}. Start: ${startDate}, End: ${endDate}`);
                    }

                    // Only pay if user is in a valid period and it's a weekly payout
                    if (currentTier && startDate && endDate && now >= startDate && now <= endDate) {
                        // Check if it's time for a weekly payout
                        const lastTx = await Transaction.findOne({
                            user_id: user.user_id,
                            transaction_type: 'CARNIVAL ROYALTY BONUS',
                            'metadata.royalty_tier': currentTier
                        }).sort({ createdAt: -1 });
                        let lastPaidDate = lastTx ? lastTx.createdAt : startDate;
                        let daysSinceLast = (now - new Date(lastPaidDate)) / (1000 * 60 * 60 * 24);
                        const weekNum = Math.floor((now - new Date(startDate)) / (7 * 24 * 60 * 60 * 1000)) + 1;
                        console.log(`[Royalty] Week: ${weekNum}, Last paid: ${lastPaidDate}, Days since last: ${daysSinceLast}`);
                        if ((daysSinceLast >= 7 || !lastTx) && applicableTier) {
                            // Calculate new remaining business
                            const tier50 = applicableTier.min * 0.5;
                            const tier30 = applicableTier.min * 0.3;
                            const tier20 = applicableTier.min * 0.2;
                            const newHighestRemaining = Math.max(0, highestTeamBusiness - tier50);
                            const newSecondHighestRemaining = Math.max(0, secondHighestTeamBusiness - tier30);
                            const newOtherRemaining = Math.max(0, otherTeamBusiness - tier20);
                            let userRoyaltyStakingIds = [];
                            directRefsIncome.forEach(ref => {
                                userRoyaltyStakingIds.push(...ref.stakingIds);
                            });
                            console.log(`[Royalty] Paying week ${weekNum} bonus to user ${user.user_id}: ${applicableTier.bonus} USDT for tier ${currentTier}`);
                            console.log(`[Royalty] Staking IDs used for payout: ${JSON.stringify(userRoyaltyStakingIds)}`);
                            await Transaction.create({
                                id: user.user_id,
                                user_id: user.user_id,
                                transaction_type: 'CARNIVAL ROYALTY BONUS',
                                income_type: 'sng_royalty',
                                amount: applicableTier.bonus,
                                staking_id: null,
                                from: null,
                                rank_achieved: `Royalty Tier ${applicableTier.min}-${applicableTier.max}`,
                                currency: 'USDT',
                                self: applicableTier.bonus,
                                total: applicableTier.bonus,
                                status: 'COMPLETE',
                                package_name: `Royalty Tier ${applicableTier.min}-${applicableTier.max}`,
                                package_amount: applicableTier.bonus,
                                description: `Royalty bonus for business: Highest(${highestTeamBusiness}), 2ndHighest(${secondHighestTeamBusiness}), Other(${otherTeamBusiness})`,
                                metadata: {
                                    royalty_tier: `${applicableTier.min}-${applicableTier.max}`,
                                    highest_team_business: highestTeamBusiness,
                                    second_highest_team_business: secondHighestTeamBusiness,
                                    other_team_business: otherTeamBusiness,
                                    new_highest_remaining: newHighestRemaining,
                                    new_second_highest_remaining: newSecondHighestRemaining,
                                    new_other_remaining: newOtherRemaining,
                                    royalty_bonus_week: weekNum,
                                    used_staking_ids: userRoyaltyStakingIds
                                }
                            });
                            await Users.findByIdAndUpdate(user._id, {
                                royalty_highest_team_remaining_business: newHighestRemaining,
                                royalty_second_highest_team_remaining_business: newSecondHighestRemaining,
                                royalty_other_team_remaining_business: newOtherRemaining
                            });
                            console.log(`[Royalty] Updated user ${user.user_id} remaining business: Highest ${newHighestRemaining}, 2ndHighest ${newSecondHighestRemaining}, Other ${newOtherRemaining}`);
                            if (userRoyaltyStakingIds.length > 0) {
                                for (const stakingId of userRoyaltyStakingIds) {
                                    const stake = await Staking.findById(stakingId);
                                    if (stake) {
                                        const update = {
                                            $inc: { paid: applicableTier.bonus },
                                        };
                                        if (stake.paid + stake.amount + applicableTier.bonus >= stake.total) {
                                            update.$set.status = 'COMPLETE';
                                        }
                                        await Staking.updateOne({ _id: stake._id }, update);
                                    }
                                    // Only push to allRoyaltyStakingIds if not fully paid after this bonus
                                    const updatedStake = await Staking.findById(stakingId);
                                    if (updatedStake && (updatedStake.paid + updatedStake.amount < updatedStake.total)) {
                                        allRoyaltyStakingIds.push(stakingId);
                                    }
                                }
                            }
                        } else if (daysSinceLast >= 7 || !lastTx) {
                            console.log(`[Royalty] Skipping payout for user ${user.user_id} this week: No applicable tier.`);
                        }
                    } else {
                        if (!currentTier || !startDate || !endDate) {
                            console.log(`[Royalty] User ${user.user_id} not in a valid royalty period.`);
                        } else if (now > endDate) {
                            console.log(`[Royalty] User ${user.user_id} royalty period ended on ${endDate}. No more payouts.`);
                        } else {
                            console.log(`[Royalty] User ${user.user_id} not eligible for payout at this time.`);
                        }
                    }
                }

                // After all users are processed, update all used staking IDs in one bulk operation
                if (allRoyaltyStakingIds.length > 0) {
                    await Staking.updateMany(
                        {
                            _id: { $in: allRoyaltyStakingIds },
                            royalty_reward_counted: false,
                            status: "RUNNING"
                        },
                        {
                            $set: { royalty_reward_counted: true }
                        }
                    );
                    console.log(`[Royalty] Marked ${allRoyaltyStakingIds.length} staking records as royalty_reward_counted (bulk update after all users).`);
                }
                console.log('Carnival Royalty Bonus distribution completed');
                return true;
            } catch (error) {
                console.error('Error in carnivalRoyaltyBonus:', error);
                throw error;
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
        const calculateTotalDownlineBusiness = async (userId, countedKey = 'rank_reward_counted') => {
            // Get all direct referrals of this user
            const downlines = await Referral.find({ sponser_id: userId });

            let totalDownlineBusiness = 0;
            let countedStakingIds = [];

            // For each downline
            for (const downline of downlines) {
                // Get their staking amounts that haven't been counted
                const stakingQuery = {
                    id: downline.user_id,
                    status: "RUNNING"
                };
                stakingQuery[countedKey] = false;
                const stakingAmounts = await Staking.find(stakingQuery);

                // Add their staking to total
                const downlineStaking = stakingAmounts.reduce((sum, staking) => sum + (staking.amount || 0), 0);
                totalDownlineBusiness += downlineStaking;

                // Store the staking IDs that were counted
                countedStakingIds = [...countedStakingIds, ...stakingAmounts.map(stake => stake._id)];

                // Recursively get their downline business
                const { total: nestedTotal, stakingIds: nestedStakingIds } = await calculateTotalDownlineBusiness(downline.user_id, countedKey);
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
                        const { total: downlineStaking, stakingIds: downlineStakingIds } = await calculateTotalDownlineBusiness(ref.user_id, 'rank_reward_counted');
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

        async function boosterincome() {
            try {
                console.log("\n=== Booster Income Function Start ===");
                // Find all RUNNING stakings (no date filter)
                const stakings = await Staking.find({ status: 'RUNNING' });
                let totalProcessed = 0, totalBoosted = 0, totalReverted = 0;
                for (const staking of stakings) {
                    console.log(staking)
                    const user = await Users.findOne({ user_id: staking.user_id, staking_status: 'ACTIVE' });
                    if (!user) continue;
                    totalProcessed++;
                    const stakingWindowEnd = new Date(staking.createdAt.getTime() + 15 * 24 * 60 * 60 * 1000);
                    console.log(`\n[PROCESS] Main User: ${user.user_id}, StakingID: ${staking._id}, Amount: ${staking.amount}, Created: ${staking.createdAt.toISOString()}, WindowEnd: ${stakingWindowEnd.toISOString()}`);
                    const directRefs = await Referral.aggregate([
                        { $match: { sponser_code: user.user_id } },
                        { $lookup: { from: 'users', localField: 'user_code', foreignField: 'user_id', as: 'user' } },
                        { $match: { 'user.staking_status': 'ACTIVE' } }
                    ]);
                    console.log(`[INFO] Found ${directRefs.length} direct referrals for user ${user.user_id}`);
                    if (!directRefs || directRefs.length < 5) {
                        if (staking.booster_applicable) {
                            await Staking.findOneAndUpdate(
                                { _id: staking._id },
                                { $set: { roi: staking.previous_roi || staking.roi, booster_applicable: false, previous_roi: null } }
                            );
                            await logRewardUser({
                                user_id: user.user_id,
                                user_code: user.user_id,
                                type: 'booster_revert',
                                details: {
                                    message: 'Booster ROI reverted (not enough directs)',
                                    staking_id: staking._id,
                                    reverted_to: staking.previous_roi || staking.roi
                                }
                            });
                            totalReverted++;
                            console.log(`[REVERT] Booster ROI reverted for staking ${staking._id} of user ${user.user_id} (not enough directs)`);
                        }
                        continue;
                    }
                    let qualifyingDirects = 0;
                    for (const ref of directRefs) {
                        // Debug: print all stakings for this direct user
                        const allDirectStakings = await Staking.find({ user_id: ref.user_code });
                        console.log(`[DEBUG] All stakings for direct user ${ref.user_code}:`, allDirectStakings.map(ds => ({ status: ds.status, amount: ds.amount, createdAt: ds.createdAt })));
                        // Direct's staking must be RUNNING, amount >= main staking, created within 15 days of main staking
                        const directStaking = await Staking.findOne({
                            user_id: ref.user_code,
                            status: 'RUNNING',
                            amount: { $gte: staking.amount },
                            createdAt: { $gte: staking.createdAt, $lte: stakingWindowEnd }
                        });
                        if (directStaking) {
                            qualifyingDirects++;
                            console.log(`[QUALIFY] Direct user ${ref.user_code} qualifies (staking: ${directStaking.amount}, created: ${directStaking.createdAt.toISOString()}) for main staking ${staking._id}`);
                        } else {
                            // Log why not qualified
                            if (allDirectStakings.length === 0) {
                                console.log(`[NO-QUALIFY] Direct user ${ref.user_code} has no staking.`);
                            } else {
                                let reason = [];
                                for (const ds of allDirectStakings) {
                                    if (ds.status !== 'RUNNING') reason.push(`status ${ds.status} != RUNNING`);
                                    if (ds.amount < staking.amount) reason.push(`amount ${ds.amount} < main ${staking.amount}`);
                                    if (ds.createdAt < staking.createdAt) reason.push(`createdAt ${ds.createdAt.toISOString()} < main staking ${staking.createdAt.toISOString()}`);
                                    if (ds.createdAt > stakingWindowEnd) reason.push(`createdAt ${ds.createdAt.toISOString()} > windowEnd ${stakingWindowEnd.toISOString()}`);
                                }
                                console.log(`[NO-QUALIFY] Direct user ${ref.user_code} does NOT qualify for main staking ${staking._id}. Reasons: ${reason.join('; ')}`);
                            }
                        }
                        if (qualifyingDirects >= 5) break;
                    }
                    if (qualifyingDirects >= 5) {
                        if (!staking.booster_applicable && staking.roi !== 1) {
                            await Staking.findOneAndUpdate(
                                { _id: staking._id },
                                { $set: { previous_roi: staking.roi, roi: 1, booster_applicable: true } }
                            );
                            await logRewardUser({
                                user_id: user.user_id,
                                user_code: user.user_id,
                                type: 'booster',
                                details: {
                                    message: 'Booster ROI applied',
                                    staking_id: staking._id,
                                    old_roi: staking.roi,
                                    new_roi: 1,
                                    qualifyingDirects
                                }
                            });
                            totalBoosted++;
                            console.log(`[BOOST] Booster ROI applied for staking ${staking._id} of user ${user.user_id}`);
                        } else {
                            console.log(`[INFO] Staking ${staking._id} of user ${user.user_id} already boosted or ROI is already 1%`);
                        }
                    } else {
                        if (staking.booster_applicable) {
                            await Staking.findOneAndUpdate(
                                { _id: staking._id },
                                { $set: { roi: staking.previous_roi || staking.roi, booster_applicable: false, previous_roi: null } }
                            );
                            await logRewardUser({
                                user_id: user.user_id,
                                user_code: user.user_id,
                                type: 'booster_revert',
                                details: {
                                    message: 'Booster ROI reverted (lost eligibility)',
                                    staking_id: staking._id,
                                    reverted_to: staking.previous_roi || staking.roi
                                }
                            });
                            totalReverted++;
                            console.log(`[REVERT] Booster ROI reverted for staking ${staking._id} of user ${user.user_id} (lost eligibility)`);
                        } else {
                            console.log(`[INFO] Staking ${staking._id} of user ${user.user_id} does not qualify for booster (only ${qualifyingDirects} qualifying directs)`);
                        }
                    }
                }
                console.log(`\n=== Booster Income Function End ===`);
                console.log(`[SUMMARY] Processed: ${totalProcessed}, Boosted: ${totalBoosted}, Reverted: ${totalReverted}`);
            } catch (error) {
                console.error("Error in booster income function:", error);
                throw error;
            }
        }

        //Cron Configurations
        // Function to run at 12:01 AM IST
        const task = async () => {
            console.log(`Cron job executed at ${moment().tz('Asia/Kolkata').format()}`);

            // Add your task logic here
            await boosterincome()
            await superBonus();
            // await carnivalCorporateToken();
            // await carnivalRankRewards();
            // await carnivalRoyaltyBonus()

        };

        // Schedule the cron job
        cron.schedule("1 0 * * *", () => {
        // cron.schedule("0 19 * * *", () => {
        // cron.schedule("*/1 * * * *", () => {
            console.log('Starting....');
            logToDb('info', 'Starting....');
            // task();
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
});

process.on('disconnect', async () => {
    console.log('Child process is disconnected. Exiting...');
    process.stdin.pause();
    process.kill(process.pid);
    process.exit(0);
});

// Utility: Get all downlines up to maxLevel for a user (no staking status check)
async function getDownlines(userId, maxLevel = 15) {
    let result = [];
    let queue = [{ userId, level: 1 }];
    while (queue.length) {
        const { userId, level } = queue.shift();
        if (level > maxLevel) continue;
        const directs = await Referral.find({ sponser_id: userId }).lean();
        for (const direct of directs) {
            result.push({ userId: direct.user_id, level, user_code: direct.user_code });
            queue.push({ userId: direct.user_id, level: level + 1 });
        }
    }
    return result;
}