import { encrypt, decrypt } from '@/lib/crypto'

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

beforeEach(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY
})

describe('encrypt / decrypt', () => {
  it('round-trips plaintext correctly', () => {
    const plaintext = 'github_pat_super_secret_token'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext on each call (random IV)', () => {
    const plaintext = 'same-input'
    const first = encrypt(plaintext)
    const second = encrypt(plaintext)
    expect(first).not.toBe(second)
    // both still decrypt to the original
    expect(decrypt(first)).toBe(plaintext)
    expect(decrypt(second)).toBe(plaintext)
  })

  it('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('round-trips unicode content', () => {
    const plaintext = '日本語テスト 🔐'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('throws when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('data')).toThrow('ENCRYPTION_KEY environment variable is not set')
  })

  it('throws when ENCRYPTION_KEY is the wrong length', () => {
    process.env.ENCRYPTION_KEY = 'tooshort'
    expect(() => encrypt('data')).toThrow('ENCRYPTION_KEY must be a 32-byte')
  })

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const ciphertext = encrypt('original')
    // flip the last byte to corrupt the auth tag / ciphertext
    const buf = Buffer.from(ciphertext, 'hex')
    buf[buf.length - 1] ^= 0xff
    const tampered = buf.toString('hex')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws when ciphertext is too short', () => {
    expect(() => decrypt('deadbeef')).toThrow('Ciphertext is too short')
  })
})
