require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { Dropbox } = require('dropbox');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

if (!process.env.DROPBOX_ACCESS_TOKEN) {
  console.warn('⚠️  DROPBOX_ACCESS_TOKEN is not set. Add it to your .env file before testing uploads.');
} else {
  console.log('✓ DROPBOX_ACCESS_TOKEN is configured');
}

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
  fetch,
});

console.log('Dropbox SDK initialized');

function safeFileName(name) {
  return (name || 'document').replace(/[\\/:*?"<>|]/g, '_');
}

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    console.log('=== UPLOAD REQUEST RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Files received:', req.files ? req.files.length : 0);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach((f, i) => {
        console.log(`  File ${i + 1}: ${f.originalname} (${f.size} bytes)`);
      });
    }

    console.log('Metadata:', {
      name: req.body.name || '(empty)',
      email: req.body.email || '(empty)',
      phone: req.body.phone || '(empty)',
    });

    if (!req.files || req.files.length === 0) {
      console.log('ERROR: No files provided');
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    console.log('Dropbox token present:', process.env.DROPBOX_ACCESS_TOKEN ? 'YES' : 'NO');

    const metadata = {
      name: req.body.name || '',
      email: req.body.email || '',
      phone: req.body.phone || '',
      scheduling_url: req.body.scheduling_url || '',
      uploadedAt: new Date().toISOString(),
    };

    const uploadedFiles = [];

    for (const file of req.files) {
      const timestamp = Date.now();
      const safeName = safeFileName(file.originalname);
      const targetPath = `/NotaryNow/${timestamp}_${safeName}`;

      console.log(`Uploading: ${targetPath}`);

      try {
        await dbx.filesUpload({
          path: targetPath,
          contents: file.buffer,
          mode: { '.tag': 'overwrite' },
        });

        console.log(`✓ SUCCESS: ${targetPath}`);
        uploadedFiles.push({
          name: safeName,
          path: targetPath,
        });
      } catch (fileError) {
        console.error(`✗ FAILED: ${targetPath}`, fileError.message);
        throw fileError;
      }
    }

    console.log('=== UPLOAD COMPLETE ===');
    console.log(`Uploaded ${uploadedFiles.length} file(s)`);

    return res.json({
      ok: true,
      message: 'Files uploaded to Dropbox successfully.',
      metadata,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('=== UPLOAD ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code || 'N/A');
    console.error('Full error:', JSON.stringify(error, null, 2));

    return res.status(500).json({
      error: 'Dropbox upload failed.',
      details: error.message,
      code: error.code || 'UNKNOWN',
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Dropbox upload service is running.' });
});

app.get('/', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'NotaryNow Dropbox upload service is running.',
    frontend: 'https://samuraiinthesnow.github.io/TorresNotary/'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dropbox upload service running on http://localhost:${port}`);
});
