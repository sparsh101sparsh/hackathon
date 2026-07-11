import { createDecision } from './index';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const index = process.argv[2] || '0';
  
  for (let i = 0; i < 10; i++) {
    await createDecision({
      decisionName: `Concurrent Decision ${index}-${i}`,
      goalId: 'goal-1',
      agent: 'PM',
      decisionStatus: 'Approved',
      timestamp: new Date().toISOString(),
      reasoning: `Concurrent run by process ${index}, iteration ${i}`
    });
    // Introduce a small random delay to allow other processes to interleave
    await delay(Math.floor(Math.random() * 50));
  }
}

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});

