/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

/* 
  eventsMixin 下面代码都是这个方法的
  分别是vm.$on、vm.$emit、vm.$off和vm.$once
*/
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      /* 
        主要是这个，
        这个_events属性就是用来作为当前实例的事件中心，
        所有绑定在这个实例上的事件都会存储在事件中心_events属性中
      */
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }
  // 先订阅事件，但是这个事件只能触发一次，就要被移除
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      // 先移除事件
      vm.$off(event, on)
      // 执行函数
      fn.apply(vm, arguments)
    }
    // 用于移除事件off时候使用
    on.fn = fn
    // 订阅事件
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    /* 
      如果没有传参数的话，
      就吧_events设置为空，
      把事件监听都清空
    
    */
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    /* 
      如果事件是个数组的话，
      遍历数组，递归调用off方法，移除事件监听就好了
    */
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    // 如果没有回调函数，说明没有需要off的事件
    if (!cbs) {
      return vm
    }
    // 用户没有传fn的话，直接全部设置成null
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    /* 
      如果同时提供了事件与回调，则只移除这个回调的监听器。那么我们只需遍历所有回调函数数组cbs，
      如果cbs中某一项与fn相同，或者某一项的fn属性与fn相同，那么就将其从数组中删除即可
    */
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      // toArray 把类数组转化为真实的数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        // invokeWithErrorHandling
        /* 
          这个函数就是封装了 apply 和 call， 加上error的判断
          触发函数调用
        */
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
