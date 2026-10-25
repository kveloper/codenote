const {_electron:electron}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const app=await electron.launch({executablePath:require('node:path').resolve('release/win-unpacked/Codenote.exe'),env:{...process.env,CODENOTE_TEST:''}});
 try{
 const page=await app.firstWindow();await page.locator('.cm-content').waitFor();
 assert.equal(await page.locator('header, [aria-label="편집 도구"]').count(),0);
 assert.deepEqual(await page.locator('#menubar button').allTextContents(),['파일','편집','보기']);
 await app.evaluate(({Menu})=>{global.openedMenu=false;Menu.getApplicationMenu().items[0].submenu.once('menu-will-show',()=>global.openedMenu=true);});
 await page.locator('[data-menu="0"]').click();
 assert.equal(await app.evaluate(()=>global.openedMenu),true);
 await app.evaluate(({Menu,BrowserWindow})=>Menu.getApplicationMenu().items[0].submenu.closePopup(BrowserWindow.getAllWindows()[0]));
 const fonts=await page.evaluate(async()=>{await document.fonts.ready;return {editor:document.fonts.check('15px D2Coding'),ui:document.fonts.check('14px Pretendard')};});
 assert.ok(fonts.editor&&fonts.ui);
 console.log(JSON.stringify({packaged:await app.evaluate(({app})=>app.isPackaged),menuPopup:true,fonts}));
 }finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exit(1)});
