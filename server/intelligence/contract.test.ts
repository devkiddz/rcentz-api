import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBatch } from './contract';
const valid={schemaVersion:1,eventId:'24b8104a-4845-4593-8243-afcbd82531a3',occurredAt:new Date().toISOString(),kind:'feature',name:'search.performed',environment:'production',featureKey:'catalog.search',measurements:{duration_ms:200},dimensions:{result:'success'}};
test('accepts valid project-neutral event',()=>assert.equal(decodeBatch({events:[valid]}).length,1));
test('rejects unsafe dimensions',()=>assert.throws(()=>decodeBatch({events:[{...valid,dimensions:{email:'x@y.com'}}]})));
test('rejects unknown fields and non-idempotent identifiers',()=>{
 assert.throws(()=>decodeBatch({events:[{...valid,projectId:'other'}]}));
 assert.throws(()=>decodeBatch({events:[{...valid,eventId:'not-a-uuid'}]}));
});
test('rejects over-large batch',()=>assert.throws(()=>decodeBatch({events:Array(21).fill(valid)})));
