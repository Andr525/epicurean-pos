/* Test-origin-only defense in depth, loaded BEFORE the unchanged POS code. */
(function(){
 'use strict';
 window.EPICUREAN_LAB_BLOCKED=[];
 const original=window.fetch.bind(window);
 window.fetch=function(input,init){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!==location.origin){window.EPICUREAN_LAB_BLOCKED.push({kind:'external-fetch',host:url.hostname});return Promise.reject(new Error('Production/external network disabled in test lab'));}return original(input,init);};
 document.addEventListener('click',function(event){const link=event.target.closest?.('a[href]');if(link&&new URL(link.href,location.href).origin!==location.origin){event.preventDefault();window.EPICUREAN_LAB_BLOCKED.push({kind:'external-navigation'});}},true);
 window.open=function(){window.EPICUREAN_LAB_BLOCKED.push({kind:'blocked-popup'});return null;};
 window.WebSocket=function(){throw Error('WebSockets disabled in test lab');};
 window.XMLHttpRequest=function(){throw Error('XHR disabled in test lab; use local fixture adapter');};
 navigator.sendBeacon=function(){return false;};
 if('serviceWorker' in navigator){try{navigator.serviceWorker.register=function(){return Promise.reject(Error('Service workers disabled in lab'));};}catch{}}
})();
