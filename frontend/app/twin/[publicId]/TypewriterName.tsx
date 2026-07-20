"use client";

import { useEffect, useState } from "react";

type TypewriterNameProps = {
  text: string;
  loop?: boolean;
};

export function TypewriterName({ text, loop = false }: TypewriterNameProps) {
  const [visibleLength, setVisibleLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    if (!loop && visibleLength >= text.length) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (loop) {
        if (!isDeleting && visibleLength < text.length) {
          setVisibleLength((current) => Math.min(current + 1, text.length));
          return;
        }

        if (!isDeleting && visibleLength >= text.length) {
          setIsDeleting(true);
          return;
        }

        if (isDeleting && visibleLength > 0) {
          setVisibleLength((current) => Math.max(current - 1, 0));
          return;
        }

        setIsDeleting(false);
        return;
      }

      setVisibleLength((current) => Math.min(current + 1, text.length));
    }, loop ? (isDeleting ? 32 : visibleLength >= text.length ? 900 : 70) : 45);

    return () => window.clearTimeout(timeoutId);
  }, [isDeleting, loop, reducedMotion, text, visibleLength]);

  return (
    <span className="typewriter-name">
      {reducedMotion ? text : text.slice(0, visibleLength)}
      {!reducedMotion && (loop || visibleLength < text.length) ? (
        <span aria-hidden="true" className="typewriter-caret">
          |
        </span>
      ) : null}
    </span>
  );
}
