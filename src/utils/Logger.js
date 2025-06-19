const Log = require('../models/Log');
let RankRewardLog;
try {
    RankRewardLog = require('../models/RankRewardLog');
} catch (e) {
    // If the model doesn't exist, fallback to generic logging
    RankRewardLog = null;
}
let RewardLog;
try {
    RewardLog = require('../models/RewardLog');
} catch (e) {
    RewardLog = null;
}

async function logToDb(level, message, meta = null) {
    try {
        await Log.create({ level, message, meta });
    } catch (err) {
        // fallback to console if DB fails
        console.error('Failed to log to DB:', err, message, meta);
    }
}

// Structured, user-centric logging for rank rewards
async function logRankRewardUser({
    user_id,
    user_code,
    timestamp = new Date(),
    directs = [],
    highestEarningDirect = {},
    otherTeamBusiness = 0,
    tierAchieved = null,
    rewardGiven = 0,
    remainingBusiness = {},
    stakingIdsUsed = []
}) {
    if (!RankRewardLog) {
        // fallback to generic log if model not found
        return logToDb('info', `RankRewardLog fallback for user ${user_id}`, {
            user_id, user_code, timestamp, directs, highestEarningDirect, otherTeamBusiness, tierAchieved, rewardGiven, remainingBusiness, stakingIdsUsed
        });
    }
    try {
        await RankRewardLog.create({
            user_id,
            user_code,
            timestamp,
            directs,
            highestEarningDirect,
            otherTeamBusiness,
            tierAchieved,
            rewardGiven,
            remainingBusiness,
            stakingIdsUsed
        });
    } catch (err) {
        // fallback to generic log if DB fails
        logToDb('error', `Failed to log rank reward for user ${user_id}`, err);
    }
}

// Generic reward logger for any reward type
async function logRewardUser({
    user_id,
    user_code,
    type, // 'rank', 'superBonus', 'roi', 'levelIncome', etc.
    details = {},
    timestamp = new Date()
}) {
    if (!RewardLog) {
        return logToDb('info', `RewardLog fallback for user ${user_id} (${type})`, {
            user_id, user_code, type, details, timestamp
        });
    }
    try {
        await RewardLog.create({
            user_id,
            user_code,
            type,
            details,
            timestamp
        });
    } catch (err) {
        logToDb('error', `Failed to log ${type} reward for user ${user_id}`, err);
    }
}

module.exports = {
    logToDb,
    logRankRewardUser,
    logRewardUser
}; 