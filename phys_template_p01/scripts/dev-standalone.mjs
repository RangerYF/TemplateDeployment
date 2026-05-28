import { spawn } from 'node:child_process';

const apps = [
  { name: 'P04', mode: 'p04-standalone', port: 5173 },
  { name: 'P08', mode: 'p08-standalone', port: 5174 },
  { name: 'P13', mode: 'p13-standalone', port: 5175 },
];

const children = apps.map((app) => {
  const child = spawn(
    'vite',
    ['--mode', app.mode, '--host', '0.0.0.0', '--port', String(app.port), '--strictPort'],
    {
      env: {
        ...process.env,
        VITE_APP_SCOPE: app.mode,
      },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const prefix = `[${app.name}]`;
  child.stdout.on('data', (chunk) => {
    process.stdout.write(`${prefix} ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`${prefix} ${chunk}`);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${prefix} stopped by ${signal}`);
      return;
    }
    if (code !== 0) {
      console.log(`${prefix} exited with code ${code}`);
    }
  });

  return child;
});

console.log('Standalone dev servers starting:');
console.log('  P04  http://localhost:5173');
console.log('  P08  http://localhost:5174');
console.log('  P13  http://localhost:5175');
console.log('Press Ctrl+C to stop all servers.');

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
