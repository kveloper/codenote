import {EditorState} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,highlightActiveLineGutter,drawSelection} from '@codemirror/view';
import {indentWithTab,undo,redo,history,defaultKeymap,historyKeymap} from '@codemirror/commands';
import {searchKeymap,highlightSelectionMatches,openSearchPanel} from '@codemirror/search';
import {StreamLanguage,HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import './style.css';
const api=window.codenote, $=id=>document.getElementById(id);
let currentPath=null,saved='',loading=false,folder=null,pending=false,eol='\n';
// Deliberately language-independent: only strings, standalone numbers and brackets.
const simpleColors=StreamLanguage.define({
 startState:()=>({quote:null}),
 token(stream,state){
  if(state.quote){const quote=state.quote;while(!stream.eol()){const ch=stream.next();if(ch==='\\'){stream.next();continue;}if(quote.length===3?ch===quote[0]&&stream.match(quote.slice(1)):ch===quote){state.quote=null;break;}}if(quote.length===1&&stream.eol())state.quote=null;return 'string';}
  if(stream.match(/^(?:"""|''')/)){state.quote=stream.current();return 'string';}
  if(stream.peek()==='"'||stream.peek()==="'"){state.quote=stream.next();return 'string';}
  if(stream.match(/^[()[\]{}]/))return 'bracket';
  if(stream.match(/^(?:0[xX][\da-fA-F]+|0[bB][01]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?![\w])/))return 'number';
  if(stream.match(/^[\p{L}_$][\p{L}\p{N}_$]*/u))return null;
  stream.next();return null;
 }
});
const colors=HighlightStyle.define([{tag:tags.number,class:'token-number'},{tag:tags.bracket,class:'token-bracket'},{tag:tags.string,class:'token-string'}]);
const extensions=()=>[lineNumbers(),highlightActiveLine(),highlightActiveLineGutter(),drawSelection(),history(),highlightSelectionMatches(),keymap.of([indentWithTab,...defaultKeymap,...historyKeymap,...searchKeymap]),simpleColors,syntaxHighlighting(colors),EditorState.lineSeparator.of(eol),EditorView.updateListener.of(update=>{if(update.docChanged&&!loading){api.change(view.state.doc.toString());updateDirty();}if(update.docChanged||update.selectionSet)statistics();})];
const view=new EditorView({state:EditorState.create({extensions:extensions()}),parent:$('editor')});
function statistics(){const head=view.state.selection.main.head,line=view.state.doc.lineAt(head);$('position').textContent=`열 ${head-line.from+1}`;$('length').textContent=`줄 길이 ${Array.from(line.text).length}`;$('lines').textContent=`전체 ${view.state.doc.lines}줄`;$('eol').textContent=eol==='\r\n'?'CRLF':'LF';}
function updateDirty(){const dirty=view.state.doc.toString()!==saved;document.title=`${dirty?'● ':''}${currentPath?basename(currentPath):'새 파일'} — Codenote`;}
function basename(p){return p.split(/[\\/]/).pop();}
function applyTheme(value){document.documentElement.dataset.theme=value;}
function showError(message){$('status').textContent=`오류: ${message}`;}
function apply(snapshot,replace=false){if(snapshot.error){showError(snapshot.error);return;}if(snapshot.busy)return;
 currentPath=snapshot.path;saved=snapshot.dirty?saved:snapshot.text;
 if(replace){eol=snapshot.text.includes('\r\n')?'\r\n':'\n';loading=true;view.setState(EditorState.create({doc:snapshot.text,extensions:extensions()}));loading=false;}
 applyTheme(snapshot.prefs.theme);updateDirty();statistics();
}
async function populate(container,path){const entries=await api.directory(path);container.replaceChildren();if(entries.error){showError(entries.error);return;}for(const item of entries){if(item.directory){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=item.name;details.append(summary);const children=document.createElement('div');children.className='children';details.append(children);details.addEventListener('toggle',()=>{if(details.open&&!details.dataset.loaded){details.dataset.loaded='true';populate(children,item.path);}});container.append(details);}else{const b=document.createElement('button');b.className='tree-file';b.textContent=item.name;b.title=item.path;b.disabled=!item.supported;b.onclick=()=>action('open',item.path);container.append(b);}}}
async function action(name,arg){
 if(name==='undo'){undo(view);view.focus();return;}if(name==='redo'){redo(view);view.focus();return;}if(name==='find'){openSearchPanel(view);return;}
 if(name==='explorer'){$('explorer').hidden=!$('explorer').hidden;return;}
 if(name==='refresh'){if(folder)await populate($('tree'),folder);return;}
 if(pending)return;pending=true;view.contentDOM.setAttribute('contenteditable','false');
 try{const result=await api.action(name,arg);if(result.folder){folder=result.folder;$('folder-title').textContent=basename(folder);$('folder-title').title=folder;await populate($('tree'),folder);}else if(result.text!==undefined){apply(result,['new','open'].includes(name));$('status').textContent=['save','saveAs'].includes(name)?'저장 완료':currentPath||'준비됨';}else if(result.error)showError(result.error);
 }catch(error){showError(error.message);}finally{pending=false;view.contentDOM.setAttribute('contenteditable','true');view.focus();}
}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
api.onCommand(action);api.onRecent(p=>action('open',p));
apply(await api.state(),true);view.focus();

document.querySelectorAll('[data-menu]').forEach(button=>{button.onclick=()=>{const rect=button.getBoundingClientRect();api.showMenu(Number(button.dataset.menu),Math.round(rect.left),Math.round(rect.bottom));};});
document.addEventListener('keydown',event=>{if(event.altKey&&['f','e','v'].includes(event.key.toLowerCase())){event.preventDefault();document.querySelectorAll('[data-menu]')[['f','e','v'].indexOf(event.key.toLowerCase())].click();}});


