const db = require('../config/db');
const crypto = require('crypto');

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const TokenModel = {
  create: async (userId, token, expiresAt) => {
    const tokenHash = hashToken(token);
    const sql = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `;
    const [result] = await db.execute(sql, [userId, tokenHash, expiresAt]);
    return result.insertId;
  },

  findByToken: async (token) => {
    const tokenHash = hashToken(token);
    const sql = `
      SELECT * FROM refresh_tokens
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
    `;
    const [rows] = await db.execute(sql, [tokenHash]);
    return rows[0] || null;
  },

  revoke: async (token) => {
    const tokenHash = hashToken(token);
    const sql = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ? AND revoked_at IS NULL
    `;
    const [result] = await db.execute(sql, [tokenHash]);
    return result.affectedRows;
  },

  revokeAllForUser: async (userId) => {
    const sql = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ? AND revoked_at IS NULL
    `;
    const [result] = await db.execute(sql, [userId]);
    return result.affectedRows;
  },

  replace: async (oldToken, newToken, expiresAt) => {
    const oldHash = hashToken(oldToken);
    const newHash = hashToken(newToken);

    // Run in a transaction for atomicity
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Find old token
      const [rows] = await conn.execute(
        'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL FOR UPDATE',
        [oldHash]
      );
      const oldTokenRecord = rows[0];
      if (!oldTokenRecord) {
        throw new Error('Old token not found or already revoked');
      }

      // Revoke old token
      await conn.execute(
        'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = ? WHERE id = ?',
        [newHash, oldTokenRecord.id]
      );

      // Create new token
      await conn.execute(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [oldTokenRecord.user_id, newHash, expiresAt]
      );

      await conn.commit();
      return oldTokenRecord.user_id;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  cleanExpired: async () => {
    const sql = `
      DELETE FROM refresh_tokens
      WHERE expires_at <= NOW() OR revoked_at IS NOT NULL
    `;
    const [result] = await db.execute(sql);
    return result.affectedRows;
  }
};

module.exports = TokenModel;
