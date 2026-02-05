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
    device_permission,
    initiator_name,
    initiator_dept
  } = req.body;

  const year = new Date().getFullYear();

  // 🔎 Find last number used this year
  db.query(
    `SELECT MAX(gate_pass_no) AS lastNo
     FROM gate_pass
     WHERE gate_pass_year = ?`,
    [year],
    (err, result) => {
      if (err) return res.status(500).json(err);

      const nextNo = (result[0].lastNo || 0) + 1;

      // ➕ Insert with yearly number
      db.query(
        `INSERT INTO gate_pass 
        (user_id, visitor_name, visitor_company, purpose, area_of_visit,
         department_code, visitor_type, valid_till, valid_from, device_permission,
         initiator_name, initiator_dept, gate_pass_no, gate_pass_year)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
          device_permission,
          initiator_name,
          initiator_dept,
          nextNo,
          year
        ],
        (err) => {
          if (err) return res.status(500).json(err);

          res.json({
            message: "Gate pass requested",
            gate_pass_no: nextNo,
            gate_pass_year: year
          });
        }
      );
    }
  );
};

/* ADMIN: get pending requests */
exports.getPending = (req, res) => {
  db.query(
    `SELECT gp.*
     FROM gate_pass gp
     WHERE CURDATE() BETWEEN gp.valid_from AND gp.valid_till
       AND NOT EXISTS (
         SELECT 1 FROM gate_pass_logs gpl
         WHERE gpl.gate_pass_id = gp.id
           AND gpl.log_date = CURDATE()
       )
     ORDER BY gp.valid_from`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
};


/* ADMIN: get approved requests */
exports.getApproved = (req, res) => {
  db.query(
    `SELECT gp.*, gpl.entry_time, gpl.exit_time, gpl.photo_path
     FROM gate_pass gp
     JOIN gate_pass_logs gpl
       ON gpl.gate_pass_id = gp.id
     WHERE gpl.log_date = CURDATE()
     ORDER BY gpl.entry_time`,
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
        gp.gate_pass_no,
        gp.gate_pass_year,
        gp.visitor_name,
        gp.visitor_company,
        gp.department_code,
        gp.purpose,
        gp.device_permission,
        gp.status,
        gp.created_at,

        gpl.entry_time,
        gpl.exit_time

     FROM gate_pass gp
     LEFT JOIN gate_pass_logs gpl 
       ON gpl.gate_pass_id = gp.id

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
     (gate_pass_id, log_date, entry_time, photo_path, status)
     VALUES (?, CURDATE(), NOW(), ?, 'IN')`,
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
     SET exit_time = NOW(), status = 'OUT'
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

exports.autoCancelNoShows = (req, res) => {
  db.query(
    `UPDATE gate_pass_logs
     SET status = 'CANCELLED'
     WHERE log_date < CURDATE()
       AND entry_time IS NULL`,
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ cancelled: result.affectedRows });
    }
  );
};
