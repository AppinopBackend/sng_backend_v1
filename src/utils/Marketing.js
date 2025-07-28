const nodemailer = require("nodemailer");

module.exports = {
  sendVerificationCode: async (email, otp) => {
    try {
      console.log("Sending Verification Code....");

      let res;
      const transporter = nodemailer.createTransport({
        host: process.env.MAILER_HOST,
        port: process.env.MAILER_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASS,
        },
        tls: {
          ciphers: "SSLv3",
        },
      });
      console.log("🚀 ~ transporter:", transporter);

      res = await transporter.sendMail({
        from: process.env.MAILER_USER,
        to: email,
        subject: "OTP FOR CONFIRMATION",
        html: `Here is your One time verification code to process your task @Spark Net Global <STRONG>${otp}</STRONG>,  or request is not submitted by you please report us at admin@sparknetglobal.org`,
      });
      console.log("🚀 ~ res:", res);
      return "Verification Code Send Successfully!";
    } catch (error) {
      console.error("[sendVerificationCode] Error:", error);
      throw new Error(error.message);
    }
  },

  sendDetails: async (data, password) => {
    try {
      console.log("Sending Details....");
      let res;
      const transporter = nodemailer.createTransport({
        host: process.env.MAILER_HOST,
        port: process.env.MAILER_PORT,
        secure: false,
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASS,
        },
      });
      res = await transporter.sendMail({
        from: process.env.MAILER_USER,
        to: data.email,
        subject: "User Details",
        html: `Welcome to spartnetglobal.org Thank you for registering with us here is you login credentials to continue explore our platform :<BR>
                userid : ${data.user_id} <BR>
                email : ${data.email} <BR>
                password : ${password} <BR>
                `,
      });
      return "Verification Code Sent Successfully!";
    } catch (error) {
      console.error("[sendDetails] Error:", error);
      throw error;
    }
  },
  sendSupportEmail: async (userMail, data) => {
    try {
      console.log("Sending Support Email....");
      const transporter = nodemailer.createTransport({
        host: process.env.MAILER_HOST,
        port: process.env.MAILER_PORT,
        secure: false,
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASS,
        },
      });
      await transporter.sendMail({
        from: userMail,
        to: process.env.MAILER_USER,
        replyTo: userMail,
        subject: `Support Request from ${data.username}`,
        html: `New support request from Contact Us form:

          <strong>Name:</strong> ${data.username}

          <strong>Email:</strong> ${userMail}

          <strong>Message:</strong>
          ${data.message}`,
        attachments: [
          {
            filename: data.file ? data.file.originalname : "attachment",
            path: data.file,
          },
        ],
      });
      return "Support email sent successfully!";
    } catch (error) {
      console.error("[sendSupportEmail] Error:", error);
      throw error;
    }
  },
};
