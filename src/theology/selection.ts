import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

type PassageSelection={start:number;end:number;left:number;top:number}
export function useStudySelection(root:RefObject<HTMLDivElement|null>,enabled:boolean,editionSection:string){
  const toolbar=useRef<HTMLDivElement>(null),saved=useRef<Range|null>(null),bounds=useRef<{start:number;end:number}|null>(null),engaged=useRef(false),entered=useRef(false)
  const [selection,setSelection]=useState<PassageSelection|null>(null)
  const clear=useCallback((native=false,focus=false)=>{saved.current=null;bounds.current=null;engaged.current=false;entered.current=false;setSelection(null);if(native)window.getSelection()?.removeAllRanges();if(focus)root.current?.focus({preventScroll:true})},[root])
  const restore=useCallback(()=>{const range=saved.current;if(range&&document.contains(range.commonAncestorContainer)){const current=window.getSelection();current?.removeAllRanges();current?.addRange(range.cloneRange())}},[])
  const preserve=(event:PointerEvent<HTMLButtonElement>)=>{event.preventDefault();engaged.current=true;restore()}
  useEffect(()=>{
    clear();if(!enabled)return
    const point=(node:Node|null,offset:number):number|null=>{
      const el=node?.nodeType===Node.TEXT_NODE?node.parentElement:node as Element|null
      if(!node||!el||!root.current?.contains(el))return null
      const span=el.closest<HTMLElement>('[data-study-start]')
      if(span){const r=document.createRange();r.setStart(span,0);try{r.setEnd(node,offset)}catch{return null};return Number(span.dataset.studyStart)+r.toString().length}
      const descendant=(part:Node|undefined,last:boolean)=>{
        const element=part?.nodeType===Node.ELEMENT_NODE?part as HTMLElement:part?.parentElement
        if(!element)return null
        const leaves=element.matches('[data-study-start]')?[element]:[...element.querySelectorAll<HTMLElement>('[data-study-start]')],leaf=last?leaves[leaves.length-1]:leaves[0]
        return leaf?Number(last?leaf.dataset.studyEnd:leaf.dataset.studyStart):null
      }
      return offset<node.childNodes.length?descendant(node.childNodes[offset],false):descendant(node.childNodes[offset-1],true)
    }
    const inspect=()=>{
      const current=window.getSelection()
      if(!current||current.isCollapsed||!current.rangeCount){if(engaged.current&&saved.current)return;clear();return}
      const a=point(current.anchorNode,current.anchorOffset),b=point(current.focusNode,current.focusOffset)
      if(a===null||b===null||a===b){if(engaged.current&&saved.current)return;clear();return}
      const start=Math.min(a,b),end=Math.max(a,b),range=current.getRangeAt(0)
      if(bounds.current?.start!==start||bounds.current?.end!==end)entered.current=false
      bounds.current={start,end};saved.current=range.cloneRange()
      const visible=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight),rect=visible[visible.length-1]??range.getBoundingClientRect()
      if(rect.bottom<0||rect.top>innerHeight){setSelection(null);return}
      setSelection({start,end,left:Math.max(12,Math.min(innerWidth-232,rect.left+rect.width/2-110)),top:Math.max(12,Math.min(innerHeight-68,rect.top>72?rect.top-60:rect.bottom+10))})
    }
    const pointer=(e:globalThis.PointerEvent)=>{if(toolbar.current?.contains(e.target as Node)){engaged.current=true;return};engaged.current=false;if(!root.current?.contains(e.target as Node))clear()}
    const focus=(e:FocusEvent)=>{engaged.current=!!toolbar.current?.contains(e.target as Node)}
    const keys=(e:KeyboardEvent)=>{
      if(!bounds.current)return
      if(e.key==='Escape'){e.preventDefault();clear(true,true);return}
      const buttons=[...toolbar.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]],inside=!!toolbar.current?.contains(document.activeElement)
      if((e.key==='Tab'&&!e.shiftKey&&!inside&&!entered.current)||(e.altKey&&e.key.toLowerCase()==='h')){if(!buttons.length)return;e.preventDefault();entered.current=true;engaged.current=true;buttons[0].focus({preventScroll:true});restore()}
      else if(inside&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();const at=buttons.indexOf(document.activeElement as HTMLButtonElement),next=(at+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus({preventScroll:true});restore()}
    }
    document.addEventListener('selectionchange',inspect);document.addEventListener('pointerdown',pointer,true);document.addEventListener('focusin',focus);document.addEventListener('keydown',keys);document.addEventListener('scroll',inspect,true);window.addEventListener('resize',inspect)
    return()=>{document.removeEventListener('selectionchange',inspect);document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('focusin',focus);document.removeEventListener('keydown',keys);document.removeEventListener('scroll',inspect,true);window.removeEventListener('resize',inspect)}
  },[root,enabled,editionSection,clear,restore])
  return {selection,toolbar,preserve,clear}
}
