process.stdin.resume();
process.stdin.once('data', () => {
  process.stdout.write('not-json\n');
  setInterval(() => {}, 1000);
});
