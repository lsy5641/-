import { build, Platform, Arch } from 'electron-builder';

const targets = Platform.WINDOWS.createTarget(['nsis'], Arch.x64);

build({ targets })
  .then(() => { console.log('NSIS_DONE'); })
  .catch((e) => { console.error('NSIS_FAILED', e); process.exit(1); });