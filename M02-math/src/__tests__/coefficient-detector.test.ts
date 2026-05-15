import { detectAndMergeCoefficients } from '@/engine/coefficientDetector';
import { preprocessExpression } from '@/engine/expressionEngine';

function assert(name: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

function names(expr: string): string[] {
  return (detectAndMergeCoefficients(expr, []) ?? []).map((p) => p.name);
}

const builtins = names('sin(x)+cos(x)+tan(x)+sqrt(x)+abs(x)+log(x)');
assert('builtin function names are not detected as coefficients', builtins.length === 0);

const params = names('a*cos(x)+b*sin(x)+c');
assert(
  'actual coefficients around function calls are still detected',
  params.join(',') === 'a,b,c',
);

assert('absolute value pipes are converted to abs()', preprocessExpression('|x|') === 'abs(x)');
assert('implicit multiplication before absolute value is preserved', preprocessExpression('2|x|') === '2*abs(x)');
assert('builtin function before absolute value treats bars as its argument', preprocessExpression('sin|x|') === 'sin(abs(x))');
