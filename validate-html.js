const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const selfClosing = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const regex = /<\/?([a-zA-Z0-9\-]+)([^>]*)>/g;
const stack = [];
let m;
while ((m = regex.exec(html)) !== null) {
  const whole = m[0];
  const tag = m[1].toLowerCase();
  const isEnd = whole.startsWith('</');
  const isSelf = selfClosing.has(tag) || /\/\s*>$/.test(whole);
  if (isEnd) {
    if (!stack.length) {
      console.log('Unmatched closing tag', tag, 'at index', m.index);
      continue;
    }
    const last = stack.pop();
    if (last.tag !== tag) {
      console.log('Mismatch: opened', last.tag, 'at index', last.index, 'but closed', tag, 'at index', m.index);
    }
  } else if (!isSelf) {
    stack.push({ tag, index: m.index });
  }
}
if (stack.length) {
  console.log('Unclosed tags count', stack.length);
  stack.slice(-20).forEach(item => console.log('Unclosed', item.tag, 'at', item.index));
} else {
  console.log('No unclosed tags found.');
}
