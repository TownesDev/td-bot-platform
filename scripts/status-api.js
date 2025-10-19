#!/usr/bin/env node

import http from 'http';

const checkAPI = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          if (health.success) {
            console.log('✅ API Server is RUNNING');
            console.log(`   Status: ${health.data.status}`);
            console.log(`   Environment: ${health.data.environment}`);
            process.exit(0);
          } else {
            console.log('❌ API Server responded but health check failed');
            process.exit(1);
          }
        } catch (e) {
          console.log('❌ API Server responded but returned invalid JSON');
          process.exit(1);
        }
        resolve();
      });
    });

    req.on('error', () => {
      console.log('❌ API Server is NOT RUNNING');
      process.exit(1);
    });

    req.on('timeout', () => {
      console.log('❌ API Server TIMEOUT - may be running but slow to respond');
      req.destroy();
      process.exit(1);
    });

    req.end();
  });
};

checkAPI();