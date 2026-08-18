#!/usr/bin/env node
// Guards the one deploy rule this repo has: if a precached file changes,
// CACHE_VERSION in sw.js must change too. Browsers detect a new service
// worker only by byte-diff on sw.js, so a forgotten bump ships fresh HTML
// against stale cached JS until the next one.
//
//   node tools/cache-version.js --check   exit 1 if a bump is owed
//   node tools/cache-version.js --bump    write the next version
//   node tools/cache-version.js --list    print the precached paths
//
// The precache list is read out of sw.js itself, so adding a file to
// REQUIRED_PRECACHE automatically puts it under the guard. No config to drift.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');
const VERSION_RE = /var CACHE_VERSION = '([^']+)';/;

function readSw(source) {
  if (source) return source;
  return fs.readFileSync(SW, 'utf8');
}

/** The CACHE_VERSION string, or null if the declaration is missing. */
function parseVersion(swSource) {
  const m = VERSION_RE.exec(swSource);
  return m ? m[1] : null;
}

/**
 * Every path in REQUIRED_PRECACHE + OPTIONAL_PRECACHE, as repo-relative files.
 * '/' is the directory index and maps to index.html, which is already listed
 * separately; drop it rather than guard a path that is not a file.
 */
function parsePrecache(swSource) {
  const out = [];
  const blocks = swSource.match(/var (?:REQUIRED|OPTIONAL)_PRECACHE = \[([\s\S]*?)\];/g) || [];
  // A guard that silently matches nothing is worse than no guard: --check
  // would pass forever. Rename a list and this fails loudly instead.
  if (blocks.length === 0) {
    throw new Error('sw.js: found no REQUIRED_PRECACHE / OPTIONAL_PRECACHE array. ' +
      'If the lists were renamed, update tools/cache-version.js to match.');
  }
  for (const block of blocks) {
    const entries = block.match(/'([^']+)'/g) || [];
    for (const raw of entries) {
      const p = raw.slice(1, -1).replace(/^\//, '');
      if (p && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** Next version: v27-2026-08-18 from v26-anything. */
function nextVersion(current, today) {
  const m = /^v(\d+)/.exec(current || '');
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return 'v' + n + '-' + today;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** Paths differing from the base ref, per git. Empty when the ref is unknown. */
function changedSince(baseRef) {
  try {
    git(['rev-parse', '--verify', baseRef]);
  } catch (e) {
    return null;                       // no such ref (fresh clone, no remote)
  }
  // --cached: the index against the base ref, i.e. exactly what a commit would
  // ship. Comparing the working tree instead would block a commit over
  // unstaged edits it does not contain.
  const out = git(['diff', '--cached', '--name-only', baseRef, '--']);
  return out ? out.split('\n').filter(Boolean) : [];
}

/** sw.js as the index has it, so the version and the file list agree. */
function stagedSw() {
  try {
    return git(['show', ':sw.js']);
  } catch (e) {
    return null;                       // not in the index (rare); caller falls back
  }
}

function baseSwSource(baseRef) {
  try {
    return git(['show', baseRef + ':sw.js']);
  } catch (e) {
    return null;
  }
}

function check(baseRef) {
  const swSource = stagedSw() || readSw();
  const version = parseVersion(swSource);
  if (!version) {
    return { ok: false, reason: 'no-version', message: 'sw.js has no CACHE_VERSION declaration.' };
  }

  const changed = changedSince(baseRef);
  if (changed === null) {
    return { ok: true, reason: 'no-base', message: 'Base ref ' + baseRef + ' not found — skipping.' };
  }

  const precached = parsePrecache(swSource);
  const touched = changed.filter(f => precached.includes(f));
  if (touched.length === 0) {
    return { ok: true, reason: 'nothing-precached-changed',
             message: 'No precached file changed.' };
  }

  const baseSource = baseSwSource(baseRef);
  const baseVersion = baseSource ? parseVersion(baseSource) : null;
  if (baseVersion && baseVersion === version) {
    return {
      ok: false, reason: 'bump-owed', touched: touched, version: version,
      message: touched.length + ' precached file' + (touched.length === 1 ? '' : 's') +
        ' changed but CACHE_VERSION is still ' + version + ':\n  ' + touched.join('\n  ') +
        '\n\nRun: node tools/cache-version.js --bump' +
        '\n(or commit with --no-verify if this genuinely ships no asset change)'
    };
  }

  return { ok: true, reason: 'bumped', version: version,
           message: 'CACHE_VERSION is ' + version + ' (base ' + baseVersion + ') — bump present.' };
}

function bump(today) {
  const swSource = readSw();
  const current = parseVersion(swSource);
  const next = nextVersion(current, today);
  fs.writeFileSync(SW, swSource.replace(VERSION_RE, "var CACHE_VERSION = '" + next + "';"));
  return { from: current, to: next };
}

module.exports = { parseVersion, parsePrecache, nextVersion, check, bump };

if (require.main === module) {
  const arg = process.argv[2] || '--check';
  const baseRef = process.argv[3] || 'origin/main';

  if (arg === '--list') {
    console.log(parsePrecache(readSw()).join('\n'));
  } else if (arg === '--bump') {
    const today = new Date().toISOString().slice(0, 10);
    const r = bump(today);
    console.log('CACHE_VERSION ' + r.from + ' -> ' + r.to);
  } else if (arg === '--check') {
    const r = check(baseRef);
    console.log((r.ok ? 'ok: ' : 'CACHE_VERSION: ') + r.message);
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error('usage: cache-version.js [--check|--bump|--list] [baseRef]');
    process.exit(2);
  }
}
