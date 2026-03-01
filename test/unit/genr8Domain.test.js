import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWranglerToml } from '../../gen/genr8Domain.js'

const t = { is: assert.strictEqual, ok: assert.ok, match: assert.match }

const cfg = { domain: 'feedi.brine.dev', r2Bucket: 'feedi-brine-dev' }
const kvId = 'abc123'

test('Gen: buildWranglerToml uses domain as worker name', () => {
  t.match(buildWranglerToml(cfg, kvId), /name = "feedi-brine-dev"/)
})

test('Gen: buildWranglerToml includes KV id', () => {
  t.match(buildWranglerToml(cfg, kvId), /id = "abc123"/)
})

test('Gen: buildWranglerToml includes R2 bucket when set', () => {
  t.match(buildWranglerToml(cfg, kvId), /bucket_name = "feedi-brine-dev"/)
})

test('Gen: buildWranglerToml omits R2 section when no bucket', () => {
  const result = buildWranglerToml({ domain: 'feedi.brine.dev' }, kvId)
  t.ok(!result.includes('r2_buckets'))
})

test('Gen: buildWranglerToml includes both crons', () => {
  const result = buildWranglerToml(cfg, kvId)
  t.match(result, /\*\/5 \* \* \* \*/)
  t.match(result, /0 2 \* \* \*/)
})
