
// ------------------------------- frag_apply_varvlu ----------------------------
// apply the varvlu to the textMask and nameMask of this regex pattern fragment.
function frag_apply_varvlu(frag, varvlu)
{
  frag.varvlu = varvlu;
  const unescaped_varvlu = string_unescape(varvlu);
  frag.text = frag.textMask.replace('{{}}', frag.varvlu);
  frag.name = frag.nameMask.replace('{{}}', unescaped_varvlu);
  frag.lx = frag.text.length;
}

// ----------------------------- regexPattern_toFragments -------------------------
// parse the input regex pattern into individual regex instructions.
// return these regex instructions as an array of regex pattern visual fragments. 
// regex fragment item: {text, name, lx }
function regexPattern_toFragments(pattern)
{

  // ----------------------------- frag_advanceLazy --------------------
  // process the ? that can follow a quantifier. This makes the quantifier lazy.
  // Lazy, meaning, other "or" matches take precedence. 
  const frag_advanceLazy = function (frag, pattern)
  {
    let lazy = false;
    const ch1 = pattern.substr(frag.bx + frag.lx, 1);
    if (ch1 == '?')
      lazy = true;

    if (lazy)
    {
      frag.name = `${frag.name} lazy`;
      frag.lx += 1;
      frag.text = pattern.substr(frag.bx, frag.lx);
      frag.lazy = lazy;
    }
  };

  // ----------------------------- frag_advanceQuantifier --------------------
  const frag_advanceQuantifier = function (frag, pattern)
  {
    // look for quantifier after the escape command.
    let quantifier = '';
    const ch1 = pattern.substr(frag.bx + frag.lx, 1);
    if (ch1 == '?')
      quantifier = 'zeroOrOne';
    else if (ch1 == '*')
      quantifier = 'zeroOrMore';
    else if (ch1 == '+')
      quantifier = 'oneOrMore';

    // apply quantifier to regex fragment.
    if (quantifier)
    {
      frag.name = `${frag.name} ${quantifier}`;
      frag.lx += 1;
      frag.text = pattern.substr(frag.bx, frag.lx);
      frag.quantifier = quantifier;
    }
  };

  // quantifier: true.  a quantifier can follow this command.
  // style: info warning success ...  How to style fragment when display visually.
  const charCommandList = [
    { text: '^', name: 'start of string' },
    { text: '$', name: 'end of string' },
    { text: '.', name: 'any character', quantifier: true },
    { text: '(', name: 'begin capture', style: 'info' },
    { text: '(?:', name: 'begin non capture', style: 'info' },
    { text: '(?=', name: 'begin positive lookahead', style: 'info' },

    {
      text: '(?<', name: 'beginNamedCapture',
      textMask: '(?<{{}}>', nameMask: 'beginNamedCapture {{}}',
      tail: '>', varvlu: '', style: 'info'
    },

    {
      text: '[', name: 'any character',
      textMask: '[{{}}]', nameMask: 'any character {{}}',
      tail: ']', varvlu: '', style: 'info'
    },

    {
      text: '[^', name: 'any character not',
      textMask: '[^{{}}]', nameMask: 'any character not {{}}',
      tail: ']', varvlu: '', style: 'info'
    },

    { text: ')', name: 'end capture', quantifier: true, style: 'info' },
    { text: '|', name: 'or' },
    { text: '\\s', name: 'whitespace', quantifier: true },
    { text: '\\S', name: 'not whitespace', quantifier: true },
    { text: '\\b', name: 'begin/end word', quantifier: true },
    { text: '\\B', name: 'not begin/end word', quantifier: true },
    { text: '\\w', name: 'word char', quantifier: true },
    { text: '\\d', name: 'digit char', quantifier: true },
    { text: '\\D', name: 'not digit char', quantifier: true },
    { text: '\\.', name: 'any char not newline', quantifier: true },

    { text: '\\w*', name: 'zeroMoreWord' },
    { text: rxp.variableName, name: 'varName' },
    { text: rxp.oneMoreNumeric, name: 'oneMoreNumeric' },
    { text: rxp.oneMoreDigits, name: 'oneMoreDigits' },
    { text: rxp.oneMoreAlpha, name: 'oneMoreAlpha' },
    { text: rxp.oneMoreWord, name: 'oneMoreWord' },

    { text: '\\+', name: '+ char', quantifier: true },
    { text: '\\*', name: '* char', quantifier: true },
    { text: '\\?', name: '? char', quantifier: true },
    { text: '\\/', name: '/ char', quantifier: true },
    { text: rxp.comment, name: 'comment', style: 'warning' },
    { text: rxp.singleQuoteQuoted, name: 'single quote quoted', style: 'warning', highlevel: true },
    { text: rxp.doubleQuoteQuoted, name: 'double quote quoted', style: 'warning', highlevel: true },
  ];

  const quantifierCommandList = [
    { text: '+', name: 'one or more' },
    { text: '*', name: 'zero or more' },
    { text: '?', name: 'zero or one' },
  ];

  let px = 0;
  const fragArray = [];

  // --------------------------------- charCommandList_find ----------------------
  // search list of regex instructions. Examine each item, looking for the best
  // match.  Where best match is a match of the longest regex instruction.
  const charCommandList_find = function (pattern, bx)
  {
    let found_item;
    for (let ix = 0; ix < charCommandList.length; ++ix)
    {
      const item = charCommandList[ix];

      const textLx = item.text.length;
      if ((!found_item) || (found_item.text.length < textLx))
      {
        const patternText = string_substrLenient(pattern, bx, textLx);
        if (patternText == item.text)
        {
          if ((item.highlevel) && (pattern == item.text))
          {
          }
          else
          {
            found_item = item;
          }
        }
      }
    }

    return found_item;
  };

  // --------------------------------- main ----------------------------------

  // regex pattern is enclosed in forward slash. It is a regex literal. Remove the
  // enclosing slash and replace any escaped fwd slash with unescaped fwd slash.
  if (string_isQuoted(pattern, '/'))
  {
    const bx = 1;
    const lx = pattern.length - 2;
    pattern = string_substrLenient(pattern, bx, lx);
    pattern = pattern.replace(/\\\//g, '/');
  }

  while (px < pattern.length)
  {
    let ch1 = pattern.substr(px, 1);
    const ch2 = pattern.substr(px, 2);
    const ch3 = pattern.substr(px, 3);
    let frag = null;

    // look for character command.  ^$.()|
    if (frag == null)
    {
      const found_item = charCommandList_find(pattern, px);
      if (found_item)
      {
        const { text } = found_item;
        frag = { ...found_item, bx: px, lx: text.length };

        // this fragment continues with some variable text and ends with fixed
        // tail text.
        if (frag.tail)
        {
          const bx = px + text.length;
          let fx;
          if (frag.tail.length > 1)
            fx = pattern.indexOf(frag.tail, bx);  // find the tail
          else
            fx = string_indexOfUnescapedChar(pattern, frag.tail, bx);

          if (fx >= 0)
          {
            const varvluLx = fx - bx;  // the variable value runs up to the tail.
            const varvlu = pattern.substr(bx, varvluLx);

            // apply the variable value to this fragment. The fragment contains
            // a textMask and nameMask. Build the text and name properties from
            // these two masks.
            frag_apply_varvlu(frag, varvlu);
          }
        }

        frag_advanceQuantifier(frag, pattern);
        frag_advanceLazy(frag, pattern);
      }
    }

    // process as plain text.
    if (frag == null) 
    {
      // the special regex characters:  \ ^ . $ | ? * + ( ) [ {
      // match for characters other than special regex characters.
      const match = pattern.substr(px).match(/([^\\\^\.\$\|\?\*\+\(\)\[\{]|\\\\)+/);
      if (match)
      {
        let matchText = match[0];

        // // replace double \\ with single \.
        // matchText = matchText.replace(/\\\\/g, '\\' ) ;

        frag = {
          text: '', name: '',
          textMask: '{{}}', nameMask: 'text: {{}}',
          varvlu: '',
          bx: px, lx: matchText.length, style: 'secondary'
        };

        // look ahead to the next character in the pattern. A quantifier applies to
        // the last character in the pattern. So if this is multiple plain text 
        // characters, split off the last character as the one the quantifier 
        // applies to.
        {
          const lx = matchText.length;
          const nx1 = string_substrLenient(pattern, px + lx, 1);
          if (regex_isQuantifier(nx1))
          {
            // split the regex text on its last character. Where a character is
            // either an actual character. Or it is an escaped character.
            const { part1, part2 } = regex_splitLastChar(matchText);
            if (part1.length > 0)
            {
              matchText = part1;
            }
          }
        }

        // apply the variable value to this fragment. The fragment contains
        // a textMask and nameMask. Build the text and name properties from
        // these two masks.
        frag_apply_varvlu(frag, matchText);

        frag_advanceQuantifier(frag, pattern);
        frag_advanceLazy(frag, pattern);
      }
    }

    // unknown character.
    if (frag == null)
    {
      frag = { text: ch1, name: `unknown ${ch1}`, bx: px, lx: 1 };
      frag_advanceQuantifier(frag, pattern);
    }

    // store fragment in fragment list.
    fragArray.push(frag);
    px += frag.lx;
  }

  return fragArray;
}

// ------------------------------ fragments_toRegexPattern ------------------------
function fragments_toRegexPattern(fragment_array)
{
  let pattern = '';
  fragment_array.forEach((item) =>
  {
    if (!item.special)
    {
      pattern += item.text;
    }
  });
  return pattern;
}


// site/js/regex_core.js
// date: 2019-09-14
// desc: regex functions and constants. Used to enhance functionality of javascript
//       built in regex features.

// rxp - const object that contains regex match patterns.
const rxp = {
  any: '\\.',       // match any char
  zeroMoreWhitespace: `\\s*`,
  singleQuoteQuoted: `'(?:\\\\.|[^'\\\\])*'`,
  doubleQuoteQuoted: `"(?:\\\\.|[^"\\\\])*"`,
  forwardSlashEnclosed: `/(?:\\\\.|[^/\\\\])*/`,
  jsonNameVluSep: `\\s*:`,
  beginString: `^\\s*`,
  jsonStart: `\\s*{`,
  jsonEnd: `\\s*}`,
  jsonStartArray: `\\s*\\[`,
  jsonStartObject: `\\s*\\{`,
  comma: `\\s*,`,
  or: '|',
  beginCapture: '(',
  closeParen: '\\)',
  comment: '\\/\\*.+?\\*\\/|\\/\\/.*(?=[\\n\\r])',
  endCapture: ')',
  endCaptureZeroOne: ')?',
  endCaptureZeroMore: ')*',
  endCaptureOneMore: ')+',
  oneMoreNumeric: '[\\d.]+',
  oneMoreDigits: '\\d+',
  oneMoreAlpha: '[A-Za-z]+',
  oneMoreWord: '\\w+',
  oneMoreWhitespace: '\\s+',
  openParen: '\\(',
  stringStart: '^',
  stringEnd: '$',
  variableName: `[a-zA-Z_]\\w*`,
  zeroOneAny: '\\.?',
  zeroMoreWord: '\\w*',
  zeroMoreWhitespace: '\\s*',

  jsonVluStart: function ()
  {
    return this.zeroMoreWhitespace + this.beginCapture + this.singleQuotedString +
      this.or + this.varName + this.or + this.jsonStartArray +
      this.or + this.jsonStartObject + this.endCapture
  },
  jsonPropName: function ()
  {
    return this.zeroMoreWhitespace + this.beginCapture + this.singleQuotedString +
      this.or + this.varName + this.endCapture
  },
  jsonNameVluPair: function ()
  {
    return this.zeroMoreWhitespace + this.beginCapture + this.singleQuotedString +
      this.or + this.varName + this.endCapture +
      this.jsonNameVluSep +
      this.beginCapture + this.singleQuotedString +
      this.or + this.varName + this.endCapture
  },
  beginNamedCapture: function (name)
  {
    return `(?<${name}>`;
  },
  escape: function (char) { return '\\' + char }
}

// ----------------------- string_indexOfUnescapedChar ------------------------
// find char in string that is not escaped ( preceded with escape char ) 
function string_indexOfUnescapedChar(text, findChar, bx)
{
  let ix = bx || 0;  // start of search.
  let foundIx = -1;  // find result. init to not found.
  while (ix < text.length)
  {
    const ch1 = text[ix];

    // current char escapes the next char. advance past next char. 
    if (ch1 == '\\')  
    {
      ix += 2;
    }

    // character being searched for. return its index.
    else if (ch1 == findChar)
    {
      foundIx = ix;
      break;
    }

    // advance index. continue search.
    else
    {
      ix += 1;
    }
  }
  return foundIx;
}

// ------------------------------- string_isQuoted --------------------------------
function string_isQuoted(text, quoteChar)
{
  let isQuoted = false;
  if (text.length >= 2)
  {
    const headChar = string_head(text, 1);

    // continue with test.  checking if is specified quote char.
    if (!quoteChar || (headChar == quoteChar))
    {
      if ((headChar == '"') || (headChar == "'") || (headChar == '`') ||
        (headChar == '/'))
      {
        const tailCh1 = string_tail(text, 1);
        const tailCh2 = string_tail(text, 2);
        if ((headChar == tailCh1) && (tailCh2.substr(0, 1) != '\\'))
          isQuoted = true;
      }
    }
  }
  return isQuoted;
}

// ------------------------- string_trim --------------------
function string_trim(str)
{
  if (typeof str == 'number')
    str = str.toString();
  if (!str)
    return str;
  else
  {
    let s1 = str.replace(/(\s+$)|(^\s+)/g, "");
    return s1;
  }
}

// ---------------------------- string_substrLenient --------------------
// return substring of the input string. only, clip the results if start or end
// pos are out of bounds of the string.
function string_substrLenient(str, fx, lx = -1)
{
  if ((typeof str) != 'string')
    return '';

  // move from from negative to zero. Reduce length by the adjusted amount.
  if (fx < 0)
  {
    var adj = 0 - fx;
    fx += adj;
    if (lx != -1)
    {
      lx -= adj;
      if (lx < 0)
        lx = 0;
    }
  }

  if (fx >= str.length)
    return '';
  if (lx == -1)
    return str.substr(fx);

  // remaining length.
  var remLx = str.length - fx;

  // trim length if remaining lgth exceeded.
  if (lx > remLx)
    lx = remLx;

  return str.substr(fx, lx);
}

// ----------------------- string_unescape ------------------------
// remove all the backslash characters from the string. With the exception of when
// the backslash is followed by another backslash. In that case, remove only the
// first of the pair.
function string_unescape(text)
{
  let ix = 0;
  let result = '';
  while (ix < text.length)
  {
    const ch1 = text[ix];
    const nx1 = (ix + 1 >= text.length) ? '' : text[ix + 1];
    if ((ch1 == '\\') && (nx1 == '\\'))
    {
      result += ch1;
      ix += 2;
    }
    else if (ch1 == '\\')
    {
      ix += 2;
      result += nx1;
    }
    else
    {
      ix += 1;
      result += ch1;
    }
  }
  return result;
}


export { fragments_toRegexPattern, regexPattern_toFragments } ;
