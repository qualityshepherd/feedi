import { unit as test } from '../testpup.js'
import { extractTitle } from '../../assets/src/editor.js'

test('extractTitle: extracts title from h1 heading', t => {
  t.is(extractTitle('# My Post Title\n\nSome content'), 'My Post Title')
})

test('extractTitle: extracts title from h1 anywhere in content', t => {
  t.is(extractTitle('Some intro\n\n# Deep Title\n\nContent'), 'Deep Title')
})

test('extractTitle: falls back to first non-empty line when no h1', t => {
  t.is(extractTitle('Just a plain line\n\nMore content'), 'Just a plain line')
})

test('extractTitle: trims whitespace from extracted title', t => {
  t.is(extractTitle('#   Spaced Title   '), 'Spaced Title')
})

test('extractTitle: returns untitled-{n} for empty string', t => {
  t.ok(extractTitle('').startsWith('untitled-'))
})

test('extractTitle: returns untitled-{n} for whitespace-only', t => {
  t.ok(extractTitle('   ').startsWith('untitled-'))
})
