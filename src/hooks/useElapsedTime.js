import { useEffect, useState } from "react";
import { formatDuration } from "./formatTime";

export function useElapsedTime(startTime) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    let startDate;
    if (startTime.toDate) {
      startDate = startTime.toDate();
    } else {
      startDate = new Date(startTime);
    }

    if (isNaN(startDate.getTime())) return;

    const interval = setInterval(() => {
      const now = new Date();
      const seconds = Math.floor((now - startDate) / 1000);
      setElapsed(seconds > 0 ? seconds : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

export function formatTime(seconds) {
  return formatDuration(seconds);
}

export function getStatusColor(elapsed, limitMinutes) {
  const limitSeconds = limitMinutes * 60;
  if (elapsed >= limitSeconds) return "#ef4444";
  if (elapsed >= limitSeconds * 0.8) return "#f59e0b";
  return "#22c55e";
}