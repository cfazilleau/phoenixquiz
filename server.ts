import { createServer } from 'node:http';
import next from 'next';
import { attachGameSockets } from '@/server/game/socket';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? '0.0.0.0';

// Next and Socket.IO share one HTTP server (and one port), so the Cloudflare tunnel only needs
// to expose a single origin. A single process also keeps every live game in one place.
const httpServer = createServer();
const app = next({ dev, hostname, port, httpServer });
const handle = app.getRequestHandler();

await app.prepare();

httpServer.on('request', (req, res) => {
  void handle(req, res);
});
attachGameSockets(httpServer);

httpServer.listen(port, hostname, () => {
  console.log(`> PhoenixQuiz ready on http://localhost:${port} (${dev ? 'development' : 'production'})`);
});
