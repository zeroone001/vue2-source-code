/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/* 
  附加到每个观察对象的观察者类
  收集依赖，并发送更新
  听过递归的方式，把一个对象的所有属性转化为可观测的对象
  只要我们将一个object传到observer中，那么这个object就会变成可观测的、响应式的object
*/
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data
  constructor (value: any) {
    this.value = value
    /* 

    */
    this.dep = new Dep()
    this.vmCount = 0
    /* 
      def 就是用defineProperty 封装一下
      给value添加一个属性，值就是这个实例
      __ob__ 这个属性就是不可以枚举的
      到时候在下面遍历的时候，就不会有影响了
      相当于给value打上标记，表示已经被转化成响应式了，避免重复操作
    */
    def(value, '__ob__', this)
    /* 
      开始判断数据的类型
      只有object类型的数据才会调用walk将每一个属性转换成getter/setter的形式来侦测变化
      注意这里，因为Object.defineProperty 是针对对象的，数组是无法使用这个方法的
      所以，走的是另外的变化机制
    */
    if (Array.isArray(value)) {
      // 判断对象上是否有原型，也就是说，判断浏览器支持原型链不
      if (hasProto) {
        // 把方法放在这个数组的原型链上
        // 其实是改写了这个数组上的方法，这样的话使用push就会变化
        /* 
          把重写的一些方法，挂载到数组的原型链上
        */
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      //  对数组深度侦测
      this.observeArray(value)
    } else {
      // data 是个对象
      // 给每个属性加上响应式
      this.walk(value)
    }
  }

  /**
    遍历所有的key，然后执行defineReactive
    当值还是object的时候，再使用new Observer进行递归
    这样我们就可以把obj中的所有属性（包括子属性）都转换成getter/seter的形式来侦测变化
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * 对数组深度侦测，如果数组的元素是对象，也能侦测到
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      /* 给那些元素是对象的item，加上Observer */
      observe(items[i])
    }
  }

}
// helpers
/**
  挂载，把重写后的方法，挂载到原型链上
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */

/* 
    创建观察者实例
    观察成功，返回新的观察者
    或者现有的观察者
*/
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  /* 有__ob__的话，表示已经是响应式了 */
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 存在的话，就直接返回
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 不存在的话，就new一个观察者实例
    /* 
      递归调用
    */
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {

  /* 
    实例化一个依赖管理器，生成一个依赖管理的数组dep
  */
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  /* 
    如果值是对象的话，对val进行递归调用
    这里主要是解决child的观察
    利用了递归
  */
  let childOb = !shallow && observe(val)
  /* 
    defineProperty
  */
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    /* 
      这里就是传说中的getter 和 setter了
      在get中收集依赖
    */
    get: function reactiveGetter () {
      /* get 部分 */
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        /* 
        依赖收集
        调用watcher的addDep方法
        使用depend收集依赖
        */
        dep.depend()
        /* 下面这个比较关键 */
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value

    },
    set: function reactiveSetter (newVal) {
      /* 在set里面通知依赖更新 */
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      /* 
        新旧值进行对比
      */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      /* 
        会对新设置的值变成一个响应式对象
      */
      childOb = !shallow && observe(newVal)
      /* 
        派发更新
        这是关键
        通知所有依赖更新
      */
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {

  /* 首先判断在非生产环境下如果传入的target是否为undefined、null或是原始类型，如果是，则抛出警告 */
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }

  /* 判断是不是一个数组，并且判断key 是否正确 */
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    /* 
      取最大的值作为数组新的长度
      先修改了数组的长度 
    */
    target.length = Math.max(target.length, key)
    // 将元素添加进数组里面
    /* 
      为什么这里就这么简单结束了呐
      因为splice方法被我们的拦截器重写了
      也就是说，当我们使用splice，往数组内添加元素的时候，这个元素自动变成响应式的
    */
    target.splice(key, 1, val)
    return val
  }

  /* 
    先判断在不在这个对象里，并且不能在原型上，
    如果存在的话，直接修改属性值就行了
  */
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  /* ob 是否为true 决定target是否为响应式对象 */
  const ob = (target: any).__ob__

  /* 如果是Vue实例，或者是根数据对象，就会报错 */
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  /* 
    这里判断，这个target 是不是响应式的，
    不是的话，直接设置值， 
    不用将属性设置为响应式的
  */
  if (!ob) {
    target[key] = val
    return val
  }

  /* 
    前面代码是铺垫
    下面两行是关键 
  */
  // 添加属性，并且转化为响应式
  defineReactive(ob.value, key, val)
  // 通知依赖更新
  ob.dep.notify()

  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 因为数组的splice方法已经被我们创建的拦截器重写了，所以使用该方法会自动通知相关依赖
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  // 删除属性
  delete target[key]
  // 如果不是响应式的对象，就简单的删除一下属性
  if (!ob) {
    return
  }
  // 通知依赖更新
  ob.dep.notify()
}


/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
