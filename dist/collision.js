import * as T from 'three';

// Sweep a thick line against the actual oriented solid, not its screen bounds.
export function segmentHitsSolid(a,b,obb,radius=0){
 const inverse=obb.rotation.clone().transpose(),p=a.clone().sub(obb.center).applyMatrix3(inverse),d=b.clone().sub(a).applyMatrix3(inverse),h=obb.halfSize;
 let lo=0,hi=1;
 for(const axis of ['x','y','z']){
  const size=h[axis]+radius;
  if(Math.abs(d[axis])<1e-9){if(Math.abs(p[axis])>size)return false;continue;}
  let t0=(-size-p[axis])/d[axis],t1=(size-p[axis])/d[axis];if(t0>t1)[t0,t1]=[t1,t0];
  lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;
 }
 return true;
}

// Flexible leads take the shortest clear polyline around blocking solids.
// Straight segments prevent a smoothing spline from cutting through a corner.
export function routeLead(start,end,obstacles,radius){
 if(obstacles.some(o=>segmentHitsSolid(start,start,o,radius)||segmentHitsSolid(end,end,o,radius)))return null;
 const clear=(a,b)=>!obstacles.some(o=>segmentHitsSolid(a,b,o,radius));
 if(clear(start,end))return[start,end];
 const nodes=[start,end],added=new Set();
 for(let pass=0;pass<6;pass++){
  const blockers=obstacles.filter(o=>!added.has(o)&&(segmentHitsSolid(start,end,o,radius)||nodes.slice(2).some(p=>segmentHitsSolid(start,p,o,radius)||segmentHitsSolid(p,end,o,radius))));
  for(const o of blockers){
   added.add(o);const e=o.rotation.elements,h=o.halfSize;
   const extent=new T.Vector3(Math.abs(e[0])*h.x+Math.abs(e[3])*h.y+Math.abs(e[6])*h.z,Math.abs(e[1])*h.x+Math.abs(e[4])*h.y+Math.abs(e[7])*h.z,Math.abs(e[2])*h.x+Math.abs(e[5])*h.y+Math.abs(e[8])*h.z).addScalar(radius+.045);
   for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const point=o.center.clone().add(new T.Vector3(x*extent.x,y*extent.y,z*extent.z));if(point.y>=.045&&!obstacles.some(box=>segmentHitsSolid(point,point,box,radius)))nodes.push(point);}
  }
  const distances=nodes.map(()=>Infinity),previous=[],visited=new Set();distances[0]=0;
  while(true){let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at===-1||distances[i]<distances[at]))at=i;if(at===-1||!Number.isFinite(distances[at]))break;if(at===1){const path=[];for(let i=1;i!==undefined;i=previous[i])path.unshift(nodes[i]);return path;}
   visited.add(at);for(let i=0;i<nodes.length;i++){if(visited.has(i))continue;const next=distances[at]+nodes[at].distanceTo(nodes[i]);if(next<distances[i]&&clear(nodes[at],nodes[i])){distances[i]=next;previous[i]=at;}}
  }
  if(!blockers.length)break;
 }
 return null;
}
