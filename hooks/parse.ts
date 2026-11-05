// Splits a reply into markdown text and display math, and turns simple
// inline math into Unicode.

export type Piece = { kind: 'text'; text: string } | { kind: 'math'; tex: string; body: string; inner: string }

const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*$/gm
const DISPLAY =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{(equation|align|gather|multline|alignat|flalign|eqnarray)(\*?)\}[\s\S]+?\\end\{\3\4\}/g

// Display math outside code fences becomes its own piece. `tex` is the
// source as written, `body` what goes in the LaTeX document, and `inner` the
// formula without its delimiters or \begin/\end, as [ copy ] copies it.
export function split(text: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  for (const fence of text.matchAll(FENCE)) {
    pushOutsideFence(pieces, text.slice(last, fence.index))
    pushText(pieces, fence[0])
    last = fence.index + fence[0].length
  }
  pushOutsideFence(pieces, text.slice(last))
  return pieces
}

function pushOutsideFence(pieces: Piece[], text: string): void {
  let last = 0
  for (const m of text.matchAll(DISPLAY)) {
    pushText(pieces, text.slice(last, m.index))
    const inner = m[1] ?? m[2]
    if (inner !== undefined) {
      if (inner.trim()) pieces.push({ kind: 'math', tex: m[0], body: `\\[ ${inner.trim()} \\]`, inner: inner.trim() })
      else pushText(pieces, m[0])
    } else {
      // alignat takes the number of columns as {n} after \begin.
      const env = m[0].replace(/^\\begin\{[^}]*\}(?:\{\d+\})?/, '').replace(/\\end\{[^}]*\}$/, '').trim()
      pieces.push({ kind: 'math', tex: m[0], body: m[0], inner: env })
    }
    last = m.index + m[0].length
  }
  pushText(pieces, text.slice(last))
}

function pushText(pieces: Piece[], text: string): void {
  const prev = pieces[pieces.length - 1]
  if (prev?.kind === 'text') prev.text += text
  else if (text) pieces.push({ kind: 'text', text })
}

// Inline math: \(...\) and $...$ (no space inside either dollar, and not a
// price such as $5 and $10). Code spans are left alone. Math that converts
// becomes Unicode; the rest stays as TeX in a code span, so markdown does
// not eat its _ and *.
const CODE_SPAN = /(`+)[\s\S]*?\1/g
const INLINE = /\\\(([\s\S]+?)\\\)|(?<![\\$])\$(?![\s$])([^$\n]+?)(?<!\s)\$(?![\d$])/g

export function inlineToUnicode(text: string): string {
  let out = ''
  let last = 0
  for (const span of text.matchAll(CODE_SPAN)) {
    out += convertInline(text.slice(last, span.index)) + span[0]
    last = span.index + span[0].length
  }
  return out + convertInline(text.slice(last))
}

function convertInline(text: string): string {
  return text.replace(INLINE, (whole, paren: string | undefined, dollar: string | undefined) => {
    const unicode = toUnicode(paren ?? dollar ?? '')
    if (unicode !== null) return unicode.replace(/[*_`|\\]/g, c => `\\${c}`)
    return whole.includes('`') ? whole : `\`${whole}\``
  })
}

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', cdotp: '·', times: '×', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘',
  bullet: '•', oplus: '⊕', otimes: '⊗', setminus: '∖',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼', simeq: '≃',
  cong: '≅', equiv: '≡', propto: '∝', ll: '≪', gg: '≫', perp: '⊥', parallel: '∥', mid: '|',
  to: '→', rightarrow: '→', leftarrow: '←', gets: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  implies: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', iff: '⇔', mapsto: '↦', uparrow: '↑',
  downarrow: '↓',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪',
  cap: '∩', emptyset: '∅', varnothing: '∅', forall: '∀', exists: '∃', neg: '¬', lnot: '¬',
  land: '∧', wedge: '∧', lor: '∨', vee: '∨', therefore: '∴', because: '∵',
  infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', int: '∫', iint: '∬', iiint: '∭',
  oint: '∮', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', prime: '′', degree: '°',
  angle: '∠', triangle: '△', square: '□', top: '⊤', bot: '⊥', dagger: '†',
  ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
  langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', vert: '|',
  lvert: '|', rvert: '|', Vert: '‖', lVert: '‖', rVert: '‖',
  quad: '  ', qquad: '    ', colon: ':',
}
const ESCAPED: Record<string, string> = {
  ',': ' ', ';': ' ', ':': ' ', '>': ' ', '!': '', ' ': ' ', '{': '{', '}': '}', '%': '%',
  $: '$', '&': '&', '#': '#', _: '_', '|': '‖',
}
const NAMED_OPERATORS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'arg',
  'gcd', 'mod', 'Pr',
])
const AS_IS = new Set([
  'text', 'textrm', 'textit', 'textbf', 'mathrm', 'mathit', 'mathbf', 'mathsf', 'mathtt',
  'boldsymbol', 'bm', 'operatorname', 'mathnormal',
])
const DROPPED = new Set([
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr',
  'displaystyle', 'textstyle', 'limits', 'nolimits',
])
const ACCENTS: Record<string, string> = {
  hat: '̂', widehat: '̂', bar: '̄', overline: '̅', tilde: '̃',
  widetilde: '̃', dot: '̇', ddot: '̈', vec: '⃗',
}
const BLACKBOARD: Record<string, string> = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ', P: 'ℙ', H: 'ℍ' }
const SCRIPT = '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵'
const SUPERSCRIPT = mapOf(
  '0123456789+-−=()nia' + 'bcdefghjklmoprstuvwxyzABDEGHIJKLMNOPRTUVW' + 'βγδθφχ′*',
  '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿⁱᵃ' + 'ᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ' + 'ᵝᵞᵟᶿᵠᵡ′*',
)
const SUBSCRIPT = mapOf('0123456789+-−=()aehijklmnoprstuvxβγρφχ', '₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ')

function mapOf(from: string, to: string): Map<string, string> {
  const a = [...from]
  const b = [...to]
  return new Map(a.map((c, i) => [c, b[i] ?? '']))
}

// Turns TeX math into plain Unicode text, or null when it holds something
// with no simple Unicode form (a matrix, an unknown command, a root of 5).
export function toUnicode(tex: string): string | null {
  const parser = new Parser(tex)
  try {
    const out = parser.sequence(false)
    return parser.pos < tex.length ? null : out.replace(/ {2,}/g, ' ').trim().normalize('NFC')
  } catch {
    return null
  }
}

class Fail extends Error {}

class Parser {
  pos = 0
  constructor(private readonly src: string) {}

  // Atoms up to a closing brace (inGroup) or the end.
  sequence(inGroup: boolean): string {
    let out = ''
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!
      if (c === '}') {
        if (!inGroup) throw new Fail()
        return out
      }
      if (/\s/.test(c)) {
        this.pos += 1
        out += ' '
      } else if (c === '^' || c === '_') {
        this.pos += 1
        out += script(this.atom(), c === '^' ? SUPERSCRIPT : SUBSCRIPT, c)
      } else {
        out += this.atom()
      }
    }
    if (inGroup) throw new Fail()
    return out
  }

  // One brace group, command, or character.
  atom(): string {
    this.skipSpaces()
    const c = this.src[this.pos]
    if (c === undefined) throw new Fail()
    if (c === '{') {
      this.pos += 1
      const inner = this.sequence(true)
      this.pos += 1
      return inner
    }
    if (c === '\\') return this.command()
    if (c === '&') throw new Fail()
    this.pos += 1
    if (c === '-') return '−'
    if (c === "'") return '′'
    if (c === '~') return ' '
    return c
  }

  command(): string {
    this.pos += 1
    const letters = /^[A-Za-z]+/.exec(this.src.slice(this.pos))?.[0]
    if (!letters) {
      const c = this.src[this.pos]
      this.pos += 1
      if (c === undefined || !(c in ESCAPED)) throw new Fail()
      return ESCAPED[c]!
    }
    this.pos += letters.length
    const name = letters
    if (name in SYMBOLS) return SYMBOLS[name]!
    if (NAMED_OPERATORS.has(name)) return name
    if (AS_IS.has(name)) return this.atom()
    if (DROPPED.has(name)) {
      this.skipSpaces()
      if (this.src[this.pos] === '.') this.pos += 1
      return ''
    }
    if (name in ACCENTS) {
      const base = this.atom()
      if ([...base].length !== 1) throw new Fail()
      return base + ACCENTS[name]
    }
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      return `${wrap(this.atom())}/${wrap(this.atom())}`
    }
    if (name === 'sqrt') {
      this.skipSpaces()
      let root = '√'
      if (this.src[this.pos] === '[') {
        const end = this.src.indexOf(']', this.pos)
        const index = end < 0 ? '' : this.src.slice(this.pos + 1, end).trim()
        root = index === '3' ? '∛' : index === '4' ? '∜' : ''
        if (!root) throw new Fail()
        this.pos = end + 1
      }
      return root + wrap(this.atom())
    }
    if (name === 'mathbb') return mapLetters(this.atom(), c => BLACKBOARD[c])
    if (name === 'mathcal' || name === 'mathscr') {
      return mapLetters(this.atom(), c => (/[A-Z]/.test(c) ? [...SCRIPT][c.charCodeAt(0) - 65] : undefined))
    }
    throw new Fail()
  }

  skipSpaces(): void {
    while (/\s/.test(this.src[this.pos] ?? '')) this.pos += 1
  }
}

// x^2 → x², x_{ij} → xᵢⱼ; a script with no Unicode form → x^(…), x_(…).
function script(text: string, table: Map<string, string>, mark: string): string {
  const chars = [...text.trim()]
  if (chars.length > 0 && chars.every(c => table.has(c))) return chars.map(c => table.get(c)).join('')
  return chars.length === 1 ? `${mark}${text.trim()}` : `${mark}(${text.trim()})`
}

// A fraction's part in parentheses unless it is one symbol run (2, ∂L, xᵢ).
function wrap(text: string): string {
  const t = text.trim()
  const run = t.replace(/\s+/g, '')
  return /^[\p{L}\p{N}\p{M}.∂∇′]+$/u.test(run) ? run : `(${t})`
}

function mapLetters(text: string, map: (c: string) => string | undefined): string {
  return [...text].map(c => map(c) ?? (() => { throw new Fail() })()).join('')
}
