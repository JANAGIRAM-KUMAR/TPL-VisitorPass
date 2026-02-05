const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res) => {
  const { name, user_code, password, department } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (name,user_code,password,department) VALUES (?,?,?,?)",
    [name, user_code, hashed, department],
    (err) => {
      if (err) return res.status(400).json(err);
      res.json({ message: "User registered successfully" });
    }
  );
};

exports.login = (req, res) => {
  const { user_code, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE user_code=?",
    [user_code],
    async (err, results) => {
      if (results.length === 0)
        return res.status(401).json({ message: "Invalid User ID" });

      const user = results[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match)
        return res.status(401).json({ message: "Wrong password" });

      const token = jwt.sign(
        { id: user.id, role: user.role },
        "SECRET_KEY",
        { expiresIn: "1d" }
      );

      res.json({
        token,
        role: user.role,
        user_code: user.user_code,
        name: user.name
      });
    }
  );
};

