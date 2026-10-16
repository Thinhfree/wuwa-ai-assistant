import assert from 'node:assert/strict';
import {buildGuide,guessCategory,cleanText,progressPercent,guideLinks,pickObjective} from '../logic.mjs';

assert.equal(guessCategory('Investigate the nearby mechanism'),'puzzle');
assert.equal(guessCategory('Defeat the enemies in the area'),'fight');
assert.equal(guessCategory('Talk to the keeper'),'dialogue');
assert.equal(guessCategory('Collect 3 materials'),'collect');
assert.equal(guessCategory('Go to Jinzhou'),'explore');
assert.equal(guessCategory('no recognizable target'), 'unknown');
assert.equal(pickObjective('Menu\nTalk to the person\nPress M to open map'),'Talk to the person');
assert.equal(cleanText('  ABC  \n\n  XYZ  '),'ABC\nXYZ');
const guide=buildGuide({title:'A Quest',ocr:'Defeat the enemies'});
assert.equal(guide.title,'A Quest');assert.equal(guide.type,'fight');assert.ok(guide.steps.length>=3);assert.equal(guide.source,'offline');
assert.equal(progressPercent([{done:true},{done:false},{done:true},{done:false}]),50);
assert.equal(progressPercent([]),0);
assert.ok(guideLinks('A&B').web.includes('A%26B'));
console.log('PASS 12 assertions: WuWa AI offline logic.');
