import { build, Platform, Arch } from 'electron-builder';

const targets = Platform.WINDOWS.createTarget(['portable', 'nsis'], Arch.x64);

build({ targets })
  .then(() => { console.log('BUILD_DONE'); })
  .catch((e) => { console.error('BUILD_FAILED', e); process.exit(1); });