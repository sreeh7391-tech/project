require('dotenv').config();
const express        = require('express');
const mysql          = require('mysql2/promise');
const session        = require('express-session');
const cors           = require('cors');
const path           = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── Middleware ─── */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

/* ─── DB Pool ─── */
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10
});

/* ─── Auth middleware ─── */
function requireLogin(req, res, next) {
  if (!req.session.employee) {
    return res.status(401).json({ success: false, message: 'Not logged in.' });
  }
  next();
}

/* ══════════════════════════════════════════
   POST /login
   Body: { empid, password }
   — For demo: password field is checked against
     a hardcoded value. Replace with hashed
     passwords in production.
══════════════════════════════════════════ */
app.post('/login', async (req, res) => {
  const { empid, password } = req.body;

  if (!empid || !password) {
    return res.json({ success: false, message: 'Employee ID and password are required.' });
  }

  // Simple demo password check — replace with bcrypt in production
  if (password !== 'pass123') {
    return res.json({ success: false, message: 'Incorrect password.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT e.empid, e.Name AS empName, d.deptid, d.Name AS deptName
       FROM employee e
       JOIN department d ON e.deptid = d.deptid
       WHERE e.empid = ?`,
      [empid]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: 'No employee found with that ID.' });
    }

    const emp = rows[0];
    req.session.employee = {
      empid:    emp.empid,
      empName:  emp.empName,
      deptid:   emp.deptid,
      deptName: emp.deptName
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      employee: req.session.employee
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
  }
});

/* ══════════════════════════════════════════
   POST /logout
══════════════════════════════════════════ */
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

/* ══════════════════════════════════════════
   GET /session
   Returns current logged-in employee info
══════════════════════════════════════════ */
app.get('/session', (req, res) => {
  if (req.session.employee) {
    res.json({ success: true, employee: req.session.employee });
  } else {
    res.json({ success: false });
  }
});

/* ══════════════════════════════════════════
   GET /categories
   Returns all rows from account table
══════════════════════════════════════════ */
app.get('/categories', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT cat_id, name, balance FROM account ORDER BY cat_id');
    res.json({ success: true, categories: rows });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ success: false, message: 'Database error: ' + err.message });
  }
});

/* ══════════════════════════════════════════
   POST /addTransaction
   Body: { items, amount, cat_id }
   empid comes from session — never from client
══════════════════════════════════════════ */
app.post('/addTransaction', requireLogin, async (req, res) => {
  const { items, amount, cat_id } = req.body;
  const empid = req.session.employee.empid; // always from session

  if (!items || !amount || !cat_id) {
    return res.json({ success: false, message: 'Items, amount, and category are required.' });
  }
  if (isNaN(amount) || parseInt(amount) <= 0) {
    return res.json({ success: false, message: 'Amount must be a positive number.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check balance
    const [accRows] = await conn.query(
      'SELECT cat_id, name, balance FROM account WHERE cat_id = ? FOR UPDATE',
      [cat_id]
    );
    if (accRows.length === 0) {
      await conn.rollback();
      return res.json({ success: false, message: 'Invalid category.' });
    }

    const acc = accRows[0];
    if (parseInt(amount) > acc.balance) {
      await conn.rollback();
      return res.json({
        success: false,
        message: `Insufficient balance. Available: ₹${acc.balance.toLocaleString('en-IN')} in ${acc.name}.`
      });
    }

    // INSERT transaction
    const [result] = await conn.query(
      'INSERT INTO transaction (items, amount, empid, cat_id) VALUES (?, ?, ?, ?)',
      [items, parseInt(amount), empid, cat_id]
    );

    // Deduct from account balance
    await conn.query(
      'UPDATE account SET balance = balance - ? WHERE cat_id = ?',
      [parseInt(amount), cat_id]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: `Transaction #${result.insertId} added successfully.`,
      tid: result.insertId
    });

  } catch (err) {
    await conn.rollback();
    console.error('Transaction error:', err);
    return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
  } finally {
    conn.release();
  }
});

/* ─── Fallback: serve index.html ─── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─── Start ─── */
app.listen(PORT, () => {
  console.log(`✅  Transaction Portal running at http://localhost:${PORT}`);
});