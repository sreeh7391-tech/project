require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10
});

// Test DB Connection
pool.getConnection()
    .then(conn => {
        console.log("✅ Database Connected Successfully");
        conn.release();
    })
    .catch(err => {
        console.error("❌ Database Connection Failed:", err.message);
    });

// ====================== LOGIN ENDPOINT ======================
// ====================== LOGIN ENDPOINT ======================
app.post("/login", async (req, res) => {
    try {
        const { empid, password } = req.body;

        if (!empid || !password) {
            return res.json({
                success: false,
                message: "Employee ID and Password are required"
            });
        }

        const [rows] = await pool.query(
            "SELECT empid, password FROM employee WHERE empid = ? LIMIT 1",
            [empid]
        );

        if (rows.length === 0) {
            return res.json({
                success: false,
                message: "Employee ID not found"
            });
        }

        if (
            String(rows[0].password).trim() ===
            String(password).trim()
        ) {
            return res.json({
                success: true,
                message: "Login successful"
            });
        }

        return res.json({
            success: false,
            message: "Incorrect password"
        });

    } catch (err) {
        console.error("Login Error:", err);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});
// ====================== ADD TRANSACTION ======================
app.post("/addTransaction", async (req, res) => {
    try {
        const { items, amount, empid, category } = req.body;

        if (!items || !amount || !empid || !category) {
            return res.json({ success: false, message: "All fields are required" });
        }

        const cat_id = 400 + Number(category);

        const [result] = await pool.query(
            "CALL add_transaction(?,?,?,?)",
            [items, amount, empid, cat_id]
        );

        const counter = result[0][0]?.counter || 0;

        if (counter === 0) {
            return res.json({ success: false, message: "No Balance" });
        }

        res.json({ success: true, message: "Transaction Added Successfully" });
    } catch (err) {
        console.error("Transaction Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Server error - " + err.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server Started on http://localhost:${PORT}`);
});