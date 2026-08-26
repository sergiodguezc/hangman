#!/usr/bin/env python3
import collections, json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from vocab_pipeline import (OpenAICefrClassificationProvider, validate_cefr_classification,
    serialize_cefr_classification, validate)

ROOT=Path(__file__).parents[1]; D=ROOT/'data'; E=D/'experiments'
QUEUE=E/'vocabulary-repair-final-cefr-recheck-queue.json'; OUT=E/'vocabulary-repair-final-cefr-recheck-output.json'
BASE=E/'vocabulary-repair-final-candidate.json'; V1=E/'vocabulary-repair-v1-candidate.json'; REPORT=E/'vocabulary-repair-final-cefr-recheck-review.md'
ORDER={x:i for i,x in enumerate(('A1','A2','B1','B2','C1','C2'))}

def load(p): return json.loads(p.read_text(encoding='utf-8'))
def main():
 q=load(QUEUE); entries=q['entries']; ids=[x['id'] for x in entries]
 if len(entries)!=40 or q['metadata'].get('runnable')!=40 or q['metadata'].get('deferred')!=[]: raise SystemExit('Final queue metadata/size invalid')
 old=load(OUT) if OUT.exists() else {}; results={x['id']:x for x in old.get('results',[]) if not validate_cefr_classification(x) and x.get('id') in ids}
 provider=OpenAICefrClassificationProvider()
 for n,item in enumerate(entries,1):
  if item['id'] in results: print(f'Reused {item["id"]} ({n}/40)'); continue
  result=serialize_cefr_classification(provider.classify(item)); errors=validate_cefr_classification(result,item['id'])
  if errors: raise SystemExit(f'Invalid result {item["id"]}: {errors}')
  results[item['id']]=result
  OUT.write_text(json.dumps({'metadata':{'source':str(QUEUE),'entries':40,'promptVersion':'cefr-sample-60-v1','model':provider.model},'results':[results[x] for x in ids if x in results]},ensure_ascii=False,indent=2)+'\n')
  print(f'Classified {item["id"]} ({n}/40)',flush=True)
 if set(results)!=set(ids) or len(results)!=40: raise SystemExit('Coverage failure')
 OUT.write_text(json.dumps({'metadata':{'source':str(QUEUE),'entries':40,'promptVersion':'cefr-sample-60-v1','model':provider.model},'results':[results[x] for x in ids]},ensure_ascii=False,indent=2)+'\n')
 base=load(BASE)['entries']; bmap={x['id']:x for x in base}; prev=load(E/'cefr-full-544-output.json')['results']; pmap={x['id']:x for x in prev}
 changes=[]; unchanged=[]
 for i in ids:
  a=pmap.get(i,{}).get('cefr'); b=results[i]['cefr']; (unchanged if a==b else changes).append((i,a,b,results[i]['reason']))
 v1=[dict(x) for x in base]
 for x in v1:
  if x['id'] in results: x['difficulty']=results[x['id']]['cefr']
 # Existing game difficulty is deliberately not CEFR; store proposed CEFR only in linguistic metadata.
 # A dedicated field keeps this artifact's vocabulary schema compatible while making the proposal explicit.
 for x in v1:
  if x['id'] in results:
   x['linguistics']=dict(x.get('linguistics') or {}); x['linguistics']['cefr']=results[x['id']]['cefr']
 # remove accidental difficulty mutation; only CEFR metadata is applied
 for x in v1:
  if x['id'] in results: x['difficulty']=bmap[x['id']]['difficulty']
 validate(v1)
 V1.write_text(json.dumps({'metadata':{'source':str(BASE),'cefrOutput':str(OUT),'entries':544},'entries':v1},ensure_ascii=False,indent=2)+'\n')
 transitions=collections.Counter(f'{a} -> {b}' for _,a,b,_ in changes)
 lines=['# Final CEFR recheck review','','## Summary','', '- 40 entries checked',f'- Unchanged: {len(unchanged)}',f'- Changed: {len(changes)}',f'- Transitions: {", ".join(f"{k} ({v})" for k,v in sorted(transitions.items())) or "none"}','- Validation: passed (40/40, no missing, extra, or duplicate IDs; all CEFR values valid)','', '## Changed classifications','', '| Lexical item | Previous | Proposed | Reason |','|---|---|---|---|']
 for i,a,b,r in changes: lines.append(f'| `{bmap[i]["answerCa"]}` | {a} | {b} | {r} |')
 lines += ['', '## Unchanged classifications','', '| Lexical item | CEFR |','|---|---|']+[f'| `{bmap[i]["answerCa"]}` | {a} |' for i,a,_,_ in unchanged]
 surprising=[(i,a,b,r) for i,a,b,r in changes if abs(ORDER[a]-ORDER[b])>=2 or 'uncertain' in r.lower()]
 lines += ['', '## Potentially surprising changes','', 'None flagged.' if not surprising else '| Lexical item | Change | Reason |\n|---|---|---|']
 for i,a,b,r in surprising: lines.append(f'| `{bmap[i]["answerCa"]}` | {a} -> {b} | {r} |')
 REPORT.write_text('\n'.join(lines)+'\n',encoding='utf-8')
 print(f'Complete: {len(changes)} changed, {len(unchanged)} unchanged; wrote {V1} and {REPORT}')
if __name__=='__main__': main()
