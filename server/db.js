
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)){
    fs.mkdirSync(DATA_DIR);
}
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'invest_track_v2.db');

const sqlite3Verbose = sqlite3.verbose();
export const db = new sqlite3Verbose.Database(DB_PATH);

const SCHEMA_PATH = path.join(__dirname, 'db', 'schema.sql');

export const initDB = () => {
    db.serialize(() => {
        db.run("PRAGMA journal_mode = WAL;");
        db.run("PRAGMA foreign_keys = ON;");

        const initSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(initSql, (err) => {
            if (err) console.error("DB Init Error:", err);
            else console.log("Database initialized successfully at", DB_PATH);
        });
    });
};

export const runQuery = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

export const getQuery = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

export const withTransaction = async (callback) => {
    try {
        await runQuery("BEGIN TRANSACTION");
        const result = await callback();
        await runQuery("COMMIT");
        return result;
    } catch (err) {
        await runQuery("ROLLBACK");
        console.error("Transaction failed, rolled back.", err);
        throw err;
    }
};
