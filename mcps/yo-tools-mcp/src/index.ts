import { checkDeps } from './check-deps.ts';

// 先检查依赖，再启动服务
checkDeps();

const { main } = await import('./main.ts');
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
