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
    api_verification
};