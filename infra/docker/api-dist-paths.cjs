const fs = require('fs');
const Module = require('module');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const compiledPackageRoot = path.join(repoRoot, 'apps', 'api', 'dist', 'packages');
const packageMap = new Map([
  ['@bitecodes/ai-controller', 'ai-controller'],
  ['@bitecodes/ai-core', 'ai-core'],
  ['@bitecodes/connectors', 'connectors'],
  ['@bitecodes/db', 'db'],
  ['@bitecodes/mcp', 'mcp'],
  ['@bitecodes/seo', 'seo'],
  ['@bitecodes/shared', 'shared'],
  ['@bitecodes/ui', 'ui'],
]);

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveBitecodesWorkspace(request, parent, isMain, options) {
  for (const [packageName, folderName] of packageMap) {
    if (request !== packageName && !request.startsWith(`${packageName}/`)) {
      continue;
    }

    const subpath = request === packageName ? 'index' : request.slice(packageName.length + 1);
    const candidate = path.join(compiledPackageRoot, folderName, 'src', `${subpath}.js`);

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
