(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":4}],3:[function(require,module,exports){
/*Copyright (c) 2016, TT Labs, Inc.
 All rights reserved.

 Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

 Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

 Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

 Neither the name of the TT Labs, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/


/***************************************************************************************************
 *                                                                                                 *
 *  version 2.1.4                                                                                  *
 *                                                                                                 *
 ***************************************************************************************************/

(function () {
  "use strict";

  var FAR_FUTURE = new Date('2060-10-22'),
      HOURS_AGO,
      PENDING = 0, EVAPORATING = 2, COMPLETE = 3, PAUSED = 4, CANCELED = 5, ERROR = 10, ABORTED = 20, PAUSING = 30,
      PAUSED_STATUSES = [PAUSED, PAUSING],
      ACTIVE_STATUSES = [PENDING, EVAPORATING, ERROR],
      ETAG_OF_0_LENGTH_BLOB = '"d41d8cd98f00b204e9800998ecf8427e"',
      PARTS_MONITOR_INTERVAL_MS = 2 * 60 * 1000,
      IMMUTABLE_OPTIONS = [
        'maxConcurrentParts',
        'logging',
        'cloudfront',
        'encodeFilename',
        'computeContentMd5',
        'allowS3ExistenceOptimization',
        'onlyRetryForSameFileName',
        'timeUrl',
        'cryptoMd5Method',
        'cryptoHexEncodedHash256',
        'awsRegion',
        'awsSignatureVersion',
        'evaporateChanged'
      ],
      S3_EXTRA_ENCODED_CHARS =  {
        33: "%21", // !
        39: "%27", // '
        40: "%28", // (
        41: "%29", // )
        42: "%2A"  // *
      },
      l;

  var Evaporate = function (config) {
    this.config = extend({
      readableStreams: false,
      readableStreamPartMethod: null,
      bucket: null,
      logging: true,
      maxConcurrentParts: 5,
      partSize: 6 * 1024 * 1024,
      retryBackoffPower: 2,
      maxRetryBackoffSecs: 300,
      progressIntervalMS: 1000,
      cloudfront: false,
      s3Acceleration: false,
      mockLocalStorage: false,
      encodeFilename: true,
      computeContentMd5: false,
      allowS3ExistenceOptimization: false,
      onlyRetryForSameFileName: false,
      timeUrl: null,
      cryptoMd5Method: null,
      cryptoHexEncodedHash256: null,
      aws_key: null,
      awsRegion: 'us-east-1',
      awsSignatureVersion: '4',
      sendCanonicalRequestToSignerUrl: false,
      s3FileCacheHoursAgo: null, // Must be a whole number of hours. Will be interpreted as negative (hours in the past).
      signParams: {},
      signHeaders: {},
      customAuthMethod: undefined,
      maxFileSize: null,
      signResponseHandler: null,
      xhrWithCredentials: false,
      // undocumented, experimental
      localTimeOffset: undefined,
      evaporateChanged: function () {},
      abortCompletionThrottlingMs: 1000
    }, config);

    if (typeof window !== 'undefined' && window.console) {
      l = window.console;
      l.d = l.log;
      l.w = window.console.warn ? l.warn : l.d;
      l.e = window.console.error ? l.error : l.d;
    }

    this._instantiationError = this.validateEvaporateOptions();
    if (typeof this._instantiationError === 'string') {
      this.supported = false;
      return;
    } else {
      delete this._instantiationError;
    }

    if (!this.config.logging) {
      // Reset the logger to be a no_op
      l = noOpLogger();
    }

    var _d = new Date();
    HOURS_AGO = new Date(_d.setHours(_d.getHours() - (this.config.s3FileCacheHoursAgo || -100)));
    if (typeof config.localTimeOffset === 'number') {
      this.localTimeOffset = config.localTimeOffset;
    } else {
      var self = this;
      Evaporate.getLocalTimeOffset(this.config)
          .then(function (offset) {
            self.localTimeOffset = offset;
          });
    }
    this.pendingFiles = {};
    this.queuedFiles = [];
    this.filesInProcess = [];
    historyCache = new HistoryCache(this.config.mockLocalStorage);
  };
  Evaporate.create = function (config) {
    var evapConfig = extend({}, config);
    return Evaporate.getLocalTimeOffset(evapConfig)
        .then(function (offset) {
          evapConfig.localTimeOffset = offset;
          return new Promise(function (resolve, reject) {
            var e = new Evaporate(evapConfig);
            if (e.supported === true) {
              resolve(e);
            } else {
              reject(e._instantiationError);
            }
          });
        });
  };
  Evaporate.getLocalTimeOffset = function (config) {
    return new Promise(function (resolve, reject) {
      if (typeof config.localTimeOffset === 'number') {
        return resolve(config.localTimeOffset);
      }
      if (config.timeUrl) {
        var xhr = new XMLHttpRequest();

        xhr.open("GET", config.timeUrl + '?requestTime=' + new Date().getTime());
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              var server_date = new Date(Date.parse(xhr.responseText)),
                  offset = server_date - new Date();
              l.d('localTimeOffset is', offset, 'ms');
              resolve(offset);
            }
          }
        };

        xhr.onerror = function (xhr) {
          l.e('xhr error timeUrl', xhr);
          reject('Fetching offset time failed with status: ' + xhr.status);
        };
        xhr.send();
      } else {
        resolve(0);
      }
    });
  };
  Evaporate.prototype.config = {};
  Evaporate.prototype.localTimeOffset = 0;
  Evaporate.prototype.supported = false;
  Evaporate.prototype._instantiationError = undefined;
  Evaporate.prototype.evaporatingCount = 0;
  Evaporate.prototype.pendingFiles = {};
  Evaporate.prototype.filesInProcess = [];
  Evaporate.prototype.queuedFiles = [];
  Evaporate.prototype.startNextFile = function (reason) {
    if (!this.queuedFiles.length ||
        this.evaporatingCount >= this.config.maxConcurrentParts) { return; }
    var fileUpload = this.queuedFiles.shift();
    if (fileUpload.status === PENDING) {
      l.d('Starting', decodeURIComponent(fileUpload.name), 'reason:', reason);
      this.evaporatingCnt(+1);
      fileUpload.start();
    } else {
      // Add the file back to the stack, it's not ready
      l.d('Requeued', decodeURIComponent(fileUpload.name), 'status:', fileUpload.status, 'reason:', reason);
      this.queuedFiles.push(fileUpload);
    }
  };
  Evaporate.prototype.fileCleanup = function (fileUpload) {
    removeAtIndex(this.queuedFiles, fileUpload);
    if (removeAtIndex(this.filesInProcess, fileUpload)) {
      this.evaporatingCnt(-1);
    }
    fileUpload.done();
    this.consumeRemainingSlots();
  };
  Evaporate.prototype.queueFile = function (fileUpload) {
    this.filesInProcess.push(fileUpload);
    this.queuedFiles.push(fileUpload);
    if (this.filesInProcess.length === 1) {
      this.startNextFile('first file');
    }
  };
  Evaporate.prototype.add = function (file,  pConfig) {
    var self = this,
        fileConfig;
    return new Promise(function (resolve, reject) {
      var c = extend(pConfig, {});

      IMMUTABLE_OPTIONS.forEach(function (a) { delete c[a]; });

      fileConfig = extend(self.config, c);

      if (typeof file === 'undefined' || typeof file.file === 'undefined') {
        return reject('Missing file');
      }
      if (fileConfig.maxFileSize && file.file.size > fileConfig.maxFileSize) {
        return reject('File size too large. Maximum size allowed is ' + fileConfig.maxFileSize);
      }
      if (typeof file.name === 'undefined') {
        return reject('Missing attribute: name');
      }

      if (fileConfig.encodeFilename) {
        // correctly encode to an S3 object name, considering '/' and ' '
        file.name = s3EncodedObjectName(file.name);
      }

      var fileUpload = new FileUpload(extend({
            started: function () {},
            uploadInitiated: function () {},
            progress: function () {},
            complete: function () {},
            cancelled: function () {},
            paused: function () {},
            resumed: function () {},
            pausing: function () {},
            nameChanged: function () {},
            info: function () {},
            warn: function () {},
            error: function () {},
            beforeSigner: undefined,
            xAmzHeadersAtInitiate: {},
            notSignedHeadersAtInitiate: {},
            xAmzHeadersCommon: null,
            xAmzHeadersAtUpload: {},
            xAmzHeadersAtComplete: {}
          }, file, {
            status: PENDING,
            priority: 0,
            loadedBytes: 0,
            sizeBytes: file.file.size,
            eTag: ''
          }), fileConfig, self),
          fileKey = fileUpload.id;

      self.pendingFiles[fileKey] = fileUpload;

      self.queueFile(fileUpload);

      // Resolve or reject the Add promise based on how the fileUpload completes
      fileUpload.deferredCompletion.promise
          .then(
              function () {
                self.fileCleanup(fileUpload);
                resolve(decodeURIComponent(fileUpload.name));
              },
              function (reason) {
                self.fileCleanup(fileUpload);
                reject(reason);
              }
          );
    })
  };
  Evaporate.prototype.cancel = function (id) {
    return typeof id === 'undefined' ? this._cancelAll() : this._cancelOne(id);
  };
  Evaporate.prototype._cancelAll = function () {
    l.d('Canceling all file uploads');
    var promises = [];
    for (var key in this.pendingFiles) {
      if (this.pendingFiles.hasOwnProperty(key)) {
        var file = this.pendingFiles[key];
        if (ACTIVE_STATUSES.indexOf(file.status) > -1) {
          promises.push(file.stop());
        }
      }
    }
    if (!promises.length) {
      promises.push(Promise.reject('No files to cancel.'));
    }
    return Promise.all(promises);
  };
  Evaporate.prototype._cancelOne = function (id) {
    var promise = [];
    if (this.pendingFiles[id]) {
      promise.push(this.pendingFiles[id].stop());
    } else {
      promise.push(Promise.reject('File does not exist'));
    }
    return Promise.all(promise);
  };
  Evaporate.prototype.pause = function (id, options) {
    options = options || {};
    var force = typeof options.force === 'undefined' ? false : options.force;
    return typeof id === 'undefined' ? this._pauseAll(force) : this._pauseOne(id, force);
  };
  Evaporate.prototype._pauseAll = function (force) {
    l.d('Pausing all file uploads');
    var promises = [];
    for (var key in this.pendingFiles) {
      if (this.pendingFiles.hasOwnProperty(key)) {
        var file = this.pendingFiles[key];
        if (ACTIVE_STATUSES.indexOf(file.status) > -1) {
          this._pause(file, force, promises);
        }
      }
    }
    return Promise.all(promises);
  };
  Evaporate.prototype._pauseOne = function (id, force) {
    var promises = [],
        file = this.pendingFiles[id];
    if (typeof file === 'undefined') {
      promises.push(Promise.reject('Cannot pause a file that has not been added.'));
    } else if (file.status === PAUSED) {
      promises.push(Promise.reject('Cannot pause a file that is already paused.'));
    }
    if (!promises.length) {
      this._pause(file, force, promises);
    }
    return Promise.all(promises);
  };
  Evaporate.prototype._pause = function(fileUpload, force, promises) {
    promises.push(fileUpload.pause(force));
    removeAtIndex(this.filesInProcess, fileUpload);
    removeAtIndex(this.queuedFiles, fileUpload);
  };
  Evaporate.prototype.resume = function (id) {
    return typeof id === 'undefined' ? this._resumeAll() : this._resumeOne(id);
  };
  Evaporate.prototype._resumeAll = function () {
    l.d('Resuming all file uploads');
    for (var key in this.pendingFiles) {
      if (this.pendingFiles.hasOwnProperty(key)) {
        var file = this.pendingFiles[key];
        if (PAUSED_STATUSES.indexOf(file.status) > -1)  {
          this.resumeFile(file);
        }
      }
    }
    return Promise.resolve();
  };
  Evaporate.prototype._resumeOne = function (id) {
    var file = this.pendingFiles[id],
        promises = [];
    if (typeof file === 'undefined') {
      promises.push(Promise.reject('Cannot pause a file that does not exist.'));
    } else if (PAUSED_STATUSES.indexOf(file.status) === -1) {
      promises.push(Promise.reject('Cannot resume a file that has not been paused.'));
    } else {
      this.resumeFile(file);
    }
    return Promise.all(promises);
  };
  Evaporate.prototype.resumeFile = function (fileUpload) {
    fileUpload.resume();
    this.queueFile(fileUpload);
  };
  Evaporate.prototype.forceRetry = function () {};
  Evaporate.prototype.consumeRemainingSlots = function () {
    var avail = this.config.maxConcurrentParts - this.evaporatingCount;
    if (!avail) { return; }
    for (var i = 0; i < this.filesInProcess.length; i++) {
      var file = this.filesInProcess[i];
      var consumed = file.consumeSlots();
      if (consumed < 0) { continue; }
      avail -= consumed;
      if (!avail) { return; }
    }
  };
  Evaporate.prototype.validateEvaporateOptions = function () {
    this.supported = !(
    typeof File === 'undefined' ||
    typeof Promise === 'undefined');

    if (!this.supported) {
      return 'Evaporate requires support for File and Promise';
    }

    if (this.config.readableStreams) {
      if (typeof this.config.readableStreamPartMethod !== 'function') {
        return "Option readableStreamPartMethod is required when readableStreams is set."
      }
    } else  {
      if (typeof Blob === 'undefined' || typeof (
          Blob.prototype.webkitSlice ||
          Blob.prototype.mozSlice ||
          Blob.prototype.slice) === 'undefined') {
        return 'Evaporate requires support for Blob [webkitSlice || mozSlice || slice]';
      }
    }

    if (!this.config.signerUrl && typeof this.config.customAuthMethod !== 'function') {
      return "Option signerUrl is required unless customAuthMethod is present.";
    }

    if (!this.config.bucket) {
      return "The AWS 'bucket' option must be present.";
    }

    if (this.config.computeContentMd5) {
      this.supported = typeof FileReader.prototype.readAsArrayBuffer !== 'undefined';
      if (!this.supported) {
        return 'The browser\'s FileReader object does not support readAsArrayBuffer';
      }

      if (typeof this.config.cryptoMd5Method !== 'function') {
        return 'Option computeContentMd5 has been set but cryptoMd5Method is not defined.'
      }

      if (this.config.awsSignatureVersion === '4') {
        if (typeof this.config.cryptoHexEncodedHash256 !== 'function') {
          return 'Option awsSignatureVersion is 4 but cryptoHexEncodedHash256 is not defined.';
        }
      }
    } else if (this.config.awsSignatureVersion === '4') {
      return 'Option awsSignatureVersion is 4 but computeContentMd5 is not enabled.';
    }
    return true;
  };
  Evaporate.prototype.evaporatingCnt = function (incr) {
    this.evaporatingCount = Math.max(0, this.evaporatingCount + incr);
    this.config.evaporateChanged(this, this.evaporatingCount);
  };


  function FileUpload(file, con, evaporate) {
    this.fileTotalBytesUploaded = 0;
    this.s3Parts = [];
    this.partsOnS3 = [];
    this.partsInProcess = [];
    this.partsToUpload = [];
    this.numParts = -1;
    this.con = extend({}, con);
    this.evaporate = evaporate;
    this.localTimeOffset = evaporate.localTimeOffset;
    this.deferredCompletion = defer();

    extend(this, file);

    this.id = decodeURIComponent(this.con.bucket + '/' + this.name);

    this.signParams = con.signParams;
  }
  FileUpload.prototype.con = undefined;
  FileUpload.prototype.evaporate = undefined;
  FileUpload.prototype.localTimeOffset = 0;
  FileUpload.prototype.id = undefined;
  FileUpload.prototype.status = PENDING;
  FileUpload.prototype.numParts = -1;
  FileUpload.prototype.fileTotalBytesUploaded = 0;
  FileUpload.prototype.partsInProcess = [];
  FileUpload.prototype.partsToUpload = [];
  FileUpload.prototype.s3Parts = [];
  FileUpload.prototype.partsOnS3 = [];
  FileUpload.prototype.deferredCompletion = undefined;
  FileUpload.prototype.abortedByUser = false;

  // Progress and Stats
  FileUpload.prototype.progressInterval = undefined;
  FileUpload.prototype.startTime = undefined;
  FileUpload.prototype.loaded = 0;
  FileUpload.prototype.totalUploaded = 0;
  FileUpload.prototype.updateLoaded = function (loadedNow) {
    this.loaded += loadedNow;
    this.fileTotalBytesUploaded += loadedNow;
  };
  FileUpload.prototype.progessStats = function () {
    // Adapted from https://github.com/fkjaekel
    // https://github.com/TTLabs/EvaporateJS/issues/13
    if (this.fileTotalBytesUploaded === 0) {
      return {
        speed: 0,
        readableSpeed: "",
        loaded: 0,
        totalUploaded: 0,
        remainingSize: this.sizeBytes,
        secondsLeft: -1,
        fileSize: this.sizeBytes,
      };
    }

    this.totalUploaded += this.loaded;
    var delta = (new Date() - this.startTime) / 1000,
        avgSpeed = this.totalUploaded / delta,
        remainingSize = this.sizeBytes - this.fileTotalBytesUploaded,
        stats = {
          speed: avgSpeed,
          readableSpeed: readableFileSize(avgSpeed),
          loaded: this.loaded,
          totalUploaded: this.fileTotalBytesUploaded,
          remainingSize: remainingSize,
          secondsLeft: -1,
          fileSize: this.sizeBytes,

        };

    if (avgSpeed > 0) {
      stats.secondsLeft = Math.round(remainingSize / avgSpeed);
    }

    return stats;
  };
  FileUpload.prototype.onProgress = function () {
    if ([ABORTED, PAUSED].indexOf(this.status) === -1) {
      this.progress(this.fileTotalBytesUploaded / this.sizeBytes, this.progessStats());
      this.loaded = 0;
    }
  };
  FileUpload.prototype.startMonitor = function () {
    clearInterval(this.progressInterval);
    this.startTime = new Date();
    this.loaded = 0;
    this.totalUploaded = 0;
    this.onProgress();
    this.progressInterval = setInterval(this.onProgress.bind(this), this.con.progressIntervalMS);
  };
  FileUpload.prototype.stopMonitor = function () {
    clearInterval(this.progressInterval);
  };

  // Evaporate proxies
  FileUpload.prototype.startNextFile = function (reason) {
    this.evaporate.startNextFile(reason);
  };
  FileUpload.prototype.evaporatingCnt = function (incr) {
    this.evaporate.evaporatingCnt(incr);
  };
  FileUpload.prototype.consumeRemainingSlots = function () {
    this.evaporate.consumeRemainingSlots();
  };
  FileUpload.prototype.getRemainingSlots = function () {
    var evapCount = this.evaporate.evaporatingCount;
    if (!this.partsInProcess.length && evapCount > 0) {
      // we can use our file slot
      evapCount -= 1;
    }
    return this.con.maxConcurrentParts - evapCount;
  };

  FileUpload.prototype.lastPartSatisfied = Promise.resolve('onStart');

  FileUpload.prototype.start = function () {
    this.status = EVAPORATING;
    this.startMonitor();
    this.started(this.id);

    if (this.uploadId) {
      l.d('resuming FileUpload ', this.id);
      return this.consumeSlots();
    }

    var awsKey = this.name;

    this.getUnfinishedFileUpload();

    var existenceOptimized = this.con.computeContentMd5 &&
            this.con.allowS3ExistenceOptimization &&
            typeof this.firstMd5Digest !== 'undefined' &&
            typeof this.eTag !== 'undefined';

        if (this.uploadId) {
          if (existenceOptimized) {
            return this.reuseS3Object(awsKey)
                .then(this.deferredCompletion.resolve)
                .catch(this.uploadFileFromScratch.bind(this));
          }

          this.resumeInterruptedUpload()
              .then(this._uploadComplete.bind(this))
              .catch(this.uploadFileFromScratch.bind(this));
        } else {
          this.uploadFileFromScratch("");
        }
  };
  FileUpload.prototype.uploadFileFromScratch = function (reason) {
    if (ACTIVE_STATUSES.indexOf(this.status) === -1) { return; }
    l.d(reason);
    this.uploadId = undefined;
    return this.uploadFile(this.name)
        .then(this._uploadComplete.bind(this))
        .catch(this._abortUpload.bind(this));
  };
  FileUpload.prototype._uploadComplete = function () {
    this.completeUpload().then(this.deferredCompletion.resolve);
  };
  FileUpload.prototype.stop = function () {
    l.d('stopping FileUpload ', this.id);
    this.setStatus(CANCELED);
    this.info('Canceling uploads...');
    this.abortedByUser = true;
    var self = this;
    return this.abortUpload()
        .then(function () {
          throw("User aborted the upload");
        })
        .catch(function (reason) {
          self.deferredCompletion.reject(reason);
        });
  };
  FileUpload.prototype.pause = function (force) {
    l.d('pausing FileUpload, force:', !!force, this.id);
    var promises = [];
    this.info('Pausing uploads...');
    this.status = PAUSING;
    if (force) {
      this.abortParts(true);
    } else {
      promises = this.partsInProcess.map(function (p) {
        return this.s3Parts[p].awsRequest.awsDeferred.promise
      }, this);
      this.pausing();
    }
    return Promise.all(promises)
        .then(function () {
          this.stopMonitor();
          this.status = PAUSED;
          this.startNextFile('pause');
          this.paused();
        }.bind(this));
  };
  FileUpload.prototype.resume = function () {
    this.status = PENDING;
    this.resumed();
  };
  FileUpload.prototype.done = function () {
    clearInterval(this.progressInterval);
    this.startNextFile('file done');
    this.partsOnS3 = [];
    this.s3Parts = [];
  };
  FileUpload.prototype._startCompleteUpload = function (callComplete) {
    return function () {
      var promise = callComplete ? this.completeUpload() : Promise.resolve();
      promise.then(this.deferredCompletion.resolve.bind(this));
    }
  };
  FileUpload.prototype._abortUpload = function () {
    if (!this.abortedByUser) {
      var self = this;
      this.abortUpload()
          .then(
              function () { self.deferredCompletion.reject('File upload aborted due to a part failing to upload'); },
              this.deferredCompletion.reject.bind(this));
    }
  };

  FileUpload.prototype.abortParts = function (pause) {
    var self = this;
    var toAbort = this.partsInProcess.slice(0);
    toAbort.forEach(function (i) {
      var s3Part = self.s3Parts[i];
      if (s3Part) {
        s3Part.awsRequest.abort();
        if (pause) { s3Part.status = PENDING; }
        removeAtIndex(self.partsInProcess, s3Part.partNumber);
        if (self.partsToUpload.length) { self.evaporatingCnt(-1); }
      }
    });
  };
  FileUpload.prototype.makeParts = function (firstPart) {
    this.numParts = Math.ceil(this.sizeBytes / this.con.partSize) || 1; // issue #58
    var partsDeferredPromises = [];

    var self = this;

    function cleanUpAfterPart(s3Part) {
      removeAtIndex(self.partsToUpload, s3Part.partNumber);
      removeAtIndex(self.partsInProcess, s3Part.partNumber);

      if (self.partsToUpload.length) { self.evaporatingCnt(-1); }
    }

    function resolve(s3Part) { return function () {
      cleanUpAfterPart(s3Part);
      if (self.partsToUpload.length) { self.consumeRemainingSlots(); }
      if (self.partsToUpload.length < self.con.maxConcurrentParts) {
        self.startNextFile('part resolve');
      }
    };
    }
    function reject(s3Part) { return function () {
      cleanUpAfterPart(s3Part);
    };
    }

    var limit = firstPart ? 1 : this.numParts;

    for (var part = 1; part <= limit; part++) {
      var s3Part = this.s3Parts[part];
      if (typeof s3Part !== "undefined"){
        if(s3Part.status === COMPLETE) { continue; }
      } else {
        s3Part = this.makePart(part, PENDING, this.sizeBytes);
      }
      s3Part.awsRequest = new PutPart(this, s3Part);
      s3Part.awsRequest.awsDeferred.promise
          .then(resolve(s3Part), reject(s3Part));

      this.partsToUpload.push(part);
      partsDeferredPromises.push(this.s3Parts[part].awsRequest.awsDeferred.promise);
    }

    return partsDeferredPromises;
  };
  FileUpload.prototype.makePart = function (partNumber, status, size) {
    var s3Part = {
      status: status,
      loadedBytes: 0,
      loadedBytesPrevious: null,
      isEmpty: (size === 0), // issue #58
      md5_digest: null,
      partNumber: partNumber
    };

    this.s3Parts[partNumber] = s3Part;

    return s3Part;
  };
  FileUpload.prototype.setStatus = function (s) {
    this.status = s;
  };

  FileUpload.prototype.createUploadFile = function () {
    if (this.status === ABORTED) { return; }
    var fileKey = uploadKey(this),
        newUpload = {
          awsKey: this.name,
          bucket: this.con.bucket,
          uploadId: this.uploadId,
          fileSize: this.sizeBytes,
          fileType: this.file.type,
          lastModifiedDate: dateISOString(this.file.lastModified),
          partSize: this.con.partSize,
          signParams: this.con.signParams,
          createdAt: new Date().toISOString()
        };
    saveUpload(fileKey, newUpload);
  };
  FileUpload.prototype.updateUploadFile = function (updates) {
    var fileKey = uploadKey(this),
        uploads = getSavedUploads(),
        upload = extend({}, uploads[fileKey], updates);
    saveUpload(fileKey, upload);
  };
  FileUpload.prototype.completeUploadFile = function (xhr) {
    var uploads = getSavedUploads(),
        upload = uploads[uploadKey(this)];

    if (typeof upload !== 'undefined') {
      upload.completedAt = new Date().toISOString();
      upload.eTag = this.eTag;
      upload.firstMd5Digest = this.firstMd5Digest;
      uploads[uploadKey(this)] = upload;
      historyCache.setItem('awsUploads', JSON.stringify(uploads));
    }

    this.complete(xhr, this.name, this.progessStats());
    this.setStatus(COMPLETE);
    this.onProgress();
  };
  FileUpload.prototype.removeUploadFile = function (){
    if (typeof this.file !== 'undefined') {
      removeUpload(uploadKey(this));
    }
  };
  FileUpload.prototype.getUnfinishedFileUpload = function () {
    var savedUploads = getSavedUploads(true),
        u = savedUploads[uploadKey(this)];

    if (this.canRetryUpload(u)) {
      this.uploadId = u.uploadId;
      this.name = u.awsKey;
      this.eTag = u.eTag;
      this.firstMd5Digest = u.firstMd5Digest;
      this.signParams = u.signParams;
    }
  };
  FileUpload.prototype.canRetryUpload = function (u) {
    // Must be the same file name, file size, last_modified, file type as previous upload
    if (typeof u === 'undefined') {
      return false;
    }
    var completedAt = new Date(u.completedAt || FAR_FUTURE);

    // check that the part sizes and bucket match, and if the file name of the upload
    // matches if onlyRetryForSameFileName is true
    return this.con.partSize === u.partSize &&
        completedAt > HOURS_AGO &&
        this.con.bucket === u.bucket &&
        (this.con.onlyRetryForSameFileName ? this.name === u.awsKey : true);
  };

  FileUpload.prototype.partSuccess = function (eTag, putRequest) {
    var part = putRequest.part;
    l.d(putRequest.request.step, 'ETag:', eTag);
    if (part.isEmpty || (eTag !== ETAG_OF_0_LENGTH_BLOB)) { // issue #58
      part.eTag = eTag;
      part.status = COMPLETE;
      this.partsOnS3.push(part);
      return true;
    } else {
      part.status = ERROR;
      putRequest.resetLoadedBytes();
      var msg = ['eTag matches MD5 of 0 length blob for part #', putRequest.partNumber, 'Retrying part.'].join(" ");
      l.w(msg);
      this.warn(msg);
    }
  };
  FileUpload.prototype.listPartsSuccess = function (listPartsRequest, partsXml) {
    this.info('uploadId', this.uploadId, 'is not complete. Fetching parts from part marker', listPartsRequest.partNumberMarker);
    partsXml = partsXml.replace(/(\r\n|\n|\r)/gm, ""); // strip line breaks to ease the regex requirements
    var partRegex = /<Part>(.+?)<\/Part\>/g;

    while (true) {
      var cp = (partRegex.exec(partsXml) || [])[1];
      if (!cp) { break; }

      var partSize = parseInt(elementText(cp, "Size"), 10);
      this.fileTotalBytesUploaded += partSize;
      this.partsOnS3.push({
        eTag: elementText(cp, "ETag").replace(/&quot;/g, '"'),
        partNumber: parseInt(elementText(cp, "PartNumber"), 10),
        size: partSize,
        LastModified: elementText(cp, "LastModified")
      });
    }
    return elementText(partsXml, "IsTruncated") === 'true' ? elementText(partsXml, "NextPartNumberMarker") : undefined;
  };
  FileUpload.prototype.makePartsfromPartsOnS3 = function () {
    if (ACTIVE_STATUSES.indexOf(this.status) === -1) { return; }
    this.nameChanged(this.name);
    this.partsOnS3.forEach(function (cp) {
      var uploadedPart = this.makePart(cp.partNumber, COMPLETE, cp.size);
      uploadedPart.eTag = cp.eTag;
      uploadedPart.loadedBytes = cp.size;
      uploadedPart.loadedBytesPrevious = cp.size;
      uploadedPart.finishedUploadingAt = cp.LastModified;
    }.bind(this));
  };
  FileUpload.prototype.completeUpload = function () {
    var self = this;
    return new CompleteMultipartUpload(this)
        .send()
        .then(
            function (xhr) {
              self.eTag = elementText(xhr.responseText, "ETag").replace(/&quot;/g, '"');
              self.completeUploadFile(xhr);
            });
  };
  FileUpload.prototype.getCompletedPayload = function () {
    var completeDoc = [];
    completeDoc.push('<CompleteMultipartUpload>');
    this.s3Parts.forEach(function (part, partNumber) {
      if (partNumber > 0) {
        ['<Part><PartNumber>', partNumber, '</PartNumber><ETag>', part.eTag, '</ETag></Part>']
            .forEach(function (a) { completeDoc.push(a); });
      }
    });
    completeDoc.push('</CompleteMultipartUpload>');

    return completeDoc.join("");
  };
  FileUpload.prototype.consumeSlots = function () {
    if (this.partsToUpload.length === 0) { return -1 }
    if (this.partsToUpload.length !== this.partsInProcess.length &&
        this.status === EVAPORATING) {

      var partsToUpload = Math.min(this.getRemainingSlots(), this.partsToUpload.length);

      if (!partsToUpload) { return -1; }

      var satisfied = 0;
      for (var i = 0; i < this.partsToUpload.length; i++) {
        var s3Part = this.s3Parts[this.partsToUpload[i]];

        if (s3Part.status === EVAPORATING) { continue; }

        if (this.canStartPart(s3Part)) {
          if (this.partsInProcess.length && this.partsToUpload.length > 1) {
            this.evaporatingCnt(+1);
          }
          this.partsInProcess.push(s3Part.partNumber);
          var awsRequest = s3Part.awsRequest;
          this.lastPartSatisfied.then(awsRequest.delaySend.bind(awsRequest));
          this.lastPartSatisfied = awsRequest.getStartedPromise();
        } else { continue; }

        satisfied += 1;

        if (satisfied === partsToUpload) { break; }

      }
      var allInProcess = this.partsToUpload.length === this.partsInProcess.length,
          remainingSlots = this.getRemainingSlots();
      if (allInProcess && remainingSlots > 0) {
        // We don't need any more slots...
        this.startNextFile('consume slots');
      }
      return remainingSlots;
    }
    return 0;
  };
  FileUpload.prototype.canStartPart = function (part) {
    return this.partsInProcess.indexOf(part.partNumber) === -1 && !part.awsRequest.errorExceptionStatus();
  };
  FileUpload.prototype.uploadFile = function (awsKey) {
    this.removeUploadFile();
    var self = this;
    return new InitiateMultipartUpload(self, awsKey)
        .send()
        .then(
            function () {
              self.uploadInitiated(self.uploadId);
              self.partsToUpload = [];
              return self.uploadParts()
                  .then(
                      function () {},
                      function (reason) {
                        throw(reason);
                      })
            });
  };
  FileUpload.prototype.uploadParts = function () {
    this.loaded = 0;
    this.totalUploaded = 0;
    if (ACTIVE_STATUSES.indexOf(this.status) === -1) {
      return Promise.reject('Part uploading stopped because the file was canceled');
    }
    var promises = this.makeParts();
    this.setStatus(EVAPORATING);
    this.startTime = new Date();
    this.consumeSlots();
    return Promise.all(promises);
  };
  FileUpload.prototype.abortUpload = function () {
    return new Promise(function (resolve, reject) {

      if(typeof this.uploadId === 'undefined') {
        resolve();
        return;
      }

      new DeleteMultipartUpload(this)
          .send()
          .then(resolve, reject);
    }.bind(this))
        .then(
            function () {
              this.setStatus(ABORTED);
              this.cancelled();
              this.removeUploadFile();
            }.bind(this),
            this.deferredCompletion.reject.bind(this));
  };
  FileUpload.prototype.resumeInterruptedUpload = function () {
    return new ResumeInterruptedUpload(this)
        .send()
        .then(this.uploadParts.bind(this));
  };
  FileUpload.prototype.reuseS3Object = function (awsKey) {
    var self = this;
    // Attempt to reuse entire uploaded object on S3
    this.makeParts(1);
    this.partsToUpload = [];
    var firstS3Part = this.s3Parts[1];
    function reject(reason) {
      self.name = awsKey;
      throw(reason);
    }
    return firstS3Part.awsRequest.getPartMd5Digest()
        .then(function () {
          if (self.firstMd5Digest === firstS3Part.md5_digest) {
            return new ReuseS3Object(self, awsKey)
                .send()
                .then(
                    function (xhr) {
                      l.d('headObject found matching object on S3.');
                      self.completeUploadFile(xhr);
                      self.nameChanged(self.name);
                    })
                .catch(reject);

          } else {
            var msg = self.con.allowS3ExistenceOptimization ? 'File\'s first part MD5 digest does not match what was stored.' : 'allowS3ExistenceOptimization is not enabled.';
            reject(msg);
          }
        });
  };


  function SignedS3AWSRequest(fileUpload, request) {
    this.fileUpload = fileUpload;
    this.con = fileUpload.con;
    this.attempts = 1;
    this.localTimeOffset = this.fileUpload.localTimeOffset;
    this.awsDeferred = defer();
    this.started = defer();

    this.awsUrl = awsUrl(this.con);
    this.awsHost = uri(this.awsUrl).hostname;

    var r = extend({}, request);
    if (fileUpload.contentType) {
      r.contentType = fileUpload.contentType;
    }

    this.updateRequest(r);
  }
  SignedS3AWSRequest.prototype.fileUpload = undefined;
  SignedS3AWSRequest.prototype.con = undefined;
  SignedS3AWSRequest.prototype.awsUrl = undefined;
  SignedS3AWSRequest.prototype.awsHost = undefined;
  SignedS3AWSRequest.prototype.authorize = function () {};
  SignedS3AWSRequest.prototype.localTimeOffset = 0;
  SignedS3AWSRequest.prototype.awsDeferred = undefined;
  SignedS3AWSRequest.prototype.started = undefined;
  SignedS3AWSRequest.prototype.getPath = function () {
    var path = '/' + this.con.bucket + '/' + this.fileUpload.name;
    if (this.con.cloudfront || this.awsUrl.indexOf('cloudfront') > -1) {
      path = '/' + this.fileUpload.name;
    }
    return path;
  };

  SignedS3AWSRequest.prototype.updateRequest = function (request) {
    this.request = request;
    var SigningClass = signingVersion(this, l);
    this.signer = new SigningClass(request);
  };
  SignedS3AWSRequest.prototype.success = function () { this.awsDeferred.resolve(this.currentXhr); };
  SignedS3AWSRequest.prototype.backOffWait = function () {
    return (this.attempts === 1) ? 0 : 1000 * Math.min(
            this.con.maxRetryBackoffSecs,
            Math.pow(this.con.retryBackoffPower, this.attempts - 2)
        );
  };
  SignedS3AWSRequest.prototype.error =  function (reason) {
    if (this.errorExceptionStatus()) {
      return;
    }

    this.signer.error();
    l.d(this.request.step, 'error:', this.fileUpload.id, reason);

    if (typeof this.errorHandler(reason) !== 'undefined' ) {
      return;
    }

    this.fileUpload.warn('Error in ', this.request.step, reason);
    this.fileUpload.setStatus(ERROR);

    var self = this,
        backOffWait = this.backOffWait();
    this.attempts += 1;

    setTimeout(function () {
      if (!self.errorExceptionStatus()) { self.trySend(); }
    }, backOffWait);
  };
  SignedS3AWSRequest.prototype.errorHandler = function () { };
  SignedS3AWSRequest.prototype.errorExceptionStatus = function () { return false; };
  SignedS3AWSRequest.prototype.getPayload = function () { return Promise.resolve(null); };
  SignedS3AWSRequest.prototype.success_status = function (xhr) {
    return (xhr.status >= 200 && xhr.status <= 299) ||
        this.request.success404 && xhr.status === 404;
  };
  SignedS3AWSRequest.prototype.stringToSign = function () {
    return encodeURIComponent(this.signer.stringToSign());
  };
  SignedS3AWSRequest.prototype.canonicalRequest = function () {
    return this.signer.canonicalRequest();
  }
  SignedS3AWSRequest.prototype.signResponse = function(payload, stringToSign, signatureDateTime) {
    var self = this;
    return new Promise(function (resolve) {
      if (typeof self.con.signResponseHandler === 'function') {
        return self.con.signResponseHandler(payload, stringToSign, signatureDateTime)
            .then(resolve);
      }
      resolve(payload);
    });
  };
  SignedS3AWSRequest.prototype.sendRequestToAWS = function () {
    var self = this;
    return new Promise( function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      self.currentXhr = xhr;

      var url = [self.awsUrl, self.getPath(), self.request.path].join(""),
          all_headers = {};

      if (self.request.query_string) {
        url += self.request.query_string;
      }
      extend(all_headers, self.request.not_signed_headers);
      extend(all_headers, self.request.x_amz_headers);

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {

          if (self.success_status(xhr)) {
            if (self.request.response_match &&
                xhr.response.match(new RegExp(self.request.response_match)) === undefined) {
              reject('AWS response does not match set pattern: ' + self.request.response_match);
            } else {
              resolve();
            }
          } else {
            var reason = xhr.responseText ? getAwsResponse(xhr) : ' ';
            reason += 'status:' + xhr.status;
            reject(reason);
          }
        }
      };

      xhr.open(self.request.method, url);
      xhr.setRequestHeader('Authorization', self.signer.authorizationString());

      for (var key in all_headers) {
        if (all_headers.hasOwnProperty(key)) {
          xhr.setRequestHeader(key, all_headers[key]);
        }
      }

      self.signer.setHeaders(xhr);

      if (self.request.contentType) {
        xhr.setRequestHeader('Content-Type', self.request.contentType);
      }

      if (self.request.md5_digest) {
        xhr.setRequestHeader('Content-MD5', self.request.md5_digest);
      }
      xhr.onerror = function (xhr) {
        var reason = xhr.responseText ? getAwsResponse(xhr) : 'transport error';
        reject(reason);
      };

      if (typeof self.request.onProgress === 'function') {
        xhr.upload.onprogress = self.request.onProgress;
      }

      self.getPayload()
          .then(xhr.send.bind(xhr), reject);

      setTimeout(function () { // We have to delay here or Safari will hang
        self.started.resolve('request sent ' + self.request.step);
      }, 20);
      self.signer.payload = null;
      self.payloadPromise = undefined;
    });
  };
  //see: http://docs.amazonwebservices.com/AmazonS3/latest/dev/RESTAuthentication.html#ConstructingTheAuthenticationHeader
  SignedS3AWSRequest.prototype.authorize = function () {
    this.request.dateString = this.signer.dateString(this.localTimeOffset);
    this.request.x_amz_headers = extend(this.request.x_amz_headers, {
      'x-amz-date': this.request.dateString
    });
    return this.signer.getPayload()
        .then(function () {
          return authorizationMethod(this).authorize();
        }.bind(this));
  };
  SignedS3AWSRequest.prototype.authorizationSuccess = function (authorization) {
    l.d(this.request.step, 'signature:', authorization);
    this.request.auth = authorization;
  };
  SignedS3AWSRequest.prototype.trySend = function () {
    var self = this;
    return this.authorize()
        .then(
            function (value) {
              self.authorizationSuccess(value);
              if (self.fileUpload.status === ABORTED) { return; }
              self.sendRequestToAWS().then(self.success.bind(self), self.error.bind(self));
            },
            self.error.bind(self));
  };
  SignedS3AWSRequest.prototype.send = function () {
    this.trySend();
    return this.awsDeferred.promise;
  };

  function CancelableS3AWSRequest(fileUpload, request) {
    SignedS3AWSRequest.call(this, fileUpload, request);
  }
  CancelableS3AWSRequest.prototype = Object.create(SignedS3AWSRequest.prototype);
  CancelableS3AWSRequest.prototype.constructor = CancelableS3AWSRequest;
  CancelableS3AWSRequest.prototype.errorExceptionStatus = function () {
    return [ABORTED, CANCELED].indexOf(this.fileUpload.status) > -1;
  };

  function SignedS3AWSRequestWithRetryLimit(fileUpload, request, maxRetries) {
    if (maxRetries > -1) {
      this.maxRetries = maxRetries;
    }
    SignedS3AWSRequest.call(this, fileUpload, request);
  }
  SignedS3AWSRequestWithRetryLimit.prototype = Object.create(CancelableS3AWSRequest.prototype);
  SignedS3AWSRequestWithRetryLimit.prototype.constructor = SignedS3AWSRequestWithRetryLimit;
  SignedS3AWSRequestWithRetryLimit.prototype.maxRetries = 1;
  SignedS3AWSRequestWithRetryLimit.prototype.errorHandler =  function (reason) {
    if (this.attempts > this.maxRetries) {
      var msg = ['MaxRetries exceeded. Will re-upload file id ', this.fileUpload.id, ', ', reason].join("");
      l.w(msg);
      this.awsDeferred.reject(msg);
      return true;
    }
  };
  SignedS3AWSRequestWithRetryLimit.prototype.rejectedSuccess = function () {
    var reason = Array.prototype.slice.call(arguments, 1).join("");
    this.awsDeferred.reject(reason);
    return false;
  };

  // see: http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadInitiate.html
  function InitiateMultipartUpload(fileUpload, awsKey) {
    var request = {
      method: 'POST',
      path: '?uploads',
      step: 'initiate',
      x_amz_headers: fileUpload.xAmzHeadersAtInitiate,
      not_signed_headers: fileUpload.notSignedHeadersAtInitiate,
      response_match: '<UploadId>(.+)<\/UploadId>'
    };

    CancelableS3AWSRequest.call(this, fileUpload, request);
    this.awsKey = awsKey;
  }
  InitiateMultipartUpload.prototype = Object.create(CancelableS3AWSRequest.prototype);
  InitiateMultipartUpload.prototype.constructor = InitiateMultipartUpload;
  InitiateMultipartUpload.prototype.success = function () {
    var match = this.currentXhr.response.match(new RegExp(this.request.response_match));
    this.fileUpload.uploadId = match[1];
    this.fileUpload.awsKey = this.awsKey;
    l.d('InitiateMultipartUpload ID is', this.fileUpload.uploadId);
    this.fileUpload.createUploadFile();
    this.awsDeferred.resolve(this.currentXhr);
  };

  //http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadComplete.html
  function CompleteMultipartUpload(fileUpload) {
    fileUpload.info('will attempt to complete upload');
    var request = {
      method: 'POST',
      contentType: 'application/xml; charset=UTF-8',
      path: '?uploadId=' + fileUpload.uploadId,
      x_amz_headers: fileUpload.xAmzHeadersCommon || fileUpload.xAmzHeadersAtComplete,
      step: 'complete'
    };
    CancelableS3AWSRequest.call(this, fileUpload, request);
  }
  CompleteMultipartUpload.prototype = Object.create(CancelableS3AWSRequest.prototype);
  CompleteMultipartUpload.prototype.constructor = CompleteMultipartUpload;
  CompleteMultipartUpload.prototype.getPayload = function () {
    return Promise.resolve(this.fileUpload.getCompletedPayload());
  };

  //http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadComplete.html
  function ReuseS3Object(fileUpload, awsKey) {
    this.awsKey = awsKey;

    fileUpload.info('will attempt to verify existence of the file');

    var request = {
      method: 'HEAD',
      path: '',
      x_amz_headers: fileUpload.xAmzHeadersCommon,
      success404: true,
      step: 'head_object'
    };

    SignedS3AWSRequestWithRetryLimit.call(this, fileUpload, request);
  }
  ReuseS3Object.prototype = Object.create(SignedS3AWSRequestWithRetryLimit.prototype);
  ReuseS3Object.prototype.constructor = ReuseS3Object;
  ReuseS3Object.prototype.awsKey = undefined;
  ReuseS3Object.prototype.success = function () {
    var eTag = this.currentXhr.getResponseHeader('Etag');
    if (eTag !== this.fileUpload.eTag &&
        !this.rejectedSuccess('uploadId ', this.fileUpload.id, ' found on S3 but the Etag doesn\'t match.')) { return; }
    this.awsDeferred.resolve(this.currentXhr);
  };

  //http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadListParts.html
  function ResumeInterruptedUpload(fileUpload) {
    SignedS3AWSRequestWithRetryLimit.call(this, fileUpload);
    this.updateRequest(this.setupRequest(0));
  }
  ResumeInterruptedUpload.prototype = Object.create(SignedS3AWSRequestWithRetryLimit.prototype);
  ResumeInterruptedUpload.prototype.constructor = ResumeInterruptedUpload;
  ResumeInterruptedUpload.prototype.awsKey = undefined;
  ResumeInterruptedUpload.prototype.partNumberMarker = 0;
  ResumeInterruptedUpload.prototype.setupRequest = function (partNumberMarker) {
    var msg = ['setupRequest() for uploadId:', this.fileUpload.uploadId, 'for part marker:', partNumberMarker].join(" ");
    l.d(msg);

    this.fileUpload.info(msg);

    this.awsKey = this.fileUpload.name;
    this.partNumberMarker = partNumberMarker;

    var request = {
      method: 'GET',
      path: ['?uploadId=', this.fileUpload.uploadId].join(""),
      query_string: "&part-number-marker=" + partNumberMarker,
      x_amz_headers: this.fileUpload.xAmzHeadersCommon,
      step: 'get upload parts',
      success404: true
    };

    this.request = request;
    return request;
  };
  ResumeInterruptedUpload.prototype.success = function () {
    if (this.currentXhr.status === 404) {
      // Success! Upload is no longer recognized, so there is nothing to fetch
      if (this.rejectedSuccess('uploadId ', this.fileUpload.id, ' not found on S3.')) { this.awsDeferred.resolve(this.currentXhr); }
      return;
    }

    var nextPartNumber = this.fileUpload.listPartsSuccess(this, this.currentXhr.responseText);
    if (nextPartNumber) {
      var request = this.setupRequest(nextPartNumber); // let's fetch the next set of parts
      this.updateRequest(request);
      this.trySend();
    } else {
      this.fileUpload.makePartsfromPartsOnS3();
      this.awsDeferred.resolve(this.currentXhr);
    }
  };

  //http://docs.aws.amazon.com/AmazonS3/latest/API/mpUploadUploadPart.html
  function PutPart(fileUpload, part) {
    this.part = part;

    this.partNumber = part.partNumber;
    this.start = (this.partNumber - 1) * fileUpload.con.partSize;
    this.end = Math.min(this.partNumber * fileUpload.con.partSize, fileUpload.sizeBytes);

    var request = {
      method: 'PUT',
      path: '?partNumber=' + this.partNumber + '&uploadId=' + fileUpload.uploadId,
      step: 'upload #' + this.partNumber,
      x_amz_headers: fileUpload.xAmzHeadersCommon || fileUpload.xAmzHeadersAtUpload,
      contentSha256: "UNSIGNED-PAYLOAD",
      onProgress: this.onProgress.bind(this)
    };

    SignedS3AWSRequest.call(this, fileUpload, request);
  }
  PutPart.prototype = Object.create(SignedS3AWSRequest.prototype);
  PutPart.prototype.constructor = PutPart;
  PutPart.prototype.part = 1;
  PutPart.prototype.payloadPromise = undefined;
  PutPart.prototype.start = 0;
  PutPart.prototype.end = 0;
  PutPart.prototype.partNumber = undefined;
  PutPart.prototype.getPartMd5Digest = function () {
    var self = this,
        part = this.part;
    return new Promise(function (resolve, reject) {
      if (self.con.computeContentMd5 && !part.md5_digest) {
        self.getPayload()
            .then(function (data) {
              var md5_digest = self.con.cryptoMd5Method(data);
              if (self.partNumber === 1 && self.con.computeContentMd5 && typeof self.fileUpload.firstMd5Digest === "undefined") {
                self.fileUpload.firstMd5Digest = md5_digest;
                self.fileUpload.updateUploadFile({firstMd5Digest: md5_digest})
              }
              resolve(md5_digest);
            }, reject);
      } else {
        resolve(part.md5_digest);
      }
    }).then(function (md5_digest) {
      if (md5_digest) {
        l.d(self.request.step, 'MD5 digest:', md5_digest);
        self.request.md5_digest = md5_digest;
        self.part.md5_digest = md5_digest;
      }
    });
  };
  PutPart.prototype.sendRequestToAWS = function () {
    this.stalledInterval = setInterval(this.stalledPartMonitor(), PARTS_MONITOR_INTERVAL_MS);
    this.stalledPartMonitor();
    return SignedS3AWSRequest.prototype.sendRequestToAWS.call(this);
  };
  PutPart.prototype.send = function () {
    if (this.part.status !== COMPLETE &&
        [ABORTED, PAUSED, CANCELED].indexOf(this.fileUpload.status) === -1
    ) {
      l.d('uploadPart #', this.partNumber, this.attempts === 1 ? 'submitting' : 'retrying');

      this.part.status = EVAPORATING;
      this.attempts += 1;
      this.part.loadedBytesPrevious = null;

      var self = this;
      return this.getPartMd5Digest()
          .then(function () {
            l.d('Sending', self.request.step);
            SignedS3AWSRequest.prototype.send.call(self);
          });
    }
  };
  PutPart.prototype.success = function () {
    clearInterval(this.stalledInterval);
    var eTag = this.currentXhr.getResponseHeader('ETag');
    this.currentXhr = null;
    if (this.fileUpload.partSuccess(eTag, this)) { this.awsDeferred.resolve(this.currentXhr); }
  };
  PutPart.prototype.onProgress = function (evt) {
    if (evt.loaded > 0) {
      var loadedNow = evt.loaded - this.part.loadedBytes;
      if (loadedNow) {
        this.part.loadedBytes = evt.loaded;
        this.fileUpload.updateLoaded(loadedNow);
      }
    }
  };
  PutPart.prototype.stalledPartMonitor = function () {
    var lastLoaded = this.part.loadedBytes;
    var self = this;
    return function () {
      clearInterval(self.stalledInterval);
      if ([EVAPORATING, ERROR, PAUSING, PAUSED].indexOf(self.fileUpload.status) === -1 &&
          self.part.status !== ABORTED &&
          self.part.loadedBytes < this.size) {
        if (lastLoaded === self.part.loadedBytes) {
          l.w('Part stalled. Will abort and retry:', self.partNumber, decodeURIComponent(self.fileUpload.name));
          self.abort();
          if (!self.errorExceptionStatus()) {
            self.delaySend();
          }
        } else {
          self.stalledInterval = setInterval(self.stalledPartMonitor(), PARTS_MONITOR_INTERVAL_MS);
        }
      }
    }
  };
  PutPart.prototype.resetLoadedBytes = function () {
    this.fileUpload.updateLoaded(-this.part.loadedBytes);
    this.part.loadedBytes = 0;
    this.fileUpload.onProgress();
  };
  PutPart.prototype.errorExceptionStatus = function () {
    return [CANCELED, ABORTED, PAUSED, PAUSING].indexOf(this.fileUpload.status) > -1;
  };
  PutPart.prototype.delaySend = function () {
    var backOffWait = this.backOffWait();
    this.attempts += 1;
    setTimeout(this.send.bind(this), backOffWait);
  };
  PutPart.prototype.errorHandler = function (reason) {
    clearInterval(this.stalledInterval);
    if (reason.match(/status:404/)) {
      var errMsg = '404 error on part PUT. The part and the file will abort. ' + reason;
      l.w(errMsg);
      this.fileUpload.error(errMsg);
      this.part.status = ABORTED;
      this.awsDeferred.reject(errMsg);
      return true;
    }
    this.resetLoadedBytes();
    this.part.status = ERROR;

    if (!this.errorExceptionStatus()) {
      this.delaySend();
    }
    return true;
  };
  PutPart.prototype.abort = function () {
    if (this.currentXhr) {
      this.currentXhr.abort();
    }
    this.resetLoadedBytes();
    this.attempts = 1;
  };
  PutPart.size = 0;
  PutPart.prototype.streamToArrayBuffer = function (stream) {
    return new Promise(function (resolve, reject) {
      // stream is empty or ended
      if (!stream.readable) { return resolve([]); }

      var arr = new Uint8Array(Math.min(this.con.partSize, this.end - this.start)),
          i = 0;
      stream.on('data', onData);
      stream.on('end', onEnd);
      stream.on('error', onEnd);
      stream.on('close', onClose);

      function onData(data) {
        if (data.byteLength === 1) { return; }
        arr.set(data, i);
        i += data.byteLength;
      }

      function onEnd(err) {
        if (err) { reject(err); }
        else { resolve(arr); }
        cleanup();
      }

      function onClose() {
        resolve(arr);
        cleanup();
      }

      function cleanup() {
        arr = null;
        stream.removeListener('data', onData);
        stream.removeListener('end', onEnd);
        stream.removeListener('error', onEnd);
        stream.removeListener('close', onClose);
      }
    }.bind(this));
  };
  PutPart.prototype.getPayload = function () {
    if (typeof this.payloadPromise === 'undefined') {
      this.payloadPromise = this.con.readableStreams ? this.payloadFromStream() : this.payloadFromBlob();
    }
    return this.payloadPromise;
  };
  PutPart.prototype.payloadFromStream = function () {
    var stream = this.con.readableStreamPartMethod(this.fileUpload.file, this.start, this.end - 1);
    return new Promise(function (resolve, reject) {
      var streamPromise = this.streamToArrayBuffer(stream);
      streamPromise.then(function (data) {
        resolve(data);
      }.bind(this), reject);
    }.bind(this));
  };
  PutPart.prototype.payloadFromBlob = function () {
    // browsers' implementation of the Blob.slice function has been renamed a couple of times, and the meaning of the
    // 2nd parameter changed. For example Gecko went from slice(start,length) -> mozSlice(start, end) -> slice(start, end).
    // As of 12/12/12, it seems that the unified 'slice' is the best bet, hence it being first in the list. See
    // https://developer.mozilla.org/en-US/docs/DOM/Blob for more info.
    var file = this.fileUpload.file,
        slicerFn = (file.slice ? 'slice' : (file.mozSlice ? 'mozSlice' : 'webkitSlice')),
        blob = file[slicerFn](this.start, this.end);
    if (this.con.computeContentMd5) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onloadend = function () {
          var buffer = this.result && typeof this.result.buffer !== 'undefined',
              result = buffer ? new Uint8Array(this.result.buffer) : this.result;
          resolve(result);
        };
        reader.readAsArrayBuffer(blob);
      });
    }
    return Promise.resolve(blob);
  };
  PutPart.prototype.stalledInterval = -1;
  PutPart.prototype.getStartedPromise = function () {
    return this.started.promise;
  };


  //http://docs.amazonwebservices.com/AmazonS3/latest/API/mpUploadAbort.html
  function DeleteMultipartUpload(fileUpload) {
    fileUpload.info('will attempt to abort the upload');

    fileUpload.abortParts();

    var request = {
      method: 'DELETE',
      path: '?uploadId=' + fileUpload.uploadId,
      x_amz_headers: fileUpload.xAmzHeadersCommon,
      success404: true,
      step: 'abort'
    };

    SignedS3AWSRequest.call(this, fileUpload, request);
  }
  DeleteMultipartUpload.prototype = Object.create(SignedS3AWSRequest.prototype);
  DeleteMultipartUpload.prototype.constructor = DeleteMultipartUpload;
  DeleteMultipartUpload.prototype.maxRetries = 1;
  DeleteMultipartUpload.prototype.success = function () {
    this.fileUpload.setStatus(ABORTED);
    this.awsDeferred.resolve(this.currentXhr);
  };
  DeleteMultipartUpload.prototype.errorHandler =  function (reason) {
    if (this.attempts > this.maxRetries) {
      var msg = 'Error aborting upload, Exceeded retries deleting the file upload: ' + reason;
      l.w(msg);
      this.fileUpload.error(msg);
      this.awsDeferred.reject(msg);
      return true;
    }
  };

  function signingVersion(awsRequest, l) {
    var con = awsRequest.con;
    function AwsSignature(request) {
      this.request = request;
    }
    AwsSignature.prototype.request = {};
    AwsSignature.prototype.error = function () {};
    AwsSignature.prototype.authorizationString = function () {};
    AwsSignature.prototype.stringToSign = function () {};
    AwsSignature.prototype.canonicalRequest = function () {};
    AwsSignature.prototype.setHeaders = function () {};
    AwsSignature.prototype.datetime = function (timeOffset) {
      return new Date(new Date().getTime() + timeOffset);

    };
    AwsSignature.prototype.dateString = function (timeOffset) {
      return this.datetime(timeOffset).toISOString().slice(0, 19).replace(/-|:/g, '') + "Z";
    };

    function AwsSignatureV2(request) {
      AwsSignature.call(this, request);
    }
    AwsSignatureV2.prototype = Object.create(AwsSignature.prototype);
    AwsSignatureV2.prototype.constructor = AwsSignatureV2;
    AwsSignatureV2.prototype.authorizationString = function () {
      return ['AWS ', con.aws_key, ':', this.request.auth].join('');
    };
    AwsSignatureV2.prototype.stringToSign = function () {
      var x_amz_headers = '', result, header_key_array = [];

      for (var key in this.request.x_amz_headers) {
        if (this.request.x_amz_headers.hasOwnProperty(key)) {
          header_key_array.push(key);
        }
      }
      header_key_array.sort();

      header_key_array.forEach(function (header_key) {
        x_amz_headers += (header_key + ':' + this.request.x_amz_headers[header_key] + '\n');
      }.bind(this));

      result = this.request.method + '\n' +
          (this.request.md5_digest || '') + '\n' +
          (this.request.contentType || '') + '\n' +
          '\n' +
          x_amz_headers +
          (con.cloudfront ? '/' + con.bucket : '') +
          awsRequest.getPath() + this.request.path;

      l.d('V2 stringToSign:', result);
      return result;

    };
    AwsSignatureV2.prototype.dateString = function (timeOffset) {
      return this.datetime(timeOffset).toUTCString();
    };
    AwsSignatureV2.prototype.getPayload = function () { return Promise.resolve(); };

    function AwsSignatureV4(request) {
      this._cr = undefined
      AwsSignature.call(this, request);
    }
    AwsSignatureV4.prototype = Object.create(AwsSignature.prototype);
    AwsSignatureV4.prototype.constructor = AwsSignatureV4;
    AwsSignatureV4.prototype._cr = undefined;
    AwsSignatureV4.prototype.payload = null;
    AwsSignatureV4.prototype.error = function () { this._cr = undefined; };
    AwsSignatureV4.prototype.getPayload = function () {
      return awsRequest.getPayload()
          .then(function (data) {
            this.payload = data;
          }.bind(this));
    };
    AwsSignatureV4.prototype.authorizationString = function () {
      var authParts = [];

      var credentials = this.credentialString();
      var headers = this.canonicalHeaders();

      authParts.push(['AWS4-HMAC-SHA256 Credential=', con.aws_key, '/', credentials].join(''));
      authParts.push('SignedHeaders=' + headers.signedHeaders);
      authParts.push('Signature=' + this.request.auth);

      return authParts.join(', ');
    };
    AwsSignatureV4.prototype.stringToSign = function () {
      var signParts = [];
      signParts.push('AWS4-HMAC-SHA256');
      signParts.push(this.request.dateString);
      signParts.push(this.credentialString());
      signParts.push(con.cryptoHexEncodedHash256(this.canonicalRequest()));
      var result = signParts.join('\n');

      l.d('V4 stringToSign:', result);
      return result;
    };
    AwsSignatureV4.prototype.credentialString = function () {
      var credParts = [];

      credParts.push(this.request.dateString.slice(0, 8));
      credParts.push(con.awsRegion);
      credParts.push('s3');
      credParts.push('aws4_request');
      return credParts.join('/');
    };
    AwsSignatureV4.prototype.canonicalQueryString = function () {
      var qs = awsRequest.request.query_string || '',
          search = uri([awsRequest.awsUrl, this.request.path, qs].join("")).search,
          searchParts = search.length ? search.split('&') : [],
          encoded = [],
          nameValue,
          i;

      for (i = 0; i < searchParts.length; i++) {
        nameValue = searchParts[i].split("=");
        encoded.push({
          name: encodeURIComponent(nameValue[0]),
          value: nameValue.length > 1 ? encodeURIComponent(nameValue[1]) : null
        })
      }
      var sorted = encoded.sort(function (a, b) {
        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        }
        return 0;
      });

      var result = [];
      for (i = 0; i < sorted.length; i++) {
        nameValue = sorted[i].value ? [sorted[i].name, sorted[i].value].join("=") : sorted[i].name + '=';
        result.push(nameValue);
      }

      return result.join('&');
    };
    AwsSignatureV4.prototype.getPayloadSha256Content = function () {
      var result = this.request.contentSha256 || con.cryptoHexEncodedHash256(this.payload || '');
      l.d(this.request.step, 'getPayloadSha256Content:', result);
      return result;
    };
    AwsSignatureV4.prototype.canonicalHeaders = function () {
      var canonicalHeaders = [],
          keys = [],
          i;

      function addHeader(name, value) {
        var key = name.toLowerCase();
        keys.push(key);
        canonicalHeaders[key] = value.replace(/\s+/g, ' ');
      }

      if (this.request.md5_digest) {
        addHeader("Content-Md5", this.request.md5_digest);
      }

      addHeader('Host', awsRequest.awsHost);

      if (this.request.contentType) {
        addHeader('Content-Type', this.request.contentType || '');
      }

      var amzHeaders = this.request.x_amz_headers || {};
      for (var key in amzHeaders) {
        if (amzHeaders.hasOwnProperty(key)) {
          addHeader(key, amzHeaders[key]);
        }
      }

      var sortedKeys = keys.sort(function (a, b) {
        if (a < b) {
          return -1;
        } else if (a > b) {
          return 1;
        }
        return 0;
      });

      var result = [];

      var unsigned_headers = [],
          not_signed = this.request.not_signed_headers || [],
          signed_headers = [];
      for (i = 0; i < not_signed.length; i++) {
        unsigned_headers.push(not_signed[i].toLowerCase());
      }

      for (i = 0; i < sortedKeys.length; i++) {
        var k = sortedKeys[i];
        result.push([k, canonicalHeaders[k]].join(":"));
        if (unsigned_headers.indexOf(k) === -1) {
          signed_headers.push(k);
        }
      }

      return {
        canonicalHeaders: result.join("\n"),
        signedHeaders: signed_headers.join(";")
      };
    };
    AwsSignatureV4.prototype.canonicalRequest = function () {
      if (typeof this._cr !== 'undefined') { return this._cr; }
      var canonParts = [];

      canonParts.push(this.request.method);
      canonParts.push(uri([awsRequest.awsUrl, awsRequest.getPath(), this.request.path].join("")).pathname);
      canonParts.push(this.canonicalQueryString() || '');

      var headers = this.canonicalHeaders();
      canonParts.push(headers.canonicalHeaders + '\n');
      canonParts.push(headers.signedHeaders);
      canonParts.push(this.getPayloadSha256Content());

      this._cr = canonParts.join("\n");
      l.d(this.request.step, 'V4 CanonicalRequest:', this._cr);
      return this._cr;
    };
    AwsSignatureV4.prototype.setHeaders = function (xhr) {
      xhr.setRequestHeader("x-amz-content-sha256", this.getPayloadSha256Content());
    };

    return con.awsSignatureVersion === '4' ? AwsSignatureV4 : AwsSignatureV2;
  }
  function authorizationMethod(awsRequest) {
    var fileUpload = awsRequest.fileUpload,
        con = fileUpload.con,
        request = awsRequest.request;

    function AuthorizationMethod() {
      this.request = request;
    }
    AuthorizationMethod.prototype = Object.create(AuthorizationMethod.prototype);
    AuthorizationMethod.prototype.request = {};
    AuthorizationMethod.makeSignParamsObject = function (params) {
      var out = {};
      for (var param in params) {
        if (!params.hasOwnProperty(param)) { continue; }
        if (typeof params[param] === 'function') {
          out[param] = params[param]();
        } else {
          out[param] = params[param];
        }
      }
      return out;
    };
    AuthorizationMethod.prototype.authorize = function () {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        awsRequest.currentXhr = xhr;

        var stringToSign = awsRequest.stringToSign(),
            url = [con.signerUrl, '?to_sign=', stringToSign, '&datetime=', request.dateString];
        if (con.sendCanonicalRequestToSignerUrl) {
          url.push('&canonical_request=');
          url.push(encodeURIComponent(awsRequest.canonicalRequest()));
        }
        url = url.join("");

        var signParams = AuthorizationMethod.makeSignParamsObject(fileUpload.signParams);
        for (var param in signParams) {
          if (!signParams.hasOwnProperty(param)) { continue; }
          url += ('&' + encodeURIComponent(param) + '=' + encodeURIComponent(signParams[param]));
        }

        if (con.xhrWithCredentials) {
          xhr.withCredentials = true;
        }

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              awsRequest.signResponse(xhr.response, stringToSign, request.dateString)
                  .then(resolve);
            } else {
              if ([401, 403].indexOf(xhr.status) > -1) {
                var reason = "status:" + xhr.status;
                fileUpload.deferredCompletion.reject('Permission denied ' + reason);
                return reject(reason);
              }
              reject("Signature fetch returned status: " + xhr.status);
            }
          }
        };

        xhr.onerror = function (xhr) {
          reject('authorizedSend transport error: ' + xhr.responseText);
        };

        xhr.open('GET', url);
        var signHeaders = AuthorizationMethod.makeSignParamsObject(con.signHeaders);
        for (var header in signHeaders) {
          if (!signHeaders.hasOwnProperty(header)) { continue; }
          xhr.setRequestHeader(header, signHeaders[header])
        }

        if (typeof fileUpload.beforeSigner  === 'function') {
          fileUpload.beforeSigner(xhr, url);
        }
        xhr.send();
      });
    };

    function AuthorizationCustom() {
      AuthorizationMethod.call(this);
    }
    AuthorizationCustom.prototype = Object.create(AuthorizationMethod.prototype);
    AuthorizationCustom.prototype.authorize = function () {
      return con.customAuthMethod(
          AuthorizationMethod.makeSignParamsObject(fileUpload.signParams),
          AuthorizationMethod.makeSignParamsObject(con.signHeaders),
          awsRequest.stringToSign(),
          request.dateString,
          awsRequest.canonicalRequest())
          .catch(function (reason) {
            fileUpload.deferredCompletion.reject(reason);
            throw reason;
          });
    };

    if (typeof con.customAuthMethod === 'function') {
      return new AuthorizationCustom()
    }

    return new AuthorizationMethod();
  }

  function awsUrl(con) {
    var url;
    if (con.aws_url) {
      url = [con.aws_url];
    } else {
      if (con.s3Acceleration) {
        url = ["https://", con.bucket, ".s3-accelerate"];
        con.cloudfront = true;
      } else {
        url = ["https://", (con.cloudfront ? con.bucket + "." : ""), "s3"];
        if (con.awsRegion !== "us-east-1") {
          url.push("-", con.awsRegion);
        }
      }
      url.push(".amazonaws.com");
    }
    return url.join("");
  }

  function s3EncodedObjectName(fileName) {
    var fileParts = fileName.split('/'),
        encodedParts = [];
    fileParts.forEach(function (p) {
      var buf = [],
          enc = encodeURIComponent(p);
      for (var i = 0; i < enc.length; i++) {
        buf.push(S3_EXTRA_ENCODED_CHARS[enc.charCodeAt(i)] || enc.charAt(i));
      }
      encodedParts.push(buf.join(""));
    });
    return encodedParts.join('/');
  }

  function uri(url) {
    var p,
        href = url || '/';

    try {
      p = new URL(href);
    } catch (e) {
      p = document.createElement('a');
      p.href = href;
    }

    return {
      protocol: p.protocol, // => "http:"
      hostname: p.hostname, // => "example.com"
      // IE omits the leading slash, so add it if it's missing
      pathname: p.pathname.replace(/(^\/?)/, "/"), // => "/pathname/"
      port: p.port, // => "3000"
      search: (p.search[0] === '?') ? p.search.substr(1) : p.search, // => "search=test"
      hash: p.hash, // => "#hash"
      host: p.host  // => "example.com:3000"
    };
  }

  function dateISOString(date) {
    // Try to get the modified date as an ISO String, if the date exists
    return date ? new Date(date).toISOString() : '';
  }

  function getAwsResponse(xhr) {
    var code = elementText(xhr.responseText, "Code"),
        msg = elementText(xhr.responseText, "Message");
    return code.length ? ['AWS Code: ', code, ', Message:', msg].join("") : '';
  }

  function elementText(source, element) {
    var match = source.match(["<", element, ">(.+)</", element, ">"].join(""));
    return match ? match[1] : '';
  }

  function defer() {
    var deferred = {}, promise;
    promise = new Promise(function(resolve, reject){
      deferred = {resolve: resolve, reject: reject};
    });
    return {
      resolve: deferred.resolve,
      reject: deferred.reject,
      promise: promise
    }
  }

  function extend(obj1, obj2, obj3) {
    function ext(target, source) {
      if (typeof source !== 'object') { return; }
      for (var key in source) {
        if (source.hasOwnProperty(key)) {
          target[key] = source[key];
        }
      }
    }

    obj1 = obj1 || {};
    obj2 = obj2 || {};
    obj3 = obj3 || {};
    ext(obj2, obj3);
    ext(obj1, obj2);

    return obj1;
  }

  function getSavedUploads(purge) {
    var uploads = JSON.parse(historyCache.getItem('awsUploads') || '{}');

    if (purge) {
      for (var key in uploads) {
        if (uploads.hasOwnProperty(key)) {
          var upload = uploads[key],
              completedAt = new Date(upload.completedAt || FAR_FUTURE);

          if (completedAt < HOURS_AGO) {
            // The upload is recent, let's keep it
            delete uploads[key];
          }
        }
      }

      historyCache.setItem('awsUploads', JSON.stringify(uploads));
    }

    return uploads;
  }

  function uploadKey(fileUpload) {
    // The key tries to give a signature to a file in the absence of its path.
    // "<filename>-<mimetype>-<modifieddate>-<filesize>"
    return [
      fileUpload.file.name,
      fileUpload.file.type,
      dateISOString(fileUpload.file.lastModified),
      fileUpload.sizeBytes
    ].join("-");
  }

  function saveUpload(uploadKey, upload) {
    var uploads = getSavedUploads();
    uploads[uploadKey] = upload;
    historyCache.setItem('awsUploads', JSON.stringify(uploads));
  }

  function removeUpload(uploadKey) {
    var uploads = getSavedUploads();
    delete uploads[uploadKey];
    historyCache.setItem('awsUploads', JSON.stringify(uploads));
  }

  function removeAtIndex(a, i) {
    var idx = a.indexOf(i);
    if (idx > -1) {
      a.splice(idx, 1);
      return true;
    }
  }

  function readableFileSize(size) {
    // Adapted from https://github.com/fkjaekel
    // https://github.com/TTLabs/EvaporateJS/issues/13
    var units = ['B', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb'],
        i = 0;
    while(size >= 1024) {
      size /= 1024;
      ++i;
    }
    return [size.toFixed(2).replace('.00', ''), units[i]].join(" ");
  }

  var historyCache;
  function HistoryCache(mockLocalStorage) {
    var supported = HistoryCache.supported();
    this.cacheStore = mockLocalStorage ? {} : (supported ? localStorage : undefined);
  }
  HistoryCache.prototype.supported = false;
  HistoryCache.prototype.cacheStore = undefined;
  HistoryCache.prototype.getItem = function (key) { if (this.cacheStore) { return this.cacheStore[key]; }};
  HistoryCache.prototype.setItem = function (key, value) { if (this.cacheStore) { this.cacheStore[key] = value; }};
  HistoryCache.prototype.removeItem = function (key) { if (this.cacheStore) { return delete this.cacheStore[key] }};
  HistoryCache.supported = function () {
    var result = false;
    if (typeof window !== 'undefined') {
      if (!('localStorage' in window)) {
        return result;
      }
    } else {
      return result;
    }

    // Try to use storage (it might be disabled, e.g. user is in private mode)
    try {
      var k = '___test';
      localStorage[k] = 'OK';
      var test = localStorage[k];
      delete localStorage[k];
      return test === 'OK';
    } catch (e) {
      return result;
    }
  };

  function noOpLogger() { return {d: function () {}, w: function () {}, e: function () {}}; }

  l = noOpLogger();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Evaporate;
  } else if (typeof window !== 'undefined') {
    window.Evaporate = Evaporate;
  }

}());

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],6:[function(require,module,exports){
/*!
 * JavaScript Cookie v2.2.0
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */
;(function (factory) {
	var registeredInModuleLoader = false;
	if (typeof define === 'function' && define.amd) {
		define(factory);
		registeredInModuleLoader = true;
	}
	if (typeof exports === 'object') {
		module.exports = factory();
		registeredInModuleLoader = true;
	}
	if (!registeredInModuleLoader) {
		var OldCookies = window.Cookies;
		var api = window.Cookies = factory();
		api.noConflict = function () {
			window.Cookies = OldCookies;
			return api;
		};
	}
}(function () {
	function extend () {
		var i = 0;
		var result = {};
		for (; i < arguments.length; i++) {
			var attributes = arguments[ i ];
			for (var key in attributes) {
				result[key] = attributes[key];
			}
		}
		return result;
	}

	function init (converter) {
		function api (key, value, attributes) {
			var result;
			if (typeof document === 'undefined') {
				return;
			}

			// Write

			if (arguments.length > 1) {
				attributes = extend({
					path: '/'
				}, api.defaults, attributes);

				if (typeof attributes.expires === 'number') {
					var expires = new Date();
					expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
					attributes.expires = expires;
				}

				// We're using "expires" because "max-age" is not supported by IE
				attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

				try {
					result = JSON.stringify(value);
					if (/^[\{\[]/.test(result)) {
						value = result;
					}
				} catch (e) {}

				if (!converter.write) {
					value = encodeURIComponent(String(value))
						.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
				} else {
					value = converter.write(value, key);
				}

				key = encodeURIComponent(String(key));
				key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
				key = key.replace(/[\(\)]/g, escape);

				var stringifiedAttributes = '';

				for (var attributeName in attributes) {
					if (!attributes[attributeName]) {
						continue;
					}
					stringifiedAttributes += '; ' + attributeName;
					if (attributes[attributeName] === true) {
						continue;
					}
					stringifiedAttributes += '=' + attributes[attributeName];
				}
				return (document.cookie = key + '=' + value + stringifiedAttributes);
			}

			// Read

			if (!key) {
				result = {};
			}

			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling "get()"
			var cookies = document.cookie ? document.cookie.split('; ') : [];
			var rdecode = /(%[0-9A-Z]{2})+/g;
			var i = 0;

			for (; i < cookies.length; i++) {
				var parts = cookies[i].split('=');
				var cookie = parts.slice(1).join('=');

				if (!this.json && cookie.charAt(0) === '"') {
					cookie = cookie.slice(1, -1);
				}

				try {
					var name = parts[0].replace(rdecode, decodeURIComponent);
					cookie = converter.read ?
						converter.read(cookie, name) : converter(cookie, name) ||
						cookie.replace(rdecode, decodeURIComponent);

					if (this.json) {
						try {
							cookie = JSON.parse(cookie);
						} catch (e) {}
					}

					if (key === name) {
						result = cookie;
						break;
					}

					if (!key) {
						result[name] = cookie;
					}
				} catch (e) {}
			}

			return result;
		}

		api.set = api;
		api.get = function (key) {
			return api.call(api, key);
		};
		api.getJSON = function () {
			return api.apply({
				json: true
			}, [].slice.call(arguments));
		};
		api.defaults = {};

		api.remove = function (key, attributes) {
			api(key, '', extend(attributes, {
				expires: -1
			}));
		};

		api.withConverter = init;

		return api;
	}

	return init(function () {});
}));

},{}],7:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":2}],8:[function(require,module,exports){
var Buffer = require('safe-buffer').Buffer

// prototype class for hash functions
function Hash (blockSize, finalSize) {
  this._block = Buffer.alloc(blockSize)
  this._finalSize = finalSize
  this._blockSize = blockSize
  this._len = 0
}

Hash.prototype.update = function (data, enc) {
  if (typeof data === 'string') {
    enc = enc || 'utf8'
    data = Buffer.from(data, enc)
  }

  var block = this._block
  var blockSize = this._blockSize
  var length = data.length
  var accum = this._len

  for (var offset = 0; offset < length;) {
    var assigned = accum % blockSize
    var remainder = Math.min(length - offset, blockSize - assigned)

    for (var i = 0; i < remainder; i++) {
      block[assigned + i] = data[offset + i]
    }

    accum += remainder
    offset += remainder

    if ((accum % blockSize) === 0) {
      this._update(block)
    }
  }

  this._len += length
  return this
}

Hash.prototype.digest = function (enc) {
  var rem = this._len % this._blockSize

  this._block[rem] = 0x80

  // zero (rem + 1) trailing bits, where (rem + 1) is the smallest
  // non-negative solution to the equation (length + 1 + (rem + 1)) === finalSize mod blockSize
  this._block.fill(0, rem + 1)

  if (rem >= this._finalSize) {
    this._update(this._block)
    this._block.fill(0)
  }

  var bits = this._len * 8

  // uint32
  if (bits <= 0xffffffff) {
    this._block.writeUInt32BE(bits, this._blockSize - 4)

  // uint64
  } else {
    var lowBits = bits & 0xffffffff
    var highBits = (bits - lowBits) / 0x100000000

    this._block.writeUInt32BE(highBits, this._blockSize - 8)
    this._block.writeUInt32BE(lowBits, this._blockSize - 4)
  }

  this._update(this._block)
  var hash = this._hash()

  return enc ? hash.toString(enc) : hash
}

Hash.prototype._update = function () {
  throw new Error('_update must be implemented by subclass')
}

module.exports = Hash

},{"safe-buffer":7}],9:[function(require,module,exports){
var exports = module.exports = function SHA (algorithm) {
  algorithm = algorithm.toLowerCase()

  var Algorithm = exports[algorithm]
  if (!Algorithm) throw new Error(algorithm + ' is not supported (we accept pull requests)')

  return new Algorithm()
}

exports.sha = require('./sha')
exports.sha1 = require('./sha1')
exports.sha224 = require('./sha224')
exports.sha256 = require('./sha256')
exports.sha384 = require('./sha384')
exports.sha512 = require('./sha512')

},{"./sha":10,"./sha1":11,"./sha224":12,"./sha256":13,"./sha384":14,"./sha512":15}],10:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-0, as defined
 * in FIPS PUB 180-1
 * This source code is derived from sha1.js of the same repository.
 * The difference between SHA-0 and SHA-1 is just a bitwise rotate left
 * operation was added.
 */

var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0
]

var W = new Array(80)

function Sha () {
  this.init()
  this._w = W

  Hash.call(this, 64, 56)
}

inherits(Sha, Hash)

Sha.prototype.init = function () {
  this._a = 0x67452301
  this._b = 0xefcdab89
  this._c = 0x98badcfe
  this._d = 0x10325476
  this._e = 0xc3d2e1f0

  return this
}

function rotl5 (num) {
  return (num << 5) | (num >>> 27)
}

function rotl30 (num) {
  return (num << 30) | (num >>> 2)
}

function ft (s, b, c, d) {
  if (s === 0) return (b & c) | ((~b) & d)
  if (s === 2) return (b & c) | (b & d) | (c & d)
  return b ^ c ^ d
}

Sha.prototype._update = function (M) {
  var W = this._w

  var a = this._a | 0
  var b = this._b | 0
  var c = this._c | 0
  var d = this._d | 0
  var e = this._e | 0

  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4)
  for (; i < 80; ++i) W[i] = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]

  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20)
    var t = (rotl5(a) + ft(s, b, c, d) + e + W[j] + K[s]) | 0

    e = d
    d = c
    c = rotl30(b)
    b = a
    a = t
  }

  this._a = (a + this._a) | 0
  this._b = (b + this._b) | 0
  this._c = (c + this._c) | 0
  this._d = (d + this._d) | 0
  this._e = (e + this._e) | 0
}

Sha.prototype._hash = function () {
  var H = Buffer.allocUnsafe(20)

  H.writeInt32BE(this._a | 0, 0)
  H.writeInt32BE(this._b | 0, 4)
  H.writeInt32BE(this._c | 0, 8)
  H.writeInt32BE(this._d | 0, 12)
  H.writeInt32BE(this._e | 0, 16)

  return H
}

module.exports = Sha

},{"./hash":8,"inherits":5,"safe-buffer":7}],11:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0
]

var W = new Array(80)

function Sha1 () {
  this.init()
  this._w = W

  Hash.call(this, 64, 56)
}

inherits(Sha1, Hash)

Sha1.prototype.init = function () {
  this._a = 0x67452301
  this._b = 0xefcdab89
  this._c = 0x98badcfe
  this._d = 0x10325476
  this._e = 0xc3d2e1f0

  return this
}

function rotl1 (num) {
  return (num << 1) | (num >>> 31)
}

function rotl5 (num) {
  return (num << 5) | (num >>> 27)
}

function rotl30 (num) {
  return (num << 30) | (num >>> 2)
}

function ft (s, b, c, d) {
  if (s === 0) return (b & c) | ((~b) & d)
  if (s === 2) return (b & c) | (b & d) | (c & d)
  return b ^ c ^ d
}

Sha1.prototype._update = function (M) {
  var W = this._w

  var a = this._a | 0
  var b = this._b | 0
  var c = this._c | 0
  var d = this._d | 0
  var e = this._e | 0

  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4)
  for (; i < 80; ++i) W[i] = rotl1(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16])

  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20)
    var t = (rotl5(a) + ft(s, b, c, d) + e + W[j] + K[s]) | 0

    e = d
    d = c
    c = rotl30(b)
    b = a
    a = t
  }

  this._a = (a + this._a) | 0
  this._b = (b + this._b) | 0
  this._c = (c + this._c) | 0
  this._d = (d + this._d) | 0
  this._e = (e + this._e) | 0
}

Sha1.prototype._hash = function () {
  var H = Buffer.allocUnsafe(20)

  H.writeInt32BE(this._a | 0, 0)
  H.writeInt32BE(this._b | 0, 4)
  H.writeInt32BE(this._c | 0, 8)
  H.writeInt32BE(this._d | 0, 12)
  H.writeInt32BE(this._e | 0, 16)

  return H
}

module.exports = Sha1

},{"./hash":8,"inherits":5,"safe-buffer":7}],12:[function(require,module,exports){
/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var inherits = require('inherits')
var Sha256 = require('./sha256')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var W = new Array(64)

function Sha224 () {
  this.init()

  this._w = W // new Array(64)

  Hash.call(this, 64, 56)
}

inherits(Sha224, Sha256)

Sha224.prototype.init = function () {
  this._a = 0xc1059ed8
  this._b = 0x367cd507
  this._c = 0x3070dd17
  this._d = 0xf70e5939
  this._e = 0xffc00b31
  this._f = 0x68581511
  this._g = 0x64f98fa7
  this._h = 0xbefa4fa4

  return this
}

Sha224.prototype._hash = function () {
  var H = Buffer.allocUnsafe(28)

  H.writeInt32BE(this._a, 0)
  H.writeInt32BE(this._b, 4)
  H.writeInt32BE(this._c, 8)
  H.writeInt32BE(this._d, 12)
  H.writeInt32BE(this._e, 16)
  H.writeInt32BE(this._f, 20)
  H.writeInt32BE(this._g, 24)

  return H
}

module.exports = Sha224

},{"./hash":8,"./sha256":13,"inherits":5,"safe-buffer":7}],13:[function(require,module,exports){
/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
  0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
  0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
  0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
  0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
  0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
  0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
  0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
  0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
]

var W = new Array(64)

function Sha256 () {
  this.init()

  this._w = W // new Array(64)

  Hash.call(this, 64, 56)
}

inherits(Sha256, Hash)

Sha256.prototype.init = function () {
  this._a = 0x6a09e667
  this._b = 0xbb67ae85
  this._c = 0x3c6ef372
  this._d = 0xa54ff53a
  this._e = 0x510e527f
  this._f = 0x9b05688c
  this._g = 0x1f83d9ab
  this._h = 0x5be0cd19

  return this
}

function ch (x, y, z) {
  return z ^ (x & (y ^ z))
}

function maj (x, y, z) {
  return (x & y) | (z & (x | y))
}

function sigma0 (x) {
  return (x >>> 2 | x << 30) ^ (x >>> 13 | x << 19) ^ (x >>> 22 | x << 10)
}

function sigma1 (x) {
  return (x >>> 6 | x << 26) ^ (x >>> 11 | x << 21) ^ (x >>> 25 | x << 7)
}

function gamma0 (x) {
  return (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3)
}

function gamma1 (x) {
  return (x >>> 17 | x << 15) ^ (x >>> 19 | x << 13) ^ (x >>> 10)
}

Sha256.prototype._update = function (M) {
  var W = this._w

  var a = this._a | 0
  var b = this._b | 0
  var c = this._c | 0
  var d = this._d | 0
  var e = this._e | 0
  var f = this._f | 0
  var g = this._g | 0
  var h = this._h | 0

  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4)
  for (; i < 64; ++i) W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) | 0

  for (var j = 0; j < 64; ++j) {
    var T1 = (h + sigma1(e) + ch(e, f, g) + K[j] + W[j]) | 0
    var T2 = (sigma0(a) + maj(a, b, c)) | 0

    h = g
    g = f
    f = e
    e = (d + T1) | 0
    d = c
    c = b
    b = a
    a = (T1 + T2) | 0
  }

  this._a = (a + this._a) | 0
  this._b = (b + this._b) | 0
  this._c = (c + this._c) | 0
  this._d = (d + this._d) | 0
  this._e = (e + this._e) | 0
  this._f = (f + this._f) | 0
  this._g = (g + this._g) | 0
  this._h = (h + this._h) | 0
}

Sha256.prototype._hash = function () {
  var H = Buffer.allocUnsafe(32)

  H.writeInt32BE(this._a, 0)
  H.writeInt32BE(this._b, 4)
  H.writeInt32BE(this._c, 8)
  H.writeInt32BE(this._d, 12)
  H.writeInt32BE(this._e, 16)
  H.writeInt32BE(this._f, 20)
  H.writeInt32BE(this._g, 24)
  H.writeInt32BE(this._h, 28)

  return H
}

module.exports = Sha256

},{"./hash":8,"inherits":5,"safe-buffer":7}],14:[function(require,module,exports){
var inherits = require('inherits')
var SHA512 = require('./sha512')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var W = new Array(160)

function Sha384 () {
  this.init()
  this._w = W

  Hash.call(this, 128, 112)
}

inherits(Sha384, SHA512)

Sha384.prototype.init = function () {
  this._ah = 0xcbbb9d5d
  this._bh = 0x629a292a
  this._ch = 0x9159015a
  this._dh = 0x152fecd8
  this._eh = 0x67332667
  this._fh = 0x8eb44a87
  this._gh = 0xdb0c2e0d
  this._hh = 0x47b5481d

  this._al = 0xc1059ed8
  this._bl = 0x367cd507
  this._cl = 0x3070dd17
  this._dl = 0xf70e5939
  this._el = 0xffc00b31
  this._fl = 0x68581511
  this._gl = 0x64f98fa7
  this._hl = 0xbefa4fa4

  return this
}

Sha384.prototype._hash = function () {
  var H = Buffer.allocUnsafe(48)

  function writeInt64BE (h, l, offset) {
    H.writeInt32BE(h, offset)
    H.writeInt32BE(l, offset + 4)
  }

  writeInt64BE(this._ah, this._al, 0)
  writeInt64BE(this._bh, this._bl, 8)
  writeInt64BE(this._ch, this._cl, 16)
  writeInt64BE(this._dh, this._dl, 24)
  writeInt64BE(this._eh, this._el, 32)
  writeInt64BE(this._fh, this._fl, 40)

  return H
}

module.exports = Sha384

},{"./hash":8,"./sha512":15,"inherits":5,"safe-buffer":7}],15:[function(require,module,exports){
var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
  0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
  0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
  0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
  0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
  0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
  0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
  0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
  0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
  0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
  0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
  0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
  0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
]

var W = new Array(160)

function Sha512 () {
  this.init()
  this._w = W

  Hash.call(this, 128, 112)
}

inherits(Sha512, Hash)

Sha512.prototype.init = function () {
  this._ah = 0x6a09e667
  this._bh = 0xbb67ae85
  this._ch = 0x3c6ef372
  this._dh = 0xa54ff53a
  this._eh = 0x510e527f
  this._fh = 0x9b05688c
  this._gh = 0x1f83d9ab
  this._hh = 0x5be0cd19

  this._al = 0xf3bcc908
  this._bl = 0x84caa73b
  this._cl = 0xfe94f82b
  this._dl = 0x5f1d36f1
  this._el = 0xade682d1
  this._fl = 0x2b3e6c1f
  this._gl = 0xfb41bd6b
  this._hl = 0x137e2179

  return this
}

function Ch (x, y, z) {
  return z ^ (x & (y ^ z))
}

function maj (x, y, z) {
  return (x & y) | (z & (x | y))
}

function sigma0 (x, xl) {
  return (x >>> 28 | xl << 4) ^ (xl >>> 2 | x << 30) ^ (xl >>> 7 | x << 25)
}

function sigma1 (x, xl) {
  return (x >>> 14 | xl << 18) ^ (x >>> 18 | xl << 14) ^ (xl >>> 9 | x << 23)
}

function Gamma0 (x, xl) {
  return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7)
}

function Gamma0l (x, xl) {
  return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7 | xl << 25)
}

function Gamma1 (x, xl) {
  return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6)
}

function Gamma1l (x, xl) {
  return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6 | xl << 26)
}

function getCarry (a, b) {
  return (a >>> 0) < (b >>> 0) ? 1 : 0
}

Sha512.prototype._update = function (M) {
  var W = this._w

  var ah = this._ah | 0
  var bh = this._bh | 0
  var ch = this._ch | 0
  var dh = this._dh | 0
  var eh = this._eh | 0
  var fh = this._fh | 0
  var gh = this._gh | 0
  var hh = this._hh | 0

  var al = this._al | 0
  var bl = this._bl | 0
  var cl = this._cl | 0
  var dl = this._dl | 0
  var el = this._el | 0
  var fl = this._fl | 0
  var gl = this._gl | 0
  var hl = this._hl | 0

  for (var i = 0; i < 32; i += 2) {
    W[i] = M.readInt32BE(i * 4)
    W[i + 1] = M.readInt32BE(i * 4 + 4)
  }
  for (; i < 160; i += 2) {
    var xh = W[i - 15 * 2]
    var xl = W[i - 15 * 2 + 1]
    var gamma0 = Gamma0(xh, xl)
    var gamma0l = Gamma0l(xl, xh)

    xh = W[i - 2 * 2]
    xl = W[i - 2 * 2 + 1]
    var gamma1 = Gamma1(xh, xl)
    var gamma1l = Gamma1l(xl, xh)

    // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
    var Wi7h = W[i - 7 * 2]
    var Wi7l = W[i - 7 * 2 + 1]

    var Wi16h = W[i - 16 * 2]
    var Wi16l = W[i - 16 * 2 + 1]

    var Wil = (gamma0l + Wi7l) | 0
    var Wih = (gamma0 + Wi7h + getCarry(Wil, gamma0l)) | 0
    Wil = (Wil + gamma1l) | 0
    Wih = (Wih + gamma1 + getCarry(Wil, gamma1l)) | 0
    Wil = (Wil + Wi16l) | 0
    Wih = (Wih + Wi16h + getCarry(Wil, Wi16l)) | 0

    W[i] = Wih
    W[i + 1] = Wil
  }

  for (var j = 0; j < 160; j += 2) {
    Wih = W[j]
    Wil = W[j + 1]

    var majh = maj(ah, bh, ch)
    var majl = maj(al, bl, cl)

    var sigma0h = sigma0(ah, al)
    var sigma0l = sigma0(al, ah)
    var sigma1h = sigma1(eh, el)
    var sigma1l = sigma1(el, eh)

    // t1 = h + sigma1 + ch + K[j] + W[j]
    var Kih = K[j]
    var Kil = K[j + 1]

    var chh = Ch(eh, fh, gh)
    var chl = Ch(el, fl, gl)

    var t1l = (hl + sigma1l) | 0
    var t1h = (hh + sigma1h + getCarry(t1l, hl)) | 0
    t1l = (t1l + chl) | 0
    t1h = (t1h + chh + getCarry(t1l, chl)) | 0
    t1l = (t1l + Kil) | 0
    t1h = (t1h + Kih + getCarry(t1l, Kil)) | 0
    t1l = (t1l + Wil) | 0
    t1h = (t1h + Wih + getCarry(t1l, Wil)) | 0

    // t2 = sigma0 + maj
    var t2l = (sigma0l + majl) | 0
    var t2h = (sigma0h + majh + getCarry(t2l, sigma0l)) | 0

    hh = gh
    hl = gl
    gh = fh
    gl = fl
    fh = eh
    fl = el
    el = (dl + t1l) | 0
    eh = (dh + t1h + getCarry(el, dl)) | 0
    dh = ch
    dl = cl
    ch = bh
    cl = bl
    bh = ah
    bl = al
    al = (t1l + t2l) | 0
    ah = (t1h + t2h + getCarry(al, t1l)) | 0
  }

  this._al = (this._al + al) | 0
  this._bl = (this._bl + bl) | 0
  this._cl = (this._cl + cl) | 0
  this._dl = (this._dl + dl) | 0
  this._el = (this._el + el) | 0
  this._fl = (this._fl + fl) | 0
  this._gl = (this._gl + gl) | 0
  this._hl = (this._hl + hl) | 0

  this._ah = (this._ah + ah + getCarry(this._al, al)) | 0
  this._bh = (this._bh + bh + getCarry(this._bl, bl)) | 0
  this._ch = (this._ch + ch + getCarry(this._cl, cl)) | 0
  this._dh = (this._dh + dh + getCarry(this._dl, dl)) | 0
  this._eh = (this._eh + eh + getCarry(this._el, el)) | 0
  this._fh = (this._fh + fh + getCarry(this._fl, fl)) | 0
  this._gh = (this._gh + gh + getCarry(this._gl, gl)) | 0
  this._hh = (this._hh + hh + getCarry(this._hl, hl)) | 0
}

Sha512.prototype._hash = function () {
  var H = Buffer.allocUnsafe(64)

  function writeInt64BE (h, l, offset) {
    H.writeInt32BE(h, offset)
    H.writeInt32BE(l, offset + 4)
  }

  writeInt64BE(this._ah, this._al, 0)
  writeInt64BE(this._bh, this._bl, 8)
  writeInt64BE(this._ch, this._cl, 16)
  writeInt64BE(this._dh, this._dl, 24)
  writeInt64BE(this._eh, this._el, 32)
  writeInt64BE(this._fh, this._fl, 40)
  writeInt64BE(this._gh, this._gl, 48)
  writeInt64BE(this._hh, this._hl, 56)

  return H
}

module.exports = Sha512

},{"./hash":8,"inherits":5,"safe-buffer":7}],16:[function(require,module,exports){
(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else {
        // Browser globals (with support for web workers)
        var glob;

        try {
            glob = window;
        } catch (e) {
            glob = self;
        }

        glob.SparkMD5 = factory();
    }
}(function (undefined) {

    'use strict';

    /*
     * Fastest md5 implementation around (JKM md5).
     * Credits: Joseph Myers
     *
     * @see http://www.myersdaily.org/joseph/javascript/md5-text.html
     * @see http://jsperf.com/md5-shootout/7
     */

    /* this function is much faster,
      so if possible we use it. Some IEs
      are the only ones I know of that
      need the idiotic second function,
      generated by an if clause.  */
    var add32 = function (a, b) {
        return (a + b) & 0xFFFFFFFF;
    },
        hex_chr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];


    function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }

    function md5cycle(x, k) {
        var a = x[0],
            b = x[1],
            c = x[2],
            d = x[3];

        a += (b & c | ~b & d) + k[0] - 680876936 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[1] - 389564586 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[2] + 606105819 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[3] - 1044525330 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;
        a += (b & c | ~b & d) + k[4] - 176418897 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[5] + 1200080426 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[6] - 1473231341 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[7] - 45705983 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;
        a += (b & c | ~b & d) + k[8] + 1770035416 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[9] - 1958414417 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[10] - 42063 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[11] - 1990404162 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;
        a += (b & c | ~b & d) + k[12] + 1804603682 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[13] - 40341101 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[14] - 1502002290 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[15] + 1236535329 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;

        a += (b & d | c & ~d) + k[1] - 165796510 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[6] - 1069501632 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[11] + 643717713 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[0] - 373897302 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;
        a += (b & d | c & ~d) + k[5] - 701558691 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[10] + 38016083 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[15] - 660478335 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[4] - 405537848 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;
        a += (b & d | c & ~d) + k[9] + 568446438 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[14] - 1019803690 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[3] - 187363961 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[8] + 1163531501 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;
        a += (b & d | c & ~d) + k[13] - 1444681467 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[2] - 51403784 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[7] + 1735328473 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[12] - 1926607734 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;

        a += (b ^ c ^ d) + k[5] - 378558 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[8] - 2022574463 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[11] + 1839030562 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[14] - 35309556 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;
        a += (b ^ c ^ d) + k[1] - 1530992060 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[4] + 1272893353 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[7] - 155497632 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[10] - 1094730640 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;
        a += (b ^ c ^ d) + k[13] + 681279174 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[0] - 358537222 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[3] - 722521979 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[6] + 76029189 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;
        a += (b ^ c ^ d) + k[9] - 640364487 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[12] - 421815835 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[15] + 530742520 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[2] - 995338651 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;

        a += (c ^ (b | ~d)) + k[0] - 198630844 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[7] + 1126891415 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[14] - 1416354905 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[5] - 57434055 | 0;
        b  = (b << 21 |b >>> 11) + c | 0;
        a += (c ^ (b | ~d)) + k[12] + 1700485571 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[3] - 1894986606 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[10] - 1051523 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[1] - 2054922799 | 0;
        b  = (b << 21 |b >>> 11) + c | 0;
        a += (c ^ (b | ~d)) + k[8] + 1873313359 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[15] - 30611744 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[6] - 1560198380 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[13] + 1309151649 | 0;
        b  = (b << 21 |b >>> 11) + c | 0;
        a += (c ^ (b | ~d)) + k[4] - 145523070 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[11] - 1120210379 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[2] + 718787259 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[9] - 343485551 | 0;
        b  = (b << 21 | b >>> 11) + c | 0;

        x[0] = a + x[0] | 0;
        x[1] = b + x[1] | 0;
        x[2] = c + x[2] | 0;
        x[3] = d + x[3] | 0;
    }

    function md5blk(s) {
        var md5blks = [],
            i; /* Andy King said do it this way. */

        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    function md5blk_array(a) {
        var md5blks = [],
            i; /* Andy King said do it this way. */

        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = a[i] + (a[i + 1] << 8) + (a[i + 2] << 16) + (a[i + 3] << 24);
        }
        return md5blks;
    }

    function md51(s) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i,
            length,
            tail,
            tmp,
            lo,
            hi;

        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        length = s.length;
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        }
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Beware that the final length might not fit in 32 bits so we take care of that
        tmp = n * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;

        md5cycle(state, tail);
        return state;
    }

    function md51_array(a) {
        var n = a.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i,
            length,
            tail,
            tmp,
            lo,
            hi;

        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk_array(a.subarray(i - 64, i)));
        }

        // Not sure if it is a bug, however IE10 will always produce a sub array of length 1
        // containing the last element of the parent array if the sub array specified starts
        // beyond the length of the parent array - weird.
        // https://connect.microsoft.com/IE/feedback/details/771452/typed-array-subarray-issue
        a = (i - 64) < n ? a.subarray(i - 64) : new Uint8Array(0);

        length = a.length;
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= a[i] << ((i % 4) << 3);
        }

        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Beware that the final length might not fit in 32 bits so we take care of that
        tmp = n * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;

        md5cycle(state, tail);

        return state;
    }

    function rhex(n) {
        var s = '',
            j;
        for (j = 0; j < 4; j += 1) {
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        }
        return s;
    }

    function hex(x) {
        var i;
        for (i = 0; i < x.length; i += 1) {
            x[i] = rhex(x[i]);
        }
        return x.join('');
    }

    // In some cases the fast add32 function cannot be used..
    if (hex(md51('hello')) !== '5d41402abc4b2a76b9719d911017c592') {
        add32 = function (x, y) {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF),
                msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        };
    }

    // ---------------------------------------------------

    /**
     * ArrayBuffer slice polyfill.
     *
     * @see https://github.com/ttaubert/node-arraybuffer-slice
     */

    if (typeof ArrayBuffer !== 'undefined' && !ArrayBuffer.prototype.slice) {
        (function () {
            function clamp(val, length) {
                val = (val | 0) || 0;

                if (val < 0) {
                    return Math.max(val + length, 0);
                }

                return Math.min(val, length);
            }

            ArrayBuffer.prototype.slice = function (from, to) {
                var length = this.byteLength,
                    begin = clamp(from, length),
                    end = length,
                    num,
                    target,
                    targetArray,
                    sourceArray;

                if (to !== undefined) {
                    end = clamp(to, length);
                }

                if (begin > end) {
                    return new ArrayBuffer(0);
                }

                num = end - begin;
                target = new ArrayBuffer(num);
                targetArray = new Uint8Array(target);

                sourceArray = new Uint8Array(this, begin, num);
                targetArray.set(sourceArray);

                return target;
            };
        })();
    }

    // ---------------------------------------------------

    /**
     * Helpers.
     */

    function toUtf8(str) {
        if (/[\u0080-\uFFFF]/.test(str)) {
            str = unescape(encodeURIComponent(str));
        }

        return str;
    }

    function utf8Str2ArrayBuffer(str, returnUInt8Array) {
        var length = str.length,
           buff = new ArrayBuffer(length),
           arr = new Uint8Array(buff),
           i;

        for (i = 0; i < length; i += 1) {
            arr[i] = str.charCodeAt(i);
        }

        return returnUInt8Array ? arr : buff;
    }

    function arrayBuffer2Utf8Str(buff) {
        return String.fromCharCode.apply(null, new Uint8Array(buff));
    }

    function concatenateArrayBuffers(first, second, returnUInt8Array) {
        var result = new Uint8Array(first.byteLength + second.byteLength);

        result.set(new Uint8Array(first));
        result.set(new Uint8Array(second), first.byteLength);

        return returnUInt8Array ? result : result.buffer;
    }

    function hexToBinaryString(hex) {
        var bytes = [],
            length = hex.length,
            x;

        for (x = 0; x < length - 1; x += 2) {
            bytes.push(parseInt(hex.substr(x, 2), 16));
        }

        return String.fromCharCode.apply(String, bytes);
    }

    // ---------------------------------------------------

    /**
     * SparkMD5 OOP implementation.
     *
     * Use this class to perform an incremental md5, otherwise use the
     * static methods instead.
     */

    function SparkMD5() {
        // call reset to init the instance
        this.reset();
    }

    /**
     * Appends a string.
     * A conversion will be applied if an utf8 string is detected.
     *
     * @param {String} str The string to be appended
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.append = function (str) {
        // Converts the string to utf8 bytes if necessary
        // Then append as binary
        this.appendBinary(toUtf8(str));

        return this;
    };

    /**
     * Appends a binary string.
     *
     * @param {String} contents The binary string to be appended
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.appendBinary = function (contents) {
        this._buff += contents;
        this._length += contents.length;

        var length = this._buff.length,
            i;

        for (i = 64; i <= length; i += 64) {
            md5cycle(this._hash, md5blk(this._buff.substring(i - 64, i)));
        }

        this._buff = this._buff.substring(i - 64);

        return this;
    };

    /**
     * Finishes the incremental computation, reseting the internal state and
     * returning the result.
     *
     * @param {Boolean} raw True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.prototype.end = function (raw) {
        var buff = this._buff,
            length = buff.length,
            i,
            tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ret;

        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= buff.charCodeAt(i) << ((i % 4) << 3);
        }

        this._finish(tail, length);
        ret = hex(this._hash);

        if (raw) {
            ret = hexToBinaryString(ret);
        }

        this.reset();

        return ret;
    };

    /**
     * Resets the internal state of the computation.
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.reset = function () {
        this._buff = '';
        this._length = 0;
        this._hash = [1732584193, -271733879, -1732584194, 271733878];

        return this;
    };

    /**
     * Gets the internal state of the computation.
     *
     * @return {Object} The state
     */
    SparkMD5.prototype.getState = function () {
        return {
            buff: this._buff,
            length: this._length,
            hash: this._hash
        };
    };

    /**
     * Gets the internal state of the computation.
     *
     * @param {Object} state The state
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.setState = function (state) {
        this._buff = state.buff;
        this._length = state.length;
        this._hash = state.hash;

        return this;
    };

    /**
     * Releases memory used by the incremental buffer and other additional
     * resources. If you plan to use the instance again, use reset instead.
     */
    SparkMD5.prototype.destroy = function () {
        delete this._hash;
        delete this._buff;
        delete this._length;
    };

    /**
     * Finish the final calculation based on the tail.
     *
     * @param {Array}  tail   The tail (will be modified)
     * @param {Number} length The length of the remaining buffer
     */
    SparkMD5.prototype._finish = function (tail, length) {
        var i = length,
            tmp,
            lo,
            hi;

        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(this._hash, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Do the final computation based on the tail and length
        // Beware that the final length may not fit in 32 bits so we take care of that
        tmp = this._length * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;
        md5cycle(this._hash, tail);
    };

    /**
     * Performs the md5 hash on a string.
     * A conversion will be applied if utf8 string is detected.
     *
     * @param {String}  str The string
     * @param {Boolean} raw True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.hash = function (str, raw) {
        // Converts the string to utf8 bytes if necessary
        // Then compute it using the binary function
        return SparkMD5.hashBinary(toUtf8(str), raw);
    };

    /**
     * Performs the md5 hash on a binary string.
     *
     * @param {String}  content The binary string
     * @param {Boolean} raw     True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.hashBinary = function (content, raw) {
        var hash = md51(content),
            ret = hex(hash);

        return raw ? hexToBinaryString(ret) : ret;
    };

    // ---------------------------------------------------

    /**
     * SparkMD5 OOP implementation for array buffers.
     *
     * Use this class to perform an incremental md5 ONLY for array buffers.
     */
    SparkMD5.ArrayBuffer = function () {
        // call reset to init the instance
        this.reset();
    };

    /**
     * Appends an array buffer.
     *
     * @param {ArrayBuffer} arr The array to be appended
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.append = function (arr) {
        var buff = concatenateArrayBuffers(this._buff.buffer, arr, true),
            length = buff.length,
            i;

        this._length += arr.byteLength;

        for (i = 64; i <= length; i += 64) {
            md5cycle(this._hash, md5blk_array(buff.subarray(i - 64, i)));
        }

        this._buff = (i - 64) < length ? new Uint8Array(buff.buffer.slice(i - 64)) : new Uint8Array(0);

        return this;
    };

    /**
     * Finishes the incremental computation, reseting the internal state and
     * returning the result.
     *
     * @param {Boolean} raw True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.ArrayBuffer.prototype.end = function (raw) {
        var buff = this._buff,
            length = buff.length,
            tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            i,
            ret;

        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= buff[i] << ((i % 4) << 3);
        }

        this._finish(tail, length);
        ret = hex(this._hash);

        if (raw) {
            ret = hexToBinaryString(ret);
        }

        this.reset();

        return ret;
    };

    /**
     * Resets the internal state of the computation.
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.reset = function () {
        this._buff = new Uint8Array(0);
        this._length = 0;
        this._hash = [1732584193, -271733879, -1732584194, 271733878];

        return this;
    };

    /**
     * Gets the internal state of the computation.
     *
     * @return {Object} The state
     */
    SparkMD5.ArrayBuffer.prototype.getState = function () {
        var state = SparkMD5.prototype.getState.call(this);

        // Convert buffer to a string
        state.buff = arrayBuffer2Utf8Str(state.buff);

        return state;
    };

    /**
     * Gets the internal state of the computation.
     *
     * @param {Object} state The state
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.setState = function (state) {
        // Convert string to buffer
        state.buff = utf8Str2ArrayBuffer(state.buff, true);

        return SparkMD5.prototype.setState.call(this, state);
    };

    SparkMD5.ArrayBuffer.prototype.destroy = SparkMD5.prototype.destroy;

    SparkMD5.ArrayBuffer.prototype._finish = SparkMD5.prototype._finish;

    /**
     * Performs the md5 hash on an array buffer.
     *
     * @param {ArrayBuffer} arr The array buffer
     * @param {Boolean}     raw True to get the raw string, false to get the hex one
     *
     * @return {String} The result
     */
    SparkMD5.ArrayBuffer.hash = function (arr, raw) {
        var hash = md51_array(new Uint8Array(arr)),
            ret = hex(hash);

        return raw ? hexToBinaryString(ret) : ret;
    };

    return SparkMD5;
}));

},{}],17:[function(require,module,exports){
const Cookies = require('js-cookie');
const createHash = require('sha.js')
const Evaporate = require('evaporate');
const SparkMD5 = require('spark-md5');


(function(){

    "use strict"

    const request = function (method, url, data, headers, el, cb) {
        let req = new XMLHttpRequest()
        req.open(method, url, true)

        Object.keys(headers).forEach(function (key) {
            req.setRequestHeader(key, headers[key])
        });

        req.onload = function () {
            cb(req.status, req.responseText)
        };

        req.onerror = req.onabort = function () {
            disableSubmit(false)
            error(el, 'Sorry, failed to upload file.')
        };

        req.send(data)
    };

    const parseNameFromUrl = function (url) {
        return decodeURIComponent((url + '').replace(/\+/g, '%20'));
    };

    const parseJson = function (json) {
        let data;
        try {
            data = JSON.parse(json);
        }
        catch (e) {
            data = null;
        }
        return data
    };

    const updateProgressBar = function (element, progressRatio) {
        const bar = element.querySelector('.bar');
        bar.style.width = Math.round(progressRatio * 100) + '%';
    };

    const error = function(el, msg) {
        el.className = 's3direct form-active'
        el.querySelector('.file-input').value = ''
        alert(msg)
    };

    let concurrentUploads = 0;

    const disableSubmit = function(status) {
        const submitRow = document.querySelector('.submit-row')
        if( ! submitRow) return

        const buttons = submitRow.querySelectorAll('input[type=submit],button[type=submit]');

        if (status === true) concurrentUploads++
        else concurrentUploads--

        ;[].forEach.call(buttons, function(el){
            el.disabled = (concurrentUploads !== 0)
        })
    }

    const beginUpload = function (element) {
        disableSubmit(true);
        element.className = 's3direct progress-active'
    };

    const finishUpload = function (element, awsBucketUrl, objectKey) {
        const link = element.querySelector('.file-link');
        const url = element.querySelector('.file-url');
        url.value = awsBucketUrl + '/' + objectKey;
        link.setAttribute('href', url.value);
        link.innerHTML = parseNameFromUrl(url.value).split('/').pop();

        element.className = 's3direct link-active';
        element.querySelector('.bar').style.width = '0%';
        disableSubmit(false);
    };

    const computeMd5 = function (data) {
        return btoa(SparkMD5.ArrayBuffer.hash(data, true));
    };

    const computeSha256 = function (data) {
        return createHash('sha256').update(data, 'utf-8').digest('hex');
    };

    const initiateMultipartUpload = function (element, signingUrl, objectKey, awsKey, awsRegion, awsBucket, awsBucketUrl, cacheControl, contentDisposition, acl, serverSideEncryption, file) {
        // Enclosed so we can propagate errors to the correct `element` in case of failure.
        const getAwsV4Signature = function (signParams, signHeaders, stringToSign, signatureDateTime, canonicalRequest) {
            return new Promise(function (resolve, reject) {
                const form          = new FormData(),
                      csrfTokenName = element.querySelector('.csrf-cookie-name').value,
                      csrfInput     = document.querySelector('input[name=csrfmiddlewaretoken]'),
                      csrfToken     = csrfInput ? csrfInput.value : Cookies.get(csrfCookieNameInput.value),
                      headers       = {'X-CSRFToken': csrfToken};
                form.append('to_sign', stringToSign);
                form.append('datetime', signatureDateTime);
                request('POST', signingUrl, form, headers, element, function (status, response) {
                    switch (status) {
                        case 200:
                            resolve(response);
                            break;
                        default:
                            error(element, 'Could not generate AWS v4 signature.')
                            reject();
                            break;
                    }
                });
            })
        };

        const generateAmazonHeaders = function (acl, serverSideEncryption) {
            // Either of these may be null, so don't add them unless they exist:
            let headers = {}
            if (acl) headers['x-amz-acl'] = acl;
            if (serverSideEncryption) headers['x-amz-server-side-encryption'] = serverSideEncryption;
            return headers;
        };

        Evaporate.create(
            {
                //signerUrl: signingUrl,
                customAuthMethod: getAwsV4Signature,
                aws_key: awsKey,
                bucket: awsBucket,
                awsRegion: awsRegion,
                computeContentMd5: true,
                cryptoMd5Method: computeMd5,
                cryptoHexEncodedHash256: computeSha256,
                partSize: 20 * 1024 * 1024,
                logging: true,
                debug: true,
                allowS3ExistenceOptimization: true,
                s3FileCacheHoursAgo: 12,
            }
        ).then(function (evaporate) {
            beginUpload(element);
            evaporate.add({
                name: objectKey,
                file: file,
                contentType: file.type,
                xAmzHeadersAtInitiate: generateAmazonHeaders(acl, serverSideEncryption),
                notSignedHeadersAtInitiate: {'Cache-Control': cacheControl, 'Content-Disposition': contentDisposition},
                progress: function (progressRatio, stats) { updateProgressBar(element, progressRatio); },
            }).then(
                function (awsS3ObjectKey) {
                    console.log('Successfully uploaded to:', awsS3ObjectKey);
                    finishUpload(element, awsBucketUrl, awsS3ObjectKey);
                },
                function (reason) {
                    console.error('Failed to upload because:', reason);
                    return error(element, reason)
                }
            )
        });
    };

    const checkFileAndInitiateUpload = function(event) {
        console.log('Checking file and initiating upload…')
        const element             = event.target.parentElement,
              csrfInput           = document.querySelector('input[name=csrfmiddlewaretoken]'),
              file                = element.querySelector('.file-input').files[0],
              dest                = element.querySelector('.file-dest').value,
              csrfCookieNameInput = element.querySelector('.csrf-cookie-name'),
              destinationCheckUrl = element.getAttribute('data-policy-url'),
              signerUrl           = element.getAttribute('data-signing-url'),
              form                = new FormData(),
              csrfToken           = csrfInput ? csrfInput.value : Cookies.get(csrfCookieNameInput.value),
              headers             = {'X-CSRFToken': csrfToken };

        form.append('dest', dest)
        form.append('name', file.name)
        form.append('type', file.type)
        form.append('size', file.size)
        request('POST', destinationCheckUrl, form, headers, element, function(status, response) {
            const uploadParameters = parseJson(response)
            switch(status) {
                case 200:
                    initiateMultipartUpload(
                        element,
                        signerUrl,
                        uploadParameters.object_key,
                        uploadParameters.access_key_id,
                        uploadParameters.region,
                        uploadParameters.bucket,
                        uploadParameters.bucket_url,
                        uploadParameters.cache_control,
                        uploadParameters.content_disposition,
                        uploadParameters.acl,
                        uploadParameters.server_side_encryption,
                        file
                    );
                    break;
                case 400:
                case 403:
                case 500:
                    error(element, uploadParameters.error)
                    break;
                default:
                    error(element, 'Sorry, could not get upload URL.')
            }
        })
    }

    const removeUpload = function (e) {
        e.preventDefault()

        const el = e.target.parentElement
        el.querySelector('.file-url').value = ''
        el.querySelector('.file-input').value = ''
        el.className = 's3direct form-active'
    };

    const addHandlers = function (el) {
        console.log('Adding django-s3direct handlers…');
        const url = el.querySelector('.file-url'),
              input = el.querySelector('.file-input'),
              remove = el.querySelector('.file-remove'),
              status = (url.value === '') ? 'form' : 'link';

        el.className = 's3direct ' + status + '-active'

        remove.addEventListener('click', removeUpload, false)
        input.addEventListener('change', checkFileAndInitiateUpload, false)
    };

    document.addEventListener('DOMContentLoaded', function(event) {
        [].forEach.call(document.querySelectorAll('.s3direct'), addHandlers)
    });

    document.addEventListener('DOMNodeInserted', function(event){
        if(event.target.tagName) {
            const el = event.target.querySelectorAll('.s3direct');
            [].forEach.call(el, function (element, index, array) {
                addHandlers(element);
            });
        }
    })

})()

},{"evaporate":3,"js-cookie":6,"sha.js":9,"spark-md5":16}]},{},[17]);
