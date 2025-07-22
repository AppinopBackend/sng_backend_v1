const express = require("express");
const router = express.Router();
const { AdminController } = require("../controllers");
const { upload } = require("../utils/Imageupload");
const { admin_verification } = require("../middleware/TokenVerification");

// ===================== AUTHENTICATION =====================
// Admin Login
router.post("/v1/admin/login", AdminController.login);
router.post("/v1/admin/send-otp", AdminController.sendOtp);
router.post("/v1/admin/forgot-password", AdminController.forgotPasswordAdmin);
router.post(
  "/v1/admin/change-password",
  [admin_verification],
  AdminController.changePasswordAdmin
);

// ===================== ADMIN MANAGEMENT =====================
// Add new sub admin
router.post(
  "/v1/admin/add-new-admin",
  [admin_verification],
  AdminController.addNewAdmin
);
// Update sub admin
router.put(
  "/v1/admin/update-subadmin",
  [admin_verification],
  AdminController.updateSubadmin
);
// Delete sub admin
router.delete(
  "/v1/admin/delete-subadmin/:id",
  [admin_verification],
  AdminController.deleteSubadmin
);
// Fetch all admin list
router.get(
  "/v1/admin/admin-list",
  [admin_verification],
  AdminController.adminList
);
// Update Admin login status
router.post(
  "/v1/admin/update-admin-status",
  [admin_verification],
  AdminController.updateAdminLoginStatus
);

// ===================== USER MANAGEMENT =====================
// Fetch all users list
router.get(
  "/v1/admin/user-list",
  [admin_verification],
  AdminController.userList
);
// Update users login status
router.post(
  "/v1/admin/update-user-status",
  [admin_verification],
  AdminController.updateLoginStatus
);
// Fetch users details
router.get(
  "/v1/admin/get-user-details",
  [admin_verification],
  AdminController.getUserDetails
);
// User Backup API
router.get(
  "/v1/admin/all-user-backup",
  [admin_verification],
  AdminController.all_user_backup
);
// User Update Rank
router.put(
  "/v1/admin/update-user-rank",
  [admin_verification],
  AdminController.updateUserRank
);

// ===================== TRANSACTIONS =====================
// Fetch all transactions by type
router.get(
  "/v1/admin/wallettransaction-by-type",
  [admin_verification],
  AdminController.transactionByType
);
// Update Deposit Transaction Status
router.post(
  "/v1/admin/update-deposit-status",
  [admin_verification],
  AdminController.updateDepositStatus
);
// Fetch all deposits
router.post(
  "/v1/admin/all-deposits",
  [admin_verification],
  AdminController.fetchAllDeposit
);
// Fetch all withdrawals
router.post(
  "/v1/admin/all-withdrawals",
  [admin_verification],
  AdminController.fetchAllWithdrawals
);
// Update Withdrawal Transaction Status
router.post(
  "/v1/admin/update-withdrawal-status",
  [admin_verification],
  AdminController.updateWithdrawalStatus
);
// Get Pending Withdrawal List
router.get(
  "/v1/admin/pending-withdrawal-request",
  [admin_verification],
  AdminController.pendingWithdrawalRequest
);
// Add Funds
router.post(
  "/v1/admin/add-funds",
  [admin_verification],
  AdminController.addFunds
);
// Deduct Funds
router.post(
  "/v1/admin/deduct-funds",
  [admin_verification],
  AdminController.deductFunds
);
// Admin Fund Transfer History
router.get(
  "/v1/admin/admin-fund-transfer-history",
  [admin_verification],
  AdminController.fundTransferHistory
);

// ===================== STAKING =====================
// Get Staking list of all users
router.get(
  "/v1/stake/stacking-history",
  [admin_verification],
  AdminController.allUsersPackageList
);
// Add User Stacking
router.post(
  "/v1/admin/add-user-stacking",
  [admin_verification],
  AdminController.addUserStacking
);
// Admin Stacking Transfer History
router.get(
  "/v1/admin/admin-stacking-transfer-history",
  [admin_verification],
  AdminController.adminStakingTransferHistory
);
// Deduct User Stacking (commented out in original)
// router.post('/v1/admin/deduct-user-stacking', AdminController.deductUserStacking);

// ===================== NOTIFICATIONS =====================
// Add Notification
router.post(
  "/v1/admin/create-notification",
  [admin_verification],
  AdminController.add_notification
);
// Notification List
router.get(
  "/v1/admin/get-all-notification",
  [admin_verification],
  AdminController.notification_list
);
// Delete Notification
router.delete(
  "/v1/admin/delete-notification/:id",
  [admin_verification],
  AdminController.delete_notification
);

// ===================== CLASSIC NEWS =====================
// Add Classic News
router.post(
  "/v1/admin/create-classic-news",
  [admin_verification, upload.single("news_image")],
  AdminController.add_classic_news
);
// Classic News List
router.get(
  "/v1/admin/get-all-classic-news",
  [admin_verification],
  AdminController.classic_news_list
);
// Delete Classic News
router.delete(
  "/v1/admin/delete-classic-news/:id",
  [admin_verification],
  AdminController.delete_classic_news
);

// ===================== DASHBOARD =====================
// Dashboard API
router.get(
  "/v1/admin/dashboard",
  [admin_verification],
  AdminController.dashboard
);

module.exports = router;
