/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
/* 解析属性 */
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/*  */
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
/* 匹配开始标签 */
const startTagOpen = new RegExp(`^<${qnameCapture}`)

const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
/* 解析HTML注释 */
const comment = /^<!\--/
// 解析条件注释
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

/* 
  定义一些常量和变量
  while循环
  解析过程中用到的辅助函数
*/
export function parseHTML (html, options) {
  const stack = [] /* 这是栈，为了维护AST层级用的 */
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag

  /* 最外层是一个大的while循环，对这个html字符串从头往后遍历 */
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {

      let textEnd = html.indexOf('<')
      /* 
        如果开头是尖括号，说明是标签类型，然后进行处理
      */
      if (textEnd === 0) {
        // Comment:
        /* 在这里处理HTML注释 */
        if (comment.test(html)) {
          /* 寻找闭合的注释 */
          const commentEnd = html.indexOf('-->');
          // 如果找到闭合的注释
          if (commentEnd >= 0) {
            /* 下面这个判断的作用是，在生成真实DOM结构的时候，要不要保留注释 */
            if (options.shouldKeepComment) {
              // 若保留注释，则把注释截取出来传给options.comment，创建注释类型的AST节点
              /* 
                把html从第4位（"<!--"长度为4）开始截取，
                直到-->处，截取得到的内容就是注释的真实内容，
                然后调用4个钩子函数中的comment函数，
                将真实的注释内容传进去，创建注释类型的AST节点
              */
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            // 若不保留注释，则将游标移动到'-->'之后，继续向后解析
            // advance 是用来移动游标的，解析完一部分就把游标向后移动一部分
            advance(commentEnd + 3)
            continue
          }
        }
        /* 解析条件注释， */
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            // 移动游标
            advance(conditionalEnd + 2)
            continue
          }
        }
        /* 解析 DOCTYPE */
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }
        /* 解析结束标签 */
        const endTagMatch = html.match(endTag)
        /* 如果endTagMatch不是null */
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          /* 主要是调用end()函数 */
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }
        /* 解析开始标签 */
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          /* 解析开始标签成功，就执行下面的函数，也就是调用start函数 */
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      } /* end if */

      let text, rest, next
      /* 从开头到第一个<出现的位置就都是文本内容了 */
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          /**
           * 用'<'以后的内容rest去匹配endTag、startTagOpen、comment、conditionalComment
           * 如果都匹配不上，表示'<'是属于文本本身的内容
           */
          // 在'<'之后查找是否还有'<'
          // 后面这个1代表要找第二个 ‘<’
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        } // 
        // 开始到< 之间是纯文本
        text = html.substring(0, textEnd)
      }
      // 整个模板字符串里没有找到`<`,说明整个模板字符串都是文本
      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }
      // 把截取出来的text转化成textAST
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }

    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    const start = html.match(startTagOpen)
    /* 如果存在开始标签 */
    /*   // '<div></div>'.match(startTagOpen)  => ['<div','div',index:0,input:'<div></div>'] */
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      /* 移动游标到标签属性的位置 */
      advance(start[0].length)
      let end, attr
      /* 提取所有的属性包含 v-bind等等 */
      /**
       * <div a=1 b=2 c=3></div>
       * 从<div之后到开始标签的结束符号'>'之前，一直匹配属性attrs
       * 所有属性匹配完之后，html字符串还剩下
       * 自闭合标签剩下：'/>'
       * 非自闭合标签剩下：'></div>'
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        attr.start = index
        // 继续移动游标
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      // startTagClose处理闭合标签的
      /* 根据匹配结果的end[1]是否是""我们即可判断出当前标签是否为自闭合标签 */
      /**
       * 这里判断了该标签是否为自闭合标签
       * 自闭合标签如:<input type='text' />
       * 非自闭合标签如:<div></div>
       * '></div>'.match(startTagClose) => [">", "", index: 0, input: "></div>", groups: undefined]
       * '/><div></div>'.match(startTagClose) => ["/>", "/", index: 0, input: "/><div></div>", groups: undefined]
       * 因此，我们可以通过end[1]是否是"/"来判断该标签是否是自闭合标签
       */
      if (end) {
        // 下面是对自闭合标签的处理
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  /* 再处理一下提取出来的标签属性数组 */
  function handleStartTag (match) {
    const tagName = match.tagName /* 开始标签的标签名 */
    const unarySlash = match.unarySlash /* 是否为自闭合标签的标志，自闭合为"",非自闭合为"/" */

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash /* 布尔值，标志是否为自闭合标签 */

    const l = match.attrs.length /* match.attrs 数组的长度 */
    const attrs = new Array(l)  /* 一个与match.attrs数组长度相等的数组 */
    /* 循环处理提取出来的标签属性数组match.attrs */
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      /* 接着定义了shouldDecodeNewlines，这个常量主要是做一些兼容性处理， 
      如果 shouldDecodeNewlines 为 true，意味着 Vue 在编译模板的时候，
      要对属性值中的换行符或制表符做兼容处理。
      而shouldDecodeNewlinesForHref为true 意味着Vue在编译模板的时候，
      要对a标签的 href属性值中的换行符或制表符做兼容处理。 */
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      
      // 将处理好的结果存入之前定义好的与match.attrs数组长度相等的attrs数组中
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }
    // 如果该标签是非自闭合标签，则将标签推入栈中
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }
    // 如果该标签是自闭合标签，现在就可以调用start钩子函数并传入处理好的参数来创建AST节点了
    if (options.start) {
      // 开始调用start函数，生成AST
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }


  /* 
    解析结束标签
    这个函数主要是调用了end函数
  
  */
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
