const {app,BrowserWindow,Menu,dialog,ipcMain,nativeTheme}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
if(process.env.CODENOTE_TEST)app.setPath('userData',path.join(__dirname,'../test-results/profile'));
let win, prefs={theme:'light',recent:[]}, doc={path:null,text:'',saved:''}, closing=false, busy=false;
const filters=[{name:'모든 파일',extensions:['*']},{name:'지원하는 파일',extensions:['py','r','txt','html']},{name:'Python',extensions:['py']},{name:'R',extensions:['r']},{name:'텍스트',extensions:['txt']},{name:'HTML',extensions:['html']}];
const supported=p=>typeof p==='string';
const dirty=()=>doc.text!==doc.saved;
const snapshot=()=>({path:doc.path,text:doc.text,dirty:dirty(),prefs});
const title=()=>win.setTitle(`${dirty()?'● ':''}${doc.path?path.basename(doc.path):'새 파일'} — Codenote`);
async function persist(){await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(path.join(app.getPath('userData'),'settings.json'),JSON.stringify(prefs));}
async function remember(p){prefs.recent=[p,...prefs.recent.filter(x=>x!==p)].slice(0,12);await persist();menu();}
async function save(as=false){
 let target=doc.path;
 if(as||!target){const result=await dialog.showSaveDialog(win,{defaultPath:target||'Untitled',filters});if(result.canceled)return false;target=result.filePath;}

 const text=doc.text;
 // Write a sibling temporary file before replacing the original.
 const temp=target+'.codenote-'+process.pid+'.tmp';
 try{await fs.writeFile(temp,text,'utf8');await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
 doc.path=target;doc.saved=text;await remember(target);title();return true;
}
async function confirm(){if(!dirty())return true;const {response}=await dialog.showMessageBox(win,{type:'question',message:'변경 내용을 저장할까요?',detail:doc.path||'새 파일',buttons:['저장','저장하지 않음','취소'],defaultId:0,cancelId:2});return response===0?save():response===1;}
async function open(file){if(!await confirm())return;if(!file){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters});if(r.canceled)return;file=r.filePaths[0];}if(!supported(file))throw Error('지원하는 확장자: py, r, txt, html');const text=(await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'');doc={path:file,text,saved:text};await remember(file);title();}
function menu(){const command=name=>()=>win.webContents.send('command',name);Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'파일',submenu:[{label:'새 파일',accelerator:'Ctrl+N',click:command('new')},{label:'파일 열기…',accelerator:'Ctrl+O',click:command('open')},{label:'폴더 열기…',accelerator:'Ctrl+Shift+O',click:command('folder')},{label:'최근 파일',submenu:[...(prefs.recent.length?prefs.recent.map(p=>({label:p.replaceAll('&','&&'),click:()=>win.webContents.send('open-recent',p)})):[{label:'최근 파일 없음',enabled:false}]),{type:'separator'},{label:'목록 지우기',enabled:prefs.recent.length>0,click:command('clearRecent')}]},{type:'separator'},{label:'저장',accelerator:'Ctrl+S',click:command('save')},{label:'다른 이름으로 저장…',accelerator:'Ctrl+Shift+S',click:command('saveAs')},{type:'separator'},{role:'quit',label:'종료'}]},
 {label:'편집',submenu:[{label:'실행 취소',accelerator:'Ctrl+Z',click:command('undo')},{label:'다시 실행',accelerator:'Ctrl+Y',click:command('redo')},{type:'separator'},{role:'cut',label:'잘라내기'},{role:'copy',label:'복사'},{role:'paste',label:'붙여넣기'},{role:'selectAll',label:'모두 선택'},{label:'찾기 / 바꾸기',accelerator:'Ctrl+F',click:command('find')}]},
 {label:'보기',submenu:[{label:'테마 전환',click:command('theme')},{label:'파일 탐색기',accelerator:'Ctrl+B',click:command('explorer')},{role:'togglefullscreen',label:'전체 화면'}]}
 ]));win.setMenuBarVisibility(false);win.setAutoHideMenuBar(false);}
ipcMain.on('menu:popup',(_event,{index,x,y})=>{if(!Number.isInteger(index)||index<0||index>2||!Number.isFinite(x)||!Number.isFinite(y))return;Menu.getApplicationMenu()?.items[index]?.submenu?.popup({window:win,x:Math.round(x),y:Math.round(y)});});
ipcMain.on('change',(_e,text)=>{if(typeof text==='string'){doc.text=text;title();}});
ipcMain.handle('action',async(_e,name,arg)=>{if(busy)return {busy:true};busy=true;try{
 if(name==='new'){if(await confirm())doc={path:null,text:'',saved:''};}
 else if(name==='open')await open(arg);
 else if(name==='save'||name==='saveAs')await save(name==='saveAs');
 else if(name==='theme'){prefs.theme=prefs.theme==='dark'?'light':'dark';nativeTheme.themeSource=prefs.theme;await persist();}
 else if(name==='clearRecent'){prefs.recent=[];await persist();menu();}
 else if(name==='folder'){const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});if(!r.canceled)return {folder:r.filePaths[0]};}
 title();return snapshot();
 }catch(e){return {error:e.message};}finally{busy=false;}});
ipcMain.handle('state',()=>snapshot());
ipcMain.handle('directory',async(_e,folder)=>{try{const entries=await fs.readdir(folder,{withFileTypes:true});return entries.filter(e=>!e.isSymbolicLink()).map(e=>({name:e.name,path:path.join(folder,e.name),directory:e.isDirectory(),supported:supported(e.name)})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));}catch(e){return {error:e.message};}});
app.whenReady().then(async()=>{
 try{const p=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'settings.json'),'utf8'));prefs={theme:p.theme==='dark'?'dark':'light',recent:Array.isArray(p.recent)?p.recent.filter(x=>typeof x==='string'&&supported(x)).slice(0,12):[]};}catch{}
 nativeTheme.themeSource=prefs.theme;
 win=new BrowserWindow({width:1240,height:820,minWidth:740,minHeight:480,backgroundColor:prefs.theme==='dark'?'#222222':'#F5F5F5',icon:path.join(__dirname,'../codenote.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 menu();await win.loadFile(path.join(__dirname,'../dist/index.html'));
 win.on('close',e=>{if(closing)return;e.preventDefault();if(busy)return;busy=true;confirm().then(ok=>{if(ok){closing=true;win.close();}}).catch(e=>dialog.showErrorBox('저장 오류',e.message)).finally(()=>busy=false);});
});
app.on('window-all-closed',()=>app.quit());




