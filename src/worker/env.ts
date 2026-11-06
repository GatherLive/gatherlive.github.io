/** Bindings are generated from wrangler.jsonc; secrets are supplied at deploy time. */
export interface WorkerEnv extends RuntimeBindings {
  CHAT_CODE_PEPPER?: string;
  CHAT_CODE_HASHES?: string;
  LOCAL_DEV?: boolean;
}
