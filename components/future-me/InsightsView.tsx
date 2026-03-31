
"use client";

import { motion } from "framer-motion";

export function InsightsView() {
  return (
    <motion.div
      key="insights"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22 }}
      className="grid gap-3.5"
    >
      {/* TODO: Implement a beautiful insights view */}
      <div className="rounded-2xl bg-white/5 p-5">
        <h2 className="text-lg font-bold">Insights</h2>
        <p className="text-white/60">Coming soon...</p>
      </div>
    </motion.div>
  );
}
