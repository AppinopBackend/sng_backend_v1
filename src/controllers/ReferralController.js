const Referral = require('../models/Referral');
const Users = require('../models/User');
const Staking = require('../models/Staking')



const getDownlineTeam2 = async (id) => {
    try {
        let team = [{ userId: id, level: 0 }];
        let allMembers = [];

        while (team.length > 0) {
            const current = team.shift();
            const direct = await Referral.find({ sponser_id: current.userId }).lean();

            if (direct.length > 0) {
                const levelMembers = direct.map(member => ({
                    userId: member.user_id,
                    level: current.level + 1
                }));

                team.push(...levelMembers);
                allMembers.push(...levelMembers);
            }
        }

        // Create a lookup object to associate user IDs with their levels
        const memberLevels = allMembers.reduce((acc, member) => {
            acc[member.userId] = member.level;
            return acc;
        }, {});

        // Fetch user details and include their levels in the response
        let details = await Users.find({ _id: { $in: Object.keys(memberLevels) } }, { password: 0 }).lean();
        details = details.map(user => ({
            ...user,
            level: memberLevels[user._id]
        }));
        console.log(memberLevels)
        let business = await Staking.aggregate([
            {
                $match: {
                    $and: [
                        { id: { $in: Object.keys(memberLevels) } },
                        { status: "RUNNING" }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    totalStackQuantity: { $sum: "$amount" }
                }
            }
        ]);
        let total = business.length > 0 ? business[0].totalStackQuantity : 0;
        console.log(total)
        return total;
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message, data: [] });
    }
};

const directReferred = async (req, res) => {
    try {
        const { id, index } = req.query;
        const members = await Referral.find({ sponser_id: id });
        const userIds = members.map(member => member.user_id);
        const userCodes = members.map(member => member.user_code);

        const users = await Users.find({ _id: { $in: userIds } }, { password: 0, ranks: 0 }).lean();
        const stacking_details = await Staking.find({ user_id: { $in: userCodes } });

        // Create a map to hold the running staking package count for each user
        const runningStakingCounts = {};
        const selfBusinessMap = {};

        for await (const userId of userIds) {
            const selfBusiness = await getDownlineTeam2(userId);
            selfBusinessMap[userId] = selfBusiness;
        }

        // Map users with additional data including staking amount
        const data = users.map(user => {
            const userStackingDetails = stacking_details.find(detail => detail.user_id === user.user_id);
            return {
                ...user,
                id: user._id,
                sponser_id: id,
                index: index,
                staking_status: user.staking_status || 'INACTIVE',
                // self_business: runningStakingCounts[user._id] || 0,
                self_business: selfBusinessMap[user._id] || 0,
                // self_stacking_amount: userStackingDetails ? userStackingDetails.amount : 0
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Direct referred fetched!!',
            data: data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
};


module.exports = {
    directReferred, getDownlineTeam2,

    getDownlineTeam: async (req, res) => {
        try {
            const { id } = req.user;
            let team = [{ userId: id, level: 0 }];
            let allMembers = [];
            let direct_referrals = await Referral.find({ sponser_id: id });

            while (team.length > 0) {
                const current = team.shift();
                const direct = await Referral.find({ sponser_id: current.userId }).lean();
                // console.log(direct, " : direct");

                if (direct.length > 0) {
                    const levelMembers = direct.map(member => ({
                        userId: member.user_id,
                        level: current.level + 1
                    }));

                    team.push(...levelMembers);
                    allMembers.push(...levelMembers);
                }
            }

            console.log(allMembers, ": ALL");

            // Create a lookup object to associate user IDs with their levels
            const memberLevels = allMembers.reduce((acc, member) => {
                acc[member.userId] = member.level;
                return acc;
            }, {});

            // Fetch user details and include their levels in the response
            let details = await Users.find({ _id: { $in: Object.keys(memberLevels) } }, { password: 0 }).lean();
            details = details.map(user => ({
                ...user,
                level: memberLevels[user._id]
            }));

            let business = await Staking.aggregate([
                {
                    $match: {
                        id: { $in: Object.keys(memberLevels) }
                    }
                },
                {
                    $group: {
                        _id: "$id",
                        totalStackQuantity: { $sum: "$amount" },
                        individualAmounts: { $push: "$amount" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalStackQuantity: { $sum: "$totalStackQuantity" },
                        details: {
                            $push: {
                                userId: "$_id",
                                stackingAmount: "$totalStackQuantity",
                                // individualAmounts: "$individualAmounts"
                            }
                        }
                    }
                }
            ]);

            let total = business.length > 0 ? business[0].totalStackQuantity : 0;
            let stackingDetails = business.length > 0 ? business[0].details : [];

            // Create a lookup object for stacking details
            const stackingLookup = stackingDetails.reduce((acc, detail) => {
                acc[detail.userId] = detail;
                return acc;
            }, {});

            // Merge stacking details with user details
            details = details.map(user => ({
                ...user,
                stackingAmount: stackingLookup[user._id] ? stackingLookup[user._id].stackingAmount : 0,
                // individualAmounts: stackingLookup[user._id] ? stackingLookup[user._id].individualAmounts : []
            }));

            return res.status(200).json({ success: true, message: 'Team details fetched successfully!!', data: details, business: total, direct: direct_referrals.length });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }
    },

    getDownlineTeam2: async (id) => {
        try {
            let team = [{ userId: id, level: 0 }];
            let allMembers = [];

            while (team.length > 0) {
                const current = team.shift();
                const direct = await Referral.find({ sponser_id: current.userId }).lean();

                if (direct.length > 0) {
                    const levelMembers = direct.map(member => ({
                        userId: member.user_id,
                        level: current.level + 1
                    }));

                    team.push(...levelMembers);
                    allMembers.push(...levelMembers);
                }
            }

            // Create a lookup object to associate user IDs with their levels
            const memberLevels = allMembers.reduce((acc, member) => {
                acc[member.userId] = member.level;
                return acc;
            }, {});

            // Fetch user details and include their levels in the response
            let details = await Users.find({ _id: { $in: Object.keys(memberLevels) } }, { password: 0 }).lean();
            details = details.map(user => ({
                ...user,
                level: memberLevels[user._id]
            }));
            console.log(memberLevels)
            let business = await Staking.aggregate([
                {
                    $match: {
                        $and: [
                            { id: { $in: Object.keys(memberLevels) } },
                            { status: "RUNNING" }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalStackQuantity: { $sum: "$amount" }
                    }
                }
            ]);
            let total = business.length > 0 ? business[0].totalStackQuantity : 0;
            console.log(total)
            return total;
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message, data: [] });
        }
    },

    getDownlineTeam3: async (id, date) => {
        try {
            let team = [{ userId: id, level: 0 }];
            let allMembers = [];

            while (team.length > 0) {
                const current = team.shift();
                const direct = await Referral.find({ sponser_id: current.userId }).lean();

                if (direct.length > 0) {
                    const levelMembers = direct.map(member => ({
                        userId: member.user_id,
                        level: current.level + 1
                    }));

                    team.push(...levelMembers);
                    allMembers.push(...levelMembers);
                }
            }

            // Create a lookup object to associate user IDs with their levels
            const memberLevels = allMembers.reduce((acc, member) => {
                acc[member.userId] = member.level;
                return acc;
            }, {});
            // id = id.toString()
            // memberLevels[`${id}`] = 0
            // console.log(memberLevels, " : memberLevels")

            // Fetch user details and include their levels in the response
            let details = await Users.find({ _id: { $in: Object.keys(memberLevels) } }, { password: 0 }).lean();
            details = details.map(user => ({
                ...user,
                level: memberLevels[user._id]
            }));

            // Fetch staking details for each user
            let query;
            if (date != null) {
                query = {
                    $match: {
                        $and: [
                            { id: { $in: Object.keys(memberLevels) } },
                            { createdAt: { $gte: date } }
                        ]
                    }
                }
            } else {
                query = {
                    $match: {
                        $and: [
                            { id: { $in: Object.keys(memberLevels) } },
                        ]
                    }
                }
            }
            let stakingDetails = await Staking.aggregate([
                query,
                {
                    $group: {
                        _id: "$id",
                        totalStackQuantity: { $sum: "$amount" }
                    }
                }
            ]);

            // Create a lookup object for staking amounts
            const stakingLookup = stakingDetails.reduce((acc, staking) => {
                acc[staking._id] = staking.totalStackQuantity;
                return acc;
            }, {});

            // Add staking amount to each user's details
            details = details.map(user => ({
                ...user,
                stakingAmount: stakingLookup[user._id] || 0
            }));

            return details;
        } catch (error) {
            throw new Error(error.message);
        }
    },

    getUplineTeam: async (id) => {
        try {
            let team = [{ userId: id, level: 0 }];
            let allSponsors = [];

            while (team.length > 0) {
                const current = team.shift();
                const user = await Referral.findOne({ user_id: current.userId }).lean();
                if (!user) continue;

                const sponsor = await Referral.findOne({ user_id: user.sponser_id }).lean();
                if (!sponsor) break;

                team.push({ userId: sponsor.user_id, level: current.level + 1 });
                allSponsors.push({ userId: sponsor.user_id, level: current.level + 1 });
                // console.log(user, " : user")
            }

            // Create a lookup object to associate user IDs with their levels
            const sponsorLevels = allSponsors.reduce((acc, sponsor) => {
                acc[sponsor.userId] = sponsor.level;
                return acc;
            }, {});
            console.log(sponsorLevels, " : sponsorLevels")
            // Fetch user details and include their levels in the response
            let details = await Users.find({ _id: { $in: Object.keys(sponsorLevels) } }, { password: 0, ranks: 0 }).lean();
            details = details.map(user => ({
                ...user,
                level: sponsorLevels[user._id],
                id: (user._id).toString()
            }));

            console.log('details')
            return details;
        } catch (error) {
            throw new Error(error.message);
        }
    },

    getUplineTeam2: async (req, res) => {
        try {
            const { id } = req.user;
            let team = [{ userId: id, level: 0 }];
            console.log(team, " : Team");

            let allSponsors = [];

            while (team.length > 0) {
                const current = team.shift();
                const user = await Referral.findOne({ user_id: current.userId }).lean();
                if (!user) continue;

                const sponsor = await Referral.findOne({ user_id: user.sponser_id }).lean();
                if (!sponsor) break;

                team.push({ userId: sponsor.user_id, level: current.level + 1 });
                allSponsors.push({ userId: sponsor.user_id, level: current.level + 1 });
                // console.log(user, " : user")
            }

            // Create a lookup object to associate user IDs with their levels
            const sponsorLevels = allSponsors.reduce((acc, sponsor) => {
                acc[sponsor.userId] = sponsor.level;
                return acc;
            }, {});
            console.log(sponsorLevels, " : sponsorLevels")
            console.log(Object.keys(sponsorLevels), " : sponsorLevels2")
            // Fetch user details and include their levels in the response
            let details = await Users.find({ _id: { $in: Object.keys(sponsorLevels) } }, { password: 0, ranks: 0 }).lean();
            details = details.map(user => ({
                ...user,
                level: sponsorLevels[user._id],
                id: (user._id).toString()
            }));

            console.log('details')
            return res.status(200).json({ success: true, message: "Upline team fetched", data: details });
        } catch (error) {
            throw new Error(error.message);
        }
    }
}