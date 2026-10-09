# v16 — drag performance, based on published v12

Scope: runtime efficiency only. Hardware model builders and geometry.js are byte-identical to v12. Electrical behavior, lesson content, styles and cable routing are unchanged. No flexible-rope code or v14 collision removals are included.

Changes:
- Cache unchanged local cable shapes; update the moved harness only.
- Keep TubeGeometry vertex/normal buffers and materials. Use identical TubeGeometry sampling, dimensions, radial/longitudinal segments and topology. Reallocate only if v12's adaptive probe-lead segment count actually changes.
- Reuse cable collision proxies, updating their transforms/dimensions. All original cable and rigid volumes remain present.
- During fine movement substeps, update harness collision proxies only. Update visible mesh buffers after the accepted position is known.
- Cache world-space OBBs using exact world-matrix and local-dimension checks.
- Build a static broadphase grid once per move; exact OBB tests and v12 mating/contact exemptions remain authoritative.
- Use one movement step only when the swept AABB of every moving solid is clear of obstacles, camera and table. Otherwise preserve v12's 0.025-unit increments. Deforming harnesses retain those fine increments.

Validation:
- Original circuit, learning and interaction suites pass, including real handler tests of probe crossing attempts at the meter, middle 4-pin connector, circular connector, and harness cable; fast connector dragging into the EM remains blocked.
- New tests verify geometry/material/buffer reuse, unchanged-harness cache, body translation via its port selection stopping at another body, continued pressure, and numerical equivalence to original TubeGeometry vertices, normals, UVs and indices.
- Same 40-small-connector-move CPU workload: v12 about 1434 ms; optimized about 150 ms. Probe workload remains about 148 ms vs 155 ms. Timings use actual Three.js with a mocked renderer; they are not browser FPS measurements.

Known pre-existing v12 issue, kept separate from performance scope:
The collision filter compares ancestorData(mesh, 'bypassPort') with sel.port. When selecting a body directly, sel.port is null and this excludes unrelated solids with no bypassPort. Selecting the component's port does not trigger that exclusion. This behavior was already present in v12 and has not been corrected in this performance-only revision.

User will evaluate browser FPS and visual behavior.
