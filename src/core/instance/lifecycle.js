/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}

/* 
  代码不多
  主要是挂载了一些默认属性
  $parent
  $root
*/
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)

    /* 渲染VNode */
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {
      // initial render

      // patch 关键函数，把虚拟DOM插入到真实DOM上
      /* 这是初始化的patch */
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)

    } else {
      // updates
      /* 这是更新的patch */
      vm.$el = vm.__patch__(prevVnode, vnode)
    }

    restoreActiveInstance()
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  /* 
    当前实例的_watcher属性就是该实例的watcher，所以要想让实例重新渲染，
    我们只需手动的去执行一下实例watcher的update方法即可
  */
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }
/* 
  生命周期，销毁阶段
*/
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    /* 
      判断当前实例是否处于正在被销毁的阶段
      如果是TRUE，直接return退出
     */
    if (vm._isBeingDestroyed) {
      return
    }
    /* 标志着正式进入销毁阶段 */
    callHook(vm, 'beforeDestroy')
    /* 设置为TRUE */
    vm._isBeingDestroyed = true
    /* 
      目的，从父级实例中删除
    */    
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      /* 如果有父实例，父级实例没有被销毁，并且不是抽象的，那么就把vm移除 */
      remove(parent.$children, vm)
    }

    // 将实例自身从其他数据的依赖列表中删除
    if (vm._watcher) {
      /* teardown方法的作用是从所有依赖向的Dep列表中将自己删除 */
      vm._watcher.teardown()
    }
    /* 
    所有实例内的数据对其他数据的依赖都会存放在实例的_watchers属性中，
    所以我们只需遍历_watchers，
    将其中的每一个watcher都调用teardown方法，
    从而实现移除实例内数据对其他数据的依赖。
     */
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // 移除实例内响应式数据的引
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // 给当前实例上添加_isDestroyed属性来表示当前实例已经被销毁，
    vm._isDestroyed = true
    // 同时将实例的VNode树设置为null
    vm.__patch__(vm._vnode, null)
    // 触发生命周期钩子函数destroyed
    callHook(vm, 'destroyed')
    // 移除实例上的所有事件监听器
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

/* 
$mount 的最后执行函数
挂载函数，
beforeMount 就在这里
*/
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el

  /* 
    判断是否存在render函数，
    如果不存在的话，就创建一个默认的渲染函数createEmptyVNode
  */
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  /* 
    触发beforeMount生命周期钩子函数
    标志着正式开始挂载操作
  */
  callHook(vm, 'beforeMount')
  /* 下面这段代码是指性能分析performance */
  let updateComponent
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    /* 
      关键中的关键 
      vm._render() 生成虚拟DOM
      vm._update() 来更新DOM
      定义函数updateComponent
      先执行vm._render()， 得到最新的VNode节点树
      然后执行vm._update，
      对最新的VNode节点树与上一次渲染的旧VNode节点树进行对比并更新DOM节点(即patch操作)，
      完成一次渲染
    */
   /* 
    如果调用了函数updateComponent，就会把模板内容渲染到页面视图上
   */
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }
  /* 
    渲染watcher
    不仅要渲染视图，还要开启对数据的监控
    当数据发生变化的时候，要通知其依赖进行更新
    想要开启监控，下面这行代码是关键
   */
  /* 把updateComponent函数作为第二个参数传给Watcher类从而创建了watcher实例，
  那么updateComponent函数中读取的所有数据都将被watcher所监控，
  这些数据中只要有任何一个发生了变化，
  那么watcher都将会得到通知，
  从而会去调用第四个参数回调函数去更新视图
  ，如此反复，直到实例被销毁。 */
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)

  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    vm._isMounted = true
    /* 
      挂载完成的时候
    */
  //  到这里，挂载阶段也就完成了
    callHook(vm, 'mounted')
  }
  // 把实例返回
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren.

  // check if there are dynamic scopedSlots (hand-written or compiled but with
  // dynamic slot names). Static scoped slots compiled from template has the
  // "$stable" marker.
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key) ||
    (!newScopedSlots && vm.$scopedSlots.$key)
  )

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  const needsForceUpdate = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    hasDynamicScopedSlot
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  listeners = listeners || emptyObject
  const oldListeners = vm.$options._parentListeners
  vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, oldListeners)

  // resolve slots + force update if has children
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}
/* 
  callhook 函数，
  触发生命周期钩子函数
  比较简单，就是遍历数组，执行钩子函数
*/
export function callHook (vm: Component, hook: string) {
  // #7573 disable dep collection when invoking lifecycle hooks
  pushTarget()
  /* 
      handlers 这里其实是个数组
  */
  const handlers = vm.$options[hook]
  const info = `${hook} hook`
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      // 在这个函数里面执行call， 钩子函数
      /* 遍历数组，把每一个钩子函数都执行一遍 */
      invokeWithErrorHandling(handlers[i], vm, null, vm, info)
    }
  }
  if (vm._hasHookEvent) {
    /* 这里触发hook， 是不是在这里挂载的 */
    vm.$emit('hook:' + hook)
  }
  popTarget()
}
