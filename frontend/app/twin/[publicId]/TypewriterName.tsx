"use client";

import { useEffect, useState } from "react";

type TypewriterNameProps = {
  text: string;
};

export function TypewriterName({ text }: TypewriterNameProps) {
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

    let delay: number;

    if (!isDeleting && visibleLength < text.length) {
      delay = 105;
    } else if (!isDeleting) {
      delay = 1400;
    } else if (visibleLength > 0) {
      delay = 55;
    } else {
      delay = 500;
    }

    const timeoutId = window.setTimeout(() => {
      if (!isDeleting && visibleLength < text.length) {
        setVisibleLength((current) => current + 1);
      } else if (!isDeleting) {
        setIsDeleting(true);
      } else if (visibleLength > 0) {
        setVisibleLength((current) => current - 1);
      } else {
        setIsDeleting(false);
      }
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [isDeleting, reducedMotion, text, visibleLength]);

  return (
    <span className="typewriter-name">
      {reducedMotion ? text : text.slice(0, visibleLength)}
      {!reducedMotion && (
        <span aria-hidden="true" className="typewriter-caret">
          |
        </span>
      )}
    </span>
  );
}
