import { build, Platform, Arch } from 'electron-builder';

const targets = Platform.WINDOWS.createTarget(['portable'], Arch.x64);

build({ targets })
  .then(() => { console.log('PORTABLE_DONE'); })
  .catch((e) => { console.error('PORTABLE_FAILED', e); process.exit(1); });