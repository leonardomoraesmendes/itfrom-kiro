import { buildApp } from './app';

async function main() {
  const app = await buildApp();

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  console.log(`AP Automation API running at http://${host}:${port}`);
  console.log(`OpenAPI docs at http://${host}:${port}/docs`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
