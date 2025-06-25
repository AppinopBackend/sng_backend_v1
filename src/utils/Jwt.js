const jwt = require("jsonwebtoken");

const generate_token = async (data, secret, expiry_time) => {
    try {
        const token = await jwt.sign({ data: data }, secret, {
            expiresIn: expiry_time
        });
        return token;
    } catch (error) {
        return { success: false, message: error.message, data: [] };
    }
};

const verify_token = async (token, secret) => {
    try {
        const tokenn = await jwt.verify(token, secret);
        return tokenn;
    } catch (error) {
        return { success: false, message: error.message, data: [] };
    }
};

module.exports = {
    generate_token,
    verify_token,
};