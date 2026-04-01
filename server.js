const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper Functions ---
function calculateDaysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getAlertStatus(pair) {
    const daysSince = calculateDaysSince(pair.last_updated);
    let alert = null;

    // Phase 1 (Week 1): 10 days
    if (pair.current_phase === 1 && daysSince >= 10) {
        alert = "停滞アラート: 第1期 10日以上経過";
    }
    // Phase 2 (Bi-weekly): 20 days
    else if (pair.current_phase === 2 && daysSince >= 20) {
        alert = "停滞アラート: 第2期 20日以上経過";
    }
    // Phase 3 (Monthly): 40 days
    else if (pair.current_phase === 3 && daysSince >= 40) {
        alert = "停滞アラート: 第3期 40日以上経過";
    }

    return { daysSince, alert };
}

// --- API Endpoints ---

// Get all pairs with status
app.get('/api/pairs', (req, res) => {
    db.getAllPairs((err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const pairsWithStatus = rows.map(pair => {
            const status = getAlertStatus(pair);
            return { ...pair, ...status };
        });
        res.json(pairsWithStatus);
    });
});

// Update Progress (1-click stamp)
// Body: { currentCount: 5 }
app.post('/api/pairs/:id/progress', (req, res) => {
    const pairId = req.params.id;
    const newCount = req.body.currentCount;
    const today = new Date().toISOString().split('T')[0];

    // Determine Phase based on count
    let newPhase = 1;
    let transitionMessage = null;

    if (newCount > 17) {
        // Cap at 17 or handle completion logic
        return res.status(400).json({ error: "Max sessions reached" });
    }

    if (newCount <= 4) {
        newPhase = 1;
        if (newCount === 4) transitionMessage = "第1期終了。第1回移行面談を実施してください。";
    } else if (newCount <= 8) {
        newPhase = 2;
        if (newCount === 8) transitionMessage = "第2期終了。第2回移行面談を実施してください。";
    } else {
        newPhase = 3;
        if (newCount === 17) transitionMessage = "プログラム完了。最終評価面談を実施してください。";
    }

    // Logic to ensure we don't regress phase if we just uncheck? 
    // Requirement says "1-click... updates state". 
    // If user unchecks, we should probably allow regression.
    // So distinct logic: 
    // 0-4 -> Phase 1
    // 5-8 -> Phase 2
    // 9-17 -> Phase 3

    db.updatePairProgress(pairId, newCount, newPhase, today, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Updated", newPhase, transitionMessage });
    });
});

// Add Log (Admin Note)
app.post('/api/pairs/:id/logs', (req, res) => {
    const pairId = req.params.id;
    const logType = req.body.logType; // 'phase1', 'phase2', 'final'
    const content = req.body.content;

    db.addLog(pairId, logType, content, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Log added" });
    });
});

app.get('/api/pairs/:id/logs', (req, res) => {
    const pairId = req.params.id;
    db.getLogsByPairId(pairId, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create Pair
app.post('/api/pairs', (req, res) => {
    const { mentorName, menteeName, startDate } = req.body;
    db.createPair(mentorName, menteeName, startDate, (err, id) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Pair created", id });
    });
});

// Delete Pair
app.delete('/api/pairs/:id', (req, res) => {
    const pairId = req.params.id;
    db.deletePair(pairId, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Pair deleted" });
    });
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
