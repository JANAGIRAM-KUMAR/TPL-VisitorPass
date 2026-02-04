const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "172.27.17.136",
  user: "admin_user",
  password: "Admin@123",
  database: "gatepass_new"
});

db.connect(err => {
  if (err) {
    console.error("DB Connection Failed:", err);
  } else {
    console.log("MySQL Connected");
  }
});

module.exports = db;
