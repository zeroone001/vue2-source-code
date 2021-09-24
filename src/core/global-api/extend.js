/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  Vue.extend = function (extendOptions: Object): Function {
    // 用户传入的一个包含组件选项的对象参数
    extendOptions = extendOptions || {}
    // 指向父类，即基础 Vue类
    const Super = this
    // 父类的cid属性，无论是基础 Vue类还是从基础 Vue类继承而来的类，都有一个cid属性，作为该类的唯一标识
    const SuperId = Super.cid
    // 缓存池，用于缓存创建出来的类
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    // 获取name字段
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      // 校验name是否合法
      validateComponentName(name)
    }

    /* 
      创建一个Sub类，这个类就是继承基础Vue的子类
    */
    const Sub = function VueComponent (options) {
      // 调用Vue基础的init 函数
      this._init(options)
    }
    // 将父类的原型继承到子类上
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    // 添加唯一标识
    Sub.cid = cid++
    // 合并options
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 将父类保存到子类的super中，保证能够拿到父类
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    /* 如果存在props，那么初始化它 */
    if (Sub.options.props) {
      initProps(Sub)
    }
    /* 存在计算属性，那么也是初始化她 */
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    /* 将父类上的一些属性方法复制到了子类上 */
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    /* 给子类新增三个独有的属性 */
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    /* 最后使用父类的cid作为key，创建好的子类作为value，放到缓存池子中 */
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

/* 其实就是把options里的props代理到原型的_props上 */
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
