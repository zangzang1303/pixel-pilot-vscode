import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 9090;
const HOST = '127.0.0.1';

// In-memory queue & images store
const jobs = new Map();
const images = new Map();

// Sample base64 512x512 PNG image
const samplePngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAFFJREFUeJztwTEBAAAAwqD1T20LL6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gxlUAAB9O3n2AAAAABJRU5ErkJggg==';
const defaultImageBuffer = Buffer.from(samplePngBase64, 'base64');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  console.log(`[InvokeAI Mock] ${req.method} ${pathname}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. Health & Ping
  if (pathname === '/api/v1/app/version' || pathname === '/api/v1/app/config' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ version: '5.2.0', status: 'ok', app_version: '5.2.0' }));
    return;
  }

  // 2. Models list
  if (pathname === '/api/v1/models/' || pathname === '/api/v2/models/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        models: [
          {
            key: 'sdxl_base_1.0',
            name: 'SDXL Base 1.0',
            base_model: 'sdxl',
            type: 'main',
            description: 'Stable Diffusion XL Base model'
          },
          {
            key: 'sd_v1.5',
            name: 'Stable Diffusion v1.5',
            base_model: 'sd-1',
            type: 'main',
            description: 'Standard SD 1.5 model'
          },
          {
            key: 'flux_1_schnell',
            name: 'FLUX.1 [schnell]',
            base_model: 'flux',
            type: 'main',
            description: 'High-speed 4-step FLUX model'
          },
          {
            key: 'dreamshaper_8',
            name: 'DreamShaper 8',
            base_model: 'sd-1',
            type: 'main',
            description: 'Creative artistic photorealism'
          }
        ]
      })
    );
    return;
  }

  // 3. Enqueue Batch
  if (pathname === '/api/v1/queue/default/enqueue_batch' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const itemId = Math.floor(Math.random() * 100000);
      const batchId = `batch_${Date.now()}`;
      const imageName = `mock_image_${Date.now()}.png`;

      // Store image
      images.set(imageName, defaultImageBuffer);

      // Store job with delayed progression
      jobs.set(itemId, {
        status: 'in_progress',
        createdAt: Date.now(),
        imageName
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          item_ids: [itemId],
          batch: { batch_id: batchId }
        })
      );
    });
    return;
  }

  // 4. Queue Item Status
  const statusMatch = pathname.match(/\/api\/v1\/queue\/default\/i\/(\d+)\/status/);
  if (statusMatch) {
    const itemId = parseInt(statusMatch[1], 10);
    const job = jobs.get(itemId);

    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Job not found' }));
      return;
    }

    const elapsed = Date.now() - job.createdAt;
    // Complete after 3.5 seconds
    const status = elapsed > 3500 ? 'completed' : 'in_progress';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        item_id: itemId,
        status: status,
        session: {
          results: {
            latents_to_image: {
              image: { image_name: job.imageName }
            }
          }
        }
      })
    );
    return;
  }

  // 5. Image Download
  const imgMatch = pathname.match(/\/api\/v1\/images\/i\/(.+)\/full/);
  if (imgMatch) {
    const imgName = imgMatch[1];
    const imgBuffer = images.get(imgName) || defaultImageBuffer;

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imgBuffer.length
    });
    res.end(imgBuffer);
    return;
  }

  // 6. Image Upload (for upscale)
  if (pathname === '/api/v1/images/upload' && req.method === 'POST') {
    const imageName = `uploaded_${Date.now()}.png`;
    images.set(imageName, defaultImageBuffer);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ image_name: imageName }));
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 InvokeAI Mock Backend is RUNNING on http://${HOST}:${PORT}`);
  console.log(`   Extension "Pixel Pilot" will now show: 🟢 Online`);
  console.log(`   Press Ctrl+C to stop.`);
  console.log(`========================================================\n`);
});

