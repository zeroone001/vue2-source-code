/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0


/* 
  这里的这个options是指，用户new Vue({}) 实例化的时候，里面的这个对象
  initMixin 函数只做了一件事，就是在Vue的原型上绑定_init 方法
*/
export function initMixin (Vue: Class<Component>) {

  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    /* 下面这个if是用来做合并配置的 */
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.

      /* createComponent 的时候，会走到这个步骤里面来 */
      /* 组件初始化的时候的合并 */
      initInternalComponent(vm, options)

    } else {
      /* 
        resolveConstructorOptions 这个函数实际上是返回了大Vue的options
        实际上是定义在globalAPI 里面的
      */
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }




    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      // 生产环境中， _renderProxy 就相当于 vm, 这里在render的时候使用了_renderProxy
      vm._renderProxy = vm
    }

    // expose real self
    vm._self = vm
    /* 下面是一堆初始化函数， 来初始化一些属性，方法等 */
    /* 初始化生命周期 */
    initLifecycle(vm)
    // 初始化事件
    initEvents(vm)
    /* 关键 render  */
    initRender(vm)
    // 触发生命周期钩子函数
    callHook(vm, 'beforeCreate')
    
    initInjections(vm) // resolve injections before data/props
    /* 
      data, props, computed, methods, watch 等等 
    */
    initState(vm)
    // 初始化 provide
    // resolve provide after data/props
    initProvide(vm) 
    // 触发生命周期钩子函数
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    /* 
        如果不直接写 $mount 的话， 那么这里是代码挂载的开始
        关键的关键
        在所有的初始化工作都完成以后，最后，会判断用户是否传入了el选项，
        如果传入了则调用$mount函数进入模板编译与挂载阶段，
        如果没有传入el选项，则不进入下一个生命周期阶段，
        需要用户手动执行vm.$mount方法才进入下一个生命周期阶段。
    */
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
    // end
  }


}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/* 
  函数作用： 解决全局mixin, 初始化的时候
*/
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
