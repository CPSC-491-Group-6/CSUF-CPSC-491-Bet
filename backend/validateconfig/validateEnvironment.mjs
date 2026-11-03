/**
 * Bet backend preflight configuration check.
 * Place in backend/scripts/validateEnvironment.mjs and run from backend/:
 *   node scripts/validateEnvironment.mjs
 * Requires npm ci and a configured .env (or equivalent exported variables).
 * This check does not create, modify, or migrate the database.
 */
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const checks = [];
function record(name, ok, detail) {
    checks.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

const major = Number(process.versions.node.split('.')[0]);
record('Node runtime', major >= 24, `Node ${process.version}; requires >=24`);

let env;
try {
    ({ env } = await import('../src/config/env.js'));
    record('Environment variables', true, 'PORT, NODE_ENV, DB_PATH and SESSION_SECRET passed application validation (secret not displayed)');
} catch (error) {
    record('Environment variables', false, error.message);
}

if (env) {
    const dbPath = env.dbPath;
    if (dbPath === ':memory:') {
        record('SQLite path', env.nodeEnv === 'test', 'In-memory SQLite should be used for tests only');
    } else {
        const resolved = path.resolve(dbPath);
        try {
            let ancestor = path.dirname(resolved);
            while (!existsSync(ancestor)) {
                const next = path.dirname(ancestor);
                if (next === ancestor) throw new Error('No existing ancestor for database directory');
                ancestor = next;
            }
            if (!statSync(ancestor).isDirectory()) throw new Error('Database parent path is not a directory');
            accessSync(ancestor, constants.W_OK | constants.X_OK);
            if (existsSync(resolved)) {
                if (!statSync(resolved).isFile()) throw new Error('Database path is not a regular file');
                accessSync(resolved, constants.R_OK | constants.W_OK);
            }
            record('SQLite path', true, `Database location is usable: ${resolved}`);
        } catch (error) {
            record('SQLite path', false, `Database location unusable: ${error.message}`);
        }
    }

    const portAvailable = await new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => resolve({ ok: false, detail: error.code || error.message }));
    server.listen({ port: env.port, host: '127.0.0.1', exclusive: true }, () => {
    server.close(() => resolve({ ok: true, detail: `127.0.0.1:${env.port} available` }));
    });
    });
    record('TCP port', portAvailable.ok, portAvailable.detail);
}

const failures = checks.filter((check) => !check.ok);
console.log(`\nPreflight result: ${checks.length - failures.length}/${checks.length} checks passed.`);
if (failures.length) process.exitCode = 1;
