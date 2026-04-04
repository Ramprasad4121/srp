(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function t(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(i){if(i.ep)return;i.ep=!0;const o=t(i);fetch(i.href,o)}})();const T=["welcome","role-selection","providers","toolchain","skills","workspace","ui-preferences","ready"],be="hybrid",ye="local-plus-docs",z={role:be,providers:[{kind:"openai-compatible",label:"Primary Compatible Endpoint",model:"gpt-4.1-mini",enabled:!0}],workspace:{rootDirectory:".",outputDirectory:".srp",useDockerToolchains:!0,internetMode:ye},approvedDomains:[{hostname:"docs.openzeppelin.com",reason:"Smart contract library documentation"},{hostname:"eips.ethereum.org",reason:"Primary standards and EIP references"},{hostname:"docs.soliditylang.org",reason:"Solidity language reference"}]};function ae(r={}){return{currentStep:"welcome",completedSteps:[],role:r.role??z.role,providers:r.providers??z.providers,workspace:r.workspace??z.workspace}}function ne(r,e){const t=r.completedSteps.includes(r.currentStep)?r.completedSteps:[...r.completedSteps,r.currentStep];return{...r,currentStep:e,completedSteps:t}}function le(r,e){const t=r.completedSteps.includes(e)?r.completedSteps:[...r.completedSteps,e];let s=r.currentStep;if(e===r.currentStep){const i=T.indexOf(e);i!==-1&&i<T.length-1&&(s=T[i+1])}return{...r,currentStep:s,completedSteps:t}}function q(r={}){return{version:r.version??"1",updatedAt:new Date().toISOString(),approvedDomains:r.approvedDomains??z.approvedDomains,state:r.state??ae()}}function de(r){const e=r.filter(s=>s.enabled),t=e.filter(s=>s.model.trim().length>0);return{enabledCount:e.length,readyCount:t.length,missingProviderKinds:e.filter(s=>s.model.trim().length===0).map(s=>s.kind)}}function ce(r){const e=de(r.state.providers);return[{step:"welcome",complete:!0,reason:"Setup manifest exists"},{step:"role-selection",complete:r.state.role.length>0,reason:`Role set to ${r.state.role}`},{step:"providers",complete:e.enabledCount>0&&e.readyCount>0,reason:e.enabledCount>0?`${e.readyCount}/${e.enabledCount} providers ready`:"No providers enabled"},{step:"toolchain",complete:!0,reason:"Toolchain checks not implemented yet (skipped)"},{step:"skills",complete:!0,reason:"Skill setup not implemented yet (skipped)"},{step:"workspace",complete:r.state.completedSteps.includes("workspace"),reason:`Outputs at ${r.state.workspace.outputDirectory}`},{step:"ui-preferences",complete:!0,reason:"Default UI preferences available"},{step:"ready",complete:r.state.completedSteps.includes("providers")&&r.state.completedSteps.includes("workspace"),reason:"Requires providers and workspace completion"}]}function xe(r){return ce(r).find(t=>!t.complete)?.step??"ready"}function _e(r){return le(ne(r,"role-selection"),"welcome")}function $e(r){return le(ne(r,"workspace"),"providers")}const we=[{kind:"anthropic",label:"Anthropic",authStrategy:"api-key",supportsStreaming:!0,supportsTools:!0,supportsReasoning:!0,defaultModel:"claude-sonnet-4-0",credentialProfiles:[{envVar:"ANTHROPIC_API_KEY",required:!0}]},{kind:"hugging-face",label:"Hugging Face",authStrategy:"api-key",supportsStreaming:!0,supportsTools:!1,supportsReasoning:!1,defaultModel:"meta-llama/Meta-Llama-3.1-70B-Instruct",credentialProfiles:[{envVar:"HUGGINGFACE_API_KEY",required:!0}]},{kind:"nvidia",label:"NVIDIA",authStrategy:"api-key",supportsStreaming:!0,supportsTools:!1,supportsReasoning:!0,defaultModel:"meta/llama-3.1-70b-instruct",credentialProfiles:[{envVar:"NVIDIA_API_KEY",required:!0}]},{kind:"ollama",label:"Ollama",authStrategy:"local",supportsStreaming:!0,supportsTools:!1,supportsReasoning:!1,defaultModel:"llama3.1:8b",credentialProfiles:[]},{kind:"openai",label:"OpenAI",authStrategy:"api-key",supportsStreaming:!0,supportsTools:!0,supportsReasoning:!0,defaultModel:"gpt-4.1",credentialProfiles:[{envVar:"OPENAI_API_KEY",required:!0}]},{kind:"openrouter",label:"OpenRouter",authStrategy:"api-key",supportsStreaming:!0,supportsTools:!1,supportsReasoning:!0,defaultModel:"openai/gpt-4.1-mini",credentialProfiles:[{envVar:"OPENROUTER_API_KEY",required:!0}]},{kind:"openai-compatible",label:"OpenAI Compatible",authStrategy:"base-url",supportsStreaming:!0,supportsTools:!0,supportsReasoning:!0,defaultModel:"gpt-4.1-mini",credentialProfiles:[{envVar:"OPENAI_COMPATIBLE_BASE_URL",required:!0},{envVar:"OPENAI_COMPATIBLE_API_KEY",required:!1}]}];T.map(r=>({step:r,title:r.split("-").map(e=>e.charAt(0).toUpperCase()+e.slice(1)).join(" ")}));we.map(r=>({kind:r.kind,label:r.label,defaultModel:r.defaultModel,supportsTools:r.supportsTools}));const S=q({state:ae()}),pe=q({state:_e(S.state)}),J=q({state:$e(pe.state)}),Se=ce(S);de(S.state.providers);S.state.currentStep,S.state.role,Se.filter(r=>r.complete).length;S.state.currentStep,pe.state.currentStep,J.state.currentStep,xe(J);/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const N=globalThis,j=N.ShadowRoot&&(N.ShadyCSS===void 0||N.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,V=Symbol(),Y=new WeakMap;let he=class{constructor(e,t,s){if(this._$cssResult$=!0,s!==V)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(j&&e===void 0){const s=t!==void 0&&t.length===1;s&&(e=Y.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),s&&Y.set(t,e))}return e}toString(){return this.cssText}};const ke=r=>new he(typeof r=="string"?r:r+"",void 0,V),$=(r,...e)=>{const t=r.length===1?r[0]:e.reduce((s,i,o)=>s+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+r[o+1],r[0]);return new he(t,r,V)},Ae=(r,e)=>{if(j)r.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const t of e){const s=document.createElement("style"),i=N.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=t.cssText,r.appendChild(s)}},G=j?r=>r:r=>r instanceof CSSStyleSheet?(e=>{let t="";for(const s of e.cssRules)t+=s.cssText;return ke(t)})(r):r;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Ee,defineProperty:Ce,getOwnPropertyDescriptor:Pe,getOwnPropertyNames:Re,getOwnPropertySymbols:Ie,getPrototypeOf:Me}=Object,D=globalThis,Z=D.trustedTypes,Oe=Z?Z.emptyScript:"",Te=D.reactiveElementPolyfillSupport,C=(r,e)=>r,B={toAttribute(r,e){switch(e){case Boolean:r=r?Oe:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,e){let t=r;switch(e){case Boolean:t=r!==null;break;case Number:t=r===null?null:Number(r);break;case Object:case Array:try{t=JSON.parse(r)}catch{t=null}}return t}},ue=(r,e)=>!Ee(r,e),Q={attribute:!0,type:String,converter:B,reflect:!1,useDefault:!1,hasChanged:ue};Symbol.metadata??=Symbol("metadata"),D.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Q){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(e,s,t);i!==void 0&&Ce(this.prototype,e,i)}}static getPropertyDescriptor(e,t,s){const{get:i,set:o}=Pe(this.prototype,e)??{get(){return this[t]},set(a){this[t]=a}};return{get:i,set(a){const c=i?.call(this);o?.call(this,a),this.requestUpdate(e,c,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Q}static _$Ei(){if(this.hasOwnProperty(C("elementProperties")))return;const e=Me(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(C("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(C("properties"))){const t=this.properties,s=[...Re(t),...Ie(t)];for(const i of s)this.createProperty(i,t[i])}const e=this[Symbol.metadata];if(e!==null){const t=litPropertyMetadata.get(e);if(t!==void 0)for(const[s,i]of t)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const i=this._$Eu(t,s);i!==void 0&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const s=new Set(e.flat(1/0).reverse());for(const i of s)t.unshift(G(i))}else e!==void 0&&t.push(G(e));return t}static _$Eu(e,t){const s=t.attribute;return s===!1?void 0:typeof s=="string"?s:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ae(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){const s=this.constructor.elementProperties.get(e),i=this.constructor._$Eu(e,s);if(i!==void 0&&s.reflect===!0){const o=(s.converter?.toAttribute!==void 0?s.converter:B).toAttribute(t,s.type);this._$Em=e,o==null?this.removeAttribute(i):this.setAttribute(i,o),this._$Em=null}}_$AK(e,t){const s=this.constructor,i=s._$Eh.get(e);if(i!==void 0&&this._$Em!==i){const o=s.getPropertyOptions(i),a=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:B;this._$Em=i;const c=a.fromAttribute(t,o.type);this[i]=c??this._$Ej?.get(i)??c,this._$Em=null}}requestUpdate(e,t,s,i=!1,o){if(e!==void 0){const a=this.constructor;if(i===!1&&(o=this[e]),s??=a.getPropertyOptions(e),!((s.hasChanged??ue)(o,t)||s.useDefault&&s.reflect&&o===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,s))))return;this.C(e,t,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:i,wrapped:o},a){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),o!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),i===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,o]of this._$Ep)this[i]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,o]of s){const{wrapped:a}=o,c=this[i];a!==!0||this._$AL.has(i)||c===void 0||this.C(i,void 0,o,c)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(t)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[C("elementProperties")]=new Map,w[C("finalized")]=new Map,Te?.({ReactiveElement:w}),(D.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const F=globalThis,X=r=>r,U=F.trustedTypes,ee=U?U.createPolicy("lit-html",{createHTML:r=>r}):void 0,me="$lit$",b=`lit$${Math.random().toFixed(9).slice(2)}$`,fe="?"+b,ze=`<${fe}>`,_=document,P=()=>_.createComment(""),R=r=>r===null||typeof r!="object"&&typeof r!="function",K=Array.isArray,Ne=r=>K(r)||typeof r?.[Symbol.iterator]=="function",H=`[ 	
\f\r]`,E=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,te=/-->/g,se=/>/g,y=RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ie=/'/g,re=/"/g,ge=/^(?:script|style|textarea|title)$/i,Ue=r=>(e,...t)=>({_$litType$:r,strings:e,values:t}),n=Ue(1),k=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),oe=new WeakMap,x=_.createTreeWalker(_,129);function ve(r,e){if(!K(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return ee!==void 0?ee.createHTML(e):e}const De=(r,e)=>{const t=r.length-1,s=[];let i,o=e===2?"<svg>":e===3?"<math>":"",a=E;for(let c=0;c<t;c++){const l=r[c];let p,u,d=-1,g=0;for(;g<l.length&&(a.lastIndex=g,u=a.exec(l),u!==null);)g=a.lastIndex,a===E?u[1]==="!--"?a=te:u[1]!==void 0?a=se:u[2]!==void 0?(ge.test(u[2])&&(i=RegExp("</"+u[2],"g")),a=y):u[3]!==void 0&&(a=y):a===y?u[0]===">"?(a=i??E,d=-1):u[1]===void 0?d=-2:(d=a.lastIndex-u[2].length,p=u[1],a=u[3]===void 0?y:u[3]==='"'?re:ie):a===re||a===ie?a=y:a===te||a===se?a=E:(a=y,i=void 0);const v=a===y&&r[c+1].startsWith("/>")?" ":"";o+=a===E?l+ze:d>=0?(s.push(p),l.slice(0,d)+me+l.slice(d)+b+v):l+b+(d===-2?c:v)}return[ve(r,o+(r[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),s]};class I{constructor({strings:e,_$litType$:t},s){let i;this.parts=[];let o=0,a=0;const c=e.length-1,l=this.parts,[p,u]=De(e,t);if(this.el=I.createElement(p,s),x.currentNode=this.el.content,t===2||t===3){const d=this.el.content.firstChild;d.replaceWith(...d.childNodes)}for(;(i=x.nextNode())!==null&&l.length<c;){if(i.nodeType===1){if(i.hasAttributes())for(const d of i.getAttributeNames())if(d.endsWith(me)){const g=u[a++],v=i.getAttribute(d).split(b),O=/([.?@])?(.*)/.exec(g);l.push({type:1,index:o,name:O[2],strings:v,ctor:O[1]==="."?He:O[1]==="?"?Be:O[1]==="@"?qe:L}),i.removeAttribute(d)}else d.startsWith(b)&&(l.push({type:6,index:o}),i.removeAttribute(d));if(ge.test(i.tagName)){const d=i.textContent.split(b),g=d.length-1;if(g>0){i.textContent=U?U.emptyScript:"";for(let v=0;v<g;v++)i.append(d[v],P()),x.nextNode(),l.push({type:2,index:++o});i.append(d[g],P())}}}else if(i.nodeType===8)if(i.data===fe)l.push({type:2,index:o});else{let d=-1;for(;(d=i.data.indexOf(b,d+1))!==-1;)l.push({type:7,index:o}),d+=b.length-1}o++}}static createElement(e,t){const s=_.createElement("template");return s.innerHTML=e,s}}function A(r,e,t=r,s){if(e===k)return e;let i=s!==void 0?t._$Co?.[s]:t._$Cl;const o=R(e)?void 0:e._$litDirective$;return i?.constructor!==o&&(i?._$AO?.(!1),o===void 0?i=void 0:(i=new o(r),i._$AT(r,t,s)),s!==void 0?(t._$Co??=[])[s]=i:t._$Cl=i),i!==void 0&&(e=A(r,i._$AS(r,e.values),i,s)),e}class Le{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:s}=this._$AD,i=(e?.creationScope??_).importNode(t,!0);x.currentNode=i;let o=x.nextNode(),a=0,c=0,l=s[0];for(;l!==void 0;){if(a===l.index){let p;l.type===2?p=new M(o,o.nextSibling,this,e):l.type===1?p=new l.ctor(o,l.name,l.strings,this,e):l.type===6&&(p=new je(o,this,e)),this._$AV.push(p),l=s[++c]}a!==l?.index&&(o=x.nextNode(),a++)}return x.currentNode=_,i}p(e){let t=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}}class M{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,i){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=A(this,e,t),R(e)?e===h||e==null||e===""?(this._$AH!==h&&this._$AR(),this._$AH=h):e!==this._$AH&&e!==k&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Ne(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==h&&R(this._$AH)?this._$AA.nextSibling.data=e:this.T(_.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:s}=e,i=typeof s=="number"?this._$AC(e):(s.el===void 0&&(s.el=I.createElement(ve(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(t);else{const o=new Le(i,this),a=o.u(this.options);o.p(t),this.T(a),this._$AH=o}}_$AC(e){let t=oe.get(e.strings);return t===void 0&&oe.set(e.strings,t=new I(e)),t}k(e){K(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let s,i=0;for(const o of e)i===t.length?t.push(s=new M(this.O(P()),this.O(P()),this,this.options)):s=t[i],s._$AI(o),i++;i<t.length&&(this._$AR(s&&s._$AB.nextSibling,i),t.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const s=X(e).nextSibling;X(e).remove(),e=s}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}}class L{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,i,o){this.type=1,this._$AH=h,this._$AN=void 0,this.element=e,this.name=t,this._$AM=i,this.options=o,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=h}_$AI(e,t=this,s,i){const o=this.strings;let a=!1;if(o===void 0)e=A(this,e,t,0),a=!R(e)||e!==this._$AH&&e!==k,a&&(this._$AH=e);else{const c=e;let l,p;for(e=o[0],l=0;l<o.length-1;l++)p=A(this,c[s+l],t,l),p===k&&(p=this._$AH[l]),a||=!R(p)||p!==this._$AH[l],p===h?e=h:e!==h&&(e+=(p??"")+o[l+1]),this._$AH[l]=p}a&&!i&&this.j(e)}j(e){e===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class He extends L{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===h?void 0:e}}class Be extends L{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==h)}}class qe extends L{constructor(e,t,s,i,o){super(e,t,s,i,o),this.type=5}_$AI(e,t=this){if((e=A(this,e,t,0)??h)===k)return;const s=this._$AH,i=e===h&&s!==h||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,o=e!==h&&(s===h||i);i&&this.element.removeEventListener(this.name,this,s),o&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class je{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){A(this,e)}}const Ve=F.litHtmlPolyfillSupport;Ve?.(I,M),(F.litHtmlVersions??=[]).push("3.3.2");const Fe=(r,e,t)=>{const s=t?.renderBefore??e;let i=s._$litPart$;if(i===void 0){const o=t?.renderBefore??null;s._$litPart$=i=new M(e.insertBefore(P(),o),o,void 0,t??{})}return i._$AI(r),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const W=globalThis;class f extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Fe(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return k}}f._$litElement$=!0,f.finalized=!0,W.litElementHydrateSupport?.({LitElement:f});const Ke=W.litElementPolyfillSupport;Ke?.({LitElement:f});(W.litElementVersions??=[]).push("4.2.2");class We{constructor(e="/api"){this.baseUrl=e}async request(e,t){const s=await fetch(`${this.baseUrl}${e}`,t);if(!s.ok)throw new Error(`Gateway request failed: ${s.status} ${s.statusText}`);return s.json()}async getBootstrap(){return this.request("/bootstrap")}async getSetup(){return this.request("/setup")}async getRuntime(){return this.request("/runtime")}async startRuntime(e){await this.request("/runtime/start",{method:"POST",body:JSON.stringify({mode:e}),headers:{"Content-Type":"application/json"}})}async startSession(){try{return{ok:!0,data:await this.request("/runtime/start",{method:"POST",body:JSON.stringify({}),headers:{"Content-Type":"application/json"}})}}catch(e){return{ok:!1,data:null,error:e.message}}}async setRole(e){try{return{ok:!0,data:await this.request("/setup/role",{method:"POST",body:JSON.stringify({role:e}),headers:{"Content-Type":"application/json"}})}}catch(t){return{ok:!1,data:null,error:t.message}}}async getConversations(){try{return{ok:!0,data:await this.request("/chat/conversations")}}catch(e){return{ok:!1,data:[],error:e.message}}}async createConversation(e){try{return{ok:!0,data:await this.request("/chat/conversations",{method:"POST",body:JSON.stringify({title:e}),headers:{"Content-Type":"application/json"}})}}catch(t){return{ok:!1,data:null,error:t.message}}}async addMessage(e,t){try{return{ok:!0,data:await this.request(`/chat/conversations/${e}/messages`,{method:"POST",body:JSON.stringify({content:t}),headers:{"Content-Type":"application/json"}})}}catch(s){return{ok:!1,data:null,error:"Network Error",detail:s.message}}}async getSkills(){try{return{ok:!0,data:await this.request("/skills")}}catch(e){return{ok:!1,data:[],error:e.message}}}}const m=new We;class Je extends f{static properties={_role:{state:!0},_step:{state:!0}};static styles=$`
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
  `;constructor(){super(),this._role="auditor",this._step=1}render(){return n`
      <h1>SRP Onboarding</h1>
      
      ${this._step===1?this.renderRoleStep():this.renderFinalStep()}
    `}renderRoleStep(){return n`
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
    `}renderFinalStep(){return n`
      <div class="step">
        <p>Your role has been set to <strong>${this._role}</strong>.</p>
        <p>To finalize provider keys and workspace settings, please use the CLI:</p>
        <pre style="background: #000; padding: 1rem; border-radius: 4px; color: #00f5a0;">srp onboard</pre>
      </div>
      <button class="btn-primary" @click=${()=>window.location.href="/"}>Back to Dashboard</button>
    `}async saveRole(){try{await m.startRuntime(this._role),this._step=2}catch(e){alert("Failed to save role: "+e)}}}customElements.define("setup-view",Je);class Ye extends f{static properties={role:{type:String},content:{type:String}};static styles=$`
    :host {
      display: block;
      margin-bottom: 2.5rem;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-container {
      display: flex;
      gap: 1.25rem;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .avatar-user {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }

    .avatar-assistant {
      background: #111827;
      color: #fff;
    }

    .avatar-system {
      background: #fef3c7;
      color: #d97706;
    }

    .body {
      flex: 1;
      min-width: 0;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .name {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }

    .time {
      font-size: 11px;
      color: #9ca3af;
      font-weight: 500;
    }

    .content {
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Markdown-ish styling */
    .content code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 4px;
      color: #111827;
    }

    .content pre {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .content pre code {
      background: transparent;
      padding: 0;
    }

    .tool-call {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #f0f7ff;
      border: 1px solid #cce3ff;
      color: #0052FF;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin: 0.5rem 0;
      font-family: 'JetBrains Mono', monospace;
    }
  `;constructor(){super(),this.role="user",this.content=""}render(){let e=this.role==="assistant"?"SRP Agent":"You";this.role==="system"&&(e="Protocol System");const t=this.content.startsWith("[TOOL:"),s=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return n`
      <div class="message-container">
        <div class="avatar avatar-${this.role}">
          ${this.role==="assistant"?"S":this.role==="system"?"P":"U"}
        </div>
        <div class="body">
          <div class="header">
            <span class="name">${e}</span>
            <span class="time">${s}</span>
          </div>
          ${t?n`<div class="tool-call">🛠️ ${this.content}</div>`:n`<div class="content">${this.content}</div>`}
        </div>
      </div>
    `}}customElements.define("chat-message",Ye);class Ge extends f{static properties={mode:{type:String},_chatInput:{state:!0},_messages:{state:!0},_isLoading:{state:!0},_conversationId:{state:!0}};static styles=$`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      font-family: 'Inter', system-ui, sans-serif;
      background: #ffffff;
      color: #111827;
      overflow: hidden;
    }

    .chat-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      scroll-behavior: smooth;
      padding-top: 2rem;
    }

    /* Centered content column */
    .message-list {
      flex: 1;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
      padding: 0 1.5rem 10rem 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      margin: auto;
      text-align: center;
      padding: 4rem 2rem;
    }

    .empty-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }

    .empty-subtitle {
      font-size: 0.875rem;
      color: #6b7280;
      max-width: 400px;
      margin: 0 auto;
    }

    /* Action bar / Input */
    .input-wrapper {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, #ffffff 70%, transparent);
      padding: 2rem 1.5rem 2rem 1.5rem;
      z-index: 10;
    }

    .input-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      padding: 0.5rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-container:focus-within {
      border-color: #0052FF;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(0, 82, 255, 0.1);
    }

    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
    }

    textarea {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      font-family: inherit;
      line-height: 1.5;
      outline: none;
      resize: none;
      max-height: 200px;
      color: #111827;
    }

    textarea::placeholder {
      color: #9ca3af;
    }

    .btn-send {
      background: #111827;
      color: #fff;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.1s, background 0.2s;
      flex-shrink: 0;
      margin-bottom: 4px;
      margin-right: 4px;
    }

    .btn-send:hover {
      background: #374151;
    }

    .btn-send:active {
      transform: scale(0.95);
    }

    .btn-send:disabled {
      background: #f3f4f6;
      color: #d1d5db;
      cursor: not-allowed;
    }

    /* Quick suggestions */
    .quick-actions {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      overflow-x: auto;
    }

    .action-chip {
      font-size: 11px;
      font-weight: 600;
      background: #f3f4f6;
      color: #4b5563;
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
      cursor: pointer;
      border: 1px solid transparent;
    }

    .action-chip:hover {
      background: #e5e7eb;
      color: #111827;
    }

    /* Loading state */
    .loading-dots {
      display: flex;
      gap: 4px;
      padding: 1rem;
    }

    .dot {
      width: 6px;
      height: 6px;
      background: #d1d5db;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }

    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;constructor(){super(),this.mode="auditor",this._chatInput="",this._messages=[],this._isLoading=!1,this._conversationId=null}async firstUpdated(){await this.initConversation()}async initConversation(){try{this._isLoading=!0;const e=await m.getConversations();if(e.ok&&e.data&&e.data.length>0){const t=e.data[e.data.length-1];this._conversationId=t.id,this._messages=t.messages||[]}else{const t=await m.createConversation("New Analysis");t.ok&&(this._conversationId=t.data.id,this._messages=t.data.messages||[])}}catch(e){console.error("Failed to init conversation",e)}finally{this._isLoading=!1,this.scrollToBottom()}}handleInput(e){const t=e.target;this._chatInput=t.value,t.style.height="auto",t.style.height=`${t.scrollHeight}px`}handleKeydown(e){e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),this.sendMessage())}async sendMessage(e){const t=e||this._chatInput.trim();if(!t||!this._conversationId||this._isLoading)return;this._chatInput="";const s=this.shadowRoot?.querySelector("textarea");s&&(s.style.height="auto"),this._isLoading=!0,this._messages=[...this._messages,{id:Date.now().toString(),role:"user",content:t}],this.scrollToBottom();try{const i=await m.addMessage(this._conversationId,t);i.ok&&i.data.assistantMessage?this._messages=[...this._messages,i.data.assistantMessage]:i.ok||(this._messages=[...this._messages,{id:"err",role:"system",content:`System Error: ${i.error}`}])}catch(i){console.error("Network failure",i)}finally{this._isLoading=!1,this.scrollToBottom()}}scrollToBottom(){setTimeout(()=>{const e=this.shadowRoot?.querySelector(".chat-layout");e&&(e.scrollTop=e.scrollHeight)},50)}render(){return n`
      <main class="chat-layout">
        <div class="message-list">
          ${this._messages.length===0?n`
              <div class="empty-state">
                <div class="empty-title">Secure Reasoning Protocol</div>
                <p class="empty-subtitle">
                  Ask me to audit a contract, explain architecture, or generate exploit proofs. I'm connected to your local workspace and the internet.
                </p>
              </div>`:this._messages.map(e=>n`
                <chat-message .role=${e.role} .content=${e.content}></chat-message>
              `)}
          
          ${this._isLoading?n`
            <div class="loading-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          `:""}
        </div>
      </main>

      <div class="input-wrapper">
        <div class="input-container">
          <div class="quick-actions">
            <div class="action-chip" @click=${()=>this.sendMessage("/scan scope")}>/scan scope</div>
            <div class="action-chip" @click=${()=>this.sendMessage("/list contracts")}>/list contracts</div>
            <div class="action-chip" @click=${()=>this.sendMessage("Explain trust boundaries")}>Explain trust boundaries</div>
          </div>
          <div class="input-row">
            <textarea 
              rows="1"
              placeholder="Message SRP Agent..." 
              .value=${this._chatInput}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
              ?disabled=${this._isLoading}
            ></textarea>
            <button class="btn-send" @click=${()=>this.sendMessage()} ?disabled=${this._isLoading||!this._chatInput.trim()}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `}}customElements.define("chat-view",Ge);class Ze extends f{static properties={_room:{state:!0}};static styles=$`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      font-family: 'JetBrains Mono', monospace;
      color: #000;
      overflow: hidden;
    }

    .stats-bar {
      padding: 1rem 2rem;
      background: #fcfcfc;
      border-bottom: 1px solid #eee;
      display: flex;
      gap: 3rem;
      font-size: 11px;
      color: #999;
      letter-spacing: 1px;
      flex-shrink: 0;
    }

    .stat-item span {
      color: #000;
      font-weight: 700;
      margin-right: 0.5rem;
    }

    .team-container {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr;
      overflow: hidden;
    }

    /* Members Sidebar */
    .members-sidebar {
      border-right: 1px solid #eee;
      padding: 2rem;
      background: #fff;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #ccc;
      margin-bottom: 2rem;
      font-weight: 700;
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
      padding: 0.5rem 0;
    }

    .avatar {
      width: 36px;
      height: 36px;
      background: #000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
    }

    .member-info {
      flex: 1;
      min-width: 0;
    }

    .member-name {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-role {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-active { background: #0052FF; box-shadow: 0 0 8px rgba(0, 82, 255, 0.5); }
    .status-idle { background: #f59e0b; }
    .status-offline { background: #eee; }

    /* Activity Feed */
    .activity-feed {
      display: flex;
      flex-direction: column;
      padding: 2rem 3rem;
      overflow-y: auto;
      background: #fff;
    }

    .activity-item {
      padding: 1rem 0;
      border-bottom: 1px solid #f9f9f9;
      font-size: 13px;
      display: flex;
      gap: 1.5rem;
      line-height: 1.6;
    }

    .timestamp {
      color: #ccc;
      min-width: 80px;
      font-size: 11px;
    }

    .activity-text {
      color: #666;
    }

    .highlight {
      color: #000;
      font-weight: 700;
    }

    .btn-invite {
      margin-top: auto;
      background: #000;
      color: #fff;
      border: none;
      padding: 1rem;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      font-weight: 700;
    }

    .btn-invite:hover {
      background: #333;
    }
  `;constructor(){super(),this._room={id:"room-01",name:"Main Protocol Audit Room",activeAuditors:4,activeDevelopers:2,members:[{id:"m1",name:"Alice (Lead)",role:"auditor",status:"active",lastActiveAt:new Date().toISOString()},{id:"m2",name:"Bob",role:"auditor",status:"active",lastActiveAt:new Date().toISOString()},{id:"m3",name:"Charlie",role:"auditor",status:"idle",lastActiveAt:new Date().toISOString()},{id:"m4",name:"Dave",role:"auditor",status:"offline",lastActiveAt:new Date().toISOString()},{id:"d1",name:"Eve (Dev)",role:"developer",status:"active",lastActiveAt:new Date().toISOString()},{id:"d2",name:"Frank (Dev)",role:"developer",status:"active",lastActiveAt:new Date().toISOString()}],sharedActivity:["Alice uploaded a new finding: REENTRANCY_IN_VAULT","Bob started reviewing phase: ARCHITECTURE_ANALYSIS","Eve merged PR: FIX_SLIPPAGE_CHECKS","System: New invariant identified by SRP_AGENT: VAULT_SOLVENCY","Frank connected to the room","Alice: Team, let's focus on the economic modeling phase next.","Charlie marked invariant INV-04 as verified","System: Audit coverage reached 85%"]}}render(){return n`
      <div class="stats-bar">
        <div class="stat-item"><span>${this._room.activeAuditors}</span> AUDITORS_ONLINE</div>
        <div class="stat-item"><span>${this._room.activeDevelopers}</span> DEVELOPERS_CONNECTED</div>
        <div class="stat-item">PROTOCOL_V1.0_SHARING_ACTIVE</div>
      </div>

      <div class="team-container">
        <aside class="members-sidebar">
          <div class="section-title">Active Team</div>
          ${this._room.members.map(e=>n`
            <div class="member-item">
              <div class="avatar">${e.name[0]}</div>
              <div class="member-info">
                <div class="member-name">${e.name}</div>
                <div class="member-role">${e.role}</div>
              </div>
              <div class="status-dot status-${e.status}"></div>
            </div>
          `)}
          <button class="btn-invite">+ Invite Member</button>
        </aside>

        <main class="activity-feed">
          <div class="section-title">Real-time Collaboration Log</div>
          ${this._room.sharedActivity.map((e,t)=>n`
            <div class="activity-item">
              <span class="timestamp">[${new Date(Date.now()-t*3e5).toLocaleTimeString([],{hour12:!1})}]</span>
              <span class="activity-text">${this.formatActivity(e)}</span>
            </div>
          `)}
        </main>
      </div>
    `}formatActivity(e){const t=e.split(":");return t.length>1?n`<span class="highlight">${t[0]}:</span> ${t[1]}`:e}}customElements.define("team-view",Ze);class Qe extends f{static styles=$`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      font-family: 'JetBrains Mono', monospace;
      color: #000;
      overflow-y: auto;
    }

    .hero-section {
      padding: 4rem 2rem;
      border-bottom: 1px solid #eee;
      text-align: center;
      background: #fcfcfc;
    }

    .hero-title {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.05em;
      margin-bottom: 1rem;
    }

    .hero-subtitle {
      font-size: 1rem;
      color: #666;
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
      padding: 3rem 2rem;
    }

    .card {
      border: 1px solid #eee;
      padding: 2rem;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card:hover {
      border-color: #000;
      box-shadow: 4px 4px 0 rgba(0,0,0,0.05);
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .card-title span {
      font-size: 0.75rem;
      background: #000;
      color: #fff;
      padding: 2px 6px;
      text-transform: uppercase;
    }

    .card-description {
      font-size: 0.875rem;
      color: #666;
      line-height: 1.5;
    }

    .btn-action {
      margin-top: auto;
      background: #000;
      color: #fff;
      border: none;
      padding: 0.75rem;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
    }

    .btn-action:hover {
      background: #333;
    }

    .section-header {
      padding: 2rem 2rem 0 2rem;
      font-size: 0.75rem;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .command-list {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .command-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f9f9f9;
      border: 1px solid #eee;
    }

    .command-code {
      font-weight: 700;
      color: #0052FF;
    }

    .command-desc {
      font-size: 0.875rem;
      color: #666;
    }
  `;render(){return n`
      <div class="hero-section">
        <div class="hero-title">BUILD FROM SCRATCH</div>
        <p class="hero-subtitle">
          Powered by <strong>.gstack</strong>. Turn SRP into a virtual engineering team. 
          Initialize new protocols, design architectures, and ship production-ready code with an army of agents.
        </p>
      </div>

      <div class="section-header">Core GSTACK Agents</div>
      <div class="grid-container">
        <div class="card">
          <div class="card-title">CEO Agent <span>Product</span></div>
          <p class="card-description">Rethinks product requirements and aligns technical goals with business vision.</p>
          <button class="btn-action">Run /plan-ceo-review</button>
        </div>
        <div class="card">
          <div class="card-title">EM Agent <span>Arch</span></div>
          <p class="card-description">Locks down system architecture and ensures modular, scalable design patterns.</p>
          <button class="btn-action">Run /plan-eng-review</button>
        </div>
        <div class="card">
          <div class="card-title">QA Agent <span>Browser</span></div>
          <p class="card-description">Automates browser-based testing and functional verification of your protocol.</p>
          <button class="btn-action">Run /qa</button>
        </div>
        <div class="card">
          <div class="card-title">Ship Agent <span>Deploy</span></div>
          <p class="card-description">Handles CI/CD pipelines, land-and-deploy sequences, and production releases.</p>
          <button class="btn-action">Run /ship</button>
        </div>
      </div>

      <div class="section-header">Direct Command Interface</div>
      <div class="command-list">
        <div class="command-item">
          <span class="command-code">/office-hours</span>
          <span class="command-desc">Describe what you want to build from scratch.</span>
        </div>
        <div class="command-item">
          <span class="command-code">/autoplan</span>
          <span class="command-desc">Generate a multi-phase implementation roadmap.</span>
        </div>
        <div class="command-item">
          <span class="command-code">/codex</span>
          <span class="command-desc">Access the deep knowledge base of protocol patterns.</span>
        </div>
      </div>
    `}}customElements.define("gstack-view",Qe);class Xe extends f{static properties={_state:{state:!0}};static styles=$`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      font-family: 'Inter', system-ui, sans-serif;
      color: #111827;
      overflow: hidden;
    }

    .layout {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr;
      overflow: hidden;
    }

    /* Sidebar / Phase List */
    .sidebar {
      border-right: 1px solid #e5e7eb;
      background: #f9fafb;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .sidebar-title {
      font-size: 12px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.5rem;
    }

    .phase-item {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      font-size: 13px;
      font-weight: 500;
      color: #4b5563;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.15s;
      border: 1px solid transparent;
    }

    .phase-item:hover {
      background: #f3f4f6;
    }

    .phase-item.active {
      background: #fff;
      color: #111827;
      border-color: #e5e7eb;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .phase-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-completed { background: #10b981; }
    .status-running { background: #0052FF; animation: pulse 2s infinite; }
    .status-pending { background: #d1d5db; }
    .status-failed { background: #ef4444; }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* Content Area */
    .content {
      overflow-y: auto;
      padding: 2.5rem;
      background: #fff;
    }

    .header {
      margin-bottom: 2.5rem;
    }

    .phase-label {
      font-size: 12px;
      font-weight: 700;
      color: #0052FF;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.5rem;
    }

    .phase-title {
      font-size: 1.875rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111827;
    }

    .artifact-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .artifact-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .artifact-content {
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
      white-space: pre-wrap;
    }

    .btn-start {
      background: #111827;
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-start:hover {
      background: #374151;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #6b7280;
    }
  `;constructor(){super(),this._state=null,this._activePhaseIndex=0}async firstUpdated(){await this.refresh(),setInterval(()=>this.refresh(),3e3)}async refresh(){try{this._state=await m.getRuntime()}catch(e){console.error("Methodology refresh failed",e)}}async startAudit(){try{await m.startSession(),await this.refresh()}catch(e){alert("Failed to start audit: "+e)}}render(){if(!this._state)return n`<div class="empty-state">Loading methodology engine...</div>`;const e=this._state.phases||[],t=e[this._activePhaseIndex];return n`
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-title">Audit Pipeline</div>
          ${e.map((s,i)=>n`
            <div class="phase-item ${this._activePhaseIndex===i?"active":""}" @click=${()=>this._activePhaseIndex=i}>
              <div class="phase-status status-${s.status}"></div>
              ${s.phase.replace("phase-","").replace("-",": ")}
            </div>
          `)}
          
          ${!this._state.isRunning&&e.every(s=>s.status==="pending")?n`
            <button class="btn-start" style="margin-top: 2rem; width: 100%; justify-content: center;" @click=${this.startAudit}>
              🚀 Launch Audit
            </button>
          `:""}
        </aside>

        <main class="content">
          ${t?n`
            <div class="header">
              <div class="phase-label">CURRENT_PHASE_VIEW</div>
              <h1 class="phase-title">${t.phase.toUpperCase().replace(/-/g," ")}</h1>
            </div>

            ${this.renderPhaseContent(t)}
          `:n`
            <div class="empty-state">
              <h2 style="font-size: 1.5rem; color: #111827; margin-bottom: 1rem;">Protocol Methodology Ready</h2>
              <p>Select a phase from the sidebar to view generated artifacts and security reasoning traces.</p>
            </div>
          `}
        </main>
      </div>
    `}renderPhaseContent(e){return e.status==="pending"?n`<div class="empty-state">This phase has not started yet. Data will appear here once the pipeline reaches this stage.</div>`:e.status==="running"?n`<div class="empty-state">
        <div class="status-running" style="width: 20px; height: 20px; margin: 0 auto 1rem auto; border-radius: 50%;"></div>
        SRP Agents are currently performing reasoning for this phase...
      </div>`:n`
      <div class="artifact-card">
        <div class="artifact-title">📋 Phase Artifact: Methodology Evidence</div>
        <div class="artifact-content">${JSON.stringify(this._state?.[this.mapPhaseToKey(e.phase)]||"Artifact data synchronized to run memory.",null,2)}</div>
      </div>
    `}mapPhaseToKey(e){return{"phase-0-preparation":"preAuditPrep","phase-1-recon":"reconResult","phase-2-architecture":"architectureSummary","phase-3-invariants":"invariantRegistry","phase-4-hypotheses":"hypothesisRegistry","phase-5-code-reading":"functionAnnotations","phase-6-notes":"questionLog","phase-7-simulations":"economicAnalysis","phase-8-interaction-matrix":"interactionMatrix","phase-9-economic-modeling":"economicScenarios","phase-10-cross-contract-paths":"crossContractAnalysis","phase-11-reporting":"formalReport","phase-12-remediation":"remediationPlan"}[e]||""}}customElements.define("methodology-view",Xe);class et extends f{static properties={_bootstrap:{state:!0},_runtime:{state:!0},_loading:{state:!0},_path:{state:!0},_error:{state:!0},_skills:{state:!0},_sidebarOpen:{state:!0},_mode:{state:!0}};static styles=$`
    :host {
      --bg-app: #ffffff;
      --bg-sidebar: #f9fafb;
      --border-main: #e5e7eb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --accent: #0052FF;
      
      display: block;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-app);
      color: var(--text-primary);
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar Refinement */
    .sidebar {
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-main);
      display: flex;
      flex-direction: column;
      z-index: 10;
      width: 280px;
      flex-shrink: 0;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar.closed {
      width: 0;
      opacity: 0;
      pointer-events: none;
    }

    .sidebar-header {
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo {
      font-weight: 800;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
      color: var(--text-primary);
    }

    .logo-badge {
      font-size: 10px;
      background: var(--text-primary);
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .nav-section {
      padding: 0.5rem 0.75rem;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 1.5rem 0.75rem 0.5rem 0.75rem;
    }

    .nav-item {
      padding: 0.625rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.15s ease;
    }

    .nav-item:hover {
      background: #f3f4f6;
      color: var(--text-primary);
    }

    .nav-item.active {
      background: #fff;
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02);
      border: 1px solid var(--border-main);
    }

    .nav-icon {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
    }

    /* Role Switcher */
    .role-switcher {
      margin: 1.5rem 0.75rem;
      background: #f3f4f6;
      padding: 0.25rem;
      border-radius: 8px;
      display: flex;
      gap: 0.25rem;
    }

    .role-btn {
      flex: 1;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
    }

    .role-btn.active {
      background: #fff;
      color: var(--text-primary);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    /* Main Content Refinement */
    .main-content {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
    }

    .top-bar {
      height: 60px;
      border-bottom: 1px solid var(--border-main);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      background: #fff;
      z-index: 5;
    }

    .page-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .view-container {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .hamburger-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      margin-right: 0.5rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
    }

    .hamburger-btn:hover {
      color: var(--text-primary);
    }

    /* Skills simplified */
    .skills-footer {
      margin-top: auto;
      padding: 1.5rem;
      border-top: 1px solid var(--border-main);
    }

    .skills-count {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .skills-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .skill-pill {
      font-size: 10px;
      background: #f3f4f6;
      color: var(--text-secondary);
      padding: 2px 8px;
      border-radius: 100px;
      white-space: nowrap;
    }
  `;constructor(){super(),this._bootstrap=null,this._runtime=null,this._loading=!0,this._path=window.location.pathname,this._error=null,this._skills=[],this._sidebarOpen=!0,this._mode="auditor",console.log("SRP Senior App initialized");const e=document.getElementById("boot-status");e&&(e.style.display="none"),document.body.style.background="#ffffff",document.body.style.color="#111827",window.addEventListener("error",t=>{this._error=t.message,console.error("Global JS Error:",t)})}async firstUpdated(){await this.refresh(),window.addEventListener("popstate",()=>{this._path=window.location.pathname}),setInterval(()=>this.poll(),5e3)}async refresh(){try{const e=await m.getBootstrap();if(this._bootstrap=e,e.decision==="ready"){this._runtime=await m.getRuntime();try{const t=await m.getSkills();t.ok&&(this._skills=t.data)}catch(t){console.warn("Could not fetch skills",t)}}}catch(e){this._error="Failed to connect to SRP Gateway. Is it running?",console.error(e)}finally{this._loading=!1}}async poll(){if(this._bootstrap?.decision==="ready")try{const e=await m.getRuntime();this._runtime=e}catch{}}async updateMode(e){this._mode=e;try{await m.setRole(e)}catch(t){console.warn("Failed to update role on backend",t)}}render(){return this._error?n`
        <div style="padding: 4rem; max-width: 600px; margin: auto; text-align: center;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Connection Error</h1>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">${this._error}</p>
          <button style="background: var(--text-primary); color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;" @click=${()=>location.reload()}>Reconnect</button>
        </div>
      `:this._loading?n`<div style="height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; color: var(--text-secondary);">
        <div class="pulse-dot" style="margin-right: 1rem;"></div>
        Initializing SRP Protocol...
      </div>`:this._path==="/setup"?n`<setup-view></setup-view>`:this._bootstrap?.decision!=="ready"?n`
        <div style="padding: 4rem; max-width: 600px; margin: auto; text-align: center;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Welcome to SRP</h1>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">Your local environment is not yet configured for security auditing.</p>
          <a href="/setup" style="background: var(--text-primary); color: #fff; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; font-weight: 600;" @click=${this.navigate}>Configure Environment</a>
        </div>
      `:n`
      <div class="app-container">
        <!-- Minimal Sidebar -->
        <aside class="sidebar ${this._sidebarOpen?"":"closed"}">
          <div class="sidebar-header">
            <div class="logo-container">
              <span class="logo">SRP Protocol</span>
              <span class="logo-badge">v1.0</span>
            </div>
            <button class="toggle-btn" style="background:none; border:none; cursor:pointer; color:var(--text-muted);" @click=${()=>this._sidebarOpen=!1}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
            </button>
          </div>

          <div class="role-switcher">
            <div class="role-btn ${this._mode==="auditor"?"active":""}" @click=${()=>this.updateMode("auditor")}>Auditor</div>
            <div class="role-btn ${this._mode==="developer"?"active":""}" @click=${()=>this.updateMode("developer")}>Developer</div>
          </div>
          
          <div class="section-label">${this._mode.toUpperCase()} WORKSPACE</div>
          <nav class="nav-section">
            <div class="nav-item ${this._path==="/"?"active":""}" @click=${()=>{window.history.pushState({},"","/"),this._path="/"}}>
              <div class="nav-icon">◈</div> Chat Engine
            </div>
            
            ${this._mode==="auditor"?n`
              <div class="nav-item ${this._path==="/audit"?"active":""}" @click=${()=>{window.history.pushState({},"","/audit"),this._path="/audit"}}>
                <div class="nav-icon">🛡️</div> Start Methodology Audit
              </div>
            `:n`
              <div class="nav-item ${this._path==="/build"?"active":""}" @click=${()=>{window.history.pushState({},"","/build"),this._path="/build"}}>
                <div class="nav-icon">⌬</div> Build from Scratch
              </div>
            `}

            <div class="nav-item ${this._path==="/team"?"active":""}" @click=${()=>{window.history.pushState({},"","/team"),this._path="/team"}}>
              <div class="nav-icon">◎</div> Virtual Room
            </div>
          </nav>

          <div class="section-label">System</div>
          <nav class="nav-section">
            <div class="nav-item" @click=${()=>{window.history.pushState({},"","/setup"),this._path="/setup"}}>
              <div class="nav-icon">⚙</div> Settings
            </div>
          </nav>

          <div class="skills-footer">
            <div class="skills-count">Active Agents: ${this._skills.length}</div>
            <div class="skills-pills">
              ${this._skills.slice(0,6).map(e=>n`<div class="skill-pill">${e.name}</div>`)}
              ${this._skills.length>6?n`<div class="skill-pill">+${this._skills.length-6}</div>`:""}
            </div>
          </div>
        </aside>

        <!-- Main Workspace Area -->
        <main class="main-content">
          <header class="top-bar">
            <div class="page-title">
              ${this._sidebarOpen?"":n`
                <button class="hamburger-btn" @click=${()=>this._sidebarOpen=!0}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
              `}
              ${this._path==="/audit"?"Methodology Pipeline":this._path==="/build"?"Build Workflow":this._path==="/team"?"Collaboration":"Security Chat"}
            </div>
            <div class="status-indicator">
              <div class="pulse-dot"></div>
              <span>Protocol Active</span>
            </div>
          </header>

          <div class="view-container">
            ${this._path==="/audit"?n`<methodology-view></methodology-view>`:this._path==="/build"?n`<gstack-view></gstack-view>`:this._path==="/team"?n`<team-view></team-view>`:n`<chat-view .mode=${this._mode}></chat-view>`}
          </div>
        </main>
      </div>
    `}navigate(e){e.preventDefault();const t=e.currentTarget.href;window.history.pushState({},"",t),this._path=window.location.pathname}}customElements.define("srp-app",et);
