/**
 * 异步处理中间件
 * 用于包装异步路由处理函数，自动捕获异常并传递给错误处理中间件
 */

/**
 * 异步处理包装器
 * @param {Function} fn - 异步处理函数
 * @returns {Function} - Express中间件函数
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // 确保fn返回一个Promise
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
