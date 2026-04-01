const API_URL = '/api/pairs';

// State
let pairs = [];

// DOM Elements
const pairsGrid = document.getElementById('pairs-grid');
const dashboardBody = document.getElementById('dashboard-body');
const dashboardTable = document.getElementById('dashboard-table');
const logModal = document.getElementById('log-modal');
const logContent = document.getElementById('log-content');
const closeModalBtn = document.getElementById('close-modal');
const saveLogBtn = document.getElementById('save-log');

// Add Pair Elements
const addPairBtn = document.getElementById('add-pair-btn');
const addPairModal = document.getElementById('add-pair-modal');
const closeAddModalBtn = document.getElementById('close-add-modal');
const saveNewPairBtn = document.getElementById('save-new-pair');
const newMentorInput = document.getElementById('new-mentor');
const newMenteeInput = document.getElementById('new-mentee');
const newStartDateInput = document.getElementById('new-start-date');

let currentLogPairId = null;

// Sorting State
let sortConfig = { key: 'name', direction: 'asc' };

// Initialization
async function init() {
    // Set default date for new pair
    if (newStartDateInput) newStartDateInput.valueAsDate = new Date();
    await fetchPairs();
    renderBoard();
    renderDashboard();
    setupSorting();
}

async function fetchPairs() {
    try {
        const res = await fetch(API_URL);
        pairs = await res.json();
    } catch (err) {
        console.error("Failed to fetch pairs", err);
    }
}

function renderBoard() {
    if (!pairsGrid) return;
    pairsGrid.innerHTML = '';
    pairs.forEach(pair => {
        const card = createPairCard(pair);
        pairsGrid.appendChild(card);
    });
}

function renderDashboard() {
    if (!dashboardBody) return;
    dashboardBody.innerHTML = '';

    const sortedPairs = sortPairs([...pairs]);

    sortedPairs.forEach(pair => {
        const tr = document.createElement('tr');
        const progressPercent = Math.round((pair.current_count / 17) * 100);
        const daysSince = calculateDaysAgo(pair.last_updated);

        // Stalled highlight (e.g., 10+ days)
        if (daysSince >= 10) {
            tr.classList.add('stagnated-row');
        }

        // Waiting for meeting highlight
        const isMeetingWaiting = [4, 8, 17].includes(pair.current_count);
        if (isMeetingWaiting) {
            tr.classList.add('meeting-waiting-row');
        }

        let nextMeetingMsg = "";
        if (pair.current_count < 4) nextMeetingMsg = `あと ${4 - pair.current_count} 回`;
        else if (pair.current_count < 8) nextMeetingMsg = `あと ${8 - pair.current_count} 回`;
        else if (pair.current_count < 17) nextMeetingMsg = `あと ${17 - pair.current_count} 回`;
        else nextMeetingMsg = "完了";

        tr.innerHTML = `
            <td><strong>${pair.mentor_name}</strong> & ${pair.mentee_name}</td>
            <td>
                <div class="mini-progress-bg">
                    <div class="mini-progress-fill" style="width: ${progressPercent}%"></div>
                </div>
            </td>
            <td>${progressPercent}% (${pair.current_count}/17)</td>
            <td>第${pair.current_phase}期</td>
            <td>${daysSince}日経過</td>
            <td>${nextMeetingMsg}</td>
        `;
        dashboardBody.appendChild(tr);
    });
}

function sortPairs(pairsToSort) {
    return pairsToSort.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'name') {
            valA = a.mentor_name;
            valB = b.mentor_name;
        } else if (sortConfig.key === 'progress') {
            valA = a.current_count;
            valB = b.current_count;
        } else if (sortConfig.key === 'days') {
            valA = calculateDaysAgo(a.last_updated);
            valB = calculateDaysAgo(b.last_updated);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function setupSorting() {
    if (!dashboardTable) return;
    const headers = dashboardTable.querySelectorAll('th.sortable');
    headers.forEach(header => {
        header.onclick = () => {
            const key = header.dataset.sort;
            if (sortConfig.key === key) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = key;
                sortConfig.direction = 'asc';
            }
            renderDashboard();
        };
    });
}

function createPairCard(pair) {
    const card = document.createElement('div');
    card.className = `pair-card ${pair.alert ? 'stagnated' : ''}`;

    const header = `
        <div class="pair-header">
            <div class="pair-info-row">
                <div class="pair-names">
                    <h3>${pair.mentor_name} <span class="role-label">(メンター)</span> & ${pair.mentee_name} <span class="role-label">(メンティー)</span></h3>
                    <p>開始日: ${new Date(pair.start_date).toLocaleDateString()} | 最終更新: ${calculateDaysAgo(pair.last_updated)}日前</p>
                    ${pair.alert ? `<div class="alert-message">${pair.alert}</div>` : ''}
                </div>
                <div class="header-actions">
                   <div class="phase-indicator">第${pair.current_phase}期</div>
                   <button class="btn-danger-sm" onclick="handleDeletePair(${pair.id})">削除</button>
                </div>
            </div>
        </div>
    `;

    const progressSection = document.createElement('div');
    progressSection.className = 'progress-section';

    // Phase 1 (1-4)
    progressSection.appendChild(createStampGroup(pair, 1, 4, "第1期 (週1回)"));
    // Phase 2 (5-8)
    progressSection.appendChild(createStampGroup(pair, 5, 8, "第2期 (隔週)"));
    // Phase 3 (9-17)
    progressSection.appendChild(createStampGroup(pair, 9, 17, "第3期 (月1回)"));

    card.innerHTML = header;
    card.appendChild(progressSection);

    return card;
}

function createStampGroup(pair, start, end, label) {
    const group = document.createElement('div');
    group.className = 'stamp-group';

    const labelEl = document.createElement('div');
    labelEl.className = 'stamp-group-label';
    labelEl.textContent = label;
    group.appendChild(labelEl);

    for (let i = start; i <= end; i++) {
        const stamp = document.createElement('div');
        stamp.className = `stamp ${i <= pair.current_count ? 'checked' : ''}`;
        if (i === 4 || i === 8 || i === 17) {
            stamp.classList.add('intervention');
            stamp.title = "管理者確認";
        }
        stamp.textContent = i;
        stamp.onclick = () => handleStampClick(pair, i);
        group.appendChild(stamp);
    }

    return group;
}

async function handleStampClick(pair, sessionNumber) {
    let newCount = sessionNumber;
    if (pair.current_count === sessionNumber) {
        newCount = sessionNumber - 1;
    }

    try {
        const res = await fetch(`/api/pairs/${pair.id}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentCount: newCount })
        });
        const data = await res.json();

        if (data.transitionMessage) {
            alert(data.transitionMessage);
            openLogModal(pair.id, data.transitionMessage);
        }

        // Refresh board
        await init();

    } catch (err) {
        console.error("Error updating progress", err);
    }
}

// Modal Logic
function openLogModal(pairId, context) {
    currentLogPairId = pairId;
    document.getElementById('modal-title').textContent = context || "面談記録";
    logModal.classList.remove('hidden');
}

closeModalBtn.onclick = () => {
    logModal.classList.add('hidden');
    logContent.value = '';
    currentLogPairId = null;
};

// Add Pair Logic
addPairBtn.onclick = () => {
    addPairModal.classList.remove('hidden');
};

closeAddModalBtn.onclick = () => {
    addPairModal.classList.add('hidden');
    newMentorInput.value = '';
    newMenteeInput.value = '';
};

saveNewPairBtn.onclick = async () => {
    const mentorName = newMentorInput.value;
    const menteeName = newMenteeInput.value;
    const startDate = newStartDateInput.value;

    if (!mentorName || !menteeName || !startDate) {
        alert("すべての項目を入力してください");
        return;
    }

    try {
        await fetch('/api/pairs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mentorName, menteeName, startDate })
        });
        closeAddModalBtn.click();
        await init(); // Refresh
    } catch (err) {
        console.error("Error creating pair", err);
    }
};

window.handleDeletePair = async (id) => {
    if (!confirm("本当にこのペアを削除しますか？\nこの操作は取り消せません。")) return;

    try {
        await fetch(`/api/pairs/${id}`, { method: 'DELETE' });
        await init();
    } catch (err) {
        console.error("Error deleting pair", err);
    }
};

function calculateDaysAgo(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

saveLogBtn.onclick = async () => {
    if (!currentLogPairId) return;
    const content = logContent.value;

    try {
        await fetch(`/api/pairs/${currentLogPairId}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logType: 'admin_log', content })
        });
        closeModalBtn.click();
        alert("記録を保存しました");
    } catch (err) {
        console.error("Error saving log", err);
    }
};

// Start
init();
