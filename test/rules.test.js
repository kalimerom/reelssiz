// Kural doğrulayıcıyı ve rules.json'un varsayılan kurallarla aynı olduğunu sınar.
// Çalıştırma: node test/rules.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');

function load(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2019' } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
  return mod.exports;
}
const { DEFAULT_RULES } = load('rules.ts');
const { validateRules } = load('rulesValidate.ts');

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('GEÇTİ  ' + name); } catch (e) { failed++; console.log('KALDI  ' + name + ' -> ' + e.message); }
}
const clone = () => JSON.parse(JSON.stringify(DEFAULT_RULES));
const withField = (k, v) => ({ ...clone(), [k]: v });

check('rules.json ile DEFAULT_RULES aynı', () => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8'));
  assert.deepStrictEqual(json, DEFAULT_RULES);
});
check('rules.json doğrulamadan geçer', () => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8'));
  assert.deepStrictEqual(validateRules(json), DEFAULT_RULES);
});
check('geçerli kurallar kabul', () => assert.deepStrictEqual(validateRules(clone()), DEFAULT_RULES));
check('bilinmeyen alanlar atılır', () => {
  const r = validateRules({ ...clone(), evil: 'x' });
  assert.ok(r && !('evil' in r));
});
for (const bad of [null, undefined, 5, 'x', [], true]) {
  check('nesne olmayan girdi reddedilir: ' + JSON.stringify(bad), () => assert.strictEqual(validateRules(bad), null));
}
check('eksik alan reddedilir', () => { const r = clone(); delete r.css; assert.strictEqual(validateRules(r), null); });
check('sürüm metin ise reddedilir', () => assert.strictEqual(validateRules(withField('version', '2')), null));
check('sürüm kesirli/negatif/NaN reddedilir', () => {
  for (const v of [1.5, -1, NaN, Infinity]) assert.strictEqual(validateRules(withField('version', v)), null);
});
check('metin alanı sayı ise reddedilir', () => assert.strictEqual(validateRules(withField('postSelector', 3)), null));
check('dizi alanı metin ise reddedilir', () => assert.strictEqual(validateRules(withField('navHide', 'a')), null));
check('dizide sayı varsa reddedilir', () => assert.strictEqual(validateRules(withField('navHide', ['a', 1])), null));
check('çok uzun metin reddedilir', () => assert.strictEqual(validateRules(withField('postSelector', 'a'.repeat(2001))), null));
check('çok uzun dizi öğesi reddedilir', () => assert.strictEqual(validateRules(withField('suggestedTexts', ['a'.repeat(2001)])), null));
check('çok fazla öğe reddedilir', () => assert.strictEqual(validateRules(withField('navHide', Array(51).fill('a'))), null));
check('geçersiz düzenli ifade (reelPath) reddedilir', () => assert.strictEqual(validateRules(withField('reelPath', '([')), null));
check('geçersiz düzenli ifade (blockedPaths) reddedilir', () => assert.strictEqual(validateRules(withField('blockedPaths', ['^/ok$', '(unclosed'])), null));
check('geçersiz düzenli ifade (feedPaths, explorePaths) reddedilir', () => {
  assert.strictEqual(validateRules(withField('feedPaths', ['*'])), null);
  assert.strictEqual(validateRules(withField('explorePaths', ['[a'])), null);
});
check('home "/" ile başlamıyorsa reddedilir', () => assert.strictEqual(validateRules(withField('home', 'https://evil.example')), null));

console.log(failed ? `\n${failed} test kaldı` : '\nTüm kural testleri geçti');
process.exit(failed ? 1 : 0);
