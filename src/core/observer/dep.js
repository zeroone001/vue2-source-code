/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */

/* 
  Dep 类
  目的是，建立数据和watcher之间的一个桥梁
  dep 相当于对watcher的一个管理
  我们给每个数据都建立一个依赖数组，
  谁依赖了这个数据，那么就都放在这个数组里，当这个数据发生变化的时候，
  就去依赖数组中，把每个依赖都通知一遍，这个过程就是依赖收集

  注意，Dep里面还有一个target

  下面就是一个依赖管理器
*/
export default class Dep {
  // 全局的唯一watcher
  /* 
    临时存放了Watcher
  */
  static target: ?Watcher;
  id: number;
  // 是一个数组，里面放了watcher
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    /* 定义了一个数组，用来存放依赖 */
    this.subs = []
  }
  /* 添加 */
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }
  /* 删除 */
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
  // 收集dep
  /* 
    调用watcher里面的 dep.addSub(this)
  */
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  /* 通知 */
  notify () {
    /* 
      浅拷贝
    */
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    /* 
      遍历依赖， 执行update方法，
      从而更新视图
    */
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
