/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const entry: ?CacheEntry = cache[key]
    if (entry) {
      const name: ?string = entry.name
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

/*
 定义了一个keep-alive 的组件 
 这里面没有template标签，但是有一个render函数
 不是模板组件，而是一个函数式的组件
*/
export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    // 表示只有匹配到的组件会被缓存
    include: patternTypes, 
    // 表示任何匹配到的组件都不会被缓存
    exclude: patternTypes,
    // 表示缓存组件的数量
    max: [String, Number]
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this

      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        }
        keys.push(keyToCache)
        // prune oldest entry
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created () {
    // 两个属性： this.cache 和 this.keys
    /* 
      this.cache = {
          'key1':'组件1',
          'key2':'组件2',
          // ...
      }
      用来存储需要缓存的组件
      keys 用来存储需要缓存的组件的key
    */
    this.cache = Object.create(null)
    this.keys = []
  },
  /* 销毁缓存的组件 */
  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.cacheVNode()
    /* 监听变化 */
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  /* 
    重头戏render
  */
  render () {
    /* 
      获取第一个子组件的VNode 
    */
    const slot = this.$slots.default
    const vnode: VNode = getFirstComponentChild(slot)

    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    
    if (componentOptions) {
      // check pattern
      /* 获取组件节点的名称 */
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      /* 如果name跟include不匹配，或者，exclude规则匹配，就不缓存，直接返回 vnode */
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      /* 下一步进行缓存 */

      const { cache, keys } = this
      
      /* 获取组件的key */
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      /* 
        如果命中了缓存，直接从缓存中拿出组件实例
      */
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        /* 调整该组件key的顺序，将其从原来的地方删掉并重新放在最后一个  */
        remove(keys, key)
        keys.push(key)
      } else {
        /* 如果没有命中缓存，则将其设置进缓存 */
        // delay setting the cache until update
        this.vnodeToCache = vnode
        this.keyToCache = key
      }
      /* 最后设置keepAlive标记位 */
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
