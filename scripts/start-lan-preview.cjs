const http = require('node:http');
const net = require('node:net');
const os = require('node:os');

const ports = [5000, 5001, 8080, 9099, 9199];

function isPrivateIPv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => value < 0 || value > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

function getLanAddress() {
  if (process.env.LAN_PREVIEW_HOST) {
    if (!isPrivateIPv4(process.env.LAN_PREVIEW_HOST)) {
      throw new Error('LAN_PREVIEW_HOST must be a private IPv4 address.');
    }
    return process.env.LAN_PREVIEW_HOST;
  }

  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(address => address && address.family === 'IPv4' && !address.internal)
    .map(address => address.address)
    .filter(isPrivateIPv4);
  const address = addresses.find(value => value.startsWith('192.168.'))
    || addresses.find(value => value.startsWith('10.'))
    || addresses[0];
  if (!address) throw new Error('No private IPv4 address found on this computer.');
  return address;
}

const lanAddress = getLanAddress();
const servers = ports.map(port => {
  const server = http.createServer((request, response) => {
    const upstream = http.request({
      host: '127.0.0.1',
      port,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host: `127.0.0.1:${port}` },
    }, upstreamResponse => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('error', error => {
      console.error(`LAN proxy ${port}: ${error.message}`);
      if (!response.headersSent) response.writeHead(502);
      response.end('Local emulator unavailable.');
    });
    request.pipe(upstream);
  });

  server.on('upgrade', (request, socket, head) => {
    const upstream = net.connect(port, '127.0.0.1', () => {
      const headers = { ...request.headers, host: `127.0.0.1:${port}` };
      const lines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
      upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${lines.join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    upstream.on('error', error => {
      console.error(`LAN proxy upgrade ${port}: ${error.message}`);
      socket.destroy();
    });
    socket.on('error', () => upstream.destroy());
  });

  server.listen(port, lanAddress, () => {
    console.log(`LAN ${port} -> 127.0.0.1:${port}`);
  });
  server.on('error', error => {
    console.error(`Could not expose LAN port ${port} on ${lanAddress}: ${error.message}`);
    process.exitCode = 1;
    for (const activeServer of servers) activeServer.close();
  });
  return server;
});

console.log(`Android preview: http://${lanAddress}:5000`);
console.log('Use only on a trusted private Wi-Fi network. Press Ctrl+C to stop the LAN proxy.');
