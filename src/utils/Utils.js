const crypto = require("crypto");
const { PROJECT_NAME } = process.env;

module.exports = {
    generate_otp: async () => {
        try {
            return Math.random().toString().substr(2, 6);
        } catch (error) {
            throw new Error(error.message);
        }
    },

    generateReferCode: async (check, email_or_phone) => {
        try {
            // let user_code = (check = "email"
                // ? `${email_or_phone
                //       .split("@")[0]
                //       .slice(0, 4)
                //       .toUpperCase()}${crypto.randomInt(0, 1000000)}`
                // ?      `${crypto.randomInt(0, 1000000)}`
                // : `${PROJECT_NAME.slice(0, 4).toUpperCase()}${crypto.randomInt(
                //       0,
                //       1000000000
                //   )}`);


            let user_code = `${crypto.randomInt(0, 1000000)}`
            return user_code;
        } catch (error) {
            throw new Error(error.message);
        }
    },

    check_type: async (value) => {
        if(value.toString().includes("@") && Object.prototype.toString.call(value) === '[object String]') {
            let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
            if(!value.match(regexEmail)){
                throw new Error('Invalid Email Address');
            }
            return "email";
        } else if (/^[0-9]+$/.test(value)){
            let regexMobile = /^[0-9]+$/;
            if(!value.toString().match(regexMobile)) {
                throw new Error('Invalid Mobile Number');
            }
            return "phone";
        }
    },

    address_validation: async(address, chain) => {
        try {
            if(chain === 'BEP20' || chain === 'RIK') {
                const bep20Regex = /^(0x)?[0-9a-fA-F]{40}$/;
                if(!bep20Regex.test(address)) {
                    return false;
                } else {
                    return true;
                }
            } else if(chain === 'TRC20') {
                const bep20Regex = /^(0x)?[0-9a-fA-F]{40}$/;
                if(!bep20Regex.test(address)) {
                    return false;
                } else {
                    return true;
                }
            }
        } catch (error) {
            throw new Error(error.message)
        }
    },

    // Function to generate a unique number
    generateUniqueNumber: async (counter) => {
         
        let uniqueNumber = counter + 1;
         
        return uniqueNumber;
    }
};
