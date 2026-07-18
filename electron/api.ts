// Shared contract between preload (implementation) and renderer (window.glacierApi).
// Grows toward the full IPC surface in SPECIFICATION.md §9 as milestones progress.
export interface GlacierApi {
  ping(): Promise<string>;
}
