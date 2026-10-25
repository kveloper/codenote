const {test}=require('node:test');
const assert=require('node:assert/strict');
const {_electron:electron}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs/promises');
test('simple coloring, no completion, clean layout, neutral file dialogs and file history',async()=>{
 const app=await electron.launch({args:[path.resolve('.')],env:{...process.env,CODENOTE_TEST:'1'}});
 try{
 const command=async name=>{await app.evaluate(({BrowserWindow},name)=>BrowserWindow.getAllWindows()[0].webContents.send('command',name),name);await new Promise(resolve=>setTimeout(resolve,80));};
 const page=await app.firstWindow();await page.locator('.cm-content').waitFor();
 const sample='def greeting(x): return 42 + "hello 123()"\nvalue = [3.14, 1e3, 0xff]\ngree';
 await page.locator('.cm-content').fill(sample);
 await page.locator('.cm-content').press('Control+End');await page.locator('.cm-content').press('Control+Space');
 assert.equal(await page.locator('.cm-tooltip-autocomplete').count(),0);
 assert.equal(await page.locator('header, #tab, #recent, #language, [aria-label="편집 도구"]').count(),0);
 assert.deepEqual(await page.locator('#menubar button').allTextContents(),['파일','편집','보기']);
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMenuBarVisible()),false);
 assert.match(await page.locator('#length').innerText(),/4/);
 assert.deepEqual(await page.locator('.token-number').allTextContents(),['42','3.14','1e3','0xff']);
 assert.match((await page.locator('.token-string').allTextContents()).join(''),/hello 123\(\)/);
 assert.ok(await page.locator('.token-bracket').count()>0);
 assert.equal(await page.locator('.cm-line span').filter({hasText:/^def$|^return$/}).count(),0);
 await command('undo');assert.doesNotMatch(await page.locator('.cm-content').innerText(),/gree/);
 await command('redo');assert.match(await page.locator('.cm-content').innerText(),/greeting/);
 if(await page.locator('html').getAttribute('data-theme')!=='dark')await command('theme');
 assert.equal(await page.locator('#menubar').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(34, 34, 34)');
 await page.screenshot({path:'test-results/editor-dark.png'});
 await command('theme');
 const dir=path.resolve('test-results');await fs.mkdir(dir,{recursive:true});
 const target=path.join(dir,'extensionless');
 await app.evaluate(({dialog},target)=>{global.dialogOptions={};dialog.showSaveDialog=async(_w,options)=>{global.dialogOptions.save=options;return {canceled:false,filePath:target};};dialog.showOpenDialog=async(_w,options)=>{global.dialogOptions.open=options;return {canceled:false,filePaths:[target]};};},target);
 await command('save');await page.waitForFunction(()=>document.querySelector('#status').textContent==='저장 완료');assert.equal(await fs.readFile(target,'utf8'),sample);
 const saveOptions=await app.evaluate(()=>global.dialogOptions.save);assert.equal(saveOptions.defaultPath,'Untitled');assert.deepEqual(saveOptions.filters[0].extensions,['*']);
 await command('new');await page.waitForFunction(()=>document.querySelector('.cm-content').textContent==='');
 await command('open');await page.waitForFunction(()=>document.querySelector('.cm-content').textContent.includes('greeting'));
 assert.deepEqual((await app.evaluate(()=>global.dialogOptions.open)).filters[0].extensions,['*']);
 assert.ok(await app.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.label==='최근 파일').submenu.items.some(i=>i.label.includes('extensionless'))));
 await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:2});});
 await page.locator('.cm-content').fill('unsaved');await command('new');assert.match(await page.locator('.cm-content').innerText(),/unsaved/);
 assert.equal(await page.locator('#menubar').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(245, 245, 245)');
 await page.screenshot({path:'test-results/editor-light.png'});
 }finally{await app.evaluate(({app})=>app.exit(0));}
});


