#!/usr/bin/env python3
"""Run Gather locally: python3 run/main.py [--port 8000] [--host 127.0.0.1]."""
from pathlib import Path
import argparse
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

def main():
    parser = argparse.ArgumentParser(description='Gather local website and live quiz server')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--host', default='127.0.0.1', help='Use 0.0.0.0 to test from other devices on your Wi-Fi')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    node = shutil.which('node')
    if not node:
        sys.exit('Node.js 22+ is required. In Termux run: pkg install nodejs-lts')
    version = subprocess.check_output([node, '--version'], text=True).strip()
    if int(version.lstrip('v').split('.')[0]) < 22:
        sys.exit('Please install Node.js 22 or newer.')
    if not (ROOT / 'node_modules/ws/package.json').exists():
        npm = shutil.which('npm')
        if not npm:
            sys.exit('npm is required for the first-time setup.')
        print('Installing the live server dependency…', flush=True)
        subprocess.run([npm, 'ci', '--omit=dev', '--no-audit', '--no-fund'], cwd=ROOT, check=True)
    child = subprocess.Popen([node, str(ROOT / 'scripts/dev-server.mjs'), '--host', args.host, '--port', str(args.port)], cwd=ROOT)
    try:
        return child.wait()
    except KeyboardInterrupt:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
        return 0

if __name__ == '__main__':
    raise SystemExit(main())
