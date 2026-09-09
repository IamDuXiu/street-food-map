import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { hashPassword } from '../lib/server/auth';
async function main() {
  const rl = createInterface({ input, output });
  const password = await rl.question('New admin password (12+ chars recommended): ');
  rl.close();
  if (password.length < 10) { console.error('Password must be at least 10 characters.'); process.exit(1); }
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
  console.log('Copy this line into your local .env.local. The password itself is never stored.');
}
main();
