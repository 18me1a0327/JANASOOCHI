import type{BoundingBox,FieldConfidence,Filters,MatchExplanation,RecordLanguage,Voter}from'./types';
export const SUPPORTED=[227,228,229,230]as const;
export const OCR_REVIEW_THRESHOLD=95;
export const UNSUPPORTED='Unsupported electoral roll. This application supports only Pallerlamudi Parts 227, 228, 229 and 230.';
export function pdfPayloadProblem(bytes:Uint8Array):'html'|'invalid'|null{const sample=new TextDecoder().decode(bytes.slice(0,1024)).trimStart().toLowerCase();if(sample.startsWith('<!doctype html')||sample.startsWith('<html')||/<html[\s>]/.test(sample.slice(0,300)))return'html';return sample.includes('%pdf-')?null:'invalid'}
export function isSuspiciousHouseNumber(value:string|null|undefined){const house=value?.trim()??'';if(!house)return false;const compact=house.replace(/\s+/g,'');return house.length>40||!/[0-9]/.test(house)||/[\r\n]/.test(house)||!/^\d+(?:[-/][\dA-Za-z]+)*$/.test(compact)||/(?:photo|available|elector|voter|name|father|mother|husband|guardian|age|gender|epic|ఓటరు|పేరు|తండ్రి|తల్లి|భర్త|వయస్సు|లింగం|نام|والد|والدہ|شوہر|عمر|جنس)/iu.test(house)}
export const normalize=(v:string|null|undefined)=>v?.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').replace(/\s*-\s*/g,'-').trim()||'';
export const normalizeHouse=(v:string|null|undefined)=>normalize(v).replace(/\s*\/\s*/g,'/');
export function languageFromFilename(filename=''):RecordLanguage{const code=filename.match(/(?:^|[-_])(ENG|TEL|URD|URDU)(?:[-_.]|$)/i)?.[1]?.toUpperCase();return code==='TEL'?'te':code==='URD'||code==='URDU'?'ur':'en'}
export function detectLanguage(text:string,fallback:RecordLanguage='en'):{language:RecordLanguage;confidence:number}{const counts:{language:RecordLanguage;count:number}[]=[{language:'te',count:(text.match(/[\u0C00-\u0C7F]/g)||[]).length},{language:'ur',count:(text.match(/[\u0600-\u06FF]/g)||[]).length},{language:'en',count:(text.match(/[A-Za-z]/g)||[]).length}];const total=counts.reduce((sum,item)=>sum+item.count,0);const winner=[...counts].sort((a,b)=>b.count-a.count)[0];if(!total||winner.count<4)return{language:fallback,confidence:total?Math.round(winner.count/total*100):0};return{language:winner.language,confidence:Math.round(winner.count/total*100)}}
export function validatePasswordChange(password:string,confirmation:string){if(password.length<8)return'too_short';if(password!==confirmation)return'mismatch';return null}
export function detectPart(text:string,filename=''){const contentHits=[...text.matchAll(/(?:part|భాగం|حصہ)\s*(?:(?:no\.?|number|నెం|సంఖ్య|نمبر)\s*)?[:#-]*\s*(\d{3})/gi)].map(x=>Number(x[1]));const filenameHits=[...filename.matchAll(/(?:^|[-_])(?:ENG|TEL|URD|URDU)[-_](\d{3})(?:[-_.]|$)/gi)].map(x=>Number(x[1]));const hits=[...contentHits,...filenameHits].filter(x=>SUPPORTED.includes(x as never));const unique=[...new Set(hits)];return unique.length===1?unique[0]:null}
export function ocrLanguages(filename=''){const code=filename.match(/(?:^|[-_])(ENG|TEL|URD|URDU)(?:[-_.]|$)/i)?.[1]?.toUpperCase();if(code==='TEL')return'eng+tel';if(code==='URD'||code==='URDU')return'eng+urd';if(code==='ENG')return'eng';return'eng+tel+urd'}
export type OcrWord={text:string;confidence?:number;bbox:{x0:number;y0:number;x1:number;y1:number}};
export function columnizeOcrWords(words:OcrWord[],pageWidth:number){
 const columns=[[],[],[]]as OcrWord[][];
 words.filter(word=>word.text.trim()).forEach(word=>{const center=(word.bbox.x0+word.bbox.x1)/2;columns[Math.min(2,Math.max(0,Math.floor(center/(pageWidth/3))))].push(word)});
 return columns.map(column=>{const sorted=[...column].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);const lines:{y:number;height:number;words:OcrWord[]}[]=[];for(const word of sorted){const y=(word.bbox.y0+word.bbox.y1)/2,height=Math.max(1,word.bbox.y1-word.bbox.y0);let line=lines.find(candidate=>Math.abs(candidate.y-y)<=Math.max(candidate.height,height)*.55);if(!line){line={y,height,words:[]};lines.push(line)}line.words.push(word);line.y=(line.y*(line.words.length-1)+y)/line.words.length;line.height=Math.max(line.height,height)}return lines.sort((a,b)=>a.y-b.y).map(line=>line.words.sort((a,b)=>a.bbox.x0-b.bbox.x0).map(word=>word.text.trim()).join(' ')).join('\n')}).join('\n');
}
export function analyzeOcrLayout(words:OcrWord[],pageWidth:number,pageHeight:number){
 const columns=[[],[],[]]as OcrWord[][];words.filter(word=>word.text.trim()).forEach(word=>{const center=(word.bbox.x0+word.bbox.x1)/2;columns[Math.min(2,Math.max(0,Math.floor(center/(pageWidth/3))))].push(word)});
 const boxes:BoundingBox[]=[];const fieldConfidences:FieldConfidence[]=[];
 const nameLabel=/(?:^|\s)(?:Name|ఓటరు\s*పేరు|نام)\s*:/i;
 const labels:{key:keyof FieldConfidence;pattern:RegExp}[]=[{key:'name',pattern:nameLabel},{key:'relation_name',pattern:/(?:Father|Mother|Husband|Guardian|తండ్రి|తల్లి|భర్త|సంరక్షక|والد|والدہ|شوہر|سرپرست).*:/i},{key:'house_number',pattern:/(?:House|ఇంటి|مکان).*:/i},{key:'age',pattern:/(?:Age|వయస్సు|వయసూ|عمر).*[:\s]/i},{key:'gender',pattern:/(?:Gender|లింగం|లింగము|جنس).*[:\s]/i},{key:'epic',pattern:/(?:EPIC|Voter\s*ID)|\b[A-Z]{3}\d{7}\b/i}];
 for(const column of columns){const sorted=[...column].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);const lines:{y:number;words:OcrWord[]}[]=[];for(const word of sorted){const y=(word.bbox.y0+word.bbox.y1)/2;let line=lines.find(item=>Math.abs(item.y-y)<=Math.max(6,(word.bbox.y1-word.bbox.y0)*.55));if(!line){line={y,words:[]};lines.push(line)}line.words.push(word);line.y=(line.y*(line.words.length-1)+y)/line.words.length}lines.sort((a,b)=>a.y-b.y).forEach(line=>line.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));const names=lines.map((line,index)=>nameLabel.test(line.words.map(word=>word.text).join(' '))?index:-1).filter(index=>index>=0);names.forEach((nameIndex,position)=>{const previous=position?lines[names[position-1]].y:0,next=position+1<names.length?lines[names[position+1]].y:pageHeight;const y0=position?(previous+lines[nameIndex].y)/2:Math.max(0,lines[nameIndex].y-60);const y1=position+1<names.length?(lines[nameIndex].y+next)/2:Math.min(pageHeight,lines[nameIndex].y+Math.max(80,pageHeight*.12));const segment=lines.filter(line=>line.y>=y0&&line.y<y1).flatMap(line=>line.words);if(!segment.length)return;const x0=Math.min(...segment.map(word=>word.bbox.x0)),x1=Math.max(...segment.map(word=>word.bbox.x1)),top=Math.min(...segment.map(word=>word.bbox.y0)),bottom=Math.max(...segment.map(word=>word.bbox.y1));boxes.push({x:x0,y:top,width:x1-x0,height:bottom-top,pageWidth,pageHeight});const confidence:FieldConfidence={};for(const{key,pattern}of labels){const matching=lines.filter(line=>line.y>=y0&&line.y<y1&&pattern.test(line.words.map(word=>word.text).join(' '))).flatMap(line=>line.words).map(word=>word.confidence).filter((value):value is number=>typeof value==='number');if(matching.length)confidence[key]=Math.round(matching.reduce((sum,value)=>sum+value,0)/matching.length)}fieldConfidences.push(confidence)})}
 return{boxes,fieldConfidences};
}
export function gridCardizeOcrWords(words:OcrWord[],pageWidth:number,pageHeight:number){
 const top=pageHeight*.032,bottom=pageHeight*.972,rowHeight=(bottom-top)/10,columnWidth=pageWidth/3;
 const cards=Array.from({length:30},()=>[]as OcrWord[]);
 for(const word of words){
  const text=word.text.trim();if(!text)continue;
  const x=(word.bbox.x0+word.bbox.x1)/2,y=(word.bbox.y0+word.bbox.y1)/2;
  const column=Math.min(2,Math.max(0,Math.floor(x/columnWidth))),row=Math.floor((y-top)/rowHeight);
  if(row>=0&&row<10)cards[row*3+column].push(word);
 }
 const boxes:BoundingBox[]=[],fieldConfidences:FieldConfidence[]=[],blocks:string[]=[];
 const patterns:{key:keyof FieldConfidence;pattern:RegExp}[]=[
  {key:'name',pattern:/(?:Name|ఓటరు\s*పేరు|نام)\s*:/i},
  {key:'relation_name',pattern:/(?:Father|Mother|Husband|Guardian|తండ్రి|తల్లి|భర్త|సంరక్షక|والد|والدہ|شوہر|سرپرست).*:/i},
  {key:'house_number',pattern:/(?:House|ఇంటి|مکان).*:/i},
  {key:'age',pattern:/(?:Age|వయస్సు|వయసూ|عمر).*[:\s]/i},
  {key:'gender',pattern:/(?:Gender|లింగం|లింగము|جنس).*[:\s]/i},
  {key:'epic',pattern:/(?:EPIC|Voter\s*ID)|\b[A-Z]{3}\d{7}\b/i},
 ];
 for(let index=0;index<cards.length;index++){
  const card=cards[index];if(!card.length)continue;
  const lines:{y:number;words:OcrWord[]}[]=[];
  for(const word of [...card].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){
   const y=(word.bbox.y0+word.bbox.y1)/2;
   let line=lines.find(item=>Math.abs(item.y-y)<=Math.max(6,(word.bbox.y1-word.bbox.y0)*.55));
   if(!line){line={y,words:[]};lines.push(line)}line.words.push(word);line.y=(line.y*(line.words.length-1)+y)/line.words.length;
  }
  lines.sort((a,b)=>a.y-b.y).forEach(line=>line.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));
  const lineTexts=lines.map(line=>line.words.map(word=>word.text.trim()).join(' ').trim()).filter(Boolean);
  if(!lineTexts.some(line=>/(?:Name|ఓటరు\s*పేరు|نام)\s*:/i.test(line)))continue;
  const row=Math.floor(index/3),column=index%3,x0=column*columnWidth,y0=top+row*rowHeight;
  const topWords=card.filter(word=>((word.bbox.y0+word.bbox.y1)/2)<y0+rowHeight*.2);
  const serial=topWords.filter(word=>((word.bbox.x0+word.bbox.x1)/2)<x0+columnWidth*.48).map(word=>word.text.trim()).find(value=>/^\d{1,4}$/.test(value));
  const epic=topWords.map(word=>word.text.trim()).join(' ').match(/\b[A-Z]{3}\d{7}\b/i)?.[0];
  const prefix=[serial?`Serial Number: ${serial}`:'',epic?`EPIC: ${epic.toUpperCase()}`:''].filter(Boolean);
  blocks.push(['--- RECORD ---',...prefix,...lineTexts].join('\n'));
  boxes.push({x:x0,y:y0,width:columnWidth,height:rowHeight,pageWidth,pageHeight});
  const confidence:FieldConfidence={};
  for(const{key,pattern}of patterns){const values=lines.filter(line=>pattern.test(line.words.map(word=>word.text).join(' '))).flatMap(line=>line.words).map(word=>word.confidence).filter((value):value is number=>typeof value==='number');if(values.length)confidence[key]=Math.round(values.reduce((sum,value)=>sum+value,0)/values.length)}
  fieldConfidences.push(confidence);
 }
 return{text:blocks.join('\n'),boxes,fieldConfidences};
}
export function extractGridCodes(words:OcrWord[],pageWidth:number,pageHeight:number){
 const top=pageHeight*.032,bottom=pageHeight*.972,rowHeight=(bottom-top)/10,columnWidth=pageWidth/3;
 return Array.from({length:30},(_,index)=>{
  const row=Math.floor(index/3),column=index%3,x0=column*columnWidth,y0=top+row*rowHeight;
  const card=words.filter(word=>{const x=(word.bbox.x0+word.bbox.x1)/2,y=(word.bbox.y0+word.bbox.y1)/2;return x>=x0&&x<x0+columnWidth&&y>=y0&&y<y0+rowHeight*.22});
  const text=card.sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0).map(word=>word.text.trim()).join(' ');
  const epic=text.match(/\b[A-Z]{3}\d{7}\b/i)?.[0]?.toUpperCase()??null;
  const serial=card.filter(word=>((word.bbox.x0+word.bbox.x1)/2)<x0+columnWidth*.48).map(word=>word.text.trim()).find(value=>/^\d{1,4}$/.test(value))??text.match(/(?:^|\s)(\d{1,4})(?=\s|[A-Z])/i)?.[1]??null;
  const confidenceValues=card.map(word=>word.confidence).filter((value):value is number=>typeof value==='number');
  return{index,serial,epic,confidence:confidenceValues.length?Math.round(confidenceValues.reduce((sum,value)=>sum+value,0)/confidenceValues.length):null};
 });
}
export function countRecordLabels(text:string){return(text.match(/(?:^|\n)\s*(?:\[?\d{1,4}\]?[.)-]?\s*)?(?:Name|ఓటరు\s*పేరు|نام)\s*:/gim)||[]).length}
export function similarity(a:string,b:string){a=normalize(a);b=normalize(b);if(!a||!b)return 0;if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length);const dp=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i?j?0:i:j));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);return 1-dp[a.length][b.length]/Math.max(a.length,b.length)}

const teluguConsonants:Record<string,string>={'క':'k','ఖ':'kh','గ':'g','ఘ':'gh','ఙ':'ng','చ':'ch','ఛ':'chh','జ':'j','ఝ':'jh','ఞ':'ny','ట':'t','ఠ':'th','డ':'d','ఢ':'dh','ణ':'n','త':'t','థ':'th','ద':'d','ధ':'dh','న':'n','ప':'p','ఫ':'ph','బ':'b','భ':'bh','మ':'m','య':'y','ర':'r','ల':'l','వ':'v','శ':'sh','ష':'sh','స':'s','హ':'h','ళ':'l','ఱ':'r'};
const scriptVowels:Record<string,string>={'అ':'a','ఆ':'aa','ఇ':'i','ఈ':'ii','ఉ':'u','ఊ':'uu','ఎ':'e','ఏ':'ee','ఐ':'ai','ఒ':'o','ఓ':'oo','ఔ':'au'};
const vowelMarks:Record<string,string>={'ా':'aa','ి':'i','ీ':'ii','ు':'u','ూ':'uu','ె':'e','ే':'ee','ై':'ai','ొ':'o','ో':'oo','ౌ':'au'};
const urduLetters:Record<string,string>={'ا':'a','آ':'aa','ب':'b','پ':'p','ت':'t','ٹ':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh','د':'d','ڈ':'d','ذ':'z','ر':'r','ڑ':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ک':'k','گ':'g','ل':'l','م':'m','ن':'n','ں':'n','و':'o','ہ':'h','ھ':'h','ء':'','ی':'i','ے':'e'};
export function romanize(value:string|null|undefined){const input=value?.normalize('NFC')||'';let out='';for(let i=0;i<input.length;i++){const char=input[i];const consonant=teluguConsonants[char];if(consonant){const next=input[i+1];if(next==='్'){out+=consonant;i++;continue}const mark=vowelMarks[next];out+=consonant+(mark??'a');if(mark!==undefined)i++;continue}out+=scriptVowels[char]??urduLetters[char]??(char==='ం'?'m':char==='ః'?'h':char)}return normalize(out).replace(/[^a-z0-9\s/-]/g,'')}

export function effectiveValue(v:Voter,key:'original_name'|'original_relation_name'|'original_house_number'|'age'|'gender'|'epic_number'){const corrected=v.corrected_value?.[key];return corrected!==undefined&&corrected!==''?String(corrected):v[key]}
type Candidate={score:number;explanation:MatchExplanation;type:'Exact Match'|'Partial Match'|'Transliteration Match'|'Fuzzy Match'};
function textCandidate(field:string,value:string|null,query:string,fuzzy:boolean,weight:number):Candidate|null{if(!query)return{score:100,explanation:{field,detail:'NOT FILTERED',score:100,kind:'exact'},type:'Exact Match'};const left=normalize(value),right=normalize(query);if(!left)return null;if(left===right)return{score:100,explanation:{field,detail:'EXACT',score:100,kind:'exact'},type:'Exact Match'};if(left.includes(right))return{score:96,explanation:{field,detail:'PARTIAL',score:96,kind:'partial'},type:'Partial Match'};const latinLeft=romanize(value),latinRight=romanize(query);if(latinLeft&&latinRight&&(latinLeft===latinRight||latinLeft.includes(latinRight)||latinRight.includes(latinLeft)))return{score:92,explanation:{field,detail:'TRANSLITERATION',score:92,kind:'transliteration'},type:'Transliteration Match'};if(fuzzy&&right.length>=3){const score=Math.round(Math.max(similarity(left,right),similarity(latinLeft,latinRight))*100);if(score>=72)return{score,explanation:{field,detail:`${score}% FUZZY`,score,kind:'fuzzy'},type:'Fuzzy Match'}}void weight;return null}
export function rankVoter(v:Voter,f:Filters){if(f.part&&f.part!=='all'&&v.part_number!==Number(f.part))return null;if(f.selectedLanguageOnly&&v.original_language!==f.recordLanguage)return null;const candidates:{candidate:Candidate;weight:number}[]=[];const addText=(field:string,value:string|null,query:string,weight:number,fuzzy=f.fuzzy)=>{if(!query)return true;const candidate=textCandidate(field,value,query,fuzzy,weight);if(!candidate)return false;candidates.push({candidate,weight});return true};const name=effectiveValue(v,'original_name');if(!addText('Name',name===null?null:String(name),f.name,6))return null;const relations:[keyof Pick<Filters,'father'|'mother'|'husband'>,Voter['relation_type']][]=[['father','Father'],['mother','Mother'],['husband','Husband']];for(const[key,type]of relations){if(f[key]&&(v.relation_type!==type||!addText(`${type} Name`,String(effectiveValue(v,'original_relation_name')??''),f[key],7)))return null}if(f.house){if(normalizeHouse(String(effectiveValue(v,'original_house_number')??''))!==normalizeHouse(f.house))return null;candidates.push({candidate:{score:100,explanation:{field:'House Number',detail:'EXACT',score:100,kind:'exact'},type:'Exact Match'},weight:8})}if(f.age){if(v.age===null)return null;const difference=v.age-Number(f.age);if(Math.abs(difference)>f.ageTolerance)return null;const exact=difference===0;candidates.push({candidate:{score:exact?100:Math.max(85,100-Math.abs(difference)*5),explanation:{field:'Age',detail:exact?'EXACT':`${difference>0?'+':''}${difference} YEAR${Math.abs(difference)===1?'':'S'}`,score:exact?100:Math.max(85,100-Math.abs(difference)*5),kind:exact?'exact':'tolerance'},type:exact?'Exact Match':'Partial Match'},weight:5})}const exactFields:[string,string|null,string,number][]=[['Gender',String(effectiveValue(v,'gender')??''),f.gender,4],['EPIC',String(effectiveValue(v,'epic_number')??''),f.epic,10],['Serial Number',v.serial_number,f.serial,9]];for(const[field,value,query,weight]of exactFields){if(!query)continue;if(normalize(value)!==normalize(query))return null;candidates.push({candidate:{score:100,explanation:{field,detail:'EXACT',score:100,kind:'exact'},type:'Exact Match'},weight})}const explanation=candidates.map(item=>item.candidate.explanation);const weighted=candidates.reduce((sum,item)=>sum+item.candidate.score*item.weight,0);const weights=candidates.reduce((sum,item)=>sum+item.weight,0);const rank=['Exact Match','Partial Match','Transliteration Match','Fuzzy Match']as const;const matchType=candidates.reduce<(typeof rank)[number]>((current,item)=>rank.indexOf(item.candidate.type)>rank.indexOf(current)?item.candidate.type:current,'Exact Match');return{score:weights?Math.round(weighted/weights):100,matchType,explanation}}
export function matchVoter(v:Voter,f:Filters){return Boolean(rankVoter(v,{...f,ageTolerance:f.ageTolerance??0}))}
export function parseRecords(text:string,part:number,page:number,confidence:number|null,context?:{language?:RecordLanguage;boundingBoxes?:BoundingBox[];fieldConfidences?:FieldConfidence[];printedPage?:number|null}):Omit<Voter,'id'|'pdf_id'>[]{
 const lines=text.replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
 const nameField='(?:Name|ఓటరు\\s*పేరు|نام)';
 const relationField='(?:Fathers?\\s+Name|Mothers?\\s+Name|Husbands?\\s+Name|Guardians?\\s+Name|తండ్రి\\s*పేరు|తల్లి\\s*పేరు|భర్త\\s*పేరు|సంరక్షకుని?\\s*పేరు|والد(?:\\s+کا)?\\s+نام|والدہ(?:\\s+کا)?\\s+نام|شوہر(?:\\s+کا)?\\s+نام|سرپرست(?:\\s+کا)?\\s+نام)';
 const houseField='(?:House\\s+(?:Number|No\\.?)|ఇంటి\\s*(?:నంబర్|సంఖ్య)|مکان(?:\\s+نمبر)?)';
 const ageField='(?:Age|వయస్సు|వయసూ|عمر)';
 const genderField='(?:Gender|లింగం|లింగము|جنس)';
 const namePattern=new RegExp(`^\\s*(?:\\[?\\d{1,4}\\]?[.)-]?\\s*)?${nameField}\\s*:`, 'i');
 const relationPattern=new RegExp(`^${relationField}\\s*:`, 'i');
 const housePattern=new RegExp(`^${houseField}\\s*:`, 'i');
 const agePattern=new RegExp(`^${ageField}(?:\\s*:|\\b)`, 'i');
 const nameIndexes=lines.map((line,index)=>namePattern.test(line)?index:-1).filter(index=>index>=0);
 const printed=context?.printedPage??(Number(text.match(/(?:Total\s+Pages[^\n]*-\s*Page|మొత్తం\s*పేజీలు[^\n]*-\s*పేజీ|کل\s*صفحات[^\n]*-\s*صفحہ|Page|పేజీ|صفحہ)\s*[:\-]?\s*(\d+)/i)?.[1])||null);
 const label=new RegExp(`^(?:${nameField}|${relationField}|${houseField}|${ageField}|${genderField})(?:\\s*:|\\b)`, 'i');
 const value=(line:string)=>line.replace(/^[^:]*:\s*/,'').trim();
 return nameIndexes.map((nameIndex,position)=>{
  const next=nameIndexes[position+1]??lines.length;
  let prefixStart=nameIndex;
  for(let i=nameIndex-1;i>=Math.max(0,nameIndex-6);i--){if(/^(?:--- RECORD ---|Photo|Available)$/i.test(lines[i]))break;prefixStart=i}
  let end=next;
  for(let i=nameIndex;i<next;i++)if(/^Available$/i.test(lines[i])){end=i+1;break}
  const blockLines=lines.slice(prefixStart,end);
  const localName=blockLines.findIndex(line=>namePattern.test(line));
  const relationIndex=blockLines.findIndex((line,index)=>index>localName&&relationPattern.test(line));
  const houseIndex=blockLines.findIndex((line,index)=>index>localName&&housePattern.test(line));
  const ageIndex=blockLines.findIndex((line,index)=>index>localName&&agePattern.test(line));
  const collect=(start:number,stop:number)=>start<0?'':blockLines.slice(start,stop).map((line,index)=>index?line:value(line)).filter(line=>!label.test(line)||line===blockLines[start]).join(' ').trim();
  const name=collect(localName,Math.min(...[relationIndex,houseIndex,ageIndex].filter(x=>x>=0),blockLines.length))||null;
  const relationLine=relationIndex>=0?blockLines[relationIndex]:'';
  const relationStop=Math.min(...[houseIndex,ageIndex].filter(x=>x>relationIndex),blockLines.length);
  const relationName=relationIndex>=0?collect(relationIndex,relationStop):null;
  const type=/^(?:Fathers?|తండ్రి|والد)/i.test(relationLine)?'Father':/^(?:Mothers?|తల్లి|والدہ)/i.test(relationLine)?'Mother':/^(?:Husbands?|భర్త|شوہر)/i.test(relationLine)?'Husband':/^(?:Guardians?|సంరక్షక|سرپرست)/i.test(relationLine)?'Guardian':'Unknown';
  const parsedHouse=houseIndex>=0?value(blockLines[houseIndex]).replace(new RegExp(`\\s+(?:${ageField}|${genderField}|Photo|Available).*$`,'i'),'').replace(/[-–—]\s*$/,'').trim()||null:null;
  const suspiciousHouse=isSuspiciousHouseNumber(parsedHouse),house=suspiciousHouse?null:parsedHouse;
  const ageGender=blockLines.slice(Math.max(0,ageIndex),Math.min(blockLines.length,ageIndex+2)).join(' ');
  const rawAge=ageGender.match(new RegExp(`${ageField}\\s*:?\\s*(\\d{1,3})`,'i'))?.[1]||null;
  const parsedAge=rawAge===null?null:Number(rawAge);
  // Keep impossible OCR readings in original_text, but never send them to the
  // constrained age column. NULL plus review is safer than guessing a value.
  const invalidAge=parsedAge!==null&&(!Number.isInteger(parsedAge)||parsedAge<18||parsedAge>125);
  const age=invalidAge?null:parsedAge;
  const gender=ageGender.match(new RegExp(`${genderField}\\s*:?\\s*([\\p{L}\\p{M}]+)`,'iu'))?.[1]||null;
  const prefix=`${blockLines.slice(0,Math.max(0,localName)).join(' ')} ${blockLines[localName]?.split(new RegExp(nameField,'i'))[0]||''}`;
  const explicitEpic=blockLines.join(' ').match(/(?:EPIC|Voter\s*ID)\s*[:-]?\s*([A-Z]{3}\d{7}|[A-Z0-9/-]{8,14})/i)?.[1];
  const bareEpic=blockLines.flatMap(line=>line.match(/\b[A-Z]{3}\d{7}\b/gi)||[])[0];
  const serial=prefix.match(/(?:^|\D)(\d{1,4})(?:\D|$)/)?.[1]||null;
  const block=blockLines.join('\n');
  const incomplete=!name||!serial||!house||age===null||!gender;
  const originalLanguage=context?.language??detectLanguage(block).language;
  const fieldConfidence={...(context?.fieldConfidences?.[position]??{})};if(suspiciousHouse)fieldConfidence.house_number=Math.min(fieldConfidence.house_number??40,40);if(invalidAge)fieldConfidence.age=0;
  return{part_number:part,serial_number:serial,original_name:name,normalized_name:normalize(name),transliterated_name:romanize(name),relation_type:type,original_relation_name:relationName,normalized_relation_name:normalize(relationName),transliterated_relation_name:romanize(relationName),original_house_number:house,normalized_house_number:normalizeHouse(house),age,gender,epic_number:(explicitEpic||bareEpic||null)?.toUpperCase()||null,pdf_page_number:page,printed_page_number:printed,original_text:block,original_language:originalLanguage,ocr_confidence:confidence,field_confidence:fieldConfidence,name_confidence:fieldConfidence.name??null,relation_confidence:fieldConfidence.relation_name??null,house_confidence:fieldConfidence.house_number??null,age_confidence:fieldConfidence.age??null,epic_confidence:fieldConfidence.epic??null,bounding_box:context?.boundingBoxes?.[position]??null,verification_status:incomplete||(confidence!==null&&confidence<OCR_REVIEW_THRESHOLD)?'requires_review':'unverified',possible_duplicate:false,duplicate_of:null}as Omit<Voter,'id'|'pdf_id'>
 }).filter(x=>x.original_name)
}
