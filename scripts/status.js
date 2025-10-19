#!/usr/bin/env node

import http from 'http';
import { execSync } from 'child_process';

console.log('🔍 Checking TownesDev Bot Platform Status...\n');

// Check API server
const checkAPI = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          if (health.success) {
            console.log('✅ API Server: RUNNING');
            console.log(`   📊 Status: ${health.data.status}`);
            console.log(`   🏷️  Version: ${health.data.version}`);
            console.log(`   🌍 Environment: ${health.data.environment}`);
          } else {
            console.log('❌ API Server: ERROR - Invalid response');
          }
        } catch (e) {
          console.log('❌ API Server: ERROR - Could not parse response');
        }
        resolve();
      });
    });

    req.on('error', () => {
      console.log('❌ API Server: NOT RUNNING (port 3000)');
      resolve();
    });

    req.on('timeout', () => {
      console.log('❌ API Server: TIMEOUT (port 3000)');
      req.destroy();
      resolve();
    });

    req.end();
  });
};

// Check for Node processes
const checkProcesses = () => {
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    const nodeProcesses = lines.filter(line => line.includes('node.exe'));

    console.log(`\n🤖 Node.js Processes: ${nodeProcesses.length} running`);

    if (nodeProcesses.length > 0) {
      console.log('   📋 Process Details:');
      nodeProcesses.forEach((process, index) => {
        const parts = process.split('","');
        const pid = parts[1];
        console.log(`      ${index + 1}. PID: ${pid}`);
      });
    }
  } catch (e) {
    console.log('\n🤖 Node.js Processes: Unable to check');
  }
};

// Main status check
async function main() {
  await checkAPI();
  checkProcesses();

  console.log('\n💡 Commands:');
  console.log('   npm run start    - Start all services');
  console.log('   npm run stop     - Stop all services');
  console.log('   npm run restart  - Restart all services');
  console.log('   npm run status   - Check status (this command)');
}

main().catch(console.error);