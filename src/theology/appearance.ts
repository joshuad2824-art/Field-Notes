import { useSyncExternalStore } from 'react'

// These follow the existing topic cards' three repeating colors. The cards
// themselves remain styled by their original nth-child rules.
export const topicTone=(index:number)=>index<0?undefined:(['forest','slate','oxblood'] as const)[index%3]

const KEY='field-notes.doctrine-dark',listeners=new Set<()=>void>()
function read(){try{return localStorage.getItem(KEY)==='true'}catch{return false}}
let dark=read()
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
export function useDoctrineDark(){
  const value=useSyncExternalStore(subscribe,()=>dark)
  return [value,(next:boolean)=>{
    dark=next
    try{localStorage.setItem(KEY,String(next))}catch{/* A blocked preference store must not interrupt reading. */}
    for(const listener of listeners)listener()
  }] as const
}
