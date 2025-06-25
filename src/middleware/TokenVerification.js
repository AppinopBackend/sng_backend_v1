const jwt = require("../utils/Jwt");
const { JWT_SECRET, API_SECRET } = process.env;

const token_verification = async (req, res, next) => {
    try {
        const header = req.header("Authorization");
        if (header === undefined) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized Request!",
                data: [],
            });
        }
        const token = header.replace("Bearer ", "");
        const user = await jwt.verify_token(token, JWT_SECRET);
        req.user = user.data;
        return next();
    } catch (e) {
        return res.status(401).json({
            success: false,
            message: `Token is expired with message: ${e.message}`,
            data: [],
        });
    }
};

const admin_verification = async (req, res, next) => {
    try {
        const header = req.header("Authorization");
        if (header === undefined) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized Request!",
                data: [],
            });
        }
        const token = header.replace("Bearer ", "");
        const user = await jwt.verify_token(token, JWT_SECRET);
        // Check if user exists and has admin properties
        if (!user.data) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required!",
                data: [],
            });
        }
        
        // Check if admin status is ACTIVE
        if (user.data.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: "Your admin account is deactivated. Please contact super admin!",
                data: [],
            });
        }
        
        req.user = user.data;
        return next();
    } catch (e) {
        console.log(e)
        return res.status(401).json({
            success: false,
            message: `Token is expired with message: ${e.message}`,
            data: [],
        });
    }
};

const api_verification = async (req, res, next) => {
    try {
        const header = req.header("Authorization");
        console.log(header)
        if (header === undefined) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized Request!",
                data: [],
            });
        }
        const token = header.replace("Bearer ", "");
        if(token != API_SECRET) {
            return res.status(401).json({success: false, message: 'You are not authorized', data: []})
        }
        req.user = token
        return next();
    } catch (e) {
        return res.status(401).json({
            success: false,
            message: `Token is expired with message: ${e.message}`,
            data: [],
        });
    }
};

module.exports = {
    token_verification,
    admin_verification,
    api_verification
};