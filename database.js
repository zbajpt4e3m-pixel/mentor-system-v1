const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.resolve(__dirname, 'mentor_system.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Pairs Table
        db.run(`CREATE TABLE IF NOT EXISTS pairs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mentor_name TEXT NOT NULL,
            mentee_name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            current_phase INTEGER DEFAULT 1,
            current_count INTEGER DEFAULT 0,
            last_updated TEXT
        )`);

        // Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pair_id INTEGER NOT NULL,
            log_type TEXT NOT NULL, -- 'phase1_end', 'phase2_end', 'final'
            content TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pair_id) REFERENCES pairs(id)
        )`);

        console.log('Database tables initialized.');

        // Seed initial data if empty
        db.get("SELECT count(*) as count FROM pairs", (err, row) => {
            if (err) console.error(err);
            if (row.count === 0) {
                console.log("Seeding initial data...");
                const stmt = db.prepare("INSERT INTO pairs (mentor_name, mentee_name, start_date, last_updated) VALUES (?, ?, ?, ?)");
                const today = new Date().toISOString().split('T')[0];
                stmt.run("Mentee A", "Mentor X", today, today);
                stmt.run("Mentee B", "Mentor Y", today, today);
                stmt.finalize();
            }
        });
    });
}

// Export database/DAL methods
module.exports = {
    db,
    getAllPairs: (callback) => {
        db.all("SELECT * FROM pairs", [], callback);
    },
    updatePairProgress: (id, currentCount, currentPhase, lastUpdated, callback) => {
        const sql = `UPDATE pairs SET current_count = ?, current_phase = ?, last_updated = ? WHERE id = ?`;
        db.run(sql, [currentCount, currentPhase, lastUpdated, id], callback);
    },
    addLog: (pairId, logType, content, callback) => {
        const sql = `INSERT INTO logs (pair_id, log_type, content) VALUES (?, ?, ?)`;
        db.run(sql, [pairId, logType, content], callback);
    },
    getLogsByPairId: (pairId, callback) => {
        db.all("SELECT * FROM logs WHERE pair_id = ?", [pairId], callback);
    },
    createPair: (mentorName, menteeName, startDate, callback) => {
        const sql = `INSERT INTO pairs (mentor_name, mentee_name, start_date, last_updated) VALUES (?, ?, ?, ?)`;
        // Initial last_updated is start_date
        db.run(sql, [mentorName, menteeName, startDate, startDate], function (err) {
            callback(err, this ? this.lastID : null);
        });
    },
    deletePair: (id, callback) => {
        // Also delete logs for integrity? SQLite FKs might handle if cascade is on, 
        // but let's be safe or just delete the pair.
        // First delete logs
        db.run("DELETE FROM logs WHERE pair_id = ?", [id], (err) => {
            if (err) return callback(err);
            db.run("DELETE FROM pairs WHERE id = ?", [id], callback);
        });
    }
};
