require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Make sure your HTML is in public folder

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10
});

// ====================== LOGIN ENDPOINT ======================
app.post("/login", async (req, res) => {
    try {
        const { empid, password } = req.body;

        const [rows] = await pool.query(
            "SELECT empid FROM employees WHERE empid = ? AND password = ?",
            [empid, password]
        );

        if (rows.length > 0) {
            res.json({ success: true, message: "Login successful" });
        } else {
            res.json({ success: false, message: "Invalid Employee ID or Password" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ====================== ADD TRANSACTION ======================
app.post("/addTransaction", async (req, res) => {
    try {
        const { items, amount, empid, category } = req.body;
        const cat_id = 400 + Number(category);

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
            message: "Transaction Added Successfully"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server Started on port " + (process.env.PORT || 3000));
});