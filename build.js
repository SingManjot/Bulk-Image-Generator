const fs = require('fs');
const path = require('path');

// Load .env manually (no extra packages needed)
const env = fs.readFileSync('.env', 'utf8')
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});

// Read template and replace placeholders
let template = fs.readFileSync('manifest.template.json', 'utf8');

template = template.replace(/{{(\w+)}}/g, (_, key) => {
  if (!env[key]) throw new Error(`Missing .env value for: ${key}`);
  return env[key];
});

// Write final manifest.json
fs.writeFileSync('manifest.json', template);
console.log('✅ manifest.json generated successfully');
