const multer = require("multer");
const mime = require("mime-types");

const path = require("path");
const fs = require("fs");

const filePath = "public/uploads/";
const iconPath = "public/icons/";
const supportPath = "public/support_assets/";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath);
    }
    cb(null, filePath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + "." + mime.extension(file.mimetype)
    );
  },
});

const icon_storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(iconPath)) {
      fs.mkdirSync(iconPath);
    }
    cb(null, iconPath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + "." + mime.extension(file.mimetype)
    );
  },
});
const support_storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(supportPath)) {
      fs.mkdirSync(supportPath, { recursive: true });
    }
    cb(null, supportPath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + "." + mime.extension(file.mimetype)
    );
  },
});

module.exports = {
  upload: multer({
    storage: storage,
    limits: {
      fieldSize: 10000000,
    },
    fileFilter(req, file, cb) {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
        return cb(new Error("Please upload a valid image file"));
      }
      cb(undefined, true);
    },
  }),

  icon_upload: multer({
    storage: icon_storage,
    limits: {
      fieldSize: 10000000,
    },
    fileFilter(req, file, cb) {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
        return cb(new Error("Please upload a valid image file"));
      }
      cb(undefined, true);
    },
  }),
  support_upload: multer({
    storage: support_storage,
    limits: {
      fieldSize: 10000000,
    },
    fileFilter(req, file, cb) {
      // Allow all files or limit based on your need
      cb(null, true);
    },
  }),
};
