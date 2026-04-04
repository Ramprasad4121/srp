(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const n of o.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function e(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(i){if(i.ep)return;i.ep=!0;const o=e(i);fetch(i.href,o)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const U=globalThis,L=U.ShadowRoot&&(U.ShadyCSS===void 0||U.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,I=Symbol(),q=new WeakMap;let tt=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==I)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(L&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=q.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&q.set(e,t))}return t}toString(){return this.cssText}};const at=r=>new tt(typeof r=="string"?r:r+"",void 0,I),et=(r,...t)=>{const e=r.length===1?r[0]:t.reduce((s,i,o)=>s+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+r[o+1],r[0]);return new tt(e,r,I)},lt=(r,t)=>{if(L)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),i=U.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=e.cssText,r.appendChild(s)}},V=L?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return at(e)})(r):r;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:dt,defineProperty:ht,getOwnPropertyDescriptor:ct,getOwnPropertyNames:pt,getOwnPropertySymbols:ut,getPrototypeOf:ft}=Object,T=globalThis,W=T.trustedTypes,mt=W?W.emptyScript:"",gt=T.reactiveElementPolyfillSupport,E=(r,t)=>r,z={toAttribute(r,t){switch(t){case Boolean:r=r?mt:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},st=(r,t)=>!dt(r,t),F={attribute:!0,type:String,converter:z,reflect:!1,useDefault:!1,hasChanged:st};Symbol.metadata??=Symbol("metadata"),T.litPropertyMetadata??=new WeakMap;let b=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=F){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);i!==void 0&&ht(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:o}=ct(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:i,set(n){const d=i?.call(this);o?.call(this,n),this.requestUpdate(t,d,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??F}static _$Ei(){if(this.hasOwnProperty(E("elementProperties")))return;const t=ft(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(E("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(E("properties"))){const e=this.properties,s=[...pt(e),...ut(e)];for(const i of s)this.createProperty(i,e[i])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,i]of e)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const i=this._$Eu(e,s);i!==void 0&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)e.unshift(V(i))}else t!==void 0&&e.push(V(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return lt(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const o=(s.converter?.toAttribute!==void 0?s.converter:z).toAttribute(e,s.type);this._$Em=t,o==null?this.removeAttribute(i):this.setAttribute(i,o),this._$Em=null}}_$AK(t,e){const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const o=s.getPropertyOptions(i),n=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:z;this._$Em=i;const d=n.fromAttribute(e,o.type);this[i]=d??this._$Ej?.get(i)??d,this._$Em=null}}requestUpdate(t,e,s,i=!1,o){if(t!==void 0){const n=this.constructor;if(i===!1&&(o=this[t]),s??=n.getPropertyOptions(t),!((s.hasChanged??st)(o,e)||s.useDefault&&s.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:o},n){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),o!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),i===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,o]of this._$Ep)this[i]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,o]of s){const{wrapped:n}=o,d=this[i];n!==!0||this._$AL.has(i)||d===void 0||this.C(i,void 0,o,d)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};b.elementStyles=[],b.shadowRootOptions={mode:"open"},b[E("elementProperties")]=new Map,b[E("finalized")]=new Map,gt?.({ReactiveElement:b}),(T.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const D=globalThis,J=r=>r,M=D.trustedTypes,G=M?M.createPolicy("lit-html",{createHTML:r=>r}):void 0,it="$lit$",g=`lit$${Math.random().toFixed(9).slice(2)}$`,rt="?"+g,$t=`<${rt}>`,_=document,P=()=>_.createComment(""),C=r=>r===null||typeof r!="object"&&typeof r!="function",j=Array.isArray,yt=r=>j(r)||typeof r?.[Symbol.iterator]=="function",H=`[ 	
\f\r]`,S=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,K=/-->/g,Z=/>/g,$=RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Y=/'/g,Q=/"/g,ot=/^(?:script|style|textarea|title)$/i,_t=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),u=_t(1),A=Symbol.for("lit-noChange"),c=Symbol.for("lit-nothing"),X=new WeakMap,y=_.createTreeWalker(_,129);function nt(r,t){if(!j(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return G!==void 0?G.createHTML(t):t}const bt=(r,t)=>{const e=r.length-1,s=[];let i,o=t===2?"<svg>":t===3?"<math>":"",n=S;for(let d=0;d<e;d++){const a=r[d];let h,p,l=-1,f=0;for(;f<a.length&&(n.lastIndex=f,p=n.exec(a),p!==null);)f=n.lastIndex,n===S?p[1]==="!--"?n=K:p[1]!==void 0?n=Z:p[2]!==void 0?(ot.test(p[2])&&(i=RegExp("</"+p[2],"g")),n=$):p[3]!==void 0&&(n=$):n===$?p[0]===">"?(n=i??S,l=-1):p[1]===void 0?l=-2:(l=n.lastIndex-p[2].length,h=p[1],n=p[3]===void 0?$:p[3]==='"'?Q:Y):n===Q||n===Y?n=$:n===K||n===Z?n=S:(n=$,i=void 0);const m=n===$&&r[d+1].startsWith("/>")?" ":"";o+=n===S?a+$t:l>=0?(s.push(h),a.slice(0,l)+it+a.slice(l)+g+m):a+g+(l===-2?d:m)}return[nt(r,o+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class R{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let o=0,n=0;const d=t.length-1,a=this.parts,[h,p]=bt(t,e);if(this.el=R.createElement(h,s),y.currentNode=this.el.content,e===2||e===3){const l=this.el.content.firstChild;l.replaceWith(...l.childNodes)}for(;(i=y.nextNode())!==null&&a.length<d;){if(i.nodeType===1){if(i.hasAttributes())for(const l of i.getAttributeNames())if(l.endsWith(it)){const f=p[n++],m=i.getAttribute(l).split(g),O=/([.?@])?(.*)/.exec(f);a.push({type:1,index:o,name:O[2],strings:m,ctor:O[1]==="."?At:O[1]==="?"?wt:O[1]==="@"?St:N}),i.removeAttribute(l)}else l.startsWith(g)&&(a.push({type:6,index:o}),i.removeAttribute(l));if(ot.test(i.tagName)){const l=i.textContent.split(g),f=l.length-1;if(f>0){i.textContent=M?M.emptyScript:"";for(let m=0;m<f;m++)i.append(l[m],P()),y.nextNode(),a.push({type:2,index:++o});i.append(l[f],P())}}}else if(i.nodeType===8)if(i.data===rt)a.push({type:2,index:o});else{let l=-1;for(;(l=i.data.indexOf(g,l+1))!==-1;)a.push({type:7,index:o}),l+=g.length-1}o++}}static createElement(t,e){const s=_.createElement("template");return s.innerHTML=t,s}}function w(r,t,e=r,s){if(t===A)return t;let i=s!==void 0?e._$Co?.[s]:e._$Cl;const o=C(t)?void 0:t._$litDirective$;return i?.constructor!==o&&(i?._$AO?.(!1),o===void 0?i=void 0:(i=new o(r),i._$AT(r,e,s)),s!==void 0?(e._$Co??=[])[s]=i:e._$Cl=i),i!==void 0&&(t=w(r,i._$AS(r,t.values),i,s)),t}class vt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=(t?.creationScope??_).importNode(e,!0);y.currentNode=i;let o=y.nextNode(),n=0,d=0,a=s[0];for(;a!==void 0;){if(n===a.index){let h;a.type===2?h=new k(o,o.nextSibling,this,t):a.type===1?h=new a.ctor(o,a.name,a.strings,this,t):a.type===6&&(h=new xt(o,this,t)),this._$AV.push(h),a=s[++d]}n!==a?.index&&(o=y.nextNode(),n++)}return y.currentNode=_,i}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=c,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=w(this,t,e),C(t)?t===c||t==null||t===""?(this._$AH!==c&&this._$AR(),this._$AH=c):t!==this._$AH&&t!==A&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):yt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==c&&C(this._$AH)?this._$AA.nextSibling.data=t:this.T(_.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=R.createElement(nt(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(e);else{const o=new vt(i,this),n=o.u(this.options);o.p(e),this.T(n),this._$AH=o}}_$AC(t){let e=X.get(t.strings);return e===void 0&&X.set(t.strings,e=new R(t)),e}k(t){j(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const o of t)i===e.length?e.push(s=new k(this.O(P()),this.O(P()),this,this.options)):s=e[i],s._$AI(o),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const s=J(t).nextSibling;J(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class N{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,o){this.type=1,this._$AH=c,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=o,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=c}_$AI(t,e=this,s,i){const o=this.strings;let n=!1;if(o===void 0)t=w(this,t,e,0),n=!C(t)||t!==this._$AH&&t!==A,n&&(this._$AH=t);else{const d=t;let a,h;for(t=o[0],a=0;a<o.length-1;a++)h=w(this,d[s+a],e,a),h===A&&(h=this._$AH[a]),n||=!C(h)||h!==this._$AH[a],h===c?t=c:t!==c&&(t+=(h??"")+o[a+1]),this._$AH[a]=h}n&&!i&&this.j(t)}j(t){t===c?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class At extends N{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===c?void 0:t}}class wt extends N{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==c)}}class St extends N{constructor(t,e,s,i,o){super(t,e,s,i,o),this.type=5}_$AI(t,e=this){if((t=w(this,t,e,0)??c)===A)return;const s=this._$AH,i=t===c&&s!==c||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,o=t!==c&&(s===c||i);i&&this.element.removeEventListener(this.name,this,s),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class xt{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){w(this,t)}}const Et=D.litHtmlPolyfillSupport;Et?.(R,k),(D.litHtmlVersions??=[]).push("3.3.2");const Pt=(r,t,e)=>{const s=e?.renderBefore??t;let i=s._$litPart$;if(i===void 0){const o=e?.renderBefore??null;s._$litPart$=i=new k(t.insertBefore(P(),o),o,void 0,e??{})}return i._$AI(r),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const B=globalThis;class v extends b{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Pt(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return A}}v._$litElement$=!0,v.finalized=!0,B.litElementHydrateSupport?.({LitElement:v});const Ct=B.litElementPolyfillSupport;Ct?.({LitElement:v});(B.litElementVersions??=[]).push("4.2.2");class Rt{constructor(t="/api"){this.baseUrl=t}async request(t,e){const s=await fetch(`${this.baseUrl}${t}`,e);if(!s.ok)throw new Error(`Gateway request failed: ${s.status} ${s.statusText}`);return s.json()}async getBootstrap(){return this.request("/bootstrap")}async getSetup(){return this.request("/setup")}async getRuntime(){return this.request("/runtime")}async startRuntime(t){await this.request("/runtime/start",{method:"POST",body:JSON.stringify({mode:t}),headers:{"Content-Type":"application/json"}})}}const x=new Rt;class kt extends v{static properties={_role:{state:!0},_step:{state:!0}};static styles=et`
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
  `;constructor(){super(),this._role="auditor",this._step=1}render(){return u`
      <h1>SRP Onboarding</h1>
      
      ${this._step===1?this.renderRoleStep():this.renderFinalStep()}
    `}renderRoleStep(){return u`
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
    `}renderFinalStep(){return u`
      <div class="step">
        <p>Your role has been set to <strong>${this._role}</strong>.</p>
        <p>To finalize provider keys and workspace settings, please use the CLI:</p>
        <pre style="background: #000; padding: 1rem; border-radius: 4px; color: #00f5a0;">srp onboard</pre>
      </div>
      <button class="btn-primary" @click=${()=>window.location.href="/"}>Back to Dashboard</button>
    `}async saveRole(){try{await x.startRuntime(this._role),this._step=2}catch(t){alert("Failed to save role: "+t)}}}customElements.define("setup-view",kt);class Ot extends v{static properties={_bootstrap:{state:!0},_runtime:{state:!0},_loading:{state:!0},_path:{state:!0},_error:{state:!0}};static styles=et`
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      background: #08090a;
      color: #e4e6eb;
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    header {
      padding: 1rem 2rem;
      border-bottom: 1px solid #262a33;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111318;
    }

    .logo {
      font-weight: 700;
      color: #00f5a0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.25rem;
    }

    main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    .card {
      background: #111318;
      border: 1px solid #262a33;
      border-radius: 8px;
      padding: 2rem;
      max-width: 800px;
      margin: 2rem auto;
    }

    h1 { color: #00f5a0; margin-top: 0; font-size: 1.5rem; }
    h2 { font-size: 1.1rem; color: #9499ab; margin-top: 2rem; }
    
    .status-badge {
      background: #004d32;
      color: #00f5a0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
    }

    .phase-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .phase-item {
      padding: 0.75rem;
      background: #1a1d23;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn {
      background: #00f5a0;
      color: #08090a;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s;
    }

    .btn:hover { background: #00d98b; }

    .btn-outline {
      background: transparent;
      border: 1px solid #262a33;
      color: #e4e6eb;
    }
    
    .btn-outline:hover {
      background: #1a1d23;
      border-color: #9499ab;
    }

    code {
      background: #000;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #00f5a0;
      font-family: 'JetBrains Mono', monospace;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .stat-box {
      padding: 1rem;
      background: #1a1d23;
      border-radius: 4px;
      border: 1px solid #262a33;
    }

    .stat-label { font-size: 0.75rem; color: #9499ab; text-transform: uppercase; }
    .stat-value { font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem; color: #00f5a0; }
  `;constructor(){super(),this._bootstrap=null,this._runtime=null,this._loading=!0,this._path=window.location.pathname,this._error=null,console.log("SRP App initialized");const t=document.getElementById("boot-status");t&&(t.style.display="none"),window.addEventListener("error",e=>{this._error=e.message,console.error("Global JS Error:",e)})}async firstUpdated(){await this.refresh(),window.addEventListener("popstate",()=>{this._path=window.location.pathname}),setInterval(()=>this.poll(),5e3)}async refresh(){try{const t=await x.getBootstrap();this._bootstrap=t,t.decision==="ready"&&(this._runtime=await x.getRuntime())}catch(t){this._error="Failed to connect to SRP Gateway. Is it running?",console.error(t)}finally{this._loading=!1}}async poll(){if(this._bootstrap?.decision==="ready")try{const t=await x.getRuntime();this._runtime=t}catch{}}render(){return this._error?u`
        <div class="card" style="border-color: #ff4d4d;">
          <h1 style="color: #ff4d4d;">System Error</h1>
          <p>${this._error}</p>
          <button class="btn" style="background: #ff4d4d; color: white;" @click=${()=>location.reload()}>Retry Connection</button>
        </div>
      `:this._loading?u`<div style="padding: 4rem; text-align: center; color: #00f5a0;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">⚡</div>
        Initializing SRP Protocol...
      </div>`:this._path==="/setup"?u`<setup-view></setup-view>`:this._bootstrap?.decision!=="ready"?this.renderSetupRedirect():u`
      <div class="app-container">
        <header>
          <div class="logo">SRP</div>
          <div class="status-badge">${this._runtime?.isRunning?"Audit Active":"Idle"}</div>
        </header>
        <main>
          ${this._runtime?.isRunning?this.renderActiveAudit():this.renderOverview()}
        </main>
      </div>
    `}renderSetupRedirect(){return u`
      <div class="card">
        <h1>Onboarding Required</h1>
        <p>Your workspace is not yet ready for a security audit.</p>
        <p>Current Status: <code>${this._bootstrap?.decision}</code></p>
        <div style="margin-top: 2rem; display: flex; gap: 1rem;">
          <a href="/setup" class="btn" style="text-decoration: none; display: inline-block;" @click=${this.navigate}>
            Configure in Web UI
          </a>
          <button class="btn btn-outline" @click=${()=>this.refresh()}>Check Again</button>
        </div>
        <p style="margin-top: 1.5rem; font-size: 0.875rem; color: #9499ab;">
          Pro-tip: Run <code>srp onboard</code> in your terminal for a guided setup.
        </p>
      </div>
    `}navigate(t){t.preventDefault();const e=t.currentTarget.href;window.history.pushState({},"",e),this._path=window.location.pathname}renderOverview(){return u`
      <div class="card">
        <h1>Project Overview</h1>
        <p>Methodology workbench is ready to analyze your codebase.</p>
        
        <div class="grid-2">
          <div class="stat-box">
            <div class="stat-label">Primary Role</div>
            <div class="stat-value" style="text-transform: capitalize;">${this._bootstrap?.role}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Active Provider</div>
            <div class="stat-value">${this._bootstrap?.providers.healthyKinds[0]||"None"}</div>
          </div>
        </div>

        <h2>Methodology Pipeline</h2>
        <div class="phase-list" style="opacity: 0.7;">
          <div class="phase-item"><span>Phase 0: Preparation</span> <span>Ready</span></div>
          <div class="phase-item"><span>Phase 1: Intent Analysis</span> <span>Pending</span></div>
          <div class="phase-item"><span>Phase 2: Architecture Mapping</span> <span>Pending</span></div>
        </div>
        
        <div style="margin-top: 3rem; display: flex; gap: 1rem;">
          <button class="btn" style="flex: 2; padding: 1rem;" @click=${this.startAudit}>Start 11-Phase Methodology Audit</button>
          <button class="btn btn-outline" style="flex: 1;" @click=${()=>window.location.href="/setup"}>Settings</button>
        </div>
      </div>
    `}renderActiveAudit(){const t=this._runtime?.phases||[],e=this._runtime?.currentPhase;return u`
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h1>Audit in Progress</h1>
          <code style="font-size: 0.75rem;">RUN: ${this._runtime?.runId?.slice(0,8)||"..."}</code>
        </div>
        
        <p>The SRP Agent Army is autonomously executing the security reasoning protocol.</p>
        
        <div class="phase-list">
          ${t.map(s=>u`
            <div class="phase-item" style="${s.phase===e?"border: 1px solid #00f5a0; background: #002d1e;":""}">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                ${s.phase===e?u`<span class="spinner" style="width: 10px; height: 10px; border: 2px solid #00f5a0; border-top-color: transparent; border-radius: 50%; display: inline-block;"></span>`:""}
                <span>${s.phase}</span>
              </div>
              <span style="color: ${s.status==="completed"?"#00f5a0":s.status==="running"?"#fbbf24":"#5c6079"}; font-weight: 600; font-size: 0.875rem;">
                ${s.status.toUpperCase()}
              </span>
            </div>
          `)}
        </div>

        <div style="margin-top: 2rem; padding: 1rem; background: #000; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;">
          <div style="color: #9499ab;">> Tail Log:</div>
          <div style="color: #00f5a0; margin-top: 0.5rem;">[${new Date().toLocaleTimeString()}] Executing reasoning step for ${e}...</div>
        </div>
      </div>
    `}async startAudit(){if(this._bootstrap)try{this._loading=!0,await x.startRuntime(this._bootstrap.role),await this.refresh()}catch(t){this._error="Failed to start audit: "+t}finally{this._loading=!1}}}customElements.define("srp-app",Ot);
