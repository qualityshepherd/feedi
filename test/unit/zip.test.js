import { unit as test } from '../testpup.js'
import { ZipWriter } from '../../worker/zip.js'

// minimal writer that collects Uint8Array chunks
class BufWriter {
  constructor () { this.bufs = [] }
  write (chunk) { this.bufs.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)); return Promise.resolve() }
  close () { return Promise.resolve() }
  get buf () { const out = new Uint8Array(this.bufs.reduce((n, b) => n + b.length, 0)); let off = 0; for (const b of this.bufs) { out.set(b, off); off += b.length }; return out }
}

const dv = (buf) => new DataView(buf.buffer ?? buf)
const le32 = (buf, off) => dv(buf).getUint32(off, true)
const le16 = (buf, off) => dv(buf).getUint16(off, true)

// CRC32 reference impl
const makeCrcTable = () => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c }
  return t
}
const CRC_TABLE = makeCrcTable()
const crc32 = (data) => { let c = 0xFFFFFFFF; for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }

const enc = new TextEncoder()

test('ZipWriter: empty archive has valid EOCD', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  await zip.finalize()
  const buf = w.buf
  // EOCD signature at end: 0x50 0x4B 0x05 0x06
  t.is(buf[buf.length - 22], 0x50)
  t.is(buf[buf.length - 21], 0x4B)
  t.is(buf[buf.length - 20], 0x05)
  t.is(buf[buf.length - 19], 0x06)
  // 0 entries (total entries field is at EOCD+10 = buf.length-12)
  t.is(le16(buf, buf.length - 12), 0)
})

test('ZipWriter: single text file has correct local header signature', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  await zip.addFile('hello.txt', 'hello')
  await zip.finalize()
  const buf = w.buf
  t.is(buf[0], 0x50)
  t.is(buf[1], 0x4B)
  t.is(buf[2], 0x03)
  t.is(buf[3], 0x04)
})

test('ZipWriter: single file entry count is 1 in EOCD', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  await zip.addFile('a.txt', 'a')
  await zip.finalize()
  const buf = w.buf
  t.is(le16(buf, buf.length - 12), 1)
})

test('ZipWriter: two files entry count is 2', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  await zip.addFile('a.txt', 'aaa')
  await zip.addFile('b.txt', 'bbb')
  await zip.finalize()
  const buf = w.buf
  t.is(le16(buf, buf.length - 12), 2)
})

test('ZipWriter: compression method is STORE (0)', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  await zip.addFile('x.txt', 'test')
  await zip.finalize()
  const buf = w.buf
  // compression method is at offset 8 in local file header (2 bytes LE)
  t.is(le16(buf, 8), 0)
})

test('ZipWriter: CRC32 in local header matches file content', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  const content = 'hello world'
  await zip.addFile('test.txt', content)
  await zip.finalize()
  const buf = w.buf
  const expected = crc32(enc.encode(content))
  // CRC32 is at offset 14 in local file header
  t.is(le32(buf, 14), expected)
})

test('ZipWriter: file size in local header matches content length', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  const content = 'hello world'
  await zip.addFile('test.txt', content)
  await zip.finalize()
  const buf = w.buf
  const bytes = enc.encode(content)
  // uncompressed size at offset 22
  t.is(le32(buf, 22), bytes.length)
})

test('ZipWriter: central directory signature is correct', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  await zip.addFile('f.txt', 'data')
  await zip.finalize()
  const buf = w.buf
  // local header: 30 + filename(5) + data(4) = 39 bytes
  // central directory starts at offset 39
  const cdOffset = le32(buf, buf.length - 6) // EOCD offset field
  t.is(buf[cdOffset], 0x50)
  t.is(buf[cdOffset + 1], 0x4B)
  t.is(buf[cdOffset + 2], 0x01)
  t.is(buf[cdOffset + 3], 0x02)
})

test('ZipWriter: handles Uint8Array data', async t => {
  const w = new BufWriter()
  const zip = new ZipWriter(w)
  const data = new Uint8Array([1, 2, 3, 4])
  await zip.addFile('bin.bin', data)
  await zip.finalize()
  const buf = w.buf
  t.is(le16(buf, buf.length - 12), 1)
})
