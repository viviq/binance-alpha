// 全局未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 启动应用
try {
  require('./app');
  console.log('应用启动成功');
} catch (error) {
  console.error('应用启动失败:', error);
  process.exit(1);
}