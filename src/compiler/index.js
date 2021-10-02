/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // parse 会用正则等方式解析 template 模板中的指令、class、style等数据，形成AST
  // 解析器
  const ast = parse(template.trim(), options)

  /*
   标记静态节点
    这是 Vue 在编译过程中的一处优化，挡在进行patch 的过程中， 
    DOM-Diff 算法会直接跳过静态节点，从而减少了比较的过程，优化了 patch 的性能。
   */
  // 优化器
  /* 
    这是优化阶段： 遍历AST，找出静态节点，打上标记
  */
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  /* 将 AST 转化成 render函数字符串的过程，
  得到结果是 render函数 的字符串以及 staticRenderFns 字符串 */
  // 代码生成器
  const code = generate(ast, options)
  return {
    ast,
    render: code.render, // render函数 的字符串
    staticRenderFns: code.staticRenderFns // (静态渲染函数) staticRenderFns 字符串 
  }
})
