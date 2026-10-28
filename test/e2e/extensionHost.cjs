const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('pixel-pilot-team.pixel-pilot-vscode');
  assert.ok(extension, 'Pixel Pilot extension must be discoverable in the Extension Development Host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Pixel Pilot extension must activate successfully.');

  const registered = new Set(await vscode.commands.getCommands(true));
  for (const command of [
    'pixel-pilot.openStudio',
    'pixelPilot.openSidebar',
    'pixel-pilot.upscaleImage',
    'pixelPilot.removeBackground',
    'pixelPilot.clearApiKey'
  ]) {
    assert.ok(registered.has(command), `Expected command to be registered: ${command}`);
  }

  // Opening the Studio exercises the contributed command and webview host
  // without calling an external model provider.
  await vscode.commands.executeCommand('pixel-pilot.openStudio');
}

module.exports = { run };
