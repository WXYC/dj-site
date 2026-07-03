// TypeScript 6.0 checks side-effect imports (TS2882), and next@16.1.6 only declares
// *.module.css — plain stylesheet declarations were added to next/types/global.d.ts in
// 16.2.x. Mirror those declarations here; safe to remove once next is bumped to >=16.2.
declare module "*.css" {}
declare module "*.sass" {}
declare module "*.scss" {}
