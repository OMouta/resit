/**
 * The application build resolves worker entry points through electron-vite's
 * `?modulePath` import. Tests compile the same sources without it.
 */
declare module "*?modulePath" {
  const path: string;
  export default path;
}
