"use client";

import { useState, type DragEvent } from "react";

/**
 * Pointer drag-and-drop reordering for lists and grids. It is a convenience
 * on top of the move-up/move-down buttons, which remain the keyboard and
 * touch path — HTML drag and drop is neither.
 */
export function useDragSort(ids: readonly string[], onReorder: (ids: string[]) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const reset = () => {
    setDragging(null);
    setOver(null);
  };

  const itemProps = (id: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      setDragging(id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    },
    onDragOver: (event: DragEvent) => {
      if (!dragging) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (over !== id) setOver(id);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (dragging && dragging !== id) {
        const next = ids.filter((item) => item !== dragging);
        const target = next.indexOf(id);
        const from = ids.indexOf(dragging);
        const to = ids.indexOf(id);
        // Dropping onto a later item places the dragged one after it.
        next.splice(from < to ? target + 1 : target, 0, dragging);
        onReorder(next);
      }
      reset();
    },
    onDragEnd: reset,
    "data-dragging": dragging === id ? "" : undefined,
    "data-drop-target": over === id && dragging !== id ? "" : undefined,
  });

  return { itemProps, dragging };
}
