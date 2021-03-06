/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  /* set 在这里设置的 */
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // Vue.observable = <T>(obj: T): T => {
  //   observe(obj)
  //   return obj
  // }
  /* 
    定义了一个options空对象
    options里面定义了 directives 空对象
    directives 就是用来存放指令的位置
  */
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 这里后面要用到
  Vue.options._base = Vue
  


  // 这里扩展内置组件<transition>
  /* 
    把<keep-alive>、<transition> 和<transition-group> 组件
    扩展到Vue.options.components上，这样在所有的组件里都可以使用啦
  */
  extend(Vue.options.components, builtInComponents)


  // Vue.use
  initUse(Vue)

  // Vue.mixin
  initMixin(Vue)
  // Vue.extend
  initExtend(Vue)

  /* 
  
  组件注册 
  Vue.component

  Vue.directive

  Vue.filter
  
  */
  initAssetRegisters(Vue)
}
