const db = require("../config/db");

const findByEmail = async (email) => {
  const [rows] = await db.execute(
    "SELECT id, name, email, password, role, phone, approval_status, created_at FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
};

const create = async ({ name, email, password, role, phone = null, approval_status = null }) => {
  const [result] = await db.execute(
    `INSERT INTO users (name, email, password, role, phone, approval_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, password, role, phone, approval_status]
  );
  return result.insertId;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    "SELECT id, name, email, role, phone, approval_status, created_at FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
};

const getAll = async (limit, offset) => {
  let sql = "SELECT id, name, email, role, phone, approval_status, created_at FROM users ORDER BY id DESC";
  if (limit !== undefined && offset !== undefined) {
    const cleanLimit = Math.max(0, parseInt(limit));
    const cleanOffset = Math.max(0, parseInt(offset));
    if (!isNaN(cleanLimit) && !isNaN(cleanOffset)) {
      sql += ` LIMIT ${cleanLimit} OFFSET ${cleanOffset}`;
    }
  }
  const [rows] = await db.execute(sql);
  return rows;
};

const setApprovalStatus = async (id, status) => {
  await db.execute("UPDATE users SET approval_status = ? WHERE id = ?", [status, id]);
};

const updateRole = async (id, role) => {
  await db.execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);
};

const deleteUser = async (id) => {
  await db.execute("DELETE FROM users WHERE id = ?", [id]);
};

const updatePasswordHash = async (id, passwordHash) => {
  await db.execute("UPDATE users SET password = ? WHERE id = ?", [passwordHash, id]);
};

const getResponderAnalytics = async () => {
  const [rows] = await db.execute(
    `SELECT approval_status, COUNT(*) as count 
     FROM users 
     WHERE role NOT IN ('citizen', 'admin') 
     GROUP BY approval_status`
  );
  return rows;
};

module.exports = {
  findByEmail,
  create,
  findById,
  getAll,
  setApprovalStatus,
  updateRole,
  updatePasswordHash,
  delete: deleteUser,
  getResponderAnalytics
};
