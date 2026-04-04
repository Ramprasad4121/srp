(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const n of r.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function t(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=t(i);fetch(i.href,r)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const M=globalThis,H=M.ShadowRoot&&(M.ShadyCSS===void 0||M.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,D=Symbol(),F=new WeakMap;let te=class{constructor(e,t,s){if(this._$cssResult$=!0,s!==D)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(H&&e===void 0){const s=t!==void 0&&t.length===1;s&&(e=F.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),s&&F.set(t,e))}return e}toString(){return this.cssText}};const ae=o=>new te(typeof o=="string"?o:o+"",void 0,D),N=(o,...e)=>{const t=o.length===1?o[0]:e.reduce((s,i,r)=>s+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+o[r+1],o[0]);return new te(t,o,D)},le=(o,e)=>{if(H)o.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const t of e){const s=document.createElement("style"),i=M.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=t.cssText,o.appendChild(s)}},J=H?o=>o:o=>o instanceof CSSStyleSheet?(e=>{let t="";for(const s of e.cssRules)t+=s.cssText;return ae(t)})(o):o;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:de,defineProperty:ce,getOwnPropertyDescriptor:he,getOwnPropertyNames:pe,getOwnPropertySymbols:ue,getPrototypeOf:fe}=Object,U=globalThis,V=U.trustedTypes,me=V?V.emptyScript:"",ge=U.reactiveElementPolyfillSupport,E=(o,e)=>o,z={toAttribute(o,e){switch(e){case Boolean:o=o?me:null;break;case Object:case Array:o=o==null?o:JSON.stringify(o)}return o},fromAttribute(o,e){let t=o;switch(e){case Boolean:t=o!==null;break;case Number:t=o===null?null:Number(o);break;case Object:case Array:try{t=JSON.parse(o)}catch{t=null}}return t}},se=(o,e)=>!de(o,e),W={attribute:!0,type:String,converter:z,reflect:!1,useDefault:!1,hasChanged:se};Symbol.metadata??=Symbol("metadata"),U.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=W){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(e,s,t);i!==void 0&&ce(this.prototype,e,i)}}static getPropertyDescriptor(e,t,s){const{get:i,set:r}=he(this.prototype,e)??{get(){return this[t]},set(n){this[t]=n}};return{get:i,set(n){const d=i?.call(this);r?.call(this,n),this.requestUpdate(e,d,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??W}static _$Ei(){if(this.hasOwnProperty(E("elementProperties")))return;const e=fe(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(E("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(E("properties"))){const t=this.properties,s=[...pe(t),...ue(t)];for(const i of s)this.createProperty(i,t[i])}const e=this[Symbol.metadata];if(e!==null){const t=litPropertyMetadata.get(e);if(t!==void 0)for(const[s,i]of t)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const i=this._$Eu(t,s);i!==void 0&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const s=new Set(e.flat(1/0).reverse());for(const i of s)t.unshift(J(i))}else e!==void 0&&t.push(J(e));return t}static _$Eu(e,t){const s=t.attribute;return s===!1?void 0:typeof s=="string"?s:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return le(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){const s=this.constructor.elementProperties.get(e),i=this.constructor._$Eu(e,s);if(i!==void 0&&s.reflect===!0){const r=(s.converter?.toAttribute!==void 0?s.converter:z).toAttribute(t,s.type);this._$Em=e,r==null?this.removeAttribute(i):this.setAttribute(i,r),this._$Em=null}}_$AK(e,t){const s=this.constructor,i=s._$Eh.get(e);if(i!==void 0&&this._$Em!==i){const r=s.getPropertyOptions(i),n=typeof r.converter=="function"?{fromAttribute:r.converter}:r.converter?.fromAttribute!==void 0?r.converter:z;this._$Em=i;const d=n.fromAttribute(t,r.type);this[i]=d??this._$Ej?.get(i)??d,this._$Em=null}}requestUpdate(e,t,s,i=!1,r){if(e!==void 0){const n=this.constructor;if(i===!1&&(r=this[e]),s??=n.getPropertyOptions(e),!((s.hasChanged??se)(r,t)||s.useDefault&&s.reflect&&r===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,s))))return;this.C(e,t,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:i,wrapped:r},n){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,n??t??this[e]),r!==!0||n!==void 0)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),i===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,r]of this._$Ep)this[i]=r;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,r]of s){const{wrapped:n}=r,d=this[i];n!==!0||this._$AL.has(i)||d===void 0||this.C(i,void 0,r,d)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(t)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[E("elementProperties")]=new Map,x[E("finalized")]=new Map,ge?.({ReactiveElement:x}),(U.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const B=globalThis,G=o=>o,T=B.trustedTypes,K=T?T.createPolicy("lit-html",{createHTML:o=>o}):void 0,ie="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,oe="?"+_,_e=`<${oe}>`,b=document,k=()=>b.createComment(""),C=o=>o===null||typeof o!="object"&&typeof o!="function",j=Array.isArray,ye=o=>j(o)||typeof o?.[Symbol.iterator]=="function",L=`[ 	
\f\r]`,S=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Y=/-->/g,Z=/>/g,$=RegExp(`>|${L}(?:([^\\s"'>=/]+)(${L}*=${L}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),X=/'/g,Q=/"/g,re=/^(?:script|style|textarea|title)$/i,$e=o=>(e,...t)=>({_$litType$:o,strings:e,values:t}),p=$e(1),w=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),ee=new WeakMap,v=b.createTreeWalker(b,129);function ne(o,e){if(!j(o)||!o.hasOwnProperty("raw"))throw Error("invalid template strings array");return K!==void 0?K.createHTML(e):e}const ve=(o,e)=>{const t=o.length-1,s=[];let i,r=e===2?"<svg>":e===3?"<math>":"",n=S;for(let d=0;d<t;d++){const a=o[d];let c,u,l=-1,f=0;for(;f<a.length&&(n.lastIndex=f,u=n.exec(a),u!==null);)f=n.lastIndex,n===S?u[1]==="!--"?n=Y:u[1]!==void 0?n=Z:u[2]!==void 0?(re.test(u[2])&&(i=RegExp("</"+u[2],"g")),n=$):u[3]!==void 0&&(n=$):n===$?u[0]===">"?(n=i??S,l=-1):u[1]===void 0?l=-2:(l=n.lastIndex-u[2].length,c=u[1],n=u[3]===void 0?$:u[3]==='"'?Q:X):n===Q||n===X?n=$:n===Y||n===Z?n=S:(n=$,i=void 0);const g=n===$&&o[d+1].startsWith("/>")?" ":"";r+=n===S?a+_e:l>=0?(s.push(c),a.slice(0,l)+ie+a.slice(l)+_+g):a+_+(l===-2?d:g)}return[ne(o,r+(o[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),s]};class O{constructor({strings:e,_$litType$:t},s){let i;this.parts=[];let r=0,n=0;const d=e.length-1,a=this.parts,[c,u]=ve(e,t);if(this.el=O.createElement(c,s),v.currentNode=this.el.content,t===2||t===3){const l=this.el.content.firstChild;l.replaceWith(...l.childNodes)}for(;(i=v.nextNode())!==null&&a.length<d;){if(i.nodeType===1){if(i.hasAttributes())for(const l of i.getAttributeNames())if(l.endsWith(ie)){const f=u[n++],g=i.getAttribute(l).split(_),R=/([.?@])?(.*)/.exec(f);a.push({type:1,index:r,name:R[2],strings:g,ctor:R[1]==="."?xe:R[1]==="?"?we:R[1]==="@"?Ae:I}),i.removeAttribute(l)}else l.startsWith(_)&&(a.push({type:6,index:r}),i.removeAttribute(l));if(re.test(i.tagName)){const l=i.textContent.split(_),f=l.length-1;if(f>0){i.textContent=T?T.emptyScript:"";for(let g=0;g<f;g++)i.append(l[g],k()),v.nextNode(),a.push({type:2,index:++r});i.append(l[f],k())}}}else if(i.nodeType===8)if(i.data===oe)a.push({type:2,index:r});else{let l=-1;for(;(l=i.data.indexOf(_,l+1))!==-1;)a.push({type:7,index:r}),l+=_.length-1}r++}}static createElement(e,t){const s=b.createElement("template");return s.innerHTML=e,s}}function A(o,e,t=o,s){if(e===w)return e;let i=s!==void 0?t._$Co?.[s]:t._$Cl;const r=C(e)?void 0:e._$litDirective$;return i?.constructor!==r&&(i?._$AO?.(!1),r===void 0?i=void 0:(i=new r(o),i._$AT(o,t,s)),s!==void 0?(t._$Co??=[])[s]=i:t._$Cl=i),i!==void 0&&(e=A(o,i._$AS(o,e.values),i,s)),e}class be{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:s}=this._$AD,i=(e?.creationScope??b).importNode(t,!0);v.currentNode=i;let r=v.nextNode(),n=0,d=0,a=s[0];for(;a!==void 0;){if(n===a.index){let c;a.type===2?c=new P(r,r.nextSibling,this,e):a.type===1?c=new a.ctor(r,a.name,a.strings,this,e):a.type===6&&(c=new Se(r,this,e)),this._$AV.push(c),a=s[++d]}n!==a?.index&&(r=v.nextNode(),n++)}return v.currentNode=b,i}p(e){let t=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}}class P{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,i){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=A(this,e,t),C(e)?e===h||e==null||e===""?(this._$AH!==h&&this._$AR(),this._$AH=h):e!==this._$AH&&e!==w&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):ye(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==h&&C(this._$AH)?this._$AA.nextSibling.data=e:this.T(b.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:s}=e,i=typeof s=="number"?this._$AC(e):(s.el===void 0&&(s.el=O.createElement(ne(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(t);else{const r=new be(i,this),n=r.u(this.options);r.p(t),this.T(n),this._$AH=r}}_$AC(e){let t=ee.get(e.strings);return t===void 0&&ee.set(e.strings,t=new O(e)),t}k(e){j(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let s,i=0;for(const r of e)i===t.length?t.push(s=new P(this.O(k()),this.O(k()),this,this.options)):s=t[i],s._$AI(r),i++;i<t.length&&(this._$AR(s&&s._$AB.nextSibling,i),t.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const s=G(e).nextSibling;G(e).remove(),e=s}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}}class I{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,i,r){this.type=1,this._$AH=h,this._$AN=void 0,this.element=e,this.name=t,this._$AM=i,this.options=r,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=h}_$AI(e,t=this,s,i){const r=this.strings;let n=!1;if(r===void 0)e=A(this,e,t,0),n=!C(e)||e!==this._$AH&&e!==w,n&&(this._$AH=e);else{const d=e;let a,c;for(e=r[0],a=0;a<r.length-1;a++)c=A(this,d[s+a],t,a),c===w&&(c=this._$AH[a]),n||=!C(c)||c!==this._$AH[a],c===h?e=h:e!==h&&(e+=(c??"")+r[a+1]),this._$AH[a]=c}n&&!i&&this.j(e)}j(e){e===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class xe extends I{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===h?void 0:e}}class we extends I{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==h)}}class Ae extends I{constructor(e,t,s,i,r){super(e,t,s,i,r),this.type=5}_$AI(e,t=this){if((e=A(this,e,t,0)??h)===w)return;const s=this._$AH,i=e===h&&s!==h||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,r=e!==h&&(s===h||i);i&&this.element.removeEventListener(this.name,this,s),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class Se{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){A(this,e)}}const Ee=B.litHtmlPolyfillSupport;Ee?.(O,P),(B.litHtmlVersions??=[]).push("3.3.2");const ke=(o,e,t)=>{const s=t?.renderBefore??e;let i=s._$litPart$;if(i===void 0){const r=t?.renderBefore??null;s._$litPart$=i=new P(e.insertBefore(k(),r),r,void 0,t??{})}return i._$AI(o),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const q=globalThis;class y extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=ke(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return w}}y._$litElement$=!0,y.finalized=!0,q.litElementHydrateSupport?.({LitElement:y});const Ce=q.litElementPolyfillSupport;Ce?.({LitElement:y});(q.litElementVersions??=[]).push("4.2.2");class Oe{constructor(e="/api"){this.baseUrl=e}async request(e,t){const s=await fetch(`${this.baseUrl}${e}`,t);if(!s.ok)throw new Error(`Gateway request failed: ${s.status} ${s.statusText}`);return s.json()}async getBootstrap(){return this.request("/bootstrap")}async getSetup(){return this.request("/setup")}async getRuntime(){return this.request("/runtime")}async startRuntime(e){await this.request("/runtime/start",{method:"POST",body:JSON.stringify({mode:e}),headers:{"Content-Type":"application/json"}})}async setRole(e){try{return{ok:!0,data:await this.request("/setup/role",{method:"POST",body:JSON.stringify({role:e}),headers:{"Content-Type":"application/json"}})}}catch(t){return{ok:!1,data:null,error:t.message}}}async getConversations(){try{return{ok:!0,data:await this.request("/chat/conversations")}}catch(e){return{ok:!1,data:[],error:e.message}}}async createConversation(e){try{return{ok:!0,data:await this.request("/chat/conversations",{method:"POST",body:JSON.stringify({title:e}),headers:{"Content-Type":"application/json"}})}}catch(t){return{ok:!1,data:null,error:t.message}}}async addMessage(e,t){try{return{ok:!0,data:await this.request(`/chat/conversations/${e}/messages`,{method:"POST",body:JSON.stringify({content:t}),headers:{"Content-Type":"application/json"}})}}catch(s){return{ok:!1,data:null,error:"Network Error",detail:s.message}}}async getSkills(){try{return{ok:!0,data:await this.request("/skills")}}catch(e){return{ok:!1,data:[],error:e.message}}}}const m=new Oe;class Pe extends y{static properties={_role:{state:!0},_step:{state:!0}};static styles=N`
    :host {
      display: block;
      max-width: 800px;
      margin: 4rem auto;
      padding: 2rem;
      background: #111318;
      border: 1px solid #262a33;
      border-radius: 8px;
    }

    h1 { color: #00f5a0; margin-bottom: 2rem; }
    
    .step {
      margin-bottom: 3rem;
    }

    .options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .option-card {
      padding: 1.5rem;
      background: #1a1d23;
      border: 1px solid #262a33;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .option-card:hover { border-color: #00f5a0; }
    .option-card.selected { border-color: #00f5a0; background: #004d32; }

    .option-title { font-weight: 600; margin-bottom: 0.5rem; display: block; }
    .option-hint { font-size: 0.875rem; color: #9499ab; }

    .btn-primary {
      background: #00f5a0;
      color: #08090a;
      border: none;
      padding: 1rem 2rem;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      font-size: 1rem;
    }
  `;constructor(){super(),this._role="auditor",this._step=1}render(){return p`
      <h1>SRP Onboarding</h1>
      
      ${this._step===1?this.renderRoleStep():this.renderFinalStep()}
    `}renderRoleStep(){return p`
      <div class="step">
        <p>Choose your primary methodology focus:</p>
        <div class="options">
          <div class="option-card ${this._role==="auditor"?"selected":""}" 
               @click=${()=>this._role="auditor"}>
            <span class="option-title">Auditor</span>
            <span class="option-hint">Deep security reasoning, invariant extraction, and exploit proving.</span>
          </div>
          <div class="option-card ${this._role==="developer"?"selected":""}" 
               @click=${()=>this._role="developer"}>
            <span class="option-title">Developer</span>
            <span class="option-hint">NatSpec generation, test suite expansion, and secure build feedback.</span>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click=${this.saveRole}>Continue</button>
    `}renderFinalStep(){return p`
      <div class="step">
        <p>Your role has been set to <strong>${this._role}</strong>.</p>
        <p>To finalize provider keys and workspace settings, please use the CLI:</p>
        <pre style="background: #000; padding: 1rem; border-radius: 4px; color: #00f5a0;">srp onboard</pre>
      </div>
      <button class="btn-primary" @click=${()=>window.location.href="/"}>Back to Dashboard</button>
    `}async saveRole(){try{await m.startRuntime(this._role),this._step=2}catch(e){alert("Failed to save role: "+e)}}}customElements.define("setup-view",Pe);class Re extends y{static properties={role:{type:String},content:{type:String}};static styles=N`
    :host {
      display: block;
      margin: 0;
      border-bottom: 1px solid #f5f5f5;
      font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
    }

    .message {
      display: flex;
      flex-direction: column;
      padding: 20px 24px;
    }

    .role-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .role-user {
      color: #0052FF;
    }

    .role-assistant {
      color: #000;
    }

    .role-system {
      color: #f59e0b;
    }
    
    .timestamp {
      color: #ccc;
      font-weight: normal;
    }

    .content {
      font-size: 13px;
      line-height: 1.7;
      color: #444;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .content.user {
      color: #000;
    }

    .role-assistant::before {
      content: "●";
      font-size: 8px;
    }

    .role-user::before {
      content: "○";
      font-size: 8px;
    }
  `;constructor(){super(),this.role="user",this.content=""}render(){let e=this.role==="assistant"?"SRP_AGENT":"REMOTE_OPERATOR";this.role==="system"&&(e="PROTOCOL_SYSTEM");const t=new Date().toLocaleTimeString([],{hour12:!1});return p`
      <div class="message">
        <div class="role-label role-${this.role}">
          ${e} <span class="timestamp">[${t}]</span>
        </div>
        <div class="content ${this.role}">
          ${this.content}
        </div>
      </div>
    `}}customElements.define("chat-message",Re);class Me extends y{static properties={mode:{type:String},_chatInput:{state:!0},_messages:{state:!0},_isLoading:{state:!0},_conversationId:{state:!0}};static styles=N`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
      box-sizing: border-box;
      position: relative;
      background-color: transparent;
      color: #000;
      overflow: hidden;
    }

    .content-wrapper {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
      background: #fff;
      border-left: 1px solid #eee;
      border-right: 1px solid #eee;
      overflow: hidden;
    }

    /* x402 Style Header */
    .x402-header {
      padding: 12px 20px;
      border-bottom: 1px solid #eee;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      letter-spacing: 2px;
      color: #999;
      text-transform: uppercase;
    }

    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #0052FF;
      border-radius: 50%;
      margin-right: 8px;
    }

    /* Chat Area */
    .chat-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 0;
      scrollbar-width: thin;
      scrollbar-color: #eee #fff;
    }

    .chat-history {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      text-align: center;
      color: #ccc;
      margin: auto;
      font-size: 13px;
      letter-spacing: 1px;
    }

    /* Chat Input Bar */
    .input-container {
      flex-shrink: 0;
      padding: 24px;
      background: #fff;
      border-top: 1px solid #f5f5f5;
    }

    .input-box {
      display: flex;
      align-items: center;
      background: #fcfcfc;
      border: 1px solid #eee;
      padding: 4px 4px 4px 16px;
      transition: border-color 0.2s ease;
    }

    .input-box.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .input-box:focus-within {
      border-color: #ddd;
    }

    .input-box input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 12px 0;
      font-size: 14px;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
      color: #000;
    }

    .input-box input::placeholder {
      color: #bbb;
    }

    .btn-send {
      background: #000;
      color: #fff;
      border: none;
      padding: 10px 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
    }

    .btn-send:hover {
      background: #333;
    }

    .btn-send:active {
      background: #444;
    }
    
    .loading-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;constructor(){super(),this.mode="auditor",this._chatInput="",this._messages=[],this._isLoading=!1,this._conversationId=null}async firstUpdated(){await this.initConversation()}async initConversation(){try{this._isLoading=!0;const e=await m.getConversations();if(e.ok&&e.data&&e.data.length>0){const t=e.data[e.data.length-1];this._conversationId=t.id,this._messages=t.messages||[]}else{const t=await m.createConversation("Default Audit Thread");t.ok&&(this._conversationId=t.data.id,this._messages=t.data.messages||[])}}catch(e){console.error("Failed to init conversation",e)}finally{this._isLoading=!1,this.scrollToBottom()}}handleInput(e){const t=e.target;this._chatInput=t.value}handleKeydown(e){e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),this.sendMessage())}async sendMessage(){if(!this._chatInput.trim()||!this._conversationId||this._isLoading)return;const e=this._chatInput.trim();this._chatInput="",this._isLoading=!0,this._messages=[...this._messages,{id:Date.now().toString(),role:"user",content:e}],this.scrollToBottom();try{const t=await m.addMessage(this._conversationId,e);t.ok?t.data.assistantMessage&&(this._messages=[...this._messages,t.data.assistantMessage]):(console.error("Failed to send message",t.error),this._messages=[...this._messages,{id:"err",role:"system",content:`Error: ${t.error} - ${t.detail}`}])}catch(t){console.error("Network failure sending message",t)}finally{this._isLoading=!1,this.scrollToBottom()}}scrollToBottom(){setTimeout(()=>{const e=this.shadowRoot?.querySelector(".chat-container");e&&(e.scrollTop=e.scrollHeight)},50)}render(){return p`
      <div class="content-wrapper">
        <header class="x402-header">
          <div><span class="status-dot"></span>SRP_NETWORK_ACTIVE</div>
          <div>PROTOCOL_V1.0</div>
        </header>

        <main class="chat-container">
          <div class="chat-history">
            ${this._messages.length===0?p`<div class="empty-state">${this._isLoading?"INITIALIZING_PROTOCOL...":"SYSTEM_IDLE: READY_FOR_COMMAND"}</div>`:this._messages.map(e=>p`
                  <chat-message .role=${e.role} .content=${e.content}></chat-message>
                `)}
          </div>
        </main>

        <footer class="input-container">
          <div class="input-box ${this._isLoading?"disabled":""}">
            <input 
              type="text" 
              placeholder=${this._isLoading?"WAITING_FOR_RESPONSE...":"EXECUTE_COMMAND (e.g., /scan, /analyze, /audit)..."} 
              .value=${this._chatInput}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
              ?disabled=${this._isLoading}
            />
            <button class="btn-send" @click=${this.sendMessage} ?disabled=${this._isLoading}>
              ${this._isLoading?p`<span class="loading-indicator"></span>`:p`↵`}
            </button>
          </div>
        </footer>
      </div>
    `}}customElements.define("chat-view",Me);class Te extends y{static properties={_bootstrap:{state:!0},_runtime:{state:!0},_loading:{state:!0},_path:{state:!0},_error:{state:!0},_skills:{state:!0},_sidebarOpen:{state:!0},_mode:{state:!0}};static styles=N`
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      background: #f7f9fa; /* x402 light background */
      color: #000;
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar Styles */
    .sidebar {
      background: #fff;
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
      z-index: 10;
      padding: 1.5rem 0;
      width: 260px;
      flex-shrink: 0;
      transition: margin-left 0.3s ease;
    }

    .sidebar.closed {
      margin-left: -260px;
    }

    .sidebar-header {
      padding: 0 1.5rem 1.5rem 1.5rem;
      border-bottom: 1px solid #e1e3e8;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .logo {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.05em;
    }

    .toggle-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0;
    }

    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0 1rem;
    }

    .nav-item {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: #666;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-item:hover {
      background: #f0f0f0;
      color: #000;
    }

    .nav-item.active {
      background: #000;
      color: #fff;
    }

    .sidebar-section {
      margin-top: 2rem;
      padding: 0 1rem;
    }

    .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      color: #999;
      margin-bottom: 0.75rem;
      padding: 0 1rem;
    }

    .mode-options {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 1rem;
    }

    .mode-item {
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      color: #666;
    }
    
    .mode-item.active {
      border: 1px solid #000;
      background: #f7f9fa;
      color: #000;
    }

    .skills-section {
      flex: 1;
      overflow-y: auto;
      margin-top: 2rem;
      padding: 0 1rem;
    }

    .skill-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .skill-item {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      padding: 0.4rem 1rem;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: default;
    }

    .skill-item::before {
      content: "•";
      margin-right: 0.5rem;
      color: #000;
    }

    .main-content {
      position: relative;
      flex: 1;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .room-header {
      background: #fff;
      border-bottom: 1px solid #000;
      padding: 1rem 1.5rem;
      font-size: 1.25rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      flex-shrink: 0;
      text-align: center;
    }

    .room-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .room-container.auditor-room {
      /* specific styling for auditor room if needed */
    }

    .room-container.developer-room {
      /* specific styling for developer room if needed */
    }

    .hamburger-btn {
      position: absolute;
      top: 1.5rem;
      left: 1.5rem;
      z-index: 20;
      background: #fff;
      border: 1px solid #000;
      border-radius: 4px;
      padding: 0.5rem;
      cursor: pointer;
      box-shadow: 2px 2px 0 rgba(0,0,0,0.1);
    }
  `;constructor(){super(),this._bootstrap=null,this._runtime=null,this._loading=!0,this._path=window.location.pathname,this._error=null,this._skills=[],this._sidebarOpen=!0,this._mode="auditor",console.log("SRP App initialized");const e=document.getElementById("boot-status");e&&(e.style.display="none"),document.body.style.background="#f7f9fa",document.body.style.color="#000",window.addEventListener("error",t=>{this._error=t.message,console.error("Global JS Error:",t)})}async firstUpdated(){await this.refresh(),window.addEventListener("popstate",()=>{this._path=window.location.pathname}),setInterval(()=>this.poll(),5e3)}async refresh(){try{const e=await m.getBootstrap();if(this._bootstrap=e,e.decision==="ready"){this._runtime=await m.getRuntime();try{const t=await m.getSkills();t.ok&&(this._skills=t.data)}catch(t){console.warn("Could not fetch skills",t)}}}catch(e){this._error="Failed to connect to SRP Gateway. Is it running?",console.error(e)}finally{this._loading=!1}}async poll(){if(this._bootstrap?.decision==="ready")try{const e=await m.getRuntime();this._runtime=e}catch{}}async updateMode(e){this._mode=e;try{await m.setRole(e)}catch(t){console.warn("Failed to update role on backend",t)}}render(){return this._error?p`
        <div style="border: 1px solid #ff4d4d; margin: 4rem auto; max-width: 800px; padding: 2rem; border-radius: 8px;">
          <h1 style="color: #ff4d4d;">System Error</h1>
          <p>${this._error}</p>
          <button style="background: #ff4d4d; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px;" @click=${()=>location.reload()}>Retry Connection</button>
        </div>
      `:this._loading?p`<div style="padding: 4rem; text-align: center; color: #000; font-family: 'JetBrains Mono', monospace;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">⚡</div>
        Initializing SRP Protocol...
      </div>`:this._path==="/setup"?p`<setup-view></setup-view>`:this._bootstrap?.decision!=="ready"?p`
        <div style="border: 1px solid #000; margin: 4rem auto; max-width: 800px; padding: 2rem; border-radius: 8px;">
          <h1>Onboarding Required</h1>
          <p>Your workspace is not yet ready for a security audit.</p>
          <a href="/setup" style="display:inline-block; margin-top:1rem; padding:0.75rem 1.5rem; background:#000; color:#fff; text-decoration:none; border-radius:4px;" @click=${this.navigate}>Configure in Web UI</a>
        </div>
      `:p`
      <div class="app-container">
        <!-- Persistent Sidebar -->
        <aside class="sidebar ${this._sidebarOpen?"":"closed"}">
          <div class="sidebar-header">
            <div class="logo-container">
              <span class="logo">SRP</span>
              <span style="font-size: 0.75rem; background: #000; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">WEB</span>
            </div>
            <button class="toggle-btn" @click=${()=>this._sidebarOpen=!1}>×</button>
          </div>
          
          <nav class="nav-menu">
            <div class="nav-item active">Chat Engine</div>
            <div class="nav-item">Methodology Audit</div>
            <div class="nav-item" @click=${()=>{window.history.pushState({},"","/setup"),this._path="/setup"}}>Settings</div>
          </nav>

          <div class="sidebar-section">
            <div class="section-title">Current Mode</div>
            <div class="mode-options">
              <div class="mode-item ${this._mode==="auditor"?"active":""}" @click=${()=>this.updateMode("auditor")}>
                Auditor
              </div>
              <div class="mode-item ${this._mode==="developer"?"active":""}" @click=${()=>this.updateMode("developer")}>
                Developer
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="section-title">Resources</div>
            <div class="nav-menu" style="padding: 0;">
              <div class="nav-item">Learning Section</div>
              <div class="nav-item">Documentation</div>
            </div>
          </div>

          <div class="skills-section">
            <div class="section-title">Active Skills (${this._skills.length})</div>
            <div class="skill-list">
              ${this._skills.length===0?p`<div style="padding: 0 1rem; font-size: 0.75rem; color: #999;">Loading...</div>`:this._skills.map(e=>p`<div class="skill-item" title=${e.name}>${e.name}</div>`)}
            </div>
          </div>
        </aside>

        <!-- Main Chat UI Area -->
        <main class="main-content">
          <div class="room-header">
            ${this._mode==="auditor"?"AUDITOR ROOM":"DEVELOPER ROOM"}
          </div>
          ${this._sidebarOpen?"":p`
            <button class="hamburger-btn" @click=${()=>this._sidebarOpen=!0}>
              ☰
            </button>
          `}
          <div class="room-container ${this._mode}-room">
            <chat-view .mode=${this._mode}></chat-view>
          </div>
        </main>
      </div>
    `}navigate(e){e.preventDefault();const t=e.currentTarget.href;window.history.pushState({},"",t),this._path=window.location.pathname}}customElements.define("srp-app",Te);
