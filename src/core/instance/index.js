import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)

/* 下面的函数，都是设置实例上的方法 */
/* 
  stateMixin 函数
  在Vue.prototype 上定义了方法
  
  $data
  $props
  $set
  $delete
  $watch
*/
stateMixin(Vue)

// 分别是vm.$on、vm.$emit、vm.$off和vm.$once
eventsMixin(Vue)


/* 下面都是往prototype上定义一些方法 */
/* 
  主要定义了 vm._update
  $forceUpdate
  $destroy
   */
lifecycleMixin(Vue)

/* 
  在这里定义的 vm._render， 用于渲染DOM结构的
  $nextTick 也是在这里定义的
*/
renderMixin(Vue)

export default Vue
