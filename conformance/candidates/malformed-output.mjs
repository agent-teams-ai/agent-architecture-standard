process.stdin.resume();
process.stdin.once('data', () => process.stdout.write('not-json\n'));
