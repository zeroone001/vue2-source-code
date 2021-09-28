/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype

/* 继承自Array原型的对象 */
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
/* def 作用是定义一个property */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  /* 将7个方法逐个封装 */
  def(arrayMethods, method, function mutator (...args) {
    /* 执行了原生方法 */
    const result = original.apply(this, args)
    const ob = this.__ob__
    /* 
      可以向数组内新增元素的方法有3个，分别是：push、unshift、splice。
      我们只需对这3中方法分别处理，拿到新增的元素，再将其转化即可
      为什么要写下面这个代码，因为我们新增的元素可能是对象，
      我们要深度侦测这个对象
     */
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    /* 
      这里很关键， 通知watcher更新
     */
    ob.dep.notify()
    return result
  })
})
