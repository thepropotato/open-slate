/**
 * Arithmetic evaluator for the search box. Hand-written recursive descent, not
 * `eval`/`new Function`: MV3 forbids executing strings.
 *
 * Grammar:
 *   expr    = term (('+' | '-') term)*
 *   term    = power (('*' | '/' | '%' | 'x') power)*
 *   power   = unary ('^' unary)*        (right associative)
 *   unary   = ('-' | '+')* primary
 *   primary = number | constant | name '(' expr ')' | '(' expr ')'
 */

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
}

const FUNCTIONS: Record<string, (n: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  exp: Math.exp,
}

/** Returns the formatted result, or null when the input is not an expression. */
export function calculate(input: string): string | null {
  const source = input.trim()
  if (!source) return null

  // Require at least one operator, so a bare "2024" is treated as a search.
  if (!/[-+*/^%x(]/i.test(source)) return null
  // Reject anything outside the grammar's alphabet before parsing.
  if (!/^[\d\s.,+\-*/^%x()a-z]+$/i.test(source)) return null

  try {
    const parser = new Parser(source)
    const value = parser.parseExpression()
    parser.expectEnd()
    if (!Number.isFinite(value)) return null
    return format(value)
  } catch {
    return null
  }
}

function format(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return value.toLocaleString()
  const rounded = Number(value.toPrecision(12))
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 })
}

class Parser {
  private pos = 0
  private readonly src: string

  constructor(source: string) {
    this.src = source
  }

  parseExpression(): number {
    let left = this.parseTerm()
    for (;;) {
      const op = this.peekOperator(['+', '-'])
      if (!op) return left
      this.pos += 1
      const right = this.parseTerm()
      left = op === '+' ? left + right : left - right
    }
  }

  private parseTerm(): number {
    let left = this.parsePower()
    for (;;) {
      const op = this.peekOperator(['*', '/', '%', 'x', 'X'])
      if (!op) return left
      this.pos += 1
      const right = this.parsePower()
      if (op === '*' || op === 'x' || op === 'X') left *= right
      else if (op === '/') left /= right
      else left %= right
    }
  }

  private parsePower(): number {
    const base = this.parseUnary()
    if (this.peekOperator(['^'])) {
      this.pos += 1
      // Right associative: 2^3^2 is 2^(3^2).
      return base ** this.parsePower()
    }
    return base
  }

  private parseUnary(): number {
    this.skipSpace()
    const char = this.src[this.pos]
    if (char === '-') {
      this.pos += 1
      return -this.parseUnary()
    }
    if (char === '+') {
      this.pos += 1
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): number {
    this.skipSpace()
    const char = this.src[this.pos]

    if (char === '(') {
      this.pos += 1
      const value = this.parseExpression()
      this.skipSpace()
      if (this.src[this.pos] !== ')') throw new Error('unclosed group')
      this.pos += 1
      return value
    }

    const name = /^[a-z]+/i.exec(this.src.slice(this.pos))?.[0]
    if (name) {
      this.pos += name.length
      const key = name.toLowerCase()
      if (key in CONSTANTS) return CONSTANTS[key]
      const fn = FUNCTIONS[key]
      if (!fn) throw new Error(`unknown name ${name}`)
      this.skipSpace()
      if (this.src[this.pos] !== '(') throw new Error('expected arguments')
      this.pos += 1
      const argument = this.parseExpression()
      this.skipSpace()
      if (this.src[this.pos] !== ')') throw new Error('unclosed call')
      this.pos += 1
      return fn(argument)
    }

    // Thousands separators are tolerated, so "1,200 * 3" works.
    const number = /^\d[\d,]*(\.\d+)?|^\.\d+/.exec(this.src.slice(this.pos))?.[0]
    if (!number) throw new Error('expected a number')
    this.pos += number.length
    return Number(number.replace(/,/g, ''))
  }

  private peekOperator(candidates: string[]): string | undefined {
    this.skipSpace()
    const char = this.src[this.pos]
    return candidates.includes(char) ? char : undefined
  }

  private skipSpace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos += 1
  }

  expectEnd(): void {
    this.skipSpace()
    if (this.pos !== this.src.length) throw new Error('trailing input')
  }
}
