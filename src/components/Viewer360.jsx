/**
 * Wrapper React imperativo do Photo Sphere Viewer + MarkersPlugin.
 * - Sincroniza markers por diff (id + assinatura), sem recriar tudo a cada render
 * - Troca de panorama com transição e re-sincronização dos markers
 * - Arraste de "handles" (pinos da quadra / vértices) sem girar a câmera
 * - Suporte nativo a pinça (zoom) e arraste em tablets
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

const sigCache = new WeakMap();
const signature = (m) => {
  let s = sigCache.get(m);
  if (!s) {
    s = JSON.stringify(m);
    sigCache.set(m, s);
  }
  return s;
};
const markerKind = (m) => (m.polygon ? 'polygon' : m.polyline ? 'polyline' : 'html');

const Viewer360 = forwardRef(function Viewer360(
  {
    panoramaUrl,
    sceneKey,
    initialView,
    markers = [],
    onSphereClick,
    onSphereDblClick,
    onPointerMove,
    onHandleDragStart,
    onHandleDrag,
    onHandleDragEnd,
    onViewChange,
    onReady,
    className = '',
  },
  ref,
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const pluginRef = useRef(null);
  const currentRef = useRef(new Map()); // id → { sig, kind }
  const loadingRef = useRef(true);
  const markersRef = useRef(markers);
  const loadedKeyRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onSphereClick, onSphereDblClick, onPointerMove, onHandleDragStart, onHandleDrag, onHandleDragEnd, onViewChange, onReady };
  markersRef.current = markers;

  const sync = () => {
    const plugin = pluginRef.current;
    if (!plugin || loadingRef.current) return;
    const current = currentRef.current;
    const next = new Map();
    for (const m of markersRef.current) {
      const sig = signature(m);
      const kind = markerKind(m);
      const prev = current.get(m.id);
      try {
        if (!prev) plugin.addMarker(m, false);
        else if (prev.kind !== kind) {
          plugin.removeMarker(m.id, false);
          plugin.addMarker(m, false);
        } else if (prev.sig !== sig) plugin.updateMarker(m, false);
      } catch (err) {
        console.warn('[Viewer360] marker inválido', m.id, err);
        continue;
      }
      next.set(m.id, { sig, kind });
    }
    const stale = [...current.keys()].filter((id) => !next.has(id));
    if (stale.length) {
      try {
        plugin.removeMarkers(stale, false);
      } catch {
        /* já removidos */
      }
    }
    currentRef.current = next;
    plugin.renderMarkers();
  };

  useImperativeHandle(ref, () => ({
    get viewer() {
      return viewerRef.current;
    },
    getPosition: () => {
      const v = viewerRef.current;
      if (!v) return null;
      return { ...v.getPosition(), zoom: v.getZoomLevel() };
    },
    animateTo: (pos, zoom) => viewerRef.current?.animate({ yaw: pos.yaw, pitch: pos.pitch, zoom, speed: '8rpm' }),
    zoomIn: () => viewerRef.current?.zoomIn(10),
    zoomOut: () => viewerRef.current?.zoomOut(10),
    toggleFullscreen: () => viewerRef.current?.toggleFullscreen(),
  }));

  /* ----------------------------------------------------------- montagem */
  useEffect(() => {
    const container = containerRef.current;
    const viewer = new Viewer({
      container,
      panorama: panoramaUrl || undefined,
      navbar: false,
      loadingTxt: '',
      defaultYaw: initialView?.yaw ?? 0,
      defaultPitch: initialView?.pitch ?? -0.4,
      defaultZoomLvl: initialView?.zoom ?? 40,
      minFov: 10,
      maxFov: 100,
      touchmoveTwoFingers: false,
      mousewheelCtrlKey: false,
      moveInertia: 0.85,
      plugins: [[MarkersPlugin, { clickEventOnMarker: true }]],
    });
    viewerRef.current = viewer;
    const plugin = viewer.getPlugin(MarkersPlugin);
    pluginRef.current = plugin;
    loadedKeyRef.current = sceneKey;

    viewer.addEventListener('ready', () => {
      loadingRef.current = false;
      sync();
      cbRef.current.onReady?.(viewer);
    }, { once: true });

    viewer.addEventListener('click', ({ data }) => {
      if (data.rightclick) return;
      cbRef.current.onSphereClick?.({ yaw: data.yaw, pitch: data.pitch }, data.marker || null, data.originalEvent || {});
    });
    viewer.addEventListener('dblclick', ({ data }) => {
      cbRef.current.onSphereDblClick?.({ yaw: data.yaw, pitch: data.pitch }, data.marker || null);
    });

    let raf = 0;
    viewer.addEventListener('position-updated', ({ position }) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => cbRef.current.onViewChange?.({ ...position, zoom: viewer.getZoomLevel() }));
    });

    const toSpherical = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      try {
        return viewer.dataHelper.viewerCoordsToSphericalCoords({ x: clientX - rect.left, y: clientY - rect.top });
      } catch {
        return null;
      }
    };

    /* ---- hover (rubber band) */
    let moveRaf = 0;
    const onMove = (e) => {
      if (!cbRef.current.onPointerMove) return;
      const { clientX, clientY } = e;
      cancelAnimationFrame(moveRaf);
      moveRaf = requestAnimationFrame(() => cbRef.current.onPointerMove?.(toSpherical(clientX, clientY)));
    };
    const onLeave = () => cbRef.current.onPointerMove?.(null);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);

    /* ---- arraste de handles: captura antes do PSV para não girar a câmera */
    let drag = null;
    const point = (e) => (e.touches ? e.touches[0] || e.changedTouches[0] : e);
    const onDown = (e) => {
      const el = e.target?.closest?.('[data-handle]');
      if (!el) return;
      e.stopPropagation();
      e.preventDefault();
      const [kind, id, index] = el.dataset.handle.split(':');
      drag = { kind, id, index: +index };
      cbRef.current.onHandleDragStart?.(drag);
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
      window.addEventListener('touchcancel', onUp);
    };
    let dragRaf = 0;
    const onDragMove = (e) => {
      if (!drag) return;
      e.preventDefault();
      const p = point(e);
      const { clientX, clientY } = p;
      cancelAnimationFrame(dragRaf);
      dragRaf = requestAnimationFrame(() => {
        const pos = toSpherical(clientX, clientY);
        if (pos && drag) cbRef.current.onHandleDrag?.(drag, { yaw: +pos.yaw.toFixed(6), pitch: +pos.pitch.toFixed(6) });
      });
    };
    const onUp = () => {
      if (drag) cbRef.current.onHandleDragEnd?.(drag);
      drag = null;
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
    container.addEventListener('mousedown', onDown, true);
    container.addEventListener('touchstart', onDown, { capture: true, passive: false });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(moveRaf);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('mousedown', onDown, true);
      container.removeEventListener('touchstart', onDown, true);
      onUp();
      viewer.destroy();
      viewerRef.current = null;
      pluginRef.current = null;
      currentRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------- troca de cena */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !panoramaUrl || loadedKeyRef.current === sceneKey) return;
    loadedKeyRef.current = sceneKey;
    loadingRef.current = true;
    pluginRef.current.clearMarkers();
    currentRef.current = new Map();
    let cancelled = false;
    viewer
      .setPanorama(panoramaUrl, {
        position: { yaw: initialView?.yaw ?? 0, pitch: initialView?.pitch ?? -0.4 },
        zoom: initialView?.zoom ?? 40,
        transition: { speed: 900, rotation: false, effect: 'fade' },
        showLoader: true,
      })
      .then(() => {
        if (cancelled) return;
        loadingRef.current = false;
        sync();
      })
      .catch(() => {
        loadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, panoramaUrl]);

  /* --------------------------------------------------- sync de markers */
  useEffect(() => {
    sync();
  });

  return <div ref={containerRef} className={`absolute inset-0 ${className}`} />;
});

export default Viewer360;
