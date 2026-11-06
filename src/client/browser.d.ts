import type {PublicConfig, DataRecord} from '../shared/types.js';

interface Turnstile {
  render(container: string | HTMLElement, options: DataRecord): string;
  remove(id: string): void;
  reset(id: string): void;
}
declare global {
  interface Window {
    GATHER_CONFIG?: PublicConfig;
    turnstile?: Turnstile;
    pdfMake?: DataRecord;
  }
  interface Navigator { connection?: {saveData?: boolean; effectiveType?: string} }
}
