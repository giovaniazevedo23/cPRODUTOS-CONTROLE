import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Proxy route for Mercado Pago
app.use('/mp-api', async (req, res) => {
  const targetUrl = 'https://api.mercadopago.com' + req.url;
  
  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Authorization': req.headers['authorization'] || '',
      }
    };
    
    if (req.headers['x-idempotency-key']) {
      fetchOptions.headers['X-Idempotency-Key'] = req.headers['x-idempotency-key'];
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch(e) {
      data = text;
    }
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ message: 'Internal Server Proxy Error', error: error.message });
  }
});

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for React Router
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Keep-alive endpoint
app.get('/ping', (req, res) => res.status(200).send('pong'));

// Self-ping to keep Render free tier alive
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
setInterval(() => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  fetch(`${url}/ping`)
    .then(res => console.log(`[Keep-Alive] Pinged ${url} - Status: ${res.status}`))
    .catch(err => console.error(`[Keep-Alive] Error pinging ${url}:`, err.message));
}, PING_INTERVAL);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
