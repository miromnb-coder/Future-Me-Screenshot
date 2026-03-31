"use client";

import { useState, useEffect } from "react";

export interface ViewportState {
  mobile: boolean;
  width: number;
  height: number;
}

export function useMobile(breakpoint = 900): ViewportState {
  const [state, setState] = useState<ViewportState>({
    mobile: false,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const update = () => {
      setState({
        mobile: window.innerWidth < breakpoint,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpoint]);

  return state;
}
