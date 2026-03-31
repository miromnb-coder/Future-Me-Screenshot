"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { hexToRgba } from "@/lib/futureMe";

interface InteractiveGlassCardProps {
  accent: string;
  style?: CSSProperties;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function InteractiveGlassCard({
  accent,
  style,
  children,
  className,
  onClick,
}: InteractiveGlassCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState({ x: 50, y: 50, dx: 0, dy: 0, active: false });

  return (
    <motion.div
      ref={ref}
      className={className}
      onClick={onClick}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const dx = (e.clientX - rect.left - rect.width / 2) / rect.width;
        const dy = (e.clientY - rect.top - rect.height / 2) / rect.height;
        setHover({ x, y, dx, dy, active: true });
      }}
      onPointerLeave={() => setHover({ x: 50, y: 50, dx: 0, dy: 0, active: false })}
      style={{
        ...style,
        position: "relative",
        overflow: "hidden",
        transformStyle: "preserve-3d",
        transform: `perspective(1200px) rotateX(${hover.active ? -hover.dy * 7 : 0}deg) rotateY(${hover.active ? hover.dx * 9 : 0}deg)`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(700px circle at ${hover.x}% ${hover.y}%, ${hexToRgba(accent, 0.18)}, transparent 42%)`,
          transform: `translate3d(${hover.dx * 14}px, ${hover.dy * 14}px, 0)`,
          transition: "transform 120ms linear, background 120ms linear",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.08,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.7px)",
          backgroundSize: "3px 3px",
          mixBlendMode: "soft-light",
        }}
      />
      {children}
    </motion.div>
  );
}
