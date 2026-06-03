require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* DB CONNECTION */
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10
});

/* ---------------- LOGIN ---------------- */
app.post("/login", async (req, res) => {
    try {
        const { empid, password } = req.body;

        const [rows] = await pool.query(
            "SELECT empid, Name FROM employee WHERE empid=? AND password=?",
            [empid, password]
        );

        if (rows.length === 0) {
            return res.json({ success: false, message: "Invalid login" });
        }

        res.json({
            success: true,
            employee: rows[0]
        });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/* -------- ADD TRANSACTION -------- */
app.post("/addTransaction", async (req, res) => {
    try {
        const { items, amount, empid, cat_id } = req.body;

        const [result] = await pool.query(
            "CALL add_transaction(?,?,?,?)",
            [items, amount, empid, cat_id]
        );

        const counter = result[0][0].counter;

        if (counter === 0) {
            return res.json({
                success: false,
                message: "No Balance"
            });
        }

        res.json({
            success: true,
            message: "Transaction Added"
        });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/* FRONTEND */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});