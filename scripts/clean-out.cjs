const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const output = path.resolve(root, 'out');

function removeDirectory(directory, protectedRoot) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory() && !fs.lstatSync(child).isSymbolicLink()) {
      if (!fs.realpathSync(child).startsWith(protectedRoot + path.sep)) {
        throw new Error('Refusing to follow an output directory outside the project.');
      }
      removeDirectory(child, protectedRoot);
    } else {
      // Do not follow a symlink/junction outside out/.
      fs.unlinkSync(child);
    }
  }
  fs.rmdirSync(directory);
}

if (path.dirname(output) !== root || path.basename(output) !== 'out') {
  throw new Error('Refusing to clean a directory outside the project output path.');
}
if (fs.existsSync(output)) {
  const resolvedOutput = fs.realpathSync(output);
  if (!resolvedOutput.startsWith(root + path.sep)) {
    throw new Error('Refusing to clean an output directory redirected outside the project.');
  }
  removeDirectory(output, resolvedOutput);
}
