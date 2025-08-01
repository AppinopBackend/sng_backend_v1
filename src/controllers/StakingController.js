const { BSCSCAN_API } = process.env;
const Staking = require("../models/Staking");
const Wallet = require("../models/Wallet");
const Referral = require("../models/Referral");
const Transaction = require("../models/Transaction");
const Token = require("../models/Token");
const Users = require("../models/User");
const User = require("../models/User");

module.exports = {
    buyPackage: async (req, res) => {
        try {
            let add;
            const rankOrder = ["SILVER", "GOLD", "PLATINUM", "DIAMOND", "CROWN"];

            const { user_id, id } = req.user;
            const { amount, bsc_address,currency } = req.body;

            // check if amount is greater then and equal to 100
            if (amount < 100)
                return res
                    .status(500)
                    .json({
                        success: false,
                        message: "You cannnot buy package below $100",
                        data: [],
                    });

            // check if user have enough balance in the wallet
            let userbalance = await Wallet.findOne({ user_id: user_id });
            let user = await Users.findOne({ user_id: user_id });
            // if (userbalance === null || userbalance.usdt_balance < amount)
            //     return res
            //         .status(406)
            //         .json({
            //             success: false,
            //             message: "Insufficient Wallet Balance",
            //             data: [],
            //         });

            // add balance from users wallet
            if(currency === "SNG"){
                 add = await Wallet.updateOne(
                    { user_id: user_id },
                    { $inc: { sng_balance: amount } }
                );
                if (!add)
                    return res
                        .status(400)
                        .json({
                            success: false,
                            message: "Unable to add user wallet balance",
                            data: [],
                        });
            }
            else if(currency === "USDT"){
                 add = await Wallet.updateOne(
                    { user_id: user_id },
                    { $inc: { usdt_balance: amount } }
                );
                if (!add)    
                    return res
                        .status(400)
                        .json({
                            success: false,
                            message: "Unable to add user wallet balance",
                            data: [],
                        });
            }

            let roi_value, rank;
            if (amount >= 100 && amount <= 500) (roi_value = 0.5), (rank = "SILVER");
            else if (amount >= 501 && amount <= 1000)
                (roi_value = 0.6), (rank = "GOLD");
            else if (amount >= 1001 && amount <= 2500)
                (roi_value = 0.7), (rank = "PLATINUM");
            else if (amount >= 2501 && amount <= 5000)
                (roi_value = 0.8), (rank = "DIAMOND");
            else if (amount >= 5001) (roi_value = 1), (rank = "CROWN");

            if (add.modifiedCount > 0) {
                // Check if this is the user's first staking
                let existingStakes = await Staking.find({ user_id: user_id });
                let isFirstStaking = existingStakes.length === 0;
                let staking_value = user?.self_staking + Number(amount);

                let direct = await Referral.find({ sponser_id: id });
                console.log(direct, "Log of direct");

                // create a staking transaction
                let obj = {
                    user_id: user_id,
                    id: id,
                    amount: amount,
                    roi: roi_value,
                    currency: currency || "USDT",
                    total: direct?.length > 0 ? amount * 3 : amount * 2,
                    chain: "BEP20",
                };
                let stake = await Staking.create(obj);

                // Update user's self-staking status
                let updateFields = {
                    staking_status: "ACTIVE",
                    total_earning_potential: direct?.length > 0 ? 300 : 200,
                    self_staking: staking_value,
                    bsc_address: bsc_address,
                };
                // Only update rank if new rank is higher
                const currentRank = user.current_rank;
                if (!currentRank || rankOrder.indexOf(rank) > rankOrder.indexOf(currentRank)) {
                    updateFields.current_rank = rank;
                }
                if (isFirstStaking) {
                    updateFields.activation_date = new Date().toISOString();
                }
                console.log(updateFields, ": updateFields");

                await Users.updateOne({ user_id: user_id }, { $set: updateFields });

                //  DIRECT REFERRAL BONUS
                // 10% Direct Bonus to sponser
                console.log("Hello");

                let sponser = await Referral.findOne({ user_id: id });
                console.log(sponser, " : Sponser");
                let sponser_user = await User.findById(id);
                let sponser_user_staking = await Staking.findOne({
                    id: sponser?.sponser_id,
                }).sort({ createdAt: -1 });
                let sponse_user_total = sponser_user_staking?.total || 0;
                let sponser_user_paid = sponser_user_staking?.paid || 0;

                // find all the existing stakings of user and updates the total value if total_earning_potential has changed to 300
                if (direct.length) {
                    let allStakes = await Staking.find({ user_id });
                    for (stake of allStakes) {
                        if (stake.total != 3 * stake.amount) {
                            // we will update the total value to 3x of amount
                            let updatedTotal = 3 * stake.amount;
                            let updatedStake = await Staking.findByIdAndUpdate(
                                stake?._id,
                                { total: updatedTotal },
                                { new: true }
                            );
                            console.log("Update Successfull");
                        }
                    }
                }
                console.log("All Existing stakes updated accordingly...");

                if (sponser != null && sponser.sponser_id != null) {
                    // Calculate direct bonus
                    let direct_bonus = (amount * 10) / 100;
                    let remaining = sponse_user_total - sponser_user_paid;

                    if (remaining <= 0) {
                        // Sponsor has reached or exceeded earning potential, no bonus
                        // Update sponsor's latest staking status to COMPLETE
                        if (sponser_user_staking?._id) {
                            await Staking.findByIdAndUpdate(
                                sponser_user_staking._id,
                                { status: "COMPLETE" },
                                { new: true }
                            );
                            // Also update the sponsor user's staking_status to INACTIVE
                            await Users.updateOne(
                                { user_id: sponser.sponser_code },
                                { $set: { staking_status: "INACTIVE" } }
                            );
                            console.log("Sponsor's staking status updated to COMPLETED.");
                        }
                    } else {
                        // Only pay up to the remaining earning potential
                        let bonus_to_pay = Math.min(direct_bonus, remaining);
                        let updatedPaid = sponser_user_paid + bonus_to_pay;

                        // transfer bonus to sponsor's wallet
                        await Wallet.updateOne(
                            { user_id: sponser.sponser_code },
                            {
                                $inc: {
                                    usdt_balance: bonus_to_pay,
                                    total_balance: bonus_to_pay,
                                },
                            }
                        );
                        console.log("Wallets updated...");

                        // update paid value in sponsor user latest staking transaction
                        await Staking.findByIdAndUpdate(
                            sponser_user_staking?._id,
                            { paid: updatedPaid, direct_bonus_paid: updatedPaid },
                            { new: true }
                        );

                        // After updating, check if staking is now complete
                        if (updatedPaid >= sponse_user_total) {
                            await Staking.findByIdAndUpdate(
                                sponser_user_staking._id,
                                { status: "COMPLETE" },
                                { new: true }
                            );
                            await Users.updateOne(
                                { user_id: sponser.sponser_code },
                                { $set: { staking_status: "INACTIVE" } }
                            );
                            console.log("Sponsor's staking status updated to COMPLETED (after bonus paid).");
                        }

                        // create transaction for direct bonus for sponsor
                        let obj = {
                            user_id: sponser.sponser_code,
                            id: sponser.sponser_id,
                            amount: bonus_to_pay,
                            staking_id: stake._id,
                            currency: "USDT",
                            transaction_type: "DIRECT REFERRAL BONUS",
                            status: "COMPLETED",
                            from: user_id,
                            from_user_name: user.name,
                            income_type: "sng_direct_referral",
                            package_amount: amount,
                        };
                        await Transaction.create(obj);
                        console.log("Transaction Created...");
                    }
                }
            } else {
                return res
                    .status(500)
                    .json({ success: false, message: "Some error occured!!", data: [] });
            }
            return res
                .status(200)
                .json({ success: true, message: "Amount Staked!!", data: [] });
        } catch (error) {
            console.log(error, " : ERROR while buying package");
            return res
                .status(500)
                .json({ success: false, message: error.message, data: [] });
        }
    },

    userPackageList: async (req, res) => {
        try {
            const { user_id } = req.user;
            let data = await Staking.find({ user_id: user_id }).sort({
                createdAt: -1,
            });
            let user = await User.findOne({ user_id: user_id });
            data = data.map((stake) => ({
                ...stake._doc,
                user_name: user?.name || "",
            }));
            return res
                .status(200)
                .json({
                    success: true,
                    message: "Staking Transaction Fetched!!",
                    data: data,
                });
        } catch (error) {
            return res
                .status(500)
                .json({ success: false, message: error.message, data: [] });
        }
    },

    rewardList: async (req, res) => {
        try {
            const { user_id } = req.user;
            const { type } = req.query; // removed skip, limit
            let data = [];
            let count = 0;

            // Calculate total package amount for the requested type
            const totalPackageAmount = await Transaction.aggregate([
                {
                    $match: {
                        user_id: user_id,
                        income_type: type || {
                            $in: ["sng_direct_referral", "sng_royalty", "sng_level", "sng_rewards"]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$package_amount" }
                    }
                }
            ]);

            // Calculate total income for each type
            const totalDirectReferral = await Transaction.aggregate([
                { $match: { user_id: user_id, income_type: "sng_direct_referral" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const totalRoi = await Transaction.aggregate([
                { $match: { user_id: user_id, income_type: "sng_roi" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const totalRoyalty = await Transaction.aggregate([
                { $match: { user_id: user_id, income_type: "sng_royalty" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const totalLevel = await Transaction.aggregate([
                { $match: { user_id: user_id, income_type: "sng_level" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const totalRewards = await Transaction.aggregate([
                { $match: { user_id: user_id, income_type: "sng_rewards" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            if (type === "sng_direct_referral") {
                data = await Transaction.find({
                    $and: [{ user_id: user_id }, { income_type: "sng_direct_referral" }],
                });
                count = await Transaction.countDocuments({
                    $and: [{ user_id: user_id }, { income_type: "sng_direct_referral" }],
                });
            } else if (type === "sng_roi") {
                data = await Transaction.find({
                    $and: [{ user_id: user_id }, { income_type: "sng_roi" }],
                });
                count = await Transaction.countDocuments({
                    $and: [{ user_id: user_id }, { income_type: "sng_roi" }],
                });
            } else if (type === "sng_royalty") {
                data = await Transaction.find({
                    $and: [{ user_id: user_id }, { income_type: "sng_royalty" }],
                });
                count = await Transaction.countDocuments({
                    $and: [{ user_id: user_id }, { income_type: "sng_royalty" }],
                });
            } else if (type === "sng_level") {
                data = await Transaction.find({
                    $and: [{ user_id: user_id }, { income_type: "sng_level" }],
                });
                count = await Transaction.countDocuments({
                    $and: [{ user_id: user_id }, { income_type: "sng_level" }],
                });
            } else if (type === "sng_rewards") {
                data = await Transaction.find({
                    $and: [{ user_id: user_id }, { income_type: "sng_rewards" }],
                });
                count = await Transaction.countDocuments({
                    $and: [{ user_id: user_id }, { income_type: "sng_rewards" }],
                });
            } else {
                data = await Transaction.find({ user_id: user_id });
                count = await Transaction.countDocuments({ user_id: user_id });
            }

            // Fetch user registration date
            let user = await User.findOne({ user_id: user_id });
            let user_registration_date = user ? user.createdAt : null;

            // For all transactions, fetch staking_registration_date from staking_id if present
            const stakingIds = data.map((tx) => tx.staking_id).filter((id) => !!id);
            let stakingMap = {};
            if (stakingIds.length > 0) {
                const stakings = await Staking.find({ _id: { $in: stakingIds } });
                stakingMap = stakings.reduce((acc, staking) => {
                    acc[staking._id] = staking.createdAt;
                    return acc;
                }, {});
            }

            data = data.map((userName) => ({
                ...userName._doc,
                user_name: user?.name || "",
                user_registration_date,
                staking_registration_date: userName.staking_id
                    ? stakingMap[userName.staking_id] || null
                    : null,
                referal_name: userName.from_user_name || "",
            }));

            return res
                .status(200)
                .json({
                    success: true,
                    message: "Transaction Fetched Successfully!!",
                    data: data,
                    total: count,
                    total_income: {
                        direct_referral: totalDirectReferral[0]?.total || 0,
                        roi: totalRoi[0]?.total || 0,
                        royalty: totalRoyalty[0]?.total || 0,
                        level: totalLevel[0]?.total || 0,
                        rewards: totalRewards[0]?.total || 0
                    },
                    total_package_amount: totalPackageAmount[0]?.total || 0
                });
        } catch (error) {
            return res
                .status(500)
                .json({ success: false, message: error.message, data: [] });
        }
    },
};
