import http from 'node:http';
import { createServer as createViteServer } from 'vite';
import liveAvatarTokenHandler from '../api/liveavatar-token.js';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 5174);

function createVercelResponse(response) {
  return {
    setHeader: (...args) => response.setHeader(...args),
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(payload) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(payload));
    }
  };
}

const vite = await createViteServer({
  appType: 'spa',
  server: {
    host,
    middlewareMode: true
  }
});

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith('/api/liveavatar-token')) {
    await liveAvatarTokenHandler(request, createVercelResponse(response));
    return;
  }

  vite.middlewares(request, response);
});

server.listen(port, host, () => {
  console.log(`Clyde website dev server: http://${host}:${port}/`);
});
