import { spawnSync } from 'node:child_process';

const targets = {
  p04: {
    label: 'P04',
    mode: 'p04-standalone',
    buildScript: 'build:p04-standalone',
    distDir: 'dist-p04',
    projectEnv: 'CF_PAGES_PROJECT_P04',
    defaultProject: 'phys-p04-standalone',
  },
  p08: {
    label: 'P08',
    mode: 'p08-standalone',
    buildScript: 'build:p08-standalone',
    distDir: 'dist-p08',
    projectEnv: 'CF_PAGES_PROJECT_P08',
    defaultProject: 'phys-p08-standalone',
  },
  p13: {
    label: 'P13',
    mode: 'p13-standalone',
    buildScript: 'build:p13-standalone',
    distDir: 'dist-p13',
    projectEnv: 'CF_PAGES_PROJECT_P13',
    defaultProject: 'phys-p13-standalone',
  },
};

const requested = process.argv.slice(2);
const selected = requested.length > 0 ? requested : Object.keys(targets);

for (const key of selected) {
  if (!targets[key]) {
    console.error(`Unknown Cloudflare deploy target: ${key}`);
    console.error(`Valid targets: ${Object.keys(targets).join(', ')}`);
    process.exit(1);
  }
}

function run(command, args, label, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    shell: true,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

for (const key of selected) {
  const target = targets[key];
  const projectName = process.env[target.projectEnv] || target.defaultProject;
  const env = {
    ...process.env,
    VITE_APP_SCOPE: target.mode,
  };

  console.log(`\n=== ${target.label}: build ${target.buildScript} ===`);
  run('pnpm', [target.buildScript], `${target.label} build`, env);

  console.log(`\n=== ${target.label}: deploy to Cloudflare Pages project "${projectName}" ===`);
  run(
    'npx',
    [
      'wrangler',
      'pages',
      'deploy',
      target.distDir,
      '--project-name',
      projectName,
      '--branch',
      'production',
    ],
    `${target.label} Cloudflare deploy`,
  );
}
