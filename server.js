const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
}, express.static("uploads"));


app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/gatepass", require("./routes/gatepassRoutes"));

app.listen(8001,"0.0.0.0", () => console.log("Server running on 8001"));
