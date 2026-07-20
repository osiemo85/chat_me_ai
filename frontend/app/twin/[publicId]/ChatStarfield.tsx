"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const STAR_COUNT = 420;

export function ChatStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const surface = canvas.parentElement;
    if (!surface) {
      return;
    }
    const surfaceElement: HTMLElement = surface;
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 9;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        canvas,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);

      const positions = new Float32Array(STAR_COUNT * 3);
      const colors = new Float32Array(STAR_COUNT * 3);
      const palette = [
        new THREE.Color("#ffffff"),
        new THREE.Color("#8cf4ff"),
        new THREE.Color("#ffd0a3"),
      ];

      for (let index = 0; index < STAR_COUNT; index += 1) {
        const offset = index * 3;
        positions[offset] = (Math.random() - 0.5) * 20;
        positions[offset + 1] = (Math.random() - 0.5) * 12;
        positions[offset + 2] = (Math.random() - 0.5) * 18;

        const color = palette[index % palette.length];
        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        depthWrite: false,
        opacity: 0.7,
        size: 0.045,
        sizeAttenuation: true,
        transparent: true,
        vertexColors: true,
      });
      const stars = new THREE.Points(geometry, material);
      scene.add(stars);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let frameId = 0;

      function resize() {
        const { width, height } = surfaceElement.getBoundingClientRect();
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
      }

      function render(time = 0) {
        if (!reducedMotion) {
          stars.rotation.y = time * 0.000012;
          stars.rotation.x = Math.sin(time * 0.00008) * 0.04;
          material.opacity = 0.62 + Math.sin(time * 0.0012) * 0.08;
        }

        renderer.render(scene, camera);
        if (!reducedMotion) {
          frameId = window.requestAnimationFrame(render);
        }
      }

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(surfaceElement);
      resize();
      render();

      return () => {
        window.cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    } catch {
      return;
    }
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="chat-starfield" />;
}
