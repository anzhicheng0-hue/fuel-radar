import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuery,distanceKm,normalizePlaces,placesQuery,lookupPlaces,brandGroup} from '../lib/places.mjs';
import {validateMapConfig} from '../lib/map-config.mjs';
import {parseFuelDataset,INTERVAL} from '../lib/prices.mjs';

test('all six radii are accepted and invalid coordinates are rejected',()=>{
  for(const radius of [1,3,5,10,20,50])assert.equal(parseQuery(new URLSearchParams({lat:'60',lon:'25',radius})).radius,radius);
  for(const q of ['lat=&lon=25&radius=3','lat=91&lon=25&radius=3','lat=60&lon=181&radius=3','lat=60&lon=25&radius=2'])assert.throws(()=>parseQuery(new URLSearchParams(q)));
});

test('OSM normalization keeps fuel stations, identifies Finland, and filters radius',()=>{
  const center={lat:60,lon:25},raw={elements:[
    {type:'node',id:1,lat:60,lon:25.001,tags:{amenity:'fuel',name:'Neste Test','addr:city':'Helsinki'}},
    {type:'way',id:2,center:{lat:60,lon:25.002},tags:{amenity:'fuel',name:'ABC Test'}},
    {type:'node',id:3,lat:61,lon:25,tags:{amenity:'fuel',name:'Far'}},
    {type:'node',id:4,lat:60,lon:25,tags:{shop:'supermarket',name:'Not fuel'}},
    {type:'node',id:1},{type:'way',id:2}
  ]};
  const result=normalizePlaces(raw,center,1);
  assert.equal(result.length,2);assert.ok(result.every(s=>s.country==='FI'));assert.equal(result[0].brandGroup,'neste');assert.equal(result[1].brandGroup,'abc');
  assert.match(placesQuery({...center,radius:3}),/\["amenity"="fuel"\]/);assert.match(placesQuery({...center,radius:3}),/around:3000/);
  assert.equal(Math.round(distanceKm({lat:0,lon:0},{lat:0,lon:1})),111);
});

test('known Finnish station brands are grouped',()=>{
  assert.equal(brandGroup({name:'Neste Express'}),'neste');assert.equal(brandGroup({brand:'St1'}),'st1');assert.equal(brandGroup({operator:'Shell Finland'}),'st1');assert.equal(brandGroup({name:'ABC Prisma'}),'abc');assert.equal(brandGroup({name:'Independent'}),'other');
});

test('map credentials reject injected or oversized values',()=>{
  assert.deepEqual(validateMapConfig({apiKey:'',mapId:''}),{apiKey:'',mapId:'',storeSource:'osm'});
  for(const value of [{apiKey:'key&callback=evil'},{apiKey:'a'.repeat(151)},{mapId:'<script>'},{unexpected:true},{storeSource:'google',apiKey:''}])assert.throws(()=>validateMapConfig(value));
});

test('Overpass backup is used and smaller radius reuses a recent covering result',async()=>{
  const original=globalThis.fetch,calls=[];
  try{
    globalThis.fetch=async(endpoint,options)=>{calls.push(endpoint);assert.match(options.headers['User-Agent'],/LocalFuelRadar/);if(endpoint.includes('overpass-api.de'))throw new Error('timeout');return new Response(JSON.stringify({elements:[{type:'node',id:9001,lat:60,lon:25,tags:{amenity:'fuel',name:'Neste test'}},{type:'node',id:9001}],osm3s:{timestamp_osm_base:'2026-10-07T00:00:00Z'}}),{status:200});};
    const result=await lookupPlaces({lat:60,lon:25,radius:3});assert.equal(calls.length,2);assert.match(result.sourceEndpoint,/private\.coffee/);assert.equal(result.stores[0].country,'FI');
    const smaller=await lookupPlaces({lat:60,lon:25,radius:1});assert.equal(calls.length,2);assert.equal(smaller.cached,true);
  }finally{globalThis.fetch=original;}
});

test('official JSON-stat2 data becomes six Finland national averages',()=>{
  const dataset={version:'2.0',updated:'2026-09-30T05:00:00Z',value:[2.02,2.43,2.25,2.35,2.09,2.09],dimension:{timeperiod_m:{category:{index:{'2026M09':0}}},coicop_13_20160512:{category:{index:{'0400500':0,'0700100':1,'0700200':2,'0700300':3,'0700800':4,'0701000':5},label:{'0400500':'Light fuel oil, 1 l','0700100':'Diesel, 1 l','0700200':'Petrol 95 E 10, 1 l','0700300':'Petrol 98 E 5','0700800':'Compressed biogas, 1 kg','0701000':'Liquefied biogas, 1 kg'}}}}};
  dataset.id=['timeperiod_m','coicop_13_20160512','contentscode'];dataset.size=[1,6,1];dataset.dimension.contentscode={category:{index:{'khi-keskihinta':0}}};
  const parsed=parseFuelDataset(dataset,'2026-10-08T00:00:00Z');assert.equal(parsed.month,'2026M09');assert.equal(parsed.products.length,6);assert.equal(parsed.products.find(p=>p.fuel==='petrol95').price,2.25);assert.ok(parsed.products.every(p=>p.nationalAverageCountry==='FI'&&p.currency==='EUR'));
  assert.throws(()=>parseFuelDataset({...dataset,size:[2,6,1]}));
  const missing=structuredClone(dataset);missing.value[2]=null;assert.ok(!parseFuelDataset(missing).products.some(p=>p.fuel==='petrol95'));
  assert.equal(INTERVAL,43200000);assert.throws(()=>parseFuelDataset({}));
});
