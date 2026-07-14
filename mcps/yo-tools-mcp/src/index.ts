const { main } = await import('./main.ts');
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
