const mongoose = require("mongoose");
mongoose.set('strictQuery', true);

const connectdb = (uri) => {
    console.log(uri, " : uri");
    try {
        mongoose.connect(uri,
            {
                // useNewUrlParser: true,
                // useUnifiedTopology: true
            }
        );
        console.log('db connected')
    } catch (err) {
        console.log(err.message);
        process.exit(0)
    }
}

module.exports = connectdb
