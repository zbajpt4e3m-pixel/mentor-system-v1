const http = require('http');

function postRequest(path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

function deleteRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'DELETE'
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function runTests() {
    console.log("--- Testing Add Pair ---");
    const newPair = JSON.stringify({
        mentorName: "Test Mentor",
        menteeName: "Test Mentee",
        startDate: "2026-02-20"
    });

    try {
        const addRes = await postRequest('/api/pairs', newPair);
        console.log("Add Status:", addRes.status);
        console.log("Add Body:", addRes.body);

        const addBody = JSON.parse(addRes.body);
        if (addRes.status === 200 && addBody.id) {
            console.log("--- Testing Delete Pair ---");
            const delRes = await deleteRequest(`/api/pairs/${addBody.id}`);
            console.log("Delete Status:", delRes.status);
            console.log("Delete Body:", delRes.body);
        }

    } catch (e) {
        console.error("Test Error:", e);
    }
}

runTests();
