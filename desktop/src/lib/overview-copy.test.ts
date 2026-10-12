import { expect, it } from 'vitest';
import { design } from '../backend/mock/data';
import { createMockBackend } from '../backend/mock';
import type { LibraryScope } from '../backend/types';
import { overviewCopy } from './overview-copy';

// `activation` is app copy with no fixture counterpart: the Activation tile replaced the board's
// Team installs tile, and design.json is generated (AGENTS.md invariant 3) so it cannot carry the string.
it('keeps app zero copy identical to the locked fixture',()=>{const {activation,...locked}=overviewCopy;expect(locked).toEqual(design.LIBRARY_OVERVIEW.zero);expect(activation).toBeTruthy();});

// L8 hides the evaluation meter only when `meter.total === 0`; every locked Library board must keep its meter.
it.each([
 ['Global',{kind:'global'} as LibraryScope,15],
 ['Terum',{kind:'checkout',root:'/Users/you/code/terum'} as LibraryScope,8],
 ['SSM',{kind:'checkout',root:'/Users/you/code/ssm'} as LibraryScope,3],
 ['MRF',{kind:'checkout',root:'/Users/you/code/mrf'} as LibraryScope,2],
])('keeps the locked %s meter populated',async(_label,scope,total)=>{
 const result=await createMockBackend().library({scope});
 expect(result.ok).toBe(true);
 if(!result.ok)throw new Error(result.error);
 expect(result.value.overview.meter.total).toBe(total);
});
