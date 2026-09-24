process.env.VONG_DEMO = '1';

const { build } = await import('vite');
await build();
