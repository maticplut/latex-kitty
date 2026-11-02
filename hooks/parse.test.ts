import { expect, test } from 'claude-code/testing'
import { inlineToUnicode, split, toUnicode } from './parse'

test('display math is split out, code fences are not', () => {
  const pieces = split('Loss:\n\n$$L = \\sum_i e_i^2$$\n\n```\n$$not math$$\n```\n\\begin{align*}a &= b\\end{align*}')
  expect(pieces.map(p => p.kind)).toEqual(['text', 'math', 'text', 'math'])
  expect(pieces[1]).toEqual({ kind: 'math', tex: '$$L = \\sum_i e_i^2$$', body: '\\[ L = \\sum_i e_i^2 \\]' })
  expect(pieces[3]?.kind === 'math' && pieces[3].body).toBe('\\begin{align*}a &= b\\end{align*}')
})

test('simple inline math becomes Unicode', () => {
  expect(toUnicode('x^2 + y_i')).toBe('x² + yᵢ')
  expect(toUnicode('\\frac{\\partial L}{\\partial w}')).toBe('∂L/∂w')
  expect(toUnicode('\\alpha \\le \\sqrt{a+b}')).toBe('α ≤ √(a+b)')
  expect(toUnicode('x_{\\text{eff}}')).toBe('x_(eff)')
  expect(toUnicode('\\mathbb{R}^n')).toBe('ℝⁿ')
  expect(toUnicode('\\hat{y}')).toBe('ŷ')
})

test('math with no simple form stays TeX in a code span', () => {
  expect(toUnicode('\\begin{pmatrix} a & b \\end{pmatrix}')).toBe(null)
  expect(inlineToUnicode('so $\\unknown{x}$ here')).toBe('so `$\\unknown{x}$` here')
})

test('prices, escaped dollars and code spans are left alone', () => {
  expect(inlineToUnicode('costs $5 and $10 today')).toBe('costs $5 and $10 today')
  expect(inlineToUnicode('a \\$ sign and `$x^2$`')).toBe('a \\$ sign and `$x^2$`')
  expect(inlineToUnicode('where $x^2$ and \\(a_1\\)')).toBe('where x² and a₁')
})
