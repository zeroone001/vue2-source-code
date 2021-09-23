/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */

 /* 把被观察数据内部所有的值都递归的读取一遍后，
 那么这个watcher实例就会被加入到对象内所有值的依赖列表中，
 之后当对象内任意某个值发生变化时就能够得到通知了 */

/* 
  这个方法单独写了一个文件
  将每个属性都【读取】一遍
*/
export function traverse (val: any) {
  _traverse(val, seenObjects)
  // 用来清空Set对象中的所有的元素
  seenObjects.clear()
}

/* 
  这个函数其实就是一个递归遍历的过程
  把被观察的数据内部的值都遍历递归一遍
*/
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 如果它不是Array或object，再或者已经被冻结，那么直接返回
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  /* 保证ID没有重复
    Set去重
  */
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  /* 
    如果是数组， 循环数组，并且每一项递归调用_traverse

  */
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
