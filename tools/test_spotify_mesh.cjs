// Transport invariants that protect transparent ordering and bounded storage.
const assert=require('node:assert/strict'),Mesh=require('../output/spotify-gpu-20261014/prototype-web/stage_mesh.js');
const mesh=new Mesh(120000),points=[[0,0,1],[10,0,2],[10,10,3],[0,0,1]];
const colors=points.map(()=>[.4,.5,.6]),widths=points.map(()=>.5),alphas=points.map(()=>.8);
mesh.stroke(points,colors,widths,alphas,'closed');
assert.equal(mesh.count,8);assert.equal(mesh.indexCount,18);
assert.deepEqual(Array.from(mesh.indices.slice(0,6)),[0,1,2,2,1,3]);
// The duplicate endpoints use identical neighboring centerline vertices.
assert.deepEqual(Array.from(mesh.vertices.slice(10,14)),[10,10,10,0]);
assert.deepEqual(Array.from(mesh.vertices.slice(6*Mesh.STRIDE+10,6*Mesh.STRIDE+14)),[10,10,10,0]);
mesh.face([[0,0,40],[1,0,40],[0,1,40]],[1,0,0],.5);
mesh.orderMesh();assert.equal(mesh.drawOrder[0].kind,0);
assert.deepEqual(Array.from(mesh.ordered.slice(0,3)),[8,9,10]);
const retained=mesh.commandPool.slice(),indices=mesh.indices,vertices=mesh.vertices;
mesh.resetMesh();mesh.stroke(points,colors,widths,alphas,'closed');
mesh.face([[0,0,40],[1,0,40],[0,1,40]],[1,0,0],.5);mesh.orderMesh();
assert(mesh.commandPool.every((q,i)=>q===retained[i]));assert.equal(mesh.indices,indices);assert.equal(mesh.vertices,vertices);
const bounded=new Mesh(6);bounded.line([0,0,0],[1,1,0],[1,1,1],1,.5);
assert.throws(()=>bounded.line([0,0,0],[1,1,0],[1,1,1],1,.5),/capacity/);
mesh.releaseMesh();assert.equal(mesh.vertices,null);assert.equal(mesh.indices,null);assert.equal(mesh.ordered,null);
assert.equal(mesh.commands.length,0);assert.equal(mesh.commandPool.length,0);
console.log('GPU contour transport: closed seams, index order, reuse, capacity and release passed');
