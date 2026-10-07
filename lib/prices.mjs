import {readFile,writeFile,rename,mkdir,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const INTERVAL=12*60*60*1000;
export const SOURCE_URL='https://statfin.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__khi/11xx.px/';
export const API_URL='https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/khi/11xx.px';
const base=resolve(import.meta.dirname,'..'),file=resolve(base,'data/prices.json');
const fuelTypes={
  '0400500':{fuel:'heatingOil',suffix:'/ l'},
  '0700100':{fuel:'diesel',suffix:'/ l'},
  '0700200':{fuel:'petrol95',suffix:'/ l'},
  '0700300':{fuel:'petrol98',suffix:'/ l'},
  '0700800':{fuel:'compressedBiogas',suffix:'/ kg'},
  '0701000':{fuel:'liquefiedBiogas',suffix:'/ kg'}
};

export function parseFuelDataset(dataset,checkedAt=new Date().toISOString()){
  if(!dataset||dataset.version!=='2.0'||!Array.isArray(dataset.value))throw new Error('Statistics Finland returned an invalid dataset.');
  const timeIndex=dataset.dimension?.timeperiod_m?.category?.index||{};
  const month=Object.keys(timeIndex).sort().at(-1);
  const commodity=dataset.dimension?.coicop_13_20160512?.category;
  if(!/^\d{4}M\d{2}$/.test(month||'')||Object.keys(timeIndex).length!==1||!commodity?.index||!commodity?.label)throw new Error('Fuel price dimensions are missing.');
  const codes=Object.entries(commodity.index).sort((a,b)=>a[1]-b[1]).map(([code])=>code);
  const ids=dataset.id,sizes=dataset.size;
  if(!Array.isArray(ids)||!Array.isArray(sizes)||ids.length!==3||sizes.length!==3||new Set(ids).size!==3||!['timeperiod_m','coicop_13_20160512','contentscode'].every(id=>ids.includes(id))||sizes.some((size,i)=>size!==(ids[i]==='coicop_13_20160512'?codes.length:1))||dataset.value.length!==codes.length||dataset.dimension.contentscode?.category?.index?.['khi-keskihinta']!==0)throw new Error('Fuel price dimensions changed; data cannot be matched safely.');
  if(Object.values(commodity.index).some(i=>!Number.isInteger(i)||i<0||i>=codes.length)||new Set(Object.values(commodity.index)).size!==codes.length)throw new Error('Fuel commodity positions are invalid.');
  const products=codes.flatMap((code,index)=>{
    const price=Number(dataset.value[index]),kind=fuelTypes[code];
    if(!kind||!Number.isFinite(price)||price<=0)return [];
    return [{id:`statistics-finland:${month}:${code}`,sourceId:'statistics-finland',nationalAverageCountry:'FI',fuel:kind.fuel,month,name:commodity.label[code],price,currency:'EUR',priceSuffix:` ${kind.suffix}`,unitLabel:`Finland national monthly average · ${month}`,sourceUrl:SOURCE_URL,scopeLabel:'Statistics Finland national monthly average; not a station pump price.',condition:`Official dataset updated ${dataset.updated||'time not supplied'}. Consumer prices include VAT; biogas values are company prices including VAT and are based on one company.`,fetchedAt:checkedAt,sourceUpdatedAt:dataset.updated||null,offerState:'published',stale:false}];
  });
  if(!products.length)throw new Error('Statistics Finland returned no usable fuel prices.');
  return {month,products};
}

async function fetchLatest(checkedAt){
  const metadataResponse=await fetch(API_URL,{headers:{Accept:'application/json','User-Agent':'LocalFuelRadar/1.0 (+http://localhost:5190; personal fuel-price map)'},signal:AbortSignal.timeout(20000)});
  if(!metadataResponse.ok)throw new Error(`Statistics Finland metadata returned HTTP ${metadataResponse.status}.`);
  const metadata=await metadataResponse.json();
  const time=metadata.variables?.find(v=>v.code==='timeperiod_m')?.values?.at(-1);
  if(!time)throw new Error('Statistics Finland did not publish a latest month.');
  const body={query:[{code:'timeperiod_m',selection:{filter:'item',values:[time]}},{code:'coicop_13_20160512',selection:{filter:'all',values:['*']}},{code:'contentscode',selection:{filter:'all',values:['*']}}],response:{format:'json-stat2'}};
  const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','User-Agent':'LocalFuelRadar/1.0 (+http://localhost:5190; personal fuel-price map)'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Statistics Finland prices returned HTTP ${response.status}.`);
  return parseFuelDataset(await response.json(),checkedAt);
}

export class PriceService{
  constructor(){this.state={products:[],sources:[],nextRunAt:null,message:'Official national fuel averages have not been checked yet.'};this.running=null;this.timer=null;}
  async init(){await mkdir(resolve(base,'data'),{recursive:true});try{this.state=JSON.parse(await readFile(file,'utf8'));}catch{}this.schedule();}
  schedule(){clearTimeout(this.timer);const due=Date.parse(this.state.nextRunAt||'')||Date.now();this.timer=setTimeout(()=>this.refresh().catch(()=>{}),Math.min(Math.max(0,due-Date.now()),INTERVAL));this.timer.unref();}
  async refresh(){if(this.running)return this.running;this.running=this.update().finally(()=>{this.running=null;this.schedule();});return this.running;}
  async update(){
    const now=new Date().toISOString(),nextRunAt=new Date(Date.now()+INTERVAL).toISOString();
    let products=this.state.products||[],lastSuccessAt=this.state.lastSuccessAt||null,status='Latest official check failed',errors=[];
    try{const latest=await fetchLatest(now);products=latest.products;lastSuccessAt=now;status=`Loaded ${products.length} national averages for ${latest.month}`;}catch(error){errors=[error.message];}
    const source={id:'statistics-finland',name:'Statistics Finland · average prices of liquid fuels',url:SOURCE_URL,status,errors,lastAttemptAt:now,lastSuccessAt};
    this.state={products,sources:[source],regionLabel:'Finland · national monthly averages',lastAttemptAt:now,lastSuccessAt,nextRunAt,message:'Prices are official national monthly averages. They are not live or station-specific pump prices.'};
    const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(this.state,null,2));await rename(tmp,file);await appendFile(resolve(base,'data/updates.log'),JSON.stringify({at:now,status,errors})+'\n');return this.state;
  }
}
