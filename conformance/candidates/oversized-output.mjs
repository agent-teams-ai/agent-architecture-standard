process.stdin.resume();
process.stdin.once('data', () => process.stdout.write('x'.repeat(8192)));
