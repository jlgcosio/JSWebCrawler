const { ipcRenderer } = require("electron");

function passUrl(){
    var urlBox = document.getElementById('urlInput');
    ipcRenderer.send('async-crawl', urlBox.value);
}

function addToList(href){
    var list = document.getElementById('linkList');
    var item = document.createElement('li');
    item.setAttribute('class', 'list-group-item');
    item.innerHTML = href;

    list.appendChild(item);
}