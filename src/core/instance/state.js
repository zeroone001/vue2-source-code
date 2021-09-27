/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  /* 
    用来存储当前实例的
    Vue不再对所有数据都进行侦测，
    而是将侦测粒度提高到了组件层面，
    对每个组件进行侦测，所以在每个组件上新增了vm._watchers属性
    ，用来存放这个组件内用到的所有状态的依赖，当其中一个状态发生变化时，
    就会通知到组件，
    然后由组件内部使用虚拟DOM进行数据比对，
    从而降低内存开销，提高性能。
  */
  vm._watchers = []
  /* 
    下面这几个初始化，是有顺序的
    所有在data 里面可以使用props
  */
  const opts = vm.$options
  // 先判断实例中是否有props选项，如果有，就调用props选项初始化函数initProps去初始化props选项
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  /* 
    如果有data就初始化data,
    没有的话，就把data当做空对象，并将其转化成响应式
  */
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  /* 计算属性 */
  if (opts.computed) initComputed(vm, opts.computed)

  /* 监听属性 */
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/* 
  初始化 props
  这个函数，主要是把传过来的props的key,value 放到vm实例上，
  这样在组件里，可以直接this.访问到
*/
function initProps (vm: Component, propsOptions: Object) {
  /* 父组件传入的真实props对象 */
  const propsData = vm.$options.propsData || {}
  // 指向vm._props的指针，所有设置到props变量中的属性都会保存到vm._props中
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  /* 
    指向vm.$options._propKeys的指针，缓存props对象中的key，
    将来更新props时只需遍历vm.$options._propKeys数组即可得到所有props的key
   */
  const keys = vm.$options._propKeys = []
  /* 当前组件是否是根组件 */
  const isRoot = !vm.$parent
  // root instance props should be converted
  /* 
    如果不是根组件，就不需要转化为响应式
  */
  if (!isRoot) {
    toggleObserving(false)
  }
  /* 
    遍历 props
  */
  for (const key in propsOptions) {
    /* _propKeys存入key */
    keys.push(key)
    /* 校验数据类型是否匹配，并且，取出父组件传过来的值 */
    const value = validateProp(key, propsOptions, propsData, vm)

    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      /* 
        把键值放到vm._props中
      */
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      /* 
        把键值放到vm._props中
      */
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    /* 
      判断这个key在当前实例中是否存在
      如果不存在，则调用proxy函数在vm上设置一个以key为属性的代码，
      当使用vm[key]访问数据时，其实访问的是vm._props[key]
    */
    if (!(key in vm)) {
      /* 代理this.key === this._props.key */
      proxy(vm, `_props`, key)
    }
  }
  /* 再把defineReactive开关打开 */
  toggleObserving(true)
}

/* 
  初始化 data
  1. 判断data 是否合法
  2. 转化成响应式
  3. 绑定到vm实例上，也就是proxy代理
*/
function initData (vm: Component) {

  /* 获取data，建议使用函数的形式，挂载到_data上 */
  let data = vm.$options.data
  /* 
    如果是工厂函数，就执行，获取返回值
  */
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}


  /* 
    判断是不是一个对象，否则就报错
    data函数的返回值需要是一个对象，否则就会报错
    无论传入的data选项是不是一个函数，它最终的值都应该是一个对象
   */
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  /* 
    下面是用来判断，data ,props, 还有methods 不能重名
  */
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {

      if (methods && hasOwn(methods, key)) {
        /* 是否跟methods重名 */
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }

    if (props && hasOwn(props, key)) {
      /* 是否跟props重名 */
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      /* 判断key不是 _或者$ 开头的属性 */
      /* 
        代理key
        this.key === this._data.key
      */
      proxy(vm, `_data`, key)
    }
  }
  /* 
    观察者 到了
    把data 里面的属性转化为响应式
  */
  observe(data, true /* asRootData */)
}
/* 
  getData 执行传入的函数，返回值
*/
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

/* 
  计算属性的初始化
  计算属性的结果会被缓存
 */
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()
  /* 
    开始遍历computed里面的每一项属性

  */
  for (const key in computed) {
    // 拿到key对应的值
    const userDef = computed[key]
    // 判断是不是函数，当然也可以是对象，平时写函数是比较多的
    /* 如果不是函数，就吧对象里的get返回 */
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    /* 这里正常来说getter 是个undefined，但是用了两个等号，所以undefined == null 为TRUE */
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    // 这个位置是关键
    if (!isSSR) {
      // create internal watcher for the computed property.
      /* 
        创建一个watcher实例
        并且放到对象watchers上面
      */
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }
    // 这里的意思是computed里面定义的key的名字是不能跟data或者props里面的key冲突的
    /* 
      判断这个key在不在实例上面
    */
    if (!(key in vm)) {
      // 下面进入关键代码
      // 为实例vm上设置计算属性
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      /* 下面三个判断就是判断在具体的哪个地方定义了相同的名字 */
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

// 作用是为target上定义一个属性key，并且属性key的getter和setter根据userDef的值来设置
/* 
  给实例vm上设置计算属性
  target , vm 实例
  key: computed的属性
  userDef： computed的值
*/
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 判断是否应该有缓存，只有在非服务器下，才是TRUE
  /* 只有在非服务器环境下才会有缓存 */
  const shouldCache = !isServerRendering()

  if (typeof userDef === 'function') {
    // sharedPropertyDefinition 是一个默认的属性描述符
    // 也就是说，在浏览器环境下，走了 createComputedGetter 函数
    // 因为userDef只是一个普通的getter，它并没有缓存功能，
    // 所以我们需要额外创建一个具有缓存功能的getter， createComputedGetter
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)

    sharedPropertyDefinition.set = noop

  } else {
    /* userDef为对象 */
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 属性key绑定到target上，其中的属性描述符就是上面设置的sharedPropertyDefinition。
  // 如此以来，就将 计算属性 绑定到实例 vm 上了
  // 属性key绑定到target上
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 这是，我们访问conputed的值的时候，出现的逻辑
/* 
  最终把computedGetter给到了属性描述符的get
*/
function createComputedGetter (key) {
  // 当获取计算属性的值时会执行属性的getter，而属性的getter就是 sharedPropertyDefinition.get，
  // 也就是说最终执行的 computedGetter函数
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      // 将evaluate方法的返回值作为计算属性的计算结果返回
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

/* 
  初始化方法
*/
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  /* 开始遍历methods */
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      /* 如果methods不是函数的话，就报错 */
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      /* methods如果跟props重名，就报错 */
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 如果在实例中已经存在，并且方法名是以_或$开头的，就抛出错误
      // isReserved函数是用来判断字符串是否以_或$开头
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    /* 把函数绑定到实例上 */
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}



/* 
  初始化所有的watch
  下面三个函数是watch相关的函数

*/
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]

    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

/* 
  对每一个watcher 进行create
  expOrFn 就是key
  handler
*/
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {

  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    // 把methods给到handler
    handler = vm[handler]
  }

  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }

  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  /* 
      作用： 定义$watch
      expOrFn 这个是watch的key
      cb 是watch的处理函数

      Watcher 定义在observe里面

  */
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this

    /* 判断是否是对象 */
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }

    options = options || {}
    options.user = true
    /* 这是关键代码，创建一个watcher实例 */
    const watcher = new Watcher(vm, expOrFn, cb, options)

    /* 立即执行监听函数 */
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
