/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // _installedPlugins 用来存储已经安装过的插件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    /* 之前安装过，就不再安装 */
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    /* 
      把参数转化为数组，
      同时，把Vue放到数组的第一个位置 
    */
    const args = toArray(arguments, 1)
    args.unshift(this)

    // 传入的是对象，有install属性
    if (typeof plugin.install === 'function') {

      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 直接传入了一个函数
      plugin.apply(null, args)
    }
    /* 把插件放到插件列表中，完成 */
    installedPlugins.push(plugin)
    return this
  }
}
