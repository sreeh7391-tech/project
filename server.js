require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10
});

app.post("/addTransaction", async (req, res) => {

    try {

        const {
            items,
            amount,
            empid,
            category
        } = req.body;

        const cat_id = 400 + Number(category);

        const [result] = await pool.query(
            "CALL add_transaction(?,?,?,?)",
            [
                items,
                amount,
                empid,
                cat_id
            ]
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
    console.log("Server Started");
});