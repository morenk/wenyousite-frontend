import { describe, expect, test } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { getSelectedEditorHeading } from '../editor-heading-state';
const schema = new Schema({nodes:{doc:{content:'block+'},paragraph:{group:'block',content:'text*'},heading:{group:'block',content:'text*',attrs:{level:{default:2}}},code_block:{group:'block',content:'text*'},text:{}}});
function state(levels:(number|string)[], range=false){
 const doc=schema.node('doc',null,levels.map(level=>schema.node(typeof level==='string'?level:level===0?'paragraph':'heading',typeof level==='number'&&level!==0?{level}:null,schema.text('文字'))));
 return EditorState.create({doc,selection:TextSelection.create(doc,1,range?doc.content.size-1:1)});
}
describe('标题分段当前状态',()=>{
 test.each([0,2,3])('光标和同级跨段选区反映 %s',level=>{
  expect(getSelectedEditorHeading(state([level]))).toBe(level);
  expect(getSelectedEditorHeading(state([level,level],true))).toBe(level);
 });
 test.each([[0,2],[2,3],[1],[4],['code_block']])('混合或不支持的层级 %s 不误选正文',(...levels)=>{
  expect(getSelectedEditorHeading(state(levels,true))).toBeUndefined();
 });
});

test('选区终点停在下一段起点时不把下一段计入标题状态', () => {
 const initial=state([2,0]);
 const selected=EditorState.create({doc:initial.doc,selection:TextSelection.create(initial.doc,1,5)});
 expect(getSelectedEditorHeading(selected)).toBe(2);
});
