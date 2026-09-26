const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Load environment variables manually so we don't need 'dotenv' dependency in root
const envPath = path.join(__dirname, 'backend', '.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = match[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length-1) === '"') {
                value = value.replace(/(^"|"$)/g, '').replace(/\\n/g, '\n');
            }
            process.env[key] = value;
        }
    });
}

console.log('\n=======================================================');
console.log('   STARTING INVISIBLE WEB3 ULTRA-FAST DEMO SERVER');
console.log('=======================================================\n');

// Get Local IP
const networkInterfaces = os.networkInterfaces();
let localIp = '127.0.0.1';
for (const net in networkInterfaces) {
    for (const iface of networkInterfaces[net]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            localIp = iface.address;
            break;
        }
    }
}

// 1. Start Backend (Compiled for speed)
console.log('[1/3] Starting Backend Server (Native Node.js for maximum speed)...');
const isBackendCompiled = fs.existsSync('./backend/dist/index.js');
const backendArgs = isBackendCompiled ? ['run', 'start'] : ['run', 'dev'];

const backend = spawn('npm', backendArgs, { 
    cwd: './backend', 
    env: { ...process.env, PORT: '3000' }, 
    stdio: 'pipe', 
    shell: true 
});

backend.stdout.on('data', data => {
    const str = data.toString();
    if (!str.includes('Prisma') && !str.includes('Debugger')) {
        process.stdout.write(`[BACKEND] ${str}`);
    }
});
backend.stderr.on('data', data => process.stderr.write(`[BACKEND ERR] ${data}`));

// 2. Start Frontend
const startFrontend = () => {
    console.log('\n[2/3] Starting Frontend Server...');
    const frontend = spawn('npm', ['run', 'start'], { 
        cwd: './frontend', 
        env: { ...process.env, PORT: '3001' }, 
        stdio: 'pipe', 
        shell: true 
    });

    frontend.stdout.on('data', data => process.stdout.write(`[FRONTEND] ${data}`));
    frontend.stderr.on('data', data => process.stderr.write(`[FRONTEND ERR] ${data}`));

    console.log('\nWaiting for frontend to be fully ready before creating tunnel...');

    const checkReady = () => {
        const req = http.get('http://127.0.0.1:3001', (res) => {
            if (res.statusCode === 200) {
                console.log('\n=======================================================');
                console.log('  🚀 YOUR DEMO IS READY AND LIGHTNING FAST!');
                console.log('=======================================================');
                console.log(`\n  🟢 LOCAL NETWORK ACCESS (Fastest, zero lag):`);
                console.log(`     http://${localIp}:3001`);
                console.log(`     (Use this on your phone if connected to the same Wi-Fi)\n`);
                
                const ngrokToken = process.env.NGROK_AUTHTOKEN;
                const ngrokDomain = process.env.NGROK_DOMAIN;

                if (ngrokToken && ngrokDomain) {
                    console.log(`  🌐 STARTING NGROK WITH PERMANENT URL: https://${ngrokDomain}`);
                    const tunnel = spawn('npx', ['ngrok', 'http', '--domain=' + ngrokDomain, '3001'], { 
                        stdio: 'inherit', 
                        shell: true,
                        env: { ...process.env, NGROK_AUTHTOKEN: ngrokToken }
                    });
                } else {
                    console.log('  🌐 CREATING PUBLIC TUNNEL VIA CLOUDFLARE (Ultra Fast, High Concurrency):');
                    console.log('\n  💡 TIP: Cloudflare generates a new secure URL every time to prevent abuse.');
                    console.log('  For a permanent URL, sign up at ngrok.com and add NGROK_AUTHTOKEN to backend/.env\n');
                    
                    const tunnel = spawn('npx', ['-y', 'untun@latest', 'tunnel', 'http://localhost:3001'], { 
                        stdio: 'inherit', 
                        shell: true,
                        env: { ...process.env, UNTUN_ACCEPT_CLOUDFLARE_TERMS: '1' }
                    });
                }
            } else {
                setTimeout(checkReady, 2000);
            }
        }).on('error', () => {
            setTimeout(checkReady, 2000);
        });
    };

    setTimeout(checkReady, 3000);
};

// Check if frontend needs building
if (!fs.existsSync('./frontend/.next')) {
    console.log('\n[2/3] Building Frontend for the first time... (Takes 30-60s)');
    const build = spawn('npm', ['run', 'build'], { 
        cwd: './frontend', 
        stdio: 'inherit', 
        shell: true 
    });
    build.on('close', (code) => {
        if (code !== 0) {
            console.error('\n❌ Frontend build failed! Check errors above.');
            process.exit(1);
        }
        startFrontend();
    });
} else {
    startFrontend();
}
