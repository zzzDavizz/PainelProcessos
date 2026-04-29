"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_PX = 48;

type DragState = { index: number; startX: number; startW: number } | null;

/**
 * Larguras em px por coluna + arrastar a borda direita do cabeçalho para ajustar.
 * `initialWidths.length` deve coincidir com o número de colunas da tabela.
 * `layoutResetKey` — quando mudar, as larguras voltam ao `initialWidths` (ex.: outro conjunto de colunas).
 */
export function useResizableTableColumns(initialWidths: number[], layoutResetKey?: string) {
  const [widths, setWidths] = useState<number[]>(() => [...initialWidths]);
  const drag = useRef<DragState>(null);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const layoutKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (layoutResetKey === undefined) return;
    if (layoutKeyRef.current === layoutResetKey) return;
    layoutKeyRef.current = layoutResetKey;
    setWidths([...initialWidths]);
  }, [layoutResetKey, initialWidths]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      e.preventDefault();
      const w = Math.max(MIN_PX, d.startW + (e.clientX - d.startX));
      setWidths((prev) => {
        const next = [...prev];
        if (d.index >= 0 && d.index < next.length) next[d.index] = w;
        return next;
      });
    };
    const onUp = () => {
      if (drag.current) {
        drag.current = null;
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = widthsRef.current[colIndex] ?? MIN_PX;
    drag.current = { index: colIndex, startX: e.clientX, startW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const tableMinWidth = widths.reduce((a, b) => a + b, 0);

  return { widths, onResizeStart, tableMinWidth };
}
