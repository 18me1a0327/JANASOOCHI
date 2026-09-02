import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { fetchDocuments } from './data'
import { getSourceUrl, pdfjs, supabase } from './lib'
import type { BoundingBox, DocumentRow, Voter } from './types'

export default function SourceViewer(){
 const{pdfId=''}=useParams();const[query,setQuery]=useSearchParams();const navigate=useNavigate();const canvasRef=useRef<HTMLCanvasElement>(null);const[pdf,setPdf]=useState<PDFDocumentProxy|null>(null);const[document,setDocument]=useState<DocumentRow|null>(null);const[box,setBox]=useState<BoundingBox|null>(null);const[zoom,setZoom]=useState(1.15);const[busy,setBusy]=useState(true);const[error,setError]=useState('');const page=Math.max(1,Number(query.get('page'))||1),voterId=query.get('voter');
 useEffect(()=>{let active=true;setBusy(true);setError('');void(async()=>{try{const docs=await fetchDocuments([pdfId]);if(!docs[0])throw new Error('Source document is unavailable.');const source=docs[0];const[url,voter]=await Promise.all([getSourceUrl(source.storage_path),voterId?supabase.from('voter_records').select('bounding_box').eq('id',voterId).single():Promise.resolve({data:null,error:null})]);if(voter.error)throw voter.error;const loaded=await pdfjs.getDocument(url).promise;if(!active)return;setDocument(source);setPdf(loaded);setBox(((voter.data as Pick<Voter,'bounding_box'>|null)?.bounding_box)??null)}catch(loadError){console.error(loadError);if(active)setError('Unable to open PDF')}finally{if(active)setBusy(false)}})();return()=>{active=false}},[pdfId,voterId]);
 useEffect(()=>{if(!pdf||!canvasRef.current)return;let cancelled=false;void(async()=>{try{const pdfPage=await pdf.getPage(Math.min(page,pdf.numPages));const viewport=pdfPage.getViewport({scale:zoom});const canvas=canvasRef.current;if(!canvas||cancelled)return;canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;await pdfPage.render({canvasContext:canvas.getContext('2d')!,viewport}).promise}catch(renderError){console.error(renderError);if(!cancelled)setError('Unable to open PDF')}})();return()=>{cancelled=true}},[pdf,page,zoom]);
 function go(next:number){const params=new URLSearchParams(query);params.set('page',String(Math.min(Math.max(1,next),pdf?.numPages??next)));setQuery(params)}
 return <section className="source-viewer">
<header>
<div>
<small>AUTHORIZED UPLOADED SOURCE</small>
<h1>{document?.filename??'Original PDF page'}</h1>
<span>Part {document?.part_number??'—'} · Physical page {page}{document?.revision_identifier?` · ${document.revision_identifier}`:''}</span>
</div>
<button className="icon-button inverse" aria-label="Back to results" onClick={()=>navigate(-1)}>
<X/>
</button>
</header>
<div className="source-toolbar">
<button className="secondary compact" disabled={page<=1} onClick={()=>go(page-1)}>
<ChevronLeft/>Previous page</button>
<label>Page<input type="number" min="1" max={pdf?.numPages??1} value={page} onChange={event=>go(Number(event.target.value))}/>
<span>of {pdf?.numPages??'—'}</span>
</label>
<button className="secondary compact" disabled={!pdf||page>=pdf.numPages} onClick={()=>go(page+1)}>Next page<ChevronRight/>
</button>
<button className="secondary compact" onClick={()=>setZoom(value=>Math.max(.6,value-.15))}>
<ZoomOut/>Zoom out</button>
<button className="secondary compact" onClick={()=>setZoom(value=>Math.min(3,value+.15))}>
<ZoomIn/>Zoom in</button>
<button className="secondary compact" onClick={()=>setZoom(1.15)}>
<RotateCcw/>Reset</button>
</div>{error&&<div className="notice error">{error}</div>}{busy&&<div className="source-loading">Opening verified source page…</div>}<div className="pdf-stage">
<div className="pdf-page">
<canvas ref={canvasRef}/>{box&&<span className="voter-highlight" style={{left:`${box.x/box.pageWidth*100}%`,top:`${box.y/box.pageHeight*100}%`,width:`${box.width/box.pageWidth*100}%`,height:`${box.height/box.pageHeight*100}%`}}/>}</div>
</div>{!busy&&!box&&voterId&&<p className="source-note">Exact voter-block coordinates are unavailable for this record. The correct physical PDF page is shown.</p>}</section>
}
