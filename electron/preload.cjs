const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('codenote',{showMenu:(index,x,y)=>ipcRenderer.send('menu:popup',{index,x,y}),state:()=>ipcRenderer.invoke('state'),action:(name,arg)=>ipcRenderer.invoke('action',name,arg),change:text=>ipcRenderer.send('change',text),directory:p=>ipcRenderer.invoke('directory',p),onCommand:fn=>ipcRenderer.on('command',(_,name)=>fn(name)),onRecent:fn=>ipcRenderer.on('open-recent',(_,p)=>fn(p))});

