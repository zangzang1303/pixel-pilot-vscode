const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { ComfyUIAdapter } = require('../out/services/ai/ComfyUIAdapter');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'webview-ui', 'dist', 'index.html');
const port = Number(process.env.PIXEL_PILOT_WEB_PORT || 4173);
const MAX_BODY = 24 * 1024 * 1024;

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

async function bodyOf(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Ảnh gửi lên vượt giới hạn 24 MB.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function imageBuffer(value) {
  if (typeof value !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new Error('Chỉ nhận ảnh PNG, JPEG hoặc WebP từ trình duyệt.');
  }
  const buffer = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
  if (!buffer.length || buffer.length > 18 * 1024 * 1024) throw new Error('Ảnh phải nhỏ hơn 18 MB.');
  return buffer;
}

async function action(payload) {
  const input = imageBuffer(payload.image);
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height || meta.width * meta.height > 20_000_000) throw new Error('Ảnh vượt giới hạn 20 MP.');
  const processor = ImageProcessor.getInstance();
  const comfy = new ComfyUIAdapter();
  const options = payload.options || {};
  let output;
  let text;
  let svg;
  switch (payload.action) {
    case 'removeBackground': {
      const result = await comfy.removeBackground(payload.image);
      if (!result.success || !result.outputImageUri || !result.metrics?.model?.startsWith('ComfyUI')) {
        throw new Error('ComfyUI chưa có model tách nền. Không áp dụng bộ lọc thay thế.');
      }
      output = imageBuffer(result.outputImageUri);
      break;
    }
    case 'recolor':
      output = await processor.recolor(input, options.subject || 'clothes', options.color || 'blue');
      break;
    case 'vectorize': {
      const result = await processor.vectorize(input);
      output = result.previewBuffer;
      svg = result.svgString;
      break;
    }
    case 'caption':
      text = `Thông tin ảnh đo được: ${meta.width} × ${meta.height} px, định dạng ${meta.format}. Chưa có model nhận diện nội dung cho caption ngữ nghĩa.`;
      break;
    default:
      throw new Error(`API chưa hỗ trợ công cụ ${payload.action}.`);
  }
  return { image: output ? `data:image/png;base64,${output.toString('base64')}` : undefined, text, svg };
}

const server = http.createServer(async (request, response) => {
  try {
    const origin = request.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
      return json(response, 403, { error: 'Origin không được phép.' });
    }
    const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    if (request.method === 'GET' && pathname === '/api/health') {
      const comfy = new ComfyUIAdapter();
      return json(response, 200, { ok: true, comfyOnline: await comfy.ping(), provider: 'local' });
    }
    if (request.method === 'POST' && pathname === '/api/action') {
      return json(response, 200, await action(await bodyOf(request)));
    }
    if (request.method === 'POST' && pathname === '/api/generate') {
      const payload = await bodyOf(request);
      const prompt = String(payload.prompt || '').trim();
      if (!prompt || prompt.length > 1000) throw new Error('Prompt phải dài 1–1000 ký tự.');
      const result = await new ComfyUIAdapter().generateImage(prompt, String(payload.negativePrompt || ''), Number(payload.width) || 512, Number(payload.height) || 512);
      if (!result.success || !result.outputImageUri) throw new Error('Provider không trả ảnh.');
      return json(response, 200, { image: result.outputImageUri, model: result.metrics?.model });
    }
    if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return fs.createReadStream(htmlPath).pipe(response);
    }
    json(response, 404, { error: 'Không tìm thấy.' });
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Pixel Pilot Web ready: http://127.0.0.1:${port}/`);
  console.log('Local Canvas + optional ComfyUI model tools. Only accessible from this computer.');
});
