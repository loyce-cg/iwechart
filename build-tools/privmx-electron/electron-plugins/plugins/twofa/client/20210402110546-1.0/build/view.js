!function e(t,n,i){function s(a,r){if(!n[a]){if(!t[a]){var c="function"==typeof require&&require;if(!r&&c)return c(a,!0);if(o)return o(a,!0);var l=new Error("Cannot find module '"+a+"'");throw l.code="MODULE_NOT_FOUND",l}var u=n[a]={exports:{}};t[a][0].call(u.exports,(function(e){return s(t[a][1][e]||e)}),u,u.exports,e,t,n,i)}return n[a].exports}for(var o="function"==typeof require&&require,a=0;a<i.length;a++)s(i[a]);return s}({1:[function(e,t,n){var i=privmxViewRequire("privmx-view");t.exports=i},{}],2:[function(e,t,n){var i,s;i=this,s=function(){"use strict";var e=function(){},t=Object.prototype.hasOwnProperty,n=Array.prototype.slice;function i(e,i,s){for(var o,a,r=0,c=(s=n.call(arguments,2)).length;r<c;r++)for(o in a=s[r])e&&!t.call(a,o)||(i[o]=a[o])}var s=function(t,n,s,o){var a=this;return"string"!=typeof t&&(o=s,s=n,n=t,t=null),"function"!=typeof n&&(o=s,s=n,n=function(){return a.apply(this,arguments)}),i(!1,n,a,o),n.prototype=function(t,n){var s;return"function"==typeof Object.create?s=Object.create(t):(e.prototype=t,s=new e,e.prototype=null),n&&i(!0,s,n),s}(a.prototype,s),n.prototype.constructor=n,n.class_=t||a.class_,n.super_=a,n};function o(){}o.class_="Nevis",o.super_=Object,o.extend=s;var a=o,r=a.extend((function(e,t,n){this.qrious=e,this.element=t,this.element.qrious=e,this.enabled=Boolean(n)}),{draw:function(e){},getElement:function(){return this.enabled||(this.enabled=!0,this.render()),this.element},getModuleSize:function(e){var t=this.qrious,n=t.padding||0,i=Math.floor((t.size-2*n)/e.width);return Math.max(1,i)},getOffset:function(e){var t=this.qrious,n=t.padding;if(null!=n)return n;var i=this.getModuleSize(e),s=Math.floor((t.size-i*e.width)/2);return Math.max(0,s)},render:function(e){this.enabled&&(this.resize(),this.reset(),this.draw(e))},reset:function(){},resize:function(){}}),c=r.extend({draw:function(e){var t,n,i=this.qrious,s=this.getModuleSize(e),o=this.getOffset(e),a=this.element.getContext("2d");for(a.fillStyle=i.foreground,a.globalAlpha=i.foregroundAlpha,t=0;t<e.width;t++)for(n=0;n<e.width;n++)e.buffer[n*e.width+t]&&a.fillRect(s*t+o,s*n+o,s,s)},reset:function(){var e=this.qrious,t=this.element.getContext("2d"),n=e.size;t.lineWidth=1,t.clearRect(0,0,n,n),t.fillStyle=e.background,t.globalAlpha=e.backgroundAlpha,t.fillRect(0,0,n,n)},resize:function(){var e=this.element;e.width=e.height=this.qrious.size}}),l=a.extend(null,{BLOCK:[0,11,15,19,23,27,31,16,18,20,22,24,26,28,20,22,24,24,26,28,28,22,24,24,26,26,28,28,24,24,26,26,26,28,28,24,26,26,26,28,28]}),u=a.extend(null,{BLOCKS:[1,0,19,7,1,0,16,10,1,0,13,13,1,0,9,17,1,0,34,10,1,0,28,16,1,0,22,22,1,0,16,28,1,0,55,15,1,0,44,26,2,0,17,18,2,0,13,22,1,0,80,20,2,0,32,18,2,0,24,26,4,0,9,16,1,0,108,26,2,0,43,24,2,2,15,18,2,2,11,22,2,0,68,18,4,0,27,16,4,0,19,24,4,0,15,28,2,0,78,20,4,0,31,18,2,4,14,18,4,1,13,26,2,0,97,24,2,2,38,22,4,2,18,22,4,2,14,26,2,0,116,30,3,2,36,22,4,4,16,20,4,4,12,24,2,2,68,18,4,1,43,26,6,2,19,24,6,2,15,28,4,0,81,20,1,4,50,30,4,4,22,28,3,8,12,24,2,2,92,24,6,2,36,22,4,6,20,26,7,4,14,28,4,0,107,26,8,1,37,22,8,4,20,24,12,4,11,22,3,1,115,30,4,5,40,24,11,5,16,20,11,5,12,24,5,1,87,22,5,5,41,24,5,7,24,30,11,7,12,24,5,1,98,24,7,3,45,28,15,2,19,24,3,13,15,30,1,5,107,28,10,1,46,28,1,15,22,28,2,17,14,28,5,1,120,30,9,4,43,26,17,1,22,28,2,19,14,28,3,4,113,28,3,11,44,26,17,4,21,26,9,16,13,26,3,5,107,28,3,13,41,26,15,5,24,30,15,10,15,28,4,4,116,28,17,0,42,26,17,6,22,28,19,6,16,30,2,7,111,28,17,0,46,28,7,16,24,30,34,0,13,24,4,5,121,30,4,14,47,28,11,14,24,30,16,14,15,30,6,4,117,30,6,14,45,28,11,16,24,30,30,2,16,30,8,4,106,26,8,13,47,28,7,22,24,30,22,13,15,30,10,2,114,28,19,4,46,28,28,6,22,28,33,4,16,30,8,4,122,30,22,3,45,28,8,26,23,30,12,28,15,30,3,10,117,30,3,23,45,28,4,31,24,30,11,31,15,30,7,7,116,30,21,7,45,28,1,37,23,30,19,26,15,30,5,10,115,30,19,10,47,28,15,25,24,30,23,25,15,30,13,3,115,30,2,29,46,28,42,1,24,30,23,28,15,30,17,0,115,30,10,23,46,28,10,35,24,30,19,35,15,30,17,1,115,30,14,21,46,28,29,19,24,30,11,46,15,30,13,6,115,30,14,23,46,28,44,7,24,30,59,1,16,30,12,7,121,30,12,26,47,28,39,14,24,30,22,41,15,30,6,14,121,30,6,34,47,28,46,10,24,30,2,64,15,30,17,4,122,30,29,14,46,28,49,10,24,30,24,46,15,30,4,18,122,30,13,32,46,28,48,14,24,30,42,32,15,30,20,4,117,30,40,7,47,28,43,22,24,30,10,67,15,30,19,6,118,30,18,31,47,28,34,34,24,30,20,61,15,30],FINAL_FORMAT:[30660,29427,32170,30877,26159,25368,27713,26998,21522,20773,24188,23371,17913,16590,20375,19104,13663,12392,16177,14854,9396,8579,11994,11245,5769,5054,7399,6608,1890,597,3340,2107],LEVELS:{L:1,M:2,Q:3,H:4}}),f=a.extend(null,{EXPONENT:[1,2,4,8,16,32,64,128,29,58,116,232,205,135,19,38,76,152,45,90,180,117,234,201,143,3,6,12,24,48,96,192,157,39,78,156,37,74,148,53,106,212,181,119,238,193,159,35,70,140,5,10,20,40,80,160,93,186,105,210,185,111,222,161,95,190,97,194,153,47,94,188,101,202,137,15,30,60,120,240,253,231,211,187,107,214,177,127,254,225,223,163,91,182,113,226,217,175,67,134,17,34,68,136,13,26,52,104,208,189,103,206,129,31,62,124,248,237,199,147,59,118,236,197,151,51,102,204,133,23,46,92,184,109,218,169,79,158,33,66,132,21,42,84,168,77,154,41,82,164,85,170,73,146,57,114,228,213,183,115,230,209,191,99,198,145,63,126,252,229,215,179,123,246,241,255,227,219,171,75,150,49,98,196,149,55,110,220,165,87,174,65,130,25,50,100,200,141,7,14,28,56,112,224,221,167,83,166,81,162,89,178,121,242,249,239,195,155,43,86,172,69,138,9,18,36,72,144,61,122,244,245,247,243,251,235,203,139,11,22,44,88,176,125,250,233,207,131,27,54,108,216,173,71,142,0],LOG:[255,0,1,25,2,50,26,198,3,223,51,238,27,104,199,75,4,100,224,14,52,141,239,129,28,193,105,248,200,8,76,113,5,138,101,47,225,36,15,33,53,147,142,218,240,18,130,69,29,181,194,125,106,39,249,185,201,154,9,120,77,228,114,166,6,191,139,98,102,221,48,253,226,152,37,179,16,145,34,136,54,208,148,206,143,150,219,189,241,210,19,92,131,56,70,64,30,66,182,163,195,72,126,110,107,58,40,84,250,133,186,61,202,94,155,159,10,21,121,43,78,212,229,172,115,243,167,87,7,112,192,247,140,128,99,13,103,74,222,237,49,197,254,24,227,165,153,119,38,184,180,124,17,68,146,217,35,32,137,46,55,63,209,91,149,188,207,205,144,135,151,178,220,252,190,97,242,86,211,171,20,42,93,158,132,60,57,83,71,109,65,162,31,45,67,216,183,123,164,118,196,23,73,236,127,12,111,246,108,161,59,82,41,157,85,170,251,96,134,177,187,204,62,90,203,89,95,176,156,169,160,81,11,245,22,235,122,117,44,215,79,174,213,233,230,231,173,232,116,214,244,234,168,80,88,175]}),d=a.extend(null,{BLOCK:[3220,1468,2713,1235,3062,1890,2119,1549,2344,2936,1117,2583,1330,2470,1667,2249,2028,3780,481,4011,142,3098,831,3445,592,2517,1776,2234,1951,2827,1070,2660,1345,3177]}),h=a.extend((function(e){var t,n,i,s,o,a=e.value.length;for(this._badness=[],this._level=u.LEVELS[e.level],this._polynomial=[],this._value=e.value,this._version=0,this._stringBuffer=[];this._version<40&&(this._version++,i=4*(this._level-1)+16*(this._version-1),s=u.BLOCKS[i++],o=u.BLOCKS[i++],t=u.BLOCKS[i++],n=u.BLOCKS[i],!(a<=(i=t*(s+o)+o-3+(this._version<=9)))););this._dataBlock=t,this._eccBlock=n,this._neccBlock1=s,this._neccBlock2=o;var r=this.width=17+4*this._version;this.buffer=h._createArray(r*r),this._ecc=h._createArray(t+(t+n)*(s+o)+o),this._mask=h._createArray((r*(r+1)+1)/2),this._insertFinders(),this._insertAlignments(),this.buffer[8+r*(r-8)]=1,this._insertTimingGap(),this._reverseMask(),this._insertTimingRowAndColumn(),this._insertVersion(),this._syncMask(),this._convertBitStream(a),this._calculatePolynomial(),this._appendEccToData(),this._interleaveBlocks(),this._pack(),this._finish()}),{_addAlignment:function(e,t){var n,i=this.buffer,s=this.width;for(i[e+s*t]=1,n=-2;n<2;n++)i[e+n+s*(t-2)]=1,i[e-2+s*(t+n+1)]=1,i[e+2+s*(t+n)]=1,i[e+n+1+s*(t+2)]=1;for(n=0;n<2;n++)this._setMask(e-1,t+n),this._setMask(e+1,t-n),this._setMask(e-n,t-1),this._setMask(e+n,t+1)},_appendData:function(e,t,n,i){var s,o,a,r=this._polynomial,c=this._stringBuffer;for(o=0;o<i;o++)c[n+o]=0;for(o=0;o<t;o++){if(255!==(s=f.LOG[c[e+o]^c[n]]))for(a=1;a<i;a++)c[n+a-1]=c[n+a]^f.EXPONENT[h._modN(s+r[i-a])];else for(a=n;a<n+i;a++)c[a]=c[a+1];c[n+i-1]=255===s?0:f.EXPONENT[h._modN(s+r[0])]}},_appendEccToData:function(){var e,t=0,n=this._dataBlock,i=this._calculateMaxLength(),s=this._eccBlock;for(e=0;e<this._neccBlock1;e++)this._appendData(t,n,i,s),t+=n,i+=s;for(e=0;e<this._neccBlock2;e++)this._appendData(t,n+1,i,s),t+=n+1,i+=s},_applyMask:function(e){var t,n,i,s,o=this.buffer,a=this.width;switch(e){case 0:for(s=0;s<a;s++)for(i=0;i<a;i++)i+s&1||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 1:for(s=0;s<a;s++)for(i=0;i<a;i++)1&s||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 2:for(s=0;s<a;s++)for(t=0,i=0;i<a;i++,t++)3===t&&(t=0),t||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 3:for(n=0,s=0;s<a;s++,n++)for(3===n&&(n=0),t=n,i=0;i<a;i++,t++)3===t&&(t=0),t||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 4:for(s=0;s<a;s++)for(t=0,n=s>>1&1,i=0;i<a;i++,t++)3===t&&(t=0,n=!n),n||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 5:for(n=0,s=0;s<a;s++,n++)for(3===n&&(n=0),t=0,i=0;i<a;i++,t++)3===t&&(t=0),(i&s&1)+!(!t|!n)||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 6:for(n=0,s=0;s<a;s++,n++)for(3===n&&(n=0),t=0,i=0;i<a;i++,t++)3===t&&(t=0),(i&s&1)+(t&&t===n)&1||this._isMasked(i,s)||(o[i+s*a]^=1);break;case 7:for(n=0,s=0;s<a;s++,n++)for(3===n&&(n=0),t=0,i=0;i<a;i++,t++)3===t&&(t=0),(t&&t===n)+(i+s&1)&1||this._isMasked(i,s)||(o[i+s*a]^=1)}},_calculateMaxLength:function(){return this._dataBlock*(this._neccBlock1+this._neccBlock2)+this._neccBlock2},_calculatePolynomial:function(){var e,t,n=this._eccBlock,i=this._polynomial;for(i[0]=1,e=0;e<n;e++){for(i[e+1]=1,t=e;t>0;t--)i[t]=i[t]?i[t-1]^f.EXPONENT[h._modN(f.LOG[i[t]]+e)]:i[t-1];i[0]=f.EXPONENT[h._modN(f.LOG[i[0]]+e)]}for(e=0;e<=n;e++)i[e]=f.LOG[i[e]]},_checkBadness:function(){var e,t,n,i,s,o=0,a=this._badness,r=this.buffer,c=this.width;for(s=0;s<c-1;s++)for(i=0;i<c-1;i++)(r[i+c*s]&&r[i+1+c*s]&&r[i+c*(s+1)]&&r[i+1+c*(s+1)]||!(r[i+c*s]||r[i+1+c*s]||r[i+c*(s+1)]||r[i+1+c*(s+1)]))&&(o+=h.N2);var l=0;for(s=0;s<c;s++){for(n=0,a[0]=0,e=0,i=0;i<c;i++)e===(t=r[i+c*s])?a[n]++:a[++n]=1,l+=(e=t)?1:-1;o+=this._getBadness(n)}l<0&&(l=-l);var u=0,f=l;for(f+=f<<2,f<<=1;f>c*c;)f-=c*c,u++;for(o+=u*h.N4,i=0;i<c;i++){for(n=0,a[0]=0,e=0,s=0;s<c;s++)e===(t=r[i+c*s])?a[n]++:a[++n]=1,e=t;o+=this._getBadness(n)}return o},_convertBitStream:function(e){var t,n,i=this._ecc,s=this._version;for(n=0;n<e;n++)i[n]=this._value.charCodeAt(n);var o=this._stringBuffer=i.slice(),a=this._calculateMaxLength();e>=a-2&&(e=a-2,s>9&&e--);var r=e;if(s>9){for(o[r+2]=0,o[r+3]=0;r--;)t=o[r],o[r+3]|=255&t<<4,o[r+2]=t>>4;o[2]|=255&e<<4,o[1]=e>>4,o[0]=64|e>>12}else{for(o[r+1]=0,o[r+2]=0;r--;)t=o[r],o[r+2]|=255&t<<4,o[r+1]=t>>4;o[1]|=255&e<<4,o[0]=64|e>>4}for(r=e+3-(s<10);r<a;)o[r++]=236,o[r++]=17},_getBadness:function(e){var t,n=0,i=this._badness;for(t=0;t<=e;t++)i[t]>=5&&(n+=h.N1+i[t]-5);for(t=3;t<e-1;t+=2)i[t-2]===i[t+2]&&i[t+2]===i[t-1]&&i[t-1]===i[t+1]&&3*i[t-1]===i[t]&&(0===i[t-3]||t+3>e||3*i[t-3]>=4*i[t]||3*i[t+3]>=4*i[t])&&(n+=h.N3);return n},_finish:function(){var e,t;this._stringBuffer=this.buffer.slice();var n=0,i=3e4;for(t=0;t<8&&(this._applyMask(t),(e=this._checkBadness())<i&&(i=e,n=t),7!==n);t++)this.buffer=this._stringBuffer.slice();n!==t&&this._applyMask(n),i=u.FINAL_FORMAT[n+(this._level-1<<3)];var s=this.buffer,o=this.width;for(t=0;t<8;t++,i>>=1)1&i&&(s[o-1-t+8*o]=1,t<6?s[8+o*t]=1:s[8+o*(t+1)]=1);for(t=0;t<7;t++,i>>=1)1&i&&(s[8+o*(o-7+t)]=1,t?s[6-t+8*o]=1:s[7+8*o]=1)},_interleaveBlocks:function(){var e,t,n=this._dataBlock,i=this._ecc,s=this._eccBlock,o=0,a=this._calculateMaxLength(),r=this._neccBlock1,c=this._neccBlock2,l=this._stringBuffer;for(e=0;e<n;e++){for(t=0;t<r;t++)i[o++]=l[e+t*n];for(t=0;t<c;t++)i[o++]=l[r*n+e+t*(n+1)]}for(t=0;t<c;t++)i[o++]=l[r*n+e+t*(n+1)];for(e=0;e<s;e++)for(t=0;t<r+c;t++)i[o++]=l[a+e+t*s];this._stringBuffer=i},_insertAlignments:function(){var e,t,n,i=this._version,s=this.width;if(i>1)for(e=l.BLOCK[i],n=s-7;;){for(t=s-7;t>e-3&&(this._addAlignment(t,n),!(t<e));)t-=e;if(n<=e+9)break;n-=e,this._addAlignment(6,n),this._addAlignment(n,6)}},_insertFinders:function(){var e,t,n,i,s=this.buffer,o=this.width;for(e=0;e<3;e++){for(t=0,i=0,1===e&&(t=o-7),2===e&&(i=o-7),s[i+3+o*(t+3)]=1,n=0;n<6;n++)s[i+n+o*t]=1,s[i+o*(t+n+1)]=1,s[i+6+o*(t+n)]=1,s[i+n+1+o*(t+6)]=1;for(n=1;n<5;n++)this._setMask(i+n,t+1),this._setMask(i+1,t+n+1),this._setMask(i+5,t+n),this._setMask(i+n+1,t+5);for(n=2;n<4;n++)s[i+n+o*(t+2)]=1,s[i+2+o*(t+n+1)]=1,s[i+4+o*(t+n)]=1,s[i+n+1+o*(t+4)]=1}},_insertTimingGap:function(){var e,t,n=this.width;for(t=0;t<7;t++)this._setMask(7,t),this._setMask(n-8,t),this._setMask(7,t+n-7);for(e=0;e<8;e++)this._setMask(e,7),this._setMask(e+n-8,7),this._setMask(e,n-8)},_insertTimingRowAndColumn:function(){var e,t=this.buffer,n=this.width;for(e=0;e<n-14;e++)1&e?(this._setMask(8+e,6),this._setMask(6,8+e)):(t[8+e+6*n]=1,t[6+n*(8+e)]=1)},_insertVersion:function(){var e,t,n,i,s=this.buffer,o=this._version,a=this.width;if(o>6)for(e=d.BLOCK[o-7],t=17,n=0;n<6;n++)for(i=0;i<3;i++,t--)1&(t>11?o>>t-12:e>>t)?(s[5-n+a*(2-i+a-11)]=1,s[2-i+a-11+a*(5-n)]=1):(this._setMask(5-n,2-i+a-11),this._setMask(2-i+a-11,5-n))},_isMasked:function(e,t){var n=h._getMaskBit(e,t);return 1===this._mask[n]},_pack:function(){var e,t,n,i=1,s=1,o=this.width,a=o-1,r=o-1,c=(this._dataBlock+this._eccBlock)*(this._neccBlock1+this._neccBlock2)+this._neccBlock2;for(t=0;t<c;t++)for(e=this._stringBuffer[t],n=0;n<8;n++,e<<=1){128&e&&(this.buffer[a+o*r]=1);do{s?a--:(a++,i?0!==r?r--:(i=!i,6==(a-=2)&&(a--,r=9)):r!==o-1?r++:(i=!i,6==(a-=2)&&(a--,r-=8))),s=!s}while(this._isMasked(a,r))}},_reverseMask:function(){var e,t,n=this.width;for(e=0;e<9;e++)this._setMask(e,8);for(e=0;e<8;e++)this._setMask(e+n-8,8),this._setMask(8,e);for(t=0;t<7;t++)this._setMask(8,t+n-7)},_setMask:function(e,t){var n=h._getMaskBit(e,t);this._mask[n]=1},_syncMask:function(){var e,t,n=this.width;for(t=0;t<n;t++)for(e=0;e<=t;e++)this.buffer[e+n*t]&&this._setMask(e,t)}},{_createArray:function(e){var t,n=[];for(t=0;t<e;t++)n[t]=0;return n},_getMaskBit:function(e,t){var n;return e>t&&(n=e,e=t,t=n),n=t,n+=t*t,n>>=1,n+=e},_modN:function(e){for(;e>=255;)e=((e-=255)>>8)+(255&e);return e},N1:3,N2:3,N3:40,N4:10}),p=h,v=r.extend({draw:function(){this.element.src=this.qrious.toDataURL()},reset:function(){this.element.src=""},resize:function(){var e=this.element;e.width=e.height=this.qrious.size}}),g=a.extend((function(e,t,n,i){this.name=e,this.modifiable=Boolean(t),this.defaultValue=n,this._valueTransformer=i}),{transform:function(e){var t=this._valueTransformer;return"function"==typeof t?t(e,this):e}}),m=a.extend(null,{abs:function(e){return null!=e?Math.abs(e):null},hasOwn:function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},noop:function(){},toUpperCase:function(e){return null!=e?e.toUpperCase():null}}),w=a.extend((function(e){this.options={},e.forEach((function(e){this.options[e.name]=e}),this)}),{exists:function(e){return null!=this.options[e]},get:function(e,t){return w._get(this.options[e],t)},getAll:function(e){var t,n=this.options,i={};for(t in n)m.hasOwn(n,t)&&(i[t]=w._get(n[t],e));return i},init:function(e,t,n){var i,s;for(i in"function"!=typeof n&&(n=m.noop),this.options)m.hasOwn(this.options,i)&&(s=this.options[i],w._set(s,s.defaultValue,t),w._createAccessor(s,t,n));this._setAll(e,t,!0)},set:function(e,t,n){return this._set(e,t,n)},setAll:function(e,t){return this._setAll(e,t)},_set:function(e,t,n,i){var s=this.options[e];if(!s)throw new Error("Invalid option: "+e);if(!s.modifiable&&!i)throw new Error("Option cannot be modified: "+e);return w._set(s,t,n)},_setAll:function(e,t,n){if(!e)return!1;var i,s=!1;for(i in e)m.hasOwn(e,i)&&this._set(i,e[i],t,n)&&(s=!0);return s}},{_createAccessor:function(e,t,n){var i={get:function(){return w._get(e,t)}};e.modifiable&&(i.set=function(i){w._set(e,i,t)&&n(i,e)}),Object.defineProperty(t,e.name,i)},_get:function(e,t){return t["_"+e.name]},_set:function(e,t,n){var i="_"+e.name,s=n[i],o=e.transform(null!=t?t:e.defaultValue);return n[i]=o,o!==s}}),b=w,_=a.extend((function(){this._services={}}),{getService:function(e){var t=this._services[e];if(!t)throw new Error("Service is not being managed with name: "+e);return t},setService:function(e,t){if(this._services[e])throw new Error("Service is already managed with name: "+e);t&&(this._services[e]=t)}}),y=new b([new g("background",!0,"white"),new g("backgroundAlpha",!0,1,m.abs),new g("element"),new g("foreground",!0,"black"),new g("foregroundAlpha",!0,1,m.abs),new g("level",!0,"L",m.toUpperCase),new g("mime",!0,"image/png"),new g("padding",!0,null,m.abs),new g("size",!0,100,m.abs),new g("value",!0,"")]),k=new _,M=a.extend((function(e){y.init(e,this,this.update.bind(this));var t=y.get("element",this),n=k.getService("element"),i=t&&n.isCanvas(t)?t:n.createCanvas(),s=t&&n.isImage(t)?t:n.createImage();this._canvasRenderer=new c(this,i,!0),this._imageRenderer=new v(this,s,s===t),this.update()}),{get:function(){return y.getAll(this)},set:function(e){y.setAll(e,this)&&this.update()},toDataURL:function(e){return this.canvas.toDataURL(e||this.mime)},update:function(){var e=new p({level:this.level,value:this.value});this._canvasRenderer.render(e),this._imageRenderer.render(e)}},{use:function(e){k.setService(e.getName(),e)}});Object.defineProperties(M.prototype,{canvas:{get:function(){return this._canvasRenderer.getElement()}},image:{get:function(){return this._imageRenderer.getElement()}}});var A=M,O=a.extend({getName:function(){}}).extend({createCanvas:function(){},createImage:function(){},getName:function(){return"element"},isCanvas:function(e){},isImage:function(e){}}).extend({createCanvas:function(){return document.createElement("canvas")},createImage:function(){return document.createElement("img")},isCanvas:function(e){return e instanceof HTMLCanvasElement},isImage:function(e){return e instanceof HTMLImageElement}});return A.use(new O),A},"object"==typeof n&&void 0!==t?t.exports=s():"function"==typeof define&&define.amd?define(s):i.QRious=s()},{}],3:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0});var i=e("../window/settingstwofa/SettingsTwofaWindowView"),s=e("../window/code/CodeWindowView"),o=e("pmc-web");o.Starter.objectFactory.register(s.CodeWindowView),o.Starter.addEventListener("instanceregistered",(function(e){e.instance&&"com.privmx.core.window.settings.SettingsWindowView"==e.instance.className&&new i.SettingsTwofaWindowView(e.instance)}),"twofa","ethernal")},{"../window/code/CodeWindowView":4,"../window/settingstwofa/SettingsTwofaWindowView":7,"pmc-web":1}],4:[function(e,t,n){"use strict";var i,s=this&&this.__extends||(i=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n])},function(e,t){function n(){this.constructor=e}i(e,t),e.prototype=null===t?Object.create(t):(n.prototype=t.prototype,new n)});Object.defineProperty(n,"__esModule",{value:!0});var o=e("pmc-web"),a=e("./template/main.html"),r=e("./template/messageTemplate.html"),c=function(e){function t(t){return e.call(this,t,a.func)||this}return s(t,e),t.prototype.initWindow=function(e){var t=this;this.digitsOnly=!0,"googleAuthenticator"==e.data.type?this.inputSize=3:this.inputSize=1,this.$main.on("click",".submit-code",this.onSubmitCodeClick.bind(this)),this.$main.on("click",".cancel",this.onCancelClick.bind(this)),this.$main.on("click",".resend-code",this.onResendCodeClick.bind(this)),this.$main.find(".code-input").on("keydown",this.onKeydown.bind(this)),this.$main.find(".code-input").on("input",this.onInput.bind(this)),this.refreshWindowHeight(),this.$main.find(".code-input").first().focus();try{e.u2f&&e.u2f.login?navigator.credentials.get({publicKey:e.u2f.login}).then((function(e){var n={u2fLogin:{id:e.id,rawId:new Uint8Array(e.rawId),type:e.type,response:{authenticatorData:new Uint8Array(e.response.authenticatorData),clientDataJSON:new Uint8Array(e.response.clientDataJSON),signature:new Uint8Array(e.response.signature),userHandle:e.response.userHandle?new Uint8Array(e.response.userHandle):e.response.userHandle}},rememberDeviceId:t.getRemeberDeviceIdValue()};t.triggerEvent("submit",n)})).catch((function(e){t.showMessage("Error","error"),console.error("Error",e,e?e.message:null,e?e.stack:null)})):e.u2f&&e.u2f.register&&navigator.credentials.create({publicKey:e.u2f.register}).then((function(e){var n={u2fRegister:{id:e.id,rawId:new Uint8Array(e.rawId),type:e.type,response:{attestationObject:new Uint8Array(e.response.attestationObject),clientDataJSON:new Uint8Array(e.response.clientDataJSON)}},rememberDeviceId:t.getRemeberDeviceIdValue()};t.triggerEvent("submit",n)})).catch((function(e){t.showMessage("Error","error"),console.error("Error",e,e?e.message:null,e?e.stack:null)}))}catch(e){console.log("Error",e),this.showMessage("Error","error")}},t.prototype.onKeydown=function(e){if(13!=e.keyCode)if(8!=e.keyCode){if(this.digitsOnly){if(1==e.key.length&&-1=="0123456789".indexOf(e.key))return e.preventDefault(),!1}}else{var t=e.target;if(0==t.value.length){var n=o.JQuery(t).prev();n.length&&n.focus()}}else this.submit()},t.prototype.onInput=function(e){var t=e.target;if(t.value.length>this.inputSize&&(t.value=t.value.substr(0,this.inputSize)),t.value.length>=this.inputSize){var n=o.JQuery(t).next();n.length&&n.focus()}},t.prototype.onSubmitCodeClick=function(){this.submit()},t.prototype.onCancelClick=function(){this.triggerEvent("cancel")},t.prototype.onResendCodeClick=function(){this.disableForm(this.$main.find(".resend-code")),this.triggerEvent("resend")},t.prototype.disableForm=function(e){this.$main.find("input button").prop("disabled",!0),e&&e.prepend('<i class="fa fa-spin fa-circle-o-notch"></i>')},t.prototype.enableForm=function(){this.$main.find("input button").prop("disabled",!1),this.$main.find("button i").remove()},t.prototype.getRemeberDeviceIdValue=function(){return this.$main.find(".remember-device-id").is(":checked")},t.prototype.submit=function(){var e,t=this,n="";if(this.$main.find(".code-input").each((function(i,s){if(s.value.length!=t.inputSize)return e=s,!1;n+=s.value})),null==e){this.clearMessage(),this.disableForm(this.$main.find(".submit-code"));var i={code:n,rememberDeviceId:this.getRemeberDeviceIdValue()};this.triggerEvent("submit",i)}else{var s=o.JQuery(document.activeElement);s.hasClass(".code-input")&&s.val().length!=this.inputSize||e.focus()}},t.prototype.clearState=function(){this.enableForm(),this.$main.find(".code-input").first().focus()},t.prototype.showMessage=function(e,t){var n=this.templateManager.createTemplate(r.func).renderToJQ({type:e,message:t});this.$main.find(".message").removeClass("hide").empty().append(n),this.refreshWindowHeight()},t.prototype.clearMessage=function(){this.$main.find(".message").addClass("hide"),this.refreshWindowHeight()},t}(o.window.base.BaseWindowView);n.CodeWindowView=c,c.prototype.className="com.privmx.plugin.twofa.window.code.CodeWindowView"},{"./template/main.html":5,"./template/messageTemplate.html":6,"pmc-web":1}],5:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.func={helper:"com.privmx.core.web-utils.MailClientViewHelper",func:function(e,t,n){var i="",s=function(e){i+=e};return s('<div class="window-main window-code">\n  <div class="header">\n    '),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.header"))),s('\n  </div>\n\n  <div class="info">\n  '),"sms"==e.data.type?(s("\n    "),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.info.sms",e.data.mobile))),s("\n  ")):"email"==e.data.type?(s("\n    "),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.info.email",e.data.email))),s("\n  ")):"googleAuthenticator"==e.data.type?(s("\n    "),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.info.googleAuthenticator"))),s("\n  ")):"u2f"==e.data.type&&(s("\n    "),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.info.u2f"))),s("\n  ")),s('\n  </div>\n  <div class="message"></div>\n  <div class="input-container type-'),s(n.escapeHtml(e.data.type)),s('">\n    '),"googleAuthenticator"==e.data.type?s('\n      <input class="form-control code-input" type="text" />\n      <input class="form-control code-input" type="text" />\n    '):"email"!=e.data.type&&"sms"!=e.data.type||s('\n      <input class="form-control code-input" type="text" />\n      <input class="form-control code-input" type="text" />\n      <input class="form-control code-input" type="text" />\n      <input class="form-control code-input" type="text" />\n    '),s('\n  </div>\n  <div class="remember-cnt">\n    <label>\n      <input type="checkbox" class="remember-device-id" />\n      '),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.remember"))),s('\n    </label>\n  </div>\n  <div class="button-container">\n    '),"email"!=e.data.type&&"sms"!=e.data.type&&"googleAuthenticator"!=e.data.type||(s('\n      <button class="btn btn-primary btn-block btn-lg submit-code">\n        '),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.submit"))),s("\n      </button>\n    ")),s("\n    "),"email"!=e.data.type&&"sms"!=e.data.type||(s('\n      <div class="or"><div>lub</div></div>\n      <button class="btn btn-default btn-block btn-lg resend-code">\n        '),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.resend"))),s("\n      </button>\n    ")),s("\n    "),e.cancellable&&(s('\n      <button class="btn btn-block btn-lg cancel">\n        '),s(n.escapeHtml(n.i18n("plugin.twofa.window.code.cancel"))),s("\n      </button>\n    ")),s("\n  </div>\n</div>\n"),i}}},{}],6:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.func={helper:"com.privmx.core.web-utils.MailClientViewHelper",func:function(e,t,n){var i="",s=function(e){i+=e};return s('<div class="message-'),s(n.escapeHtml(e.type)),s('">\n    <i class="fa '),s(n.escapeHtml("success"==e.type?"fa-check-circle":"info"==e.type?"fa-info-circle":"fa-exclamation-circle")),s('"></i>\n    '),s(n.escapeHtml(e.message)),s("\n</div>"),i}}},{}],7:[function(e,t,n){"use strict";var i,s=this&&this.__extends||(i=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n])},function(e,t){function n(){this.constructor=e}i(e,t),e.prototype=null===t?Object.create(t):(n.prototype=t.prototype,new n)});Object.defineProperty(n,"__esModule",{value:!0});var o=e("pmc-web"),a=e("./template/main.html"),r=e("qrious"),c=function(e){function t(t){var n=e.call(this,t,a.func)||this;return n.menuModel={id:"plugin-twofa",priority:250,groupId:"account",icon:"lock",labelKey:"plugin.twofa.window.settingstwofa.menu.item.twofa.label"},n.parent.registerTab({tab:n}),n}return s(t,e),t.prototype.afterRenderContent=function(e){this.scope=new o.webUtils.Scope(this.$main.find(".section"),{methods:e.methods,enabled:e.enabled,type:e.type,googleAuthenticatorKey:e.googleAuthenticatorKey,email:e.email,mobile:e.mobile,saving:!1,save:this.onSaveButtonClick.bind(this),toggleEnabled:this.onToggleEnabled.bind(this),generateKey:this.onGenerateGoogleAuthenticatorKeyClick.bind(this)}),this.qr=new r({level:"M",size:200,value:e.googleAuthenticatorKeyUri}),this.$main.find(".canvas-placeholder").append(this.qr.canvas)},t.prototype.onToggleEnabled=function(){var e=this,t=!this.scope.data.enabled;t?this.setEnabled(t):(this.triggerEvent("disable"),this.updateDirty()),setTimeout((function(){e.updateDirty()}),0)},t.prototype.setEnabled=function(e){this.scope.data.enabled=e,this.scope.onChange(),this.$main.find(".twofa-enabled").prop("checked",this.scope.data.enabled),this.updateDirty()},t.prototype.onSaveButtonClick=function(){this.scope.data.saving=!0,this.scope.onChange(),this.saveData()},t.prototype.onGenerateGoogleAuthenticatorKeyClick=function(){this.triggerEvent("generateGoogleAuthenticatorKey")},t.prototype.getData=function(){var e=this.scope.data.type;if("googleAuthenticator"==e)return{type:e,googleAuthenticatorKey:this.scope.data.googleAuthenticatorKey};if("email"==e)return{type:e,email:this.scope.data.email};if("sms"==e)return{type:e,mobile:this.scope.data.mobile};if("u2f"==e)return{type:e};throw new Error("Invalid 2FA type '"+e+"'")},t.prototype.saveData=function(){this.triggerEvent("enable",this.getData())},t.prototype.finishSaving=function(e){var t=this;void 0===e&&(e=!1),setTimeout((function(){t.scope.data.saving=!1,t.scope.onChange(),e&&t.resetDirty(),setTimeout((function(){e&&t.resetDirty()}),0)}),500)},t.prototype.setGoogleAuthenticatorKey=function(e,t){this.scope.data.googleAuthenticatorKey=e,this.qr.set({value:t}),this.scope.onChange()},t.prototype.getState=function(){var e=this.getData();return e.enabled=this.scope.data.enabled,JSON.stringify(e)},t.prototype.isDirty=function(){return this.getState()!=this.savedState},t.prototype.resetDirty=function(){this.savedState=this.getState(),this.updateDirty()},t}(o.window.settings.BaseView);n.SettingsTwofaWindowView=c,c.prototype.className="com.privmx.plugin.twofa.window.settingstwofa.SettingsTwofaWindowView"},{"./template/main.html":8,"pmc-web":1,qrious:2}],8:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.func={helper:"com.privmx.core.web-utils.MailClientViewHelper",func:function(e,t,n){var i="",s=function(e){i+=e};return s('<div class="section twofa-section">\n  <div class="section-info">\n    '),s(n.i18n("plugin.twofa.window.settingstwofa.info","<b>","</b>")),s('\n  </div>\n  <div class="switcher-row" vf-visible="{true}">\n    <input type="checkbox" class="twofa-enabled" vf-click="toggleEnabled()" '),e.enabled&&s("checked"),s(' />\n    <span class="switch-label" vf-click="toggleEnabled()">\n      '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.enable"))),s('\n    </span>\n  </div>\n  \n  <div class="base-form" vf-visible="enabled">\n    <div class="fields">\n      \n      <div class="field">\n        <div class="info">\n          '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.type.label"))),s('\n        </div>\n        <div class="input radio">\n          '),-1!=e.methods.indexOf("googleAuthenticator")&&(s('\n            <label>\n              <input type="radio" value="googleAuthenticator" vf-model="type" />\n              '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.type.value.googleAuthenticator"))),s("\n            </label>\n          ")),s("\n          "),-1!=e.methods.indexOf("email")&&(s('\n            <label>\n              <input type="radio" value="email" vf-model="type" />\n              '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.type.value.email"))),s("\n            </label>\n          ")),s("\n          "),-1!=e.methods.indexOf("sms")&&(s('\n            <label>\n              <input type="radio" value="sms" vf-model="type" />\n              '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.type.value.sms"))),s("\n            </label>\n          ")),s("\n          "),-1!=e.methods.indexOf("u2f")&&(s('\n            <label>\n              <input type="radio" value="u2f" vf-model="type" />\n              '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.type.value.u2f"))),s("\n            </label>\n          ")),s('\n        </div>\n      </div>\n      \n      <div class="field" vf-visible="type == \'googleAuthenticator\'">\n        <div class="info">\n          '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.googleAuthenticatorKey.label"))),s('\n        </div>\n        <div class="input">\n          <input type="text" placeholder="" vf-model="googleAuthenticatorKey" readonly="readonly" />\n          <div class="canvas-placeholder">\n          </div>\n        </div>\n      </div>\n      \n      <div class="field" vf-visible="type == \'email\'">\n        <div class="info">\n          '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.email.label"))),s('\n        </div>\n        <div class="input">\n          <input type="text" placeholder="" vf-model="email" />\n        </div>\n      </div>\n      \n      <div class="field" vf-visible="type == \'sms\'">\n        <div class="info">\n          '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.sms.label"))),s('\n        </div>\n        <div class="input">\n          <input type="text" placeholder="" vf-model="mobile" />\n        </div>\n      </div>\n      \n      <div class="field buttons" vf-class="{noMargin: this.type == \'googleAuthenticator\'}"">\n        <div class="info">\n        </div>\n        <div class="input">\n          <button class="btn btn-success save-button progress-button" vf-click="save()" vf-disabled="saving">\n            <i class="fa fa-save"></i>\n            <span vf-visible="{!this.saving}">'),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.button.save.text"))),s('</span>\n            <span vf-visible="saving">'),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.button.saving"))),s('</span>\n          </button>\n          <button class="btn btn-default gray" vf-click="generateKey()" vf-visible="type == \'googleAuthenticator\'">\n            <i class="fa fa-magic"></i>\n            '),s(n.escapeHtml(n.i18n("plugin.twofa.window.settingstwofa.button.generateKey.text"))),s("\n          </button>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n</div>\n"),i}}},{}]},{},[3]);
//# sourceMappingURL=view.js.map
