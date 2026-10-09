// Collider cache shared by colliders, view, probes and rope (1.19: the old tube/curve
// helpers for the pre-1.16 cables were removed; only the cache and bounds remain).
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
