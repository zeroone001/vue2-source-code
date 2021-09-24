/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

/* 总的来说，是做了一个存储指令的操作，真正执行不是在这里 */
export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {

    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {

      /* 
        definition 没有传入的话，就是获取指令 
        传入了的话，就是注册指令
      */
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          /* 对组件的名字做了一个校验 */
          validateComponentName(id)
        }

        /* 
          Vue.component
          对component做处理
          如果是个对象，那么使用Vue.extend 将其变成Vue的子类
        */
        if (type === 'component' && isPlainObject(definition)) {
          // 优先使用name
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }

        /* 注册指令 */
        if (type === 'directive' && typeof definition === 'function') {
          /* 注册完成指令， */
          definition = { bind: definition, update: definition }
        }

        /* 
          this.components[id] = APP;
          在options上存储指令
          filter直接存进去
        */
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
