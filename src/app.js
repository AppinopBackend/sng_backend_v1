const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const app = express();

app.use(cors());

require("dotenv").config({ path: "./src/config/.env" });
const { PORT, ENV } = process.env;
const config = require("./config/config");
const morgan = require("morgan");

// connect database
require("./db/mongoose")(config["databases"][ENV]);

// Router import goes here
const UserRoutes = require("./routes/UserRouter");
const ReferRoutes = require("./routes/ReferralRouter");
const WalletRoutes = require("./routes/WalletRouter");
const AdminRoutes = require("./routes/AdminRouter");
const StakeRoutes = require("./routes/StakingRouter");
const NewAdminRoutes = require("./routes/NewAdminRouter");
const Bcrypt = require("./utils/Bcrypt");

// Express middleware
app.use(express.json({ limit: "25mb" }));
app.use(
  express.urlencoded({
    limit: "25mb",
    extended: true,
    parameterLimit: 20000000,
  })
);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Morgan for logger
let accessLogStream = fs.createWriteStream(
  path.join(__dirname, "requests.log")
);
morgan.token("body", (req, res) => JSON.stringify(req.body));
app.use(
  morgan(
    ":url :status :method :body :res[content-length] - :response-time ms",
    { stream: accessLogStream }
  )
);

app.use("/public", express.static(path.join(__dirname, "../public")));

// async function PasswordChange() {
//     const pass = 'P@123456';
//     const data = await Bcrypt.passwordEncryption(pass);
//     console.log(data, "Encrypted Password");
// }
// PasswordChange()

// Router middleware goes here
app.use([
  UserRoutes,
  ReferRoutes,
  WalletRoutes,
  AdminRoutes,
  StakeRoutes,
  NewAdminRoutes,
]);
app.listen(PORT, () => {
  console.log("Application is running on : ", PORT);
  const { fork } = require("child_process");
  const childProcess = fork("./src/utils/Child_process.js");
  console.log("we are going to initiate the child process.");
  childProcess.send({ data: 1 }); //send method is used to send message to child process through IPC
});
