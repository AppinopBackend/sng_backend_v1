const nodemailer = require('nodemailer');

module.exports = {
    sendVerificationCode: async (email, otp) => {
        try {
            console.log('Hereeee we areee....');
            
            let res;
            const transporter = nodemailer.createTransport({
                host: 'smtp.zeptomail.in',
                port: 587,
                secure: false,
                auth: {
                    user: "emailapikey",
                    pass: "PHtE6r1cFrjvi2Au8EAC4qO7FMWgZogt/e1hKFFEtNwXXPEKHE1SrYgqkTLjqUh7U/RGRqTIyI0+5eubtuyGIGboPGxEWGqyqK3sx/VYSPOZsbq6x00atVoScU3cU4bsdNNu0SzTvdrTNA=="
                }
            })
    
            res = await transporter.sendMail({
                from: "noreply@sparknetglobal.in",
                to: email,
                subject: "OTP FOR CONFIRMATION",
                html: `Here is your One time verification code to process your task @Spark Net Global <STRONG>${otp}</STRONG>,  or request is not submitted by you please report us at support@carnivalcoin.io`
            });
    
            console.log("Email Send Successfully! with otp ", otp);
            return "Verification Code Send Successfully!"
        } catch (error) {
            throw new Error(error.message);
        }
    },

    sendDetails: async (data, password) => {
        try {
            let res;
            const transporter = nodemailer.createTransport({
                host: 'smtp.zeptomail.in',
                port: 587,
                secure: false,
                auth: {
                    user: "emailapikey",
                    pass: "PHtE6r1cFrjvi2Au8EAC4qO7FMWgZogt/e1hKFFEtNwXXPEKHE1SrYgqkTLjqUh7U/RGRqTIyI0+5eubtuyGIGboPGxEWGqyqK3sx/VYSPOZsbq6x00atVoScU3cU4bsdNNu0SzTvdrTNA=="
                }
            })
            res = await transporter.sendMail({
                from: "noreply@sparknetglobal.in",
                to: data.email,
                subject: "User Details",
                html: `Welcome to spartnetglobal.in Thank you for registering with us here is you login credentials to continue explore our platform :<BR>
                userid : ${data.user_id} <BR>
                email : ${data.email} <BR>
                password : ${password} <BR>
                `
            })
            console.log("Email Send Succesfully: ", res);
            return "Verification Code Sent Successfully!"
        } catch (error) {
            throw error;
        }
    }
}