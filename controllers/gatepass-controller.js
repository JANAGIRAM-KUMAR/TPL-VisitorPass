const db = require("../config/db");

/* USER creates gate pass */

exports.createRequest = (req, res) => {
  const {
    visitor_name,
    visitor_company,
    purpose,
    area_of_visit,
    department_code,
    visitor_type,
    valid_till,
    valid_from,
    device_permission
  } = req.body;

  db.query(
    `INSERT INTO gate_pass 
    (user_id, visitor_name, visitor_company, purpose, area_of_visit,
     department_code, visitor_type, valid_till, valid_from, device_permission)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      req.user.id,
      visitor_name,
      visitor_company,
      purpose,
      area_of_visit,
      department_code,
      visitor_type,
      valid_till,
      valid_from,
      device_permission
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json(err);
      }
      res.json({ message: "Gate pass requested" });
    }
  );
};


/* ADMIN: get pending requests */
exports.getPending = (req, res) => {
  console.log("AUTH USER:", req.user);

  db.query(
    `SELECT gp.*, u.name, u.department
     FROM gate_pass gp
     JOIN users u ON gp.user_id = u.id
     WHERE gp.status = 'PENDING'
     ORDER BY gp.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
};

/* ADMIN: get approved requests */
exports.getApproved = (req, res) => {
  db.query(
    `SELECT gp.*, u.name, u.department
     FROM gate_pass gp
     JOIN users u ON gp.user_id = u.id
     WHERE gp.status = 'APPROVED'
     ORDER BY gp.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
};

/* ADMIN: approve with photo */
exports.approveRequest = (req, res) => {
  const { id } = req.params;
  const photo = req.file?.filename;

  db.query(
    `UPDATE gate_pass
     SET status='APPROVED',
         approver_id=?,
         photo_path=?
     WHERE id=?`,
    [req.user.id, photo, id],
    () => res.json({ message: "Gate pass approved" })
  );
};

exports.getGatePassById = (req, res) => {
  const { id } = req.params;

  db.query(
    `SELECT gp.*, u.name, u.department
     FROM gate_pass gp
     JOIN users u ON gp.user_id = u.id
     WHERE gp.id = ?`,
    [id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      if (results.length === 0)
        return res.status(404).json({ message: "Gate pass not found" });

      res.json(results[0]);
    }
  );
};

exports.getReportData = (req, res) => {
  const { from, to } = req.query;

  db.query(
    `SELECT 
      gp.id,
      gp.visitor_name,
      gp.visitor_company,
      gp.department_code,
      gp.visitor_type,
      gp.device_permission,
      gp.purpose,
      gp.valid_till,
      gp.valid_from,
      gp.status,
      gp.created_at,
      u.name AS requested_by
     FROM gate_pass gp
     JOIN users u ON gp.user_id = u.id
     WHERE DATE(gp.created_at) BETWEEN ? AND ?
     ORDER BY gp.created_at DESC`,
    [from, to],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
};

/* SEARCH valid visitors for TODAY */
exports.searchValidVisitors = (req, res) => {
  const { name } = req.query;

  db.query(
    `SELECT *
     FROM gate_pass
     WHERE visitor_name LIKE ?
       AND status = 'APPROVED'
       AND CURDATE() BETWEEN valid_from AND valid_till`,
    [`%${name}%`],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
};

/* MARK IN (entry time) */
exports.markIn = (req, res) => {
  const { gate_pass_id } = req.body;
  const photo = req.file?.filename;

  if (!photo)
    return res.status(400).json({ message: "Photo is required for entry" });

  db.query(
    `INSERT INTO gate_pass_logs
     (gate_pass_id, log_date, entry_time, photo_path)
     VALUES (?, CURDATE(), NOW(), ?)`,
    [gate_pass_id, photo],
    (err) => {
      if (err)
        return res.status(400).json({ message: "Already marked IN today" });

      res.json({ message: "IN time + photo recorded" });
    }
  );
};


/* MARK OUT (exit time) */
exports.markOut = (req, res) => {
  const { gate_pass_id } = req.body;

  db.query(
    `UPDATE gate_pass_logs
     SET exit_time = NOW()
     WHERE gate_pass_id = ?
       AND log_date = CURDATE()
       AND exit_time IS NULL`,
    [gate_pass_id],
    (err, result) => {
      if (result.affectedRows === 0)
        return res.status(400).json({ message: "OUT already marked or no IN found" });

      res.json({ message: "OUT time recorded" });
    }
  );
};

/* GET today status (IN / OUT / NONE) */
exports.getTodayLog = (req, res) => {
  const { id } = req.params;

  db.query(
    `SELECT *
     FROM gate_pass_logs
     WHERE gate_pass_id = ?
       AND log_date = CURDATE()`,
    [id],
    (err, results) => {
      res.json(results[0] || null);
    }
  );
};

