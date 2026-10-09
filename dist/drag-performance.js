import * as T from 'three';
import {colliderOf as originalCollider} from './geometry.js';

// Identical OBBs, cached only while both world transform and local dimensions agree.
const cache=new WeakMap();
export function cachedCollider(mesh){
 mesh.updateWorldMatrix(true,false);const e=mesh.matrixWorld.elements,s=mesh.userData.solid,c=mesh.userData.solidCenter;let item=cache.get(mesh);
 if(item&&e.every((v,i)=>v===item.matrix[i])&&s.equals(item.size)&&(!c&&!item.center||c&&item.center&&c.equals(item.center)))return item.obb;
 const obb=originalCollider(mesh);cache.set(mesh,{matrix:e.slice(),size:s.clone(),center:c?.clone(),obb});return obb;
}
export function bounds(obb){const e=obb.rotation.elements,h=obb.halfSize,x=Math.abs(e[0])*h.x+Math.abs(e[3])*h.y+Math.abs(e[6])*h.z,y=Math.abs(e[1])*h.x+Math.abs(e[4])*h.y+Math.abs(e[7])*h.z,z=Math.abs(e[2])*h.x+Math.abs(e[5])*h.y+Math.abs(e[8])*h.z;return new T.Box3(obb.center.clone().sub(new T.Vector3(x,y,z)),obb.center.clone().add(new T.Vector3(x,y,z))).expandByScalar(.0001);}
export function colliderGrid(entries){
 const cells=new Map(),size=2;
 function visit(box,fn){for(let x=Math.floor(box.min.x/size);x<=Math.floor(box.max.x/size);x++)for(let y=Math.floor(box.min.y/size);y<=Math.floor(box.max.y/size);y++)for(let z=Math.floor(box.min.z/size);z<=Math.floor(box.max.z/size);z++)fn(x+','+y+','+z);}
 for(const entry of entries){entry.box=bounds(entry.obb);visit(entry.box,key=>{if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry);});}
 return {query(box){const result=new Set();visit(box,key=>{for(const entry of cells.get(key)||[])if(entry.box.intersectsBox(box))result.add(entry);});return result;}};
}
// Update the original TubeGeometry buffers with the exact same sampling and Frenet
// frames as Three.js TubeGeometry; segment counts, radius, material and UVs stay intact.
export function updateTube(mesh,curve,linear=false){
 const radius=mesh.userData.cableRadius,segments=linear?Math.max(60,Math.ceil(curve.getLength()/.04)):60;
 const geometry=mesh.geometry;
 if(geometry.parameters.tubularSegments!==segments){mesh.geometry=new T.TubeGeometry(curve,segments,radius,8,false);geometry.dispose();}
 else{
  const frames=curve.computeFrenetFrames(segments,false),p=new T.Vector3(),n=new T.Vector3(),v=new T.Vector3(),pos=geometry.attributes.position,norm=geometry.attributes.normal;
  for(let i=0;i<=segments;i++){curve.getPointAt(i/segments,p);const N=frames.normals[i],B=frames.binormals[i];for(let j=0;j<=8;j++){const angle=j/8*Math.PI*2,sin=Math.sin(angle),cos=-Math.cos(angle);n.set(cos*N.x+sin*B.x,cos*N.y+sin*B.y,cos*N.z+sin*B.z).normalize();v.copy(p).addScaledVector(n,radius);const index=i*9+j;pos.setXYZ(index,v.x,v.y,v.z);norm.setXYZ(index,n.x,n.y,n.z);}}
  pos.needsUpdate=true;norm.needsUpdate=true;geometry.parameters.path=curve;geometry.tangents=frames.tangents;geometry.normals=frames.normals;geometry.binormals=frames.binormals;geometry.boundingBox=null;geometry.boundingSphere=null;
 }
 mesh.userData.cableCurve=curve;
}
export function pathKey(points){return points.map(p=>p.toArray().join(',')).join(';');}
export function curveFor(points,linear=false){if(!linear)return new T.CatmullRomCurve3(points);const curve=new T.CurvePath();for(let i=1;i<points.length;i++)curve.add(new T.LineCurve3(points[i-1],points[i]));return curve;}
