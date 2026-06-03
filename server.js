const http = require('http');

const pythonPid = parseInt(process.argv[2], 10);
if (!process.argv[2] || isNaN(pythonPid)) {
  console.error('Usage: node server.js <pythonPid>');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
  } else if (req.method === 'POST' && req.url === '/shutdown') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    setTimeout(() => {
      process.kill(pythonPid);
      process.exit(0);
    }, 100);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ ok: false }));
  }
});

server.listen(9999, () => {
  console.log('Shutdown listener ready on port 9999');
});
