/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}
/* 
文本解析器
  expression: "我叫"+_s(name)+"，我今年"+_s(age)+"岁了",
  tokens:[
    "我叫",
    {'@binding': name },
    "，我今年"
    {'@binding': age },
  "岁了"
  ] 
*/
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  // 这个正则表达式是用来检查文本中是否包含变量的
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  /* 判断text里面是否包含变量，不包含的话，直接return */
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  /* 
    开启while循环
    tagRE.exec 如果找到了一个匹配就返回数组，找不到匹配就返回null
  */
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      // // 先把'{{'前面的文本放入tokens中
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    const exp = parseFilters(match[1].trim())
    // 把变量exp改成_s(exp)形式也放入tokens中
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length
  } /* end while */
  // 当剩下的text不再被正则匹配上时，表示所有变量已经处理完毕
  /* 
    此时如果lastIndex < text.length，表示在最后一个变量后面还有文本,
    最后将后面的文本再加入到tokens中
  */
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
