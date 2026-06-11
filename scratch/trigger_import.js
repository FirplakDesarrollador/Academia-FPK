
const fs = require('fs');
const http = require('http');

let content = fs.readFileSync('scratch/ods_data.json', 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
}
const allUsers = JSON.parse(content);

const CONFIG = {
    cursoId: '86eb9037-31d0-4914-bb03-56cabdf51229',
    leccionIds: [
        'f08f6085-17ff-4459-9c5d-df508d2dd9af',
        '87622cc7-fc15-4a74-9bba-9af426fa954d',
        '396c66ad-5741-4721-89bd-3a2dd18b952f'
    ],
    rolId: 3,
    batchSize: 50
};

async function sendBatch(users) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            users,
            ...CONFIG
        });

        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/bulk-import',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function run() {
    console.log(`Starting import of ${allUsers.length} records...`);
    const totalCreated = { created: 0, alreadyExists: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < allUsers.length; i += CONFIG.batchSize) {
        const batch = allUsers.slice(i, i + CONFIG.batchSize);
        console.log(`Processing batch ${Math.floor(i / CONFIG.batchSize) + 1}...`);
        
        try {
            const result = await sendBatch(batch);
            console.log(`Batch Result:`, JSON.stringify(result));
            totalCreated.created += result.created || 0;
            totalCreated.alreadyExists += result.alreadyExists || 0;
            totalCreated.skipped += result.skipped || 0;
            totalCreated.errors += result.errors ? result.errors.length : 0;
        } catch (err) {
            console.error(`Batch Error: ${err.message}`);
        }
    }

    console.log('\n--- FINAL REPORT ---');
    console.log(`Total Records: ${allUsers.length}`);
    console.log(`New Accounts: ${totalCreated.created}`);
    console.log(`Existing Accounts: ${totalCreated.alreadyExists}`);
    console.log(`Skipped (No Match): ${totalCreated.skipped}`);
    console.log(`Errors encountered: ${totalCreated.errors}`);
}

run();
