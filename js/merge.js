// 움직이지 않는 부품 합치기: 같은 부모(뼈대) 아래, 같은 재질인 메시들을 하나로 합쳐 그리기 호출 수를 줄임
import * as THREE from 'three';

// keep: 애니메이션에서 따로 움직이는 부품 (합치지 않음)
export function mergeStatic(root, keepObj) {
  const keep = new Set();
  const addKeep = v => { if (!v) return; if (Array.isArray(v)) v.forEach(addKeep); else if (v.isObject3D) keep.add(v); };
  if (keepObj) for (const v of Object.values(keepObj)) addKeep(v);
  const parents = []; root.traverse(o => { if (o.children.length) parents.push(o); });
  for (const par of parents) {
    const groups = new Map();
    for (const c of par.children) {
      if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || c.children.length || keep.has(c) || !c.visible || Array.isArray(c.material)) continue;
      const g = c.geometry; if (!g.attributes.position || !g.attributes.normal) continue;
      const useUv = !!c.material.map, key = c.material.uuid + (useUv ? ':uv' : '') + ':' + c.renderOrder;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const useUv = !!list[0].material.map; let n = 0;
      const parts = list.map(m => { m.updateMatrix(); let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); n += g.attributes.position.count; return g; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = useUv ? new Float32Array(n * 2) : null; let o = 0;
      for (const g of parts) {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3); nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
        if (uv) { if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2); }
        o += c; g.dispose();
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, list[0].material); mesh.renderOrder = list[0].renderOrder; mesh.frustumCulled = list.every(m => m.frustumCulled);
      for (const m of list) par.remove(m); par.add(mesh);
    }
  }
  return root;
}
