/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 */
export function resolveFilter (id: string): Function {
  /* 调用resolveAsset 获取返回值 或者 返回identity */
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
