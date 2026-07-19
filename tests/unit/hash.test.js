'use strict';

const hashHelper = require('../../lib/helpers/hash');

describe('password hash helper', () => {
  it('hashes and verifies passwords asynchronously using the current format', async () => {
    const storedHash = await hashHelper.hashPassword('correct-horse-battery-staple');

    expect(storedHash).toMatch(/^pbkdf2\$210000\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    await expect(hashHelper.verifyPassword('correct-horse-battery-staple', storedHash)).resolves.toBe(true);
    await expect(hashHelper.verifyPassword('wrong-password', storedHash)).resolves.toBe(false);
  });

  it('still verifies legacy PBKDF2 hashes without an iteration field', async () => {
    const legacyHash = 'pbkdf2$salt$afe6c5530785b6cc6b1c6453384731bd5ee432ee549fd42fb6695779ad8a1c5bf59de69c48f774efc4007d5298f9033c0241d5ab69305e7b64eceeb8d834cfec';

    await expect(hashHelper.verifyPassword('password', legacyHash)).resolves.toBe(true);
  });

  it('returns false for malformed hashes', async () => {
    await expect(hashHelper.verifyPassword('password', 'not-a-pbkdf2-hash')).resolves.toBe(false);
    await expect(hashHelper.verifyPassword('password', 'pbkdf2$bad$format$xyz')).resolves.toBe(false);
  });
});
