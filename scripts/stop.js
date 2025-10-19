#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('🛑 Stopping TownesDev Bot Platform services...\n');

// Function to kill all Node processes
const killAllNode = () => {
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    const nodeProcesses = lines.filter(line => line.includes('node.exe'));

    if (nodeProcesses.length === 0) {
      console.log('ℹ️  No Node.js processes found');
      return;
    }

    console.log(`🔪 Killing ${nodeProcesses.length} Node.js process(es)...`);

    let killed = 0;
    for (const process of nodeProcesses) {
      const parts = process.split('","');
      const pid = parts[1];
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'pipe' });
        console.log(`✅ Killed Node.js process (PID: ${pid})`);
        killed++;
      } catch (e) {
        // Process might already be gone or access denied
        console.log(`⚠️  Could not kill process (PID: ${pid}) - may already be stopped`);
      }
    }

    console.log(`📊 Successfully killed ${killed} of ${nodeProcesses.length} processes`);
  } catch (e) {
    console.log('ℹ️  No Node.js processes to kill');
  }
};

// Main stop function
async function main() {
  console.log('🔍 Checking for running services...');

  // Kill all Node processes
  killAllNode();

  // Wait a moment for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n✅ Services stopped successfully!');
  console.log('\n💡 Commands:');
  console.log('   npm run status     - Check if services are stopped');
  console.log('   npm run status:api - Quick API check');
  console.log('   npm run start      - Start services again');
}

main().catch(console.error);