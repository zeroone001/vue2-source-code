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
stateMixin(Vue)
eventsMixin(Vue)


/* 下面都是往prototype上定义一些方法 */
/* 主要定义了 vm._update */
lifecycleMixin(Vue)

/* 
  在这里定义的 vm._render， 用于渲染DOM结构的
  $nextTick 也是在这里定义的
*/
renderMixin(Vue)

export default Vue
