import { listOutbox } from './src/modules/messaging/queries';

async function main() {
  try {
    const groups = await listOutbox();
    console.log('OK', Object.fromEntries(Object.entries(groups).map(([k,v]) => [k, v.length])));
  } catch (e) {
    console.error('THREW:', e);
  }
}
main();
