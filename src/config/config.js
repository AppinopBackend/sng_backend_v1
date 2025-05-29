module.exports = {
    "databases": {
        "development":process.env.DEV_DB_URI,
        "production":  process.env.PROD_DB_URI,
    }
}