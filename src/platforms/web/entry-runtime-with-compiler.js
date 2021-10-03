/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

/* 这个地方要注意
  里面定义了Vue.prototype.$mount
*/
import Vue from './runtime/index'

import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  /* 调用query方法，也就是说，如果el是个字符串，那就document.querySelector, 
    否则就直接返回
  */
  el = el && query(el)
  /* istanbul ignore if */
  /* 不能直接挂载到body或者HTML上上 */
  /* 
    Vue模板中的内容将会替换el 对应的DOM元素
    如果是body或者HTML会破坏文档流
  */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  /* 
    如果没有写render,就获取template，编译成render函数
  */
  if (!options.render) {
    let template = options.template
    if (template) {
      /* 如果写了template 那么走下面的 */
      /* 如果手写了，就用下面这个值， 如果没有手写，那么就用el 去获取 */
      if (typeof template === 'string') {
        /* 如果变量template存在，则接着判断如果template是字符串并且以##开头，
        则认为template是id选择符 */
        if (template.charAt(0) === '#') {
          /* 用idToTemplate函数获取到选择符对应的DOM元素的innerHTML作为模板 */
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        /* 判断是不是一个DOM元素，如果是的话，就返回innerHTML */
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      /* 
        如果没有template这个options
        那么就根据el ，获取外部模板
      */
      template = getOuterHTML(el)
    }

    if (template) {
      /* 上面模板已经准备好了，接下来，就是把模板编译成render函数 */
      /* 下面就是关键的编译了 */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }
      /* 
        主要在compileToFunctions这个函数中进行的
        返回render这个函数，
        然后挂载到options上面  
      */
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)

      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  /* mount 就是runtime里面的 $mount */
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML /* 注意这里，返回的其实是字符串 */
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
