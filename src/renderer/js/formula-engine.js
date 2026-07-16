/**
 * Cognitience SS — Safe Formula Engine
 * Tokenizer + recursive-descent parser + evaluator. No Function()/eval.
 * Supports + - * / ^, comparisons (= <> < > <= >=), parentheses, cell refs (A1),
 * ranges (A1:B5), string/number literals, and nested function calls.
 * Includes a dependency graph + topological recalculation with circular-ref detection.
 */

import { parseCellAddr, cellAddr, isErrorValue } from './helpers.js';

export const FUNCTION_LIST = [
  { name: 'SUM', desc: 'Adds all numbers in a range or list of arguments.', example: 'SUM(A1:A5)' },
  { name: 'AVERAGE', desc: 'Returns the average (mean) of the arguments.', example: 'AVERAGE(A1:A5)' },
  { name: 'MIN', desc: 'Returns the smallest number in a set of values.', example: 'MIN(A1:A5)' },
  { name: 'MAX', desc: 'Returns the largest number in a set of values.', example: 'MAX(A1:A5)' },
  { name: 'COUNT', desc: 'Counts numeric values in a range or list.', example: 'COUNT(A1:A5)' },
  { name: 'COUNTA', desc: 'Counts non-empty values in a range or list.', example: 'COUNTA(A1:A5)' },
  { name: 'IF', desc: 'Returns one value if a condition is true, another if false.', example: 'IF(A1>10,"big","small")' },
  { name: 'ABS', desc: 'Returns the absolute value of a number.', example: 'ABS(A1)' },
  { name: 'ROUND', desc: 'Rounds a number to a given number of decimal places.', example: 'ROUND(A1,2)' },
  { name: 'SQRT', desc: 'Returns the positive square root of a number.', example: 'SQRT(A1)' },
  { name: 'POWER', desc: 'Returns a number raised to a power.', example: 'POWER(A1,2)' },
  { name: 'MOD', desc: 'Returns the remainder after division.', example: 'MOD(A1,2)' },
  { name: 'CONCAT', desc: 'Joins several text values into one text value.', example: 'CONCAT(A1,B1)' },
  { name: 'LEN', desc: 'Returns the number of characters in a text string.', example: 'LEN(A1)' },
  { name: 'UPPER', desc: 'Converts text to uppercase.', example: 'UPPER(A1)' },
  { name: 'LOWER', desc: 'Converts text to lowercase.', example: 'LOWER(A1)' },
  { name: 'TRIM', desc: 'Removes leading/trailing whitespace from text.', example: 'TRIM(A1)' },
  { name: 'NOW', desc: 'Returns the current date and time.', example: 'NOW()' },
  { name: 'TODAY', desc: "Returns today's date.", example: 'TODAY()' },
  { name: 'PI', desc: 'Returns the value of Pi.', example: 'PI()' },
];

// ─── Accessors (injected by workbook.js) ───────────────────────────

let _getCell = () => ({ value: '', computed: null });
let _getActiveSheetCells = () => ({});

export function setFormulaAccessors({ getCell, getActiveSheetCells }) {
  if (typeof getCell === 'function') _getCell = getCell;
  if (typeof getActiveSheetCells === 'function') _getActiveSheetCells = getActiveSheetCells;
}

// ─── Tokenizer ──────────────────────────────────────────────────────

function tokenize(src) {
  const tokens = [];
  const s = src;
  let i = 0;
  const n = s.length;

  while (i < n) {
    const c = s[i];

    if (/\s/.test(c)) { i++; continue; }

    if (c === '"') {
      let j = i + 1;
      let str = '';
      while (j < n && s[j] !== '"') { str += s[j]; j++; }
      tokens.push({ type: 'STRING', value: str });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i;
      let num = '';
      while (j < n && /[0-9.]/.test(s[j])) { num += s[j]; j++; }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      i = j;
      continue;
    }

    if (/[A-Za-z]/.test(c)) {
      let j = i;
      let word = '';
      while (j < n && /[A-Za-z0-9_]/.test(s[j])) { word += s[j]; j++; }
      const m = word.match(/^([A-Za-z]+)(\d+)$/);
      if (m) {
        // Look ahead for a range continuation: "A1:B5"
        let k = j;
        if (s[k] === ':') {
          let k2 = k + 1;
          let word2 = '';
          while (k2 < n && /[A-Za-z0-9]/.test(s[k2])) { word2 += s[k2]; k2++; }
          const m2 = word2.match(/^([A-Za-z]+)(\d+)$/);
          if (m2) {
            tokens.push({ type: 'RANGE', value: word.toUpperCase() + ':' + word2.toUpperCase() });
            i = k2;
            continue;
          }
        }
        tokens.push({ type: 'CELL', value: word.toUpperCase() });
        i = j;
        continue;
      }
      tokens.push({ type: 'IDENT', value: word.toUpperCase() });
      i = j;
      continue;
    }

    if (c === '<' && s[i + 1] === '>') { tokens.push({ type: 'OP', value: '<>' }); i += 2; continue; }
    if (c === '<' && s[i + 1] === '=') { tokens.push({ type: 'OP', value: '<=' }); i += 2; continue; }
    if (c === '>' && s[i + 1] === '=') { tokens.push({ type: 'OP', value: '>=' }); i += 2; continue; }

    if (c === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }
    if ('+-*/^=<>&'.includes(c)) { tokens.push({ type: 'OP', value: c }); i++; continue; }

    throw new Error('Unexpected character: ' + c);
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

// ─── Recursive-Descent Parser ──────────────────────────────────────

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }
  expect(type) {
    const t = this.next();
    if (t.type !== type) throw new Error(`Expected ${type} but got ${t.type}`);
    return t;
  }

  parse() {
    const node = this.parseComparison();
    if (this.peek().type !== 'EOF') throw new Error('Unexpected token: ' + this.peek().value);
    return node;
  }

  parseComparison() {
    let left = this.parseConcat();
    while (this.peek().type === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseConcat();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  parseConcat() {
    let left = this.parseAdditive();
    while (this.peek().type === 'OP' && this.peek().value === '&') {
      this.next();
      const right = this.parseAdditive();
      left = { type: 'concat', left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseTerm();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const right = this.parseTerm();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  parseTerm() {
    let left = this.parseUnary();
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.peek().type === 'OP' && (this.peek().value === '-' || this.peek().value === '+')) {
      const op = this.next().value;
      const operand = this.parseUnary();
      return { type: 'unary', op, operand };
    }
    return this.parsePower();
  }

  parsePower() {
    let base = this.parsePrimary();
    if (this.peek().type === 'OP' && this.peek().value === '^') {
      this.next();
      const exponent = this.parseUnary();
      return { type: 'binop', op: '^', left: base, right: exponent };
    }
    return base;
  }

  parsePrimary() {
    const t = this.peek();
    if (t.type === 'NUMBER') { this.next(); return { type: 'number', value: t.value }; }
    if (t.type === 'STRING') { this.next(); return { type: 'string', value: t.value }; }
    if (t.type === 'RANGE') { this.next(); return { type: 'range', value: t.value }; }
    if (t.type === 'CELL') { this.next(); return { type: 'cell', addr: t.value }; }
    if (t.type === 'LPAREN') {
      this.next();
      const expr = this.parseComparison();
      this.expect('RPAREN');
      return expr;
    }
    if (t.type === 'IDENT') {
      this.next();
      const name = t.value;
      if (this.peek().type === 'LPAREN') {
        this.next();
        const args = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseArg());
          while (this.peek().type === 'COMMA') {
            this.next();
            args.push(this.parseArg());
          }
        }
        this.expect('RPAREN');
        return { type: 'call', name, args };
      }
      if (name === 'TRUE') return { type: 'bool', value: true };
      if (name === 'FALSE') return { type: 'bool', value: false };
      return { type: 'name', value: name };
    }
    throw new Error('Unexpected token: ' + (t.value ?? t.type));
  }

  parseArg() {
    if (this.peek().type === 'RANGE') {
      const t = this.next();
      return { type: 'range', value: t.value };
    }
    return this.parseComparison();
  }
}

function parseFormulaExpr(expr) {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ─── Evaluation ─────────────────────────────────────────────────────

function err(type, message) {
  return { type, message };
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return n;
}

function cellValueAt(addr) {
  const parsed = parseCellAddr(addr);
  if (!parsed) return null;
  const cell = _getCell(parsed.row, parsed.col);
  return cell ? cell.computed : null;
}

function rangeAddrs(rangeStr) {
  const [start, end] = rangeStr.split(':');
  const s = parseCellAddr(start);
  const e = parseCellAddr(end);
  if (!s || !e) return [];
  const addrs = [];
  const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
  const minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      addrs.push(cellAddr(r, c));
    }
  }
  return addrs;
}

function evaluateNode(node) {
  switch (node.type) {
    case 'number': return node.value;
    case 'string': return node.value;
    case 'bool': return node.value;
    case 'name': return err('#NAME?', 'Unknown identifier: ' + node.value);
    case 'cell': {
      const val = cellValueAt(node.addr);
      if (isErrorValue(val)) return val;
      return val === null || val === undefined ? '' : val;
    }
    case 'range':
      return err('#VALUE!', 'A range cannot be used as a single value');
    case 'unary': {
      const v = evaluateNode(node.operand);
      if (isErrorValue(v)) return v;
      const num = toNumber(v);
      if (isNaN(num)) return err('#VALUE!', 'Expected a number');
      return node.op === '-' ? -num : num;
    }
    case 'concat': {
      const l = evaluateNode(node.left);
      if (isErrorValue(l)) return l;
      const r = evaluateNode(node.right);
      if (isErrorValue(r)) return r;
      return String(l ?? '') + String(r ?? '');
    }
    case 'binop':
      return evaluateBinop(node);
    case 'call':
      return evaluateFunction(node.name, node.args);
    default:
      return err('#VALUE!', 'Cannot evaluate expression');
  }
}

function evaluateBinop(node) {
  const { op } = node;
  const l = evaluateNode(node.left);
  if (isErrorValue(l)) return l;
  const r = evaluateNode(node.right);
  if (isErrorValue(r)) return r;

  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    let a = l, b = r;
    let cmp;
    const bothNumeric = !isNaN(toNumber(a)) && a !== '' && !isNaN(toNumber(b)) && b !== '';
    if (bothNumeric) {
      const na = toNumber(a), nb = toNumber(b);
      cmp = na < nb ? -1 : na > nb ? 1 : 0;
    } else {
      const sa = String(a), sb = String(b);
      cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
    }
    switch (op) {
      case '=': return cmp === 0;
      case '<>': return cmp !== 0;
      case '<': return cmp < 0;
      case '>': return cmp > 0;
      case '<=': return cmp <= 0;
      case '>=': return cmp >= 0;
    }
  }

  const a = toNumber(l), b = toNumber(r);
  if (isNaN(a) || isNaN(b)) return err('#VALUE!', 'Expected a number');
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) return err('#DIV/0!', 'Division by zero');
      return a / b;
    case '^': return Math.pow(a, b);
    default: return err('#VALUE!', 'Unknown operator: ' + op);
  }
}

/** Collects numeric values from a list of argument AST nodes (expanding ranges). */
function collectNumericValues(argNodes) {
  const values = [];
  for (const arg of argNodes) {
    if (arg.type === 'range') {
      for (const addr of rangeAddrs(arg.value)) {
        const v = cellValueAt(addr);
        if (v !== null && v !== '' && !isErrorValue(v)) {
          const num = toNumber(v);
          if (!isNaN(num)) values.push(num);
        }
      }
    } else {
      const v = evaluateNode(arg);
      if (isErrorValue(v)) continue;
      if (v !== null && v !== '') {
        const num = toNumber(v);
        if (!isNaN(num)) values.push(num);
      }
    }
  }
  return values;
}

function evaluateFunction(name, argNodes) {
  switch (name) {
    case 'SUM': {
      const vals = collectNumericValues(argNodes);
      return vals.reduce((a, b) => a + b, 0);
    }
    case 'AVERAGE':
    case 'AVG': {
      const vals = collectNumericValues(argNodes);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    case 'MIN': {
      const vals = collectNumericValues(argNodes);
      return vals.length > 0 ? Math.min(...vals) : 0;
    }
    case 'MAX': {
      const vals = collectNumericValues(argNodes);
      return vals.length > 0 ? Math.max(...vals) : 0;
    }
    case 'COUNT': {
      return collectNumericValues(argNodes).length;
    }
    case 'COUNTA': {
      let count = 0;
      for (const arg of argNodes) {
        if (arg.type === 'range') {
          for (const addr of rangeAddrs(arg.value)) {
            const v = cellValueAt(addr);
            if (v !== null && v !== '' && v !== undefined) count++;
          }
        } else {
          const v = evaluateNode(arg);
          if (isErrorValue(v)) { count++; continue; }
          if (v !== null && v !== '') count++;
        }
      }
      return count;
    }
    case 'IF': {
      if (argNodes.length < 2) return err('#VALUE!', 'IF needs at least 2 arguments');
      const cond = evaluateNode(argNodes[0]);
      if (isErrorValue(cond)) return cond;
      const isTrue = cond !== 0 && cond !== false && cond !== '' && cond !== null;
      if (isTrue) return evaluateNode(argNodes[1]);
      return argNodes[2] ? evaluateNode(argNodes[2]) : false;
    }
    case 'ABS': {
      const v = evaluateNode(argNodes[0]);
      if (isErrorValue(v)) return v;
      return Math.abs(toNumber(v) || 0);
    }
    case 'ROUND': {
      const v = toNumber(evaluateNode(argNodes[0])) || 0;
      const places = argNodes[1] ? (toNumber(evaluateNode(argNodes[1])) || 0) : 0;
      const factor = Math.pow(10, places);
      return Math.round(v * factor) / factor;
    }
    case 'SQRT': {
      const v = toNumber(evaluateNode(argNodes[0])) || 0;
      return v < 0 ? err('#NUM!', 'Cannot take square root of a negative number') : Math.sqrt(v);
    }
    case 'POWER': {
      const base = toNumber(evaluateNode(argNodes[0])) || 0;
      const exp = toNumber(evaluateNode(argNodes[1])) || 0;
      return Math.pow(base, exp);
    }
    case 'MOD': {
      const a = toNumber(evaluateNode(argNodes[0])) || 0;
      const b = toNumber(evaluateNode(argNodes[1])) || 0;
      return b === 0 ? err('#DIV/0!', 'Division by zero') : a % b;
    }
    case 'CONCAT':
    case 'CONCATENATE': {
      let out = '';
      for (const arg of argNodes) {
        const v = evaluateNode(arg);
        if (isErrorValue(v)) return v;
        out += v !== null && v !== '' ? String(v) : '';
      }
      return out;
    }
    case 'LEN': {
      const v = evaluateNode(argNodes[0]);
      if (isErrorValue(v)) return v;
      return String(v || '').length;
    }
    case 'UPPER': {
      const v = evaluateNode(argNodes[0]);
      if (isErrorValue(v)) return v;
      return String(v || '').toUpperCase();
    }
    case 'LOWER': {
      const v = evaluateNode(argNodes[0]);
      if (isErrorValue(v)) return v;
      return String(v || '').toLowerCase();
    }
    case 'TRIM': {
      const v = evaluateNode(argNodes[0]);
      if (isErrorValue(v)) return v;
      return String(v || '').trim();
    }
    case 'NOW': return new Date().toLocaleString();
    case 'TODAY': return new Date().toLocaleDateString();
    case 'PI': return Math.PI;
    default:
      return err('#NAME?', `Unknown function: ${name}`);
  }
}

/** Evaluates a formula string (including the leading "="). */
export function evaluateFormula(formula) {
  try {
    const expr = formula.slice(1).trim();
    if (!expr) return '';
    const ast = parseFormulaExpr(expr);
    return evaluateNode(ast);
  } catch (e) {
    return err('#VALUE!', e.message || 'Invalid formula');
  }
}

/** Extracts cell addresses (with ranges expanded) referenced by a formula string. */
export function extractRefs(formula) {
  try {
    const expr = formula.slice(1).trim();
    if (!expr) return [];
    const ast = parseFormulaExpr(expr);
    const refs = new Set();
    walkRefs(ast, refs);
    return Array.from(refs);
  } catch (e) {
    return [];
  }
}

function walkRefs(node, refs) {
  if (!node || typeof node !== 'object') return;
  switch (node.type) {
    case 'cell':
      refs.add(node.addr);
      return;
    case 'range':
      for (const addr of rangeAddrs(node.value)) refs.add(addr);
      return;
    case 'unary':
      walkRefs(node.operand, refs);
      return;
    case 'concat':
    case 'binop':
      walkRefs(node.left, refs);
      walkRefs(node.right, refs);
      return;
    case 'call':
      for (const arg of node.args) walkRefs(arg, refs);
      return;
    default:
      return;
  }
}

/**
 * Recalculates all formula cells in a sheet, in dependency order.
 * Detects circular references and marks involved cells with #CIRCULAR!.
 *
 * @param {(row:number,col:number)=>object} getCell
 * @param {(row:number,col:number,value:any)=>void} setComputed
 * @param {Record<string,object>} sheetCells raw cells dict of the sheet being recalculated
 */
export function recalculateAll(getCell, setComputed, sheetCells) {
  const deps = new Map(); // addr -> Set(depAddr)
  for (const [addr, cell] of Object.entries(sheetCells)) {
    if (cell && typeof cell.value === 'string' && cell.value.startsWith('=')) {
      deps.set(addr, new Set(extractRefs(cell.value)));
    }
  }

  const visited = new Map(); // addr -> 'visiting' | 'done'
  const order = [];
  const cyclic = new Set();

  function visit(addr, stack) {
    if (visited.get(addr) === 'done') return;
    if (!deps.has(addr)) { visited.set(addr, 'done'); return; }
    if (stack.has(addr)) {
      cyclic.add(addr);
      return;
    }
    stack.add(addr);
    visited.set(addr, 'visiting');
    for (const dep of deps.get(addr)) {
      if (deps.has(dep)) {
        if (stack.has(dep)) {
          // Mark the entire cycle path (from the ancestor `dep` through the
          // current node), not just the two endpoints of the back-edge.
          const stackArr = Array.from(stack);
          const idx = stackArr.indexOf(dep);
          for (let k = idx; k < stackArr.length; k++) cyclic.add(stackArr[k]);
        } else {
          visit(dep, stack);
        }
      }
    }
    stack.delete(addr);
    if (visited.get(addr) !== 'done') visited.set(addr, 'done');
    order.push(addr);
  }

  for (const addr of deps.keys()) {
    visit(addr, new Set());
  }

  for (const addr of order) {
    if (cyclic.has(addr)) continue;
    const cell = sheetCells[addr];
    const parsed = parseCellAddr(addr);
    if (!parsed || !cell) continue;
    const result = evaluateFormula(cell.value);
    setComputed(parsed.row, parsed.col, result);
  }
  for (const addr of cyclic) {
    const parsed = parseCellAddr(addr);
    if (!parsed) continue;
    setComputed(parsed.row, parsed.col, { type: '#CIRCULAR!', message: 'Circular reference detected' });
  }
}
