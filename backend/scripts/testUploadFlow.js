const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = 'http://127.0.0.1:5000/api';

async function main() {
  try {
    const token = jwt.sign({ id: 'local-user', email: 'local@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Using token:', token.slice(0, 40) + '...');

    const filePath = path.join(process.cwd(), 'test-upload.csv');
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'col1,col2\n1,2\n3,4\n');
      console.log('Wrote', filePath);
    }

    const form = new (globalThis.FormData)();
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer]);
    form.append('file', blob, 'test-upload.csv');

    console.log('Uploading file...');
    const uploadRes = await fetch(`${API}/excel/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const uploadBody = await uploadRes.text();
    console.log('Upload status:', uploadRes.status);
    let uploadJson;
    try { uploadJson = JSON.parse(uploadBody); } catch(e) { console.log('Upload response not JSON:', uploadBody); throw e; }
    console.log('Upload response:', uploadJson);

    const fileId = uploadJson.fileId;
    if (!fileId) throw new Error('No fileId returned');

    console.log('\nFetching metadata...');
    const metaRes = await fetch(`${API}/excel/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Metadata status:', metaRes.status);
    console.log('Metadata:', await metaRes.json());

    console.log('\nFetching file data...');
    const dataRes = await fetch(`${API}/excel/${fileId}/data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Data status:', dataRes.status);
    const dataJson = await dataRes.json();
    console.log('Data keys:', Object.keys(dataJson));
    console.log('First sheet meta:', dataJson.sheets && dataJson.sheets[0] ? { name: dataJson.sheets[0].name, rows: dataJson.sheets[0].metadata?.rows, columns: dataJson.sheets[0].metadata?.columns } : 'no sheets');

    console.log('\nFull test completed successfully');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();
