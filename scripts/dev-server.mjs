// Node-compatible launcher for the TypeScript development server.
import {tsImport} from 'tsx/esm/api';
await tsImport('../src/server/index.ts', import.meta.url);
