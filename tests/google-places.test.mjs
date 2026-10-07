import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGooglePlaces} from '../public/google-places.mjs';

test('Google fuel stations preserve country, brand group, and radius',()=>{
  const place=(id,name,lat,lon,country)=>({id,displayName:name,location:{lat:()=>lat,lng:()=>lon},addressComponents:[{types:['country'],shortText:country}]});
  const results=normalizeGooglePlaces([place('fi','Neste Helsinki',60,25,'FI'),place('se','St1 Other',60,25.001,'SE'),place('far','ABC',61,25,'FI'),{id:'missing'}],{lat:60,lon:25},1);
  assert.equal(results.length,2);assert.equal(results[0].brandGroup,'neste');assert.equal(results[0].country,'FI');assert.equal(results[1].brandGroup,'st1');assert.equal(results[1].country,'SE');
});
