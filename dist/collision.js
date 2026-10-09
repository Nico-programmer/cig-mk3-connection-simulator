// Segment-vs-box test used by probePose() to pick a clear approach direction for a probe.
// (1.19: the old polyline lead router that lived here was removed; leads are ropes since 1.16.)
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
