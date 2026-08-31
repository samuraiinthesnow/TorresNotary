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
  console.warn('DROPBOX_ACCESS_TOKEN is not set. Add it to your .env file before testing uploads.');
}

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
  fetch,
});

function safeFileName(name) {
  return (name || 'document').replace(/[\\/:*?"<>|]/g, '_');
}

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

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

      await dbx.filesUpload({
        path: targetPath,
        contents: file.buffer,
        mode: { '.tag': 'overwrite' },
      });

      uploadedFiles.push({
        name: safeName,
        path: targetPath,
      });
    }

    return res.json({
      ok: true,
      message: 'Files uploaded to Dropbox successfully.',
      metadata,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Dropbox upload failed:', error);

    return res.status(500).json({
      error: 'Dropbox upload failed.',
      details: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Dropbox upload service is running.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dropbox upload service running on http://localhost:${port}`);
});
