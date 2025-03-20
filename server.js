const fs = require("fs");
const express = require("express");
require("dotenv").config();
const mysql = require("mysql");
const multer = require("multer");
const path = require("path");
const pdfParse = require("pdf-parse");
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json()); // To handle JSON data from frontend
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user:  process.env.DB_USER,
    password:  process.env.DB_PASS,
    database:  process.env.DB_NAME,
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Connected to MySQL");
    }
});

// Function to check if PDF contains keywords
const containsKeywords = (text, keywords) => {
    return keywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
};


// Upload and parse PDF, only storing filenames that contain user-defined keywords
app.post("/upload", upload.array("resumes"), async (req, res) => {
    try {
        const { keywords } = req.body;
        if (!keywords || keywords.length === 0) {
            return res.status(400).json({ error: "No keywords provided" });
        }

        const keywordList = keywords.split(",").map(k => k.trim()); // Convert to an array

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        // Deletion of previous data uploaded

db.query("TRUNCATE TABLE resumes",(err)=>{
    if(err) console.error("Error truncating database:",err);
});

        for (const file of req.files) {
            try {
                const dataBuffer = fs.readFileSync(file.path);
                const data = await pdfParse(dataBuffer);
                const pdfText = data.text;

                if (containsKeywords(pdfText, keywordList)) {
                    db.query(
                        "INSERT INTO resumes (filename) VALUES (?)",
                        [file.originalname],
                        (err, result) => {
                            if (err) {
                                console.error("Database Insert Error:", err);
                            } else {
                                console.log(`Inserted resume ID: ${result.insertId}`);
                            }
                        }
                    );
                }

                fs.unlinkSync(file.path); // Delete file after processing
            } catch (err) {
                console.error(`Error processing file ${file.originalname}:`, err);
            }
        }

        res.json({ message: "Resumes uploaded and processed!" });
    } catch (err) {
        console.error("Error handling request:", err);
        res.status(500).json({ error: "Error processing PDFs" });
    }
});

// Fetch resumes from the database
app.get("/resumes", (req, res) => {
    db.query("SELECT id, filename FROM resumes", (err, results) => {
        if (err) {
            console.error("Error fetching resumes:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// Start server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});