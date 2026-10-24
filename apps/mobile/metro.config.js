// Metro config for the BookMyWarehouse mobile app.
//
// This app lives in a pnpm workspace and imports two pure-TypeScript workspace
// packages (@bmw/validation, @bmw/shared-types). Metro does not follow symlinks
// by default, so we point it at the workspace root (watchFolders) and add the
// root node_modules to the resolver search path. We also watch the compiled
// `dist/` output of those packages so edits rebuild.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so the workspace packages' dist output triggers
// re-bundling, and so Metro can resolve them through the pnpm symlinks.
config.watchFolders = [workspaceRoot];

// Search both the local node_modules and the hoisted workspace node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Follow symlinks so pnpm's linked workspace packages resolve correctly.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'import'];

module.exports = config;
