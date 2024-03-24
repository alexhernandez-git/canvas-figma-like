import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useCallback,
} from "react";
import Button from "./button";
import useWindowDimensions from "../hooks/use-window-dimensions";

const Whiteboard = () => {
  const canvasRef = useRef(null);
  const [items, setItems] = useState([
    {
      id: (Math.random() + 1).toString(36).substring(7),
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      selected: false,
      permanentSelection: false,
      fontSize: 20,
    },

    {
      id: (Math.random() + 1).toString(36).substring(7),
      x: 200,
      y: 200,
      width: 100,
      height: 100,
      selected: false,
      permanentSelection: false,
      fontSize: 20,
    },

    {
      id: (Math.random() + 1).toString(36).substring(7),
      x: 400,
      y: 400,
      width: 100,
      height: 100,
      selected: false,
      permanentSelection: false,
      fontSize: 20,
    },
  ]);
  const [dragging, setDragging] = useState(false); // State to track dragging
  const [resizeDirection, setResizeDirection] = useState<{
    direction: string;
    id: string;
  }>(null);
  const [prevMousePosition, setPrevMousePosition] = useState({ x: 0, y: 0 });
  const [selecting, setSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [endPoint, setEndPoint] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 }); // Track view offset
  const selectedRects = useMemo(
    () => items.filter(({ selected }) => selected),
    [items]
  );
  const [undoStack, setUndoStack] = useState([]); // Stack for undoing actions
  const [redoStack, setRedoStack] = useState([]); // Stack for redoing actions
  const [draggingView, setDraggingView] = useState(false); // State to track view dragging
  const [dragStartPoint, setDragStartPoint] = useState({ x: 0, y: 0 }); // Track start point of view dragging
  const [currIndexLayer, setCurrIndexLayer] = useState(0);
  const { width: innerWidth, height: innerHeight } = useWindowDimensions();

  const undo = useCallback(() => {
    if (undoStack.length > 0) {
      const previousState = undoStack.pop();
      setRedoStack((prevState) => [items, ...prevState]);
      setItems(previousState);
    }
  }, [undoStack, setRedoStack, setItems, items]);

  const redo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextState = redoStack[0];
      setUndoStack((prevState) => [items, ...prevState]);
      setItems(nextState);
      setRedoStack((prevState) => prevState.slice(1));
    }
  }, [items, redoStack]);

  const getCurrentRectangles = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - viewOffset.x - rect.left;
      const y = event.clientY - viewOffset.y - rect.top;
      const currentRects = items.filter((rectangle) => {
        return (
          x >= rectangle.x &&
          x <= rectangle.x + rectangle.width &&
          y >= rectangle.y &&
          y <= rectangle.y + rectangle.height
        );
      });

      return currentRects;
    },
    [items, viewOffset.x, viewOffset.y]
  );

  const determineCursorType = useCallback(
    (e) => {
      let { offsetX, offsetY } = e.nativeEvent;
      offsetX = offsetX - viewOffset.x;
      offsetY = offsetY - viewOffset.y;
      const currRects = getCurrentRectangles(e);
      if (
        currRects.length === 0 ||
        !selectedRects.some((rect) =>
          currRects.some((currRect) => currRect.id === rect.id)
        )
      ) {
        document.body.style.cursor = "inherit";
      }
      selectedRects.forEach((selRect) => {
        const { x, y, width, height } = selRect;
        if (
          offsetX >= x &&
          offsetX <= x + width &&
          offsetY >= y &&
          offsetY <= y + height
        ) {
          setPrevMousePosition({ x: offsetX, y: offsetY });

          if (offsetX - x < 10 && offsetY - y < 10) {
            document.body.style.cursor = "nwse-resize";
          } else if (x + width - offsetX < 10 && offsetY - y < 10) {
            document.body.style.cursor = "nesw-resize";
          } else if (x + width - offsetX < 10 && y + height - offsetY < 10) {
            document.body.style.cursor = "nwse-resize";
          } else if (offsetX - x < 10 && y + height - offsetY < 10) {
            document.body.style.cursor = "nesw-resize";
          } else if (offsetX - x < 10) {
            document.body.style.cursor = "ew-resize";
          } else if (x + width - offsetX < 10) {
            document.body.style.cursor = "ew-resize";
          } else if (offsetY - y < 10) {
            document.body.style.cursor = "ns-resize";
          } else if (y + height - offsetY < 10) {
            document.body.style.cursor = "ns-resize";
          } else {
            document.body.style.cursor = "inherit";
          }
        }
      });
    },
    [getCurrentRectangles, selectedRects, viewOffset.x, viewOffset.y]
  );

  const getLargestRect = useCallback(
    (currRects, doubleClick = false) => {
      // Sort rectangles from smaller to larger
      const sortedRects = currRects.slice().sort((a, b) => {
        return b.width * b.height - a.width * a.height;
      });

      const currRect = selectedRects.find(({ id }) =>
        currRects.some(({ id: currRectId }) => id === currRectId)
      );

      if (!doubleClick) {
        setCurrIndexLayer(
          sortedRects.findIndex(
            (sortedRect) => (currRect ?? sortedRects[0]).id === sortedRect.id
          )
        );
        return currRect ?? sortedRects[0];
      }

      const getNextRect = () => {
        let index = currIndexLayer;
        while (index < sortedRects.length) {
          const nextRect = sortedRects[index];
          if (!selectedRects.some(({ id }) => nextRect.id === id)) {
            setCurrIndexLayer(index);
            return nextRect;
          }
          index++;
        }

        setCurrIndexLayer(0);
        return sortedRects[0]; // No more rectangles available
      };

      return getNextRect();
    },
    [currIndexLayer, selectedRects]
  );

  const setSelectedRectangles = useCallback(
    (newItems) => {
      // Calculate selection area boundaries
      const startX = Math.min(startPoint.x, endPoint.x) - viewOffset.x;
      const startY = Math.min(startPoint.y, endPoint.y) - viewOffset.y;
      const endX = Math.max(startPoint.x, endPoint.x) - viewOffset.x;
      const endY = Math.max(startPoint.y, endPoint.y) - viewOffset.y;

      // Find the rectangles that intersect with the selection area
      const selectedRectangles = items.filter((rect) => {
        const rectStartX = rect.x;
        const rectStartY = rect.y;
        const rectEndX = rect.x + rect.width;
        const rectEndY = rect.y + rect.height;

        // Check for intersection
        return (
          rectStartX < endX &&
          rectEndX > startX &&
          rectStartY < endY &&
          rectEndY > startY
        );
      });

      // Update selected state for rectangles

      return newItems.map((rect) => {
        const isSelected = selectedRectangles.some(
          (selRec) => selRec?.id === rect?.id
        );
        return {
          ...rect,
          selected: isSelected,
          permanentSelection: isSelected,
        };
      });
    },
    [startPoint, endPoint, viewOffset, items]
  );

  const handleSelectItem = useCallback(
    (e, mouseDown = false) => {
      let currRects = getCurrentRectangles(e);
      let newItems = items;
      // Find the rectangle with the smallest width and height
      const smallestRect = getLargestRect(currRects);

      // Update the selected state of rectangles
      newItems = items.map((rect) => {
        let selected =
          (smallestRect && smallestRect.id === rect.id) ||
          rect.permanentSelection;

        if (mouseDown) {
          selected = smallestRect && smallestRect.id === rect.id;
        }

        return { ...rect, selected };
      });

      if (e.shiftKey) {
        // If shift key is pressed, add selected rectangles to the current selection
        const selectedRectangles = newItems.filter((rect) => rect.selected);
        const combinedRects = items.map((rect) => {
          const isSelected = selectedRectangles.some(
            (selRec) => selRec?.id === rect?.id
          );
          return {
            ...rect,
            selected: rect.selected || isSelected,
            permanentSelection: rect.selected || isSelected,
          };
        });
        newItems = combinedRects;
      } else {
        // If shift key is not pressed, replace the selection with the new selection
        // eslint-disable-next-line no-self-assign
        newItems = newItems;
      }

      return newItems;
    },
    [getCurrentRectangles, getLargestRect, items]
  );

  const handleMouseDown = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      let currRects = getCurrentRectangles(e);

      // Find the rectangle with the smallest width and height
      const smallestRect = getLargestRect(currRects);

      // Update the selected state of rectangles
      let newItems = items.map((rect) => {
        const selected = smallestRect && smallestRect.id === rect.id;
        return { ...rect, selected, permanentSelection: selected };
      });

      if (e.shiftKey) {
        // If shift key is pressed, add selected rectangles to the current selection
        const selectedRectangles = newItems.filter((rect) => rect.selected);
        const combinedRects = items.map((rect) => {
          const isSelected = selectedRectangles.some(
            (selRec) => selRec?.id === rect?.id
          );
          return {
            ...rect,
            selected: rect.selected || isSelected,
            permanentSelection: rect.selected || isSelected,
          };
        });
        newItems = combinedRects;
      }

      let { offsetX, offsetY } = e.nativeEvent;
      offsetX = offsetX - viewOffset.x;
      offsetY = offsetY - viewOffset.y;
      const xDiff = e.clientX - rect.left;
      const yDiff = e.clientY - rect.top;

      setItems(newItems);

      newItems.forEach((selectedRect) => {
        if (selectedRect) {
          const { x, y, width, height, id } = selectedRect;

          if (
            offsetX >= x &&
            offsetX <= x + width &&
            offsetY >= y &&
            offsetY <= y + height
          ) {
            setPrevMousePosition({ x: offsetX, y: offsetY });

            // Determine which direction to resize
            if (offsetX - x < 10 && offsetY - y < 10) {
              setResizeDirection({ direction: "topLeft", id });
            } else if (x + width - offsetX < 10 && offsetY - y < 10) {
              setResizeDirection({ direction: "topRight", id });
            } else if (x + width - offsetX < 10 && y + height - offsetY < 10) {
              setResizeDirection({ direction: "bottomRight", id });
            } else if (offsetX - x < 10 && y + height - offsetY < 10) {
              setResizeDirection({ direction: "bottomLeft", id });
            } else if (offsetX - x < 10) {
              setResizeDirection({ direction: "left", id });
            } else if (x + width - offsetX < 10) {
              setResizeDirection({ direction: "right", id });
            } else if (offsetY - y < 10) {
              setResizeDirection({ direction: "top", id });
            } else if (y + height - offsetY < 10) {
              setResizeDirection({ direction: "bottom", id });
            }
          }
        }
      });

      if (currRects.length > 0) {
        setDragging(true);
        return;
      }
      if (e.shiftKey) {
        setSelecting(true);
        setStartPoint({ x: xDiff, y: yDiff });
        setEndPoint({ x: xDiff, y: yDiff });
      } else {
        setDraggingView(true);
        setDragStartPoint({ x: e.clientX, y: e.clientY });
      }
    },
    [
      canvasRef,
      getCurrentRectangles,
      getLargestRect,
      items,
      setItems,
      setPrevMousePosition,
      setResizeDirection,
      setDragging,
      setSelecting,
      setStartPoint,
      setEndPoint,
      setDraggingView,
      setDragStartPoint,
      viewOffset,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingView(false);

    if (selecting) {
      setSelecting(false);
    }
    if (dragging) {
      setDragging(false);
    }
    if (resizeDirection) {
      setResizeDirection(null);
    }

    setStartPoint({ x: 0, y: 0 });
    setEndPoint({ x: 0, y: 0 });
    setUndoStack([...undoStack, items]);
  }, [selecting, dragging, resizeDirection, undoStack, items]);

  const handleMouseMove = useCallback(
    (e) => {
      let newItems = items;

      if (!dragging && !selecting) {
        newItems = handleSelectItem(e);
      }

      if (draggingView) {
        const deltaX = e.clientX - dragStartPoint.x;
        const deltaY = e.clientY - dragStartPoint.y;

        // Update view offset based on dragging
        setViewOffset((prevOffset) => ({
          x: prevOffset.x + deltaX,
          y: prevOffset.y + deltaY,
        }));

        // Update drag start point for next movement calculation
        setDragStartPoint({ x: e.clientX, y: e.clientY });
      }

      if (selecting) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setEndPoint({ x, y });

        newItems = setSelectedRectangles(newItems);
      }

      determineCursorType(e);

      if (resizeDirection || resizeDirection?.direction || dragging) {
        let { offsetX, offsetY } = e.nativeEvent;
        offsetX = offsetX - viewOffset.x;
        offsetY = offsetY - viewOffset.y;
        const deltaX = offsetX - prevMousePosition.x;
        const deltaY = offsetY - prevMousePosition.y;

        newItems = newItems.map((rect) => {
          if (rect.selected) {
            let newX = rect.x;
            let newY = rect.y;
            let newWidth = rect.width;
            let newHeight = rect.height;

            if (
              resizeDirection?.direction &&
              resizeDirection?.id === rect?.id
            ) {
              switch (resizeDirection.direction) {
                case "topLeft":
                  newX += deltaX;
                  newY += deltaY;
                  newWidth -= deltaX;
                  newHeight -= deltaY;
                  break;
                case "topRight":
                  newY += deltaY;
                  newWidth += deltaX;
                  newHeight -= deltaY;
                  break;
                case "bottomRight":
                  newWidth += deltaX;
                  newHeight += deltaY;
                  break;
                case "bottomLeft":
                  newX += deltaX;
                  newWidth -= deltaX;
                  newHeight += deltaY;
                  break;
                case "left":
                  newX += deltaX;
                  newWidth -= deltaX;
                  break;
                case "right":
                  newWidth += deltaX;
                  break;
                case "top":
                  newY += deltaY;
                  newHeight -= deltaY;
                  break;
                case "bottom":
                  newHeight += deltaY;
                  break;
                default:
                  break;
              }
            } else if (dragging && !resizeDirection) {
              newX += deltaX;
              newY += deltaY;
            }

            return {
              ...rect,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          } else {
            return rect;
          }
        });
        setPrevMousePosition({ x: offsetX, y: offsetY });
      }
      setItems(newItems);
    },
    [
      items,
      dragging,
      selecting,
      draggingView,
      determineCursorType,
      resizeDirection,
      handleSelectItem,
      dragStartPoint.x,
      dragStartPoint.y,
      setSelectedRectangles,
      viewOffset.x,
      viewOffset.y,
      prevMousePosition.x,
      prevMousePosition.y,
    ]
  );

  const handleRemoveSelected = useCallback(() => {
    const newItems = items.filter((rect) => !rect.selected);
    setItems(newItems);
    setUndoStack([...undoStack, newItems]);
  }, [items, undoStack]);

  const handleCopySelected = useCallback(() => {
    // Filter out selected rectangles and copy them to clipboard
    const selectedRectangles = items.filter((rect) => rect.selected);
    const jsonString = JSON.stringify(selectedRectangles);
    navigator.clipboard.writeText(jsonString);
  }, [items]);

  const handlePaste = useCallback(async () => {
    const clipboardData = await navigator.clipboard.readText();
    try {
      const parsedData = JSON.parse(clipboardData);
      // Offset pasted rectangles to prevent overlapping with existing ones
      const pastedRectangles = parsedData.map((rect) => {
        let newId = rect.id;
        // eslint-disable-next-line no-loop-func
        while (items.some((existingRect) => existingRect.id === newId)) {
          // Generate new ID if the ID already exists
          newId = (Math.random() + 1).toString(36).substring(7);
        }
        return {
          ...rect,
          id: newId,
          x: rect.x + 10,
          y: rect.y + 10,
          selected: false, // Deselect pasted rectangles
          permanentSelection: false, // Deselect pasted rectangles
        };
      });

      const newItems = [...items, ...pastedRectangles].map((rect) =>
        pastedRectangles.some((pastRect) => pastRect.id === rect.id)
          ? { ...rect, selected: true, permanentSelection: true }
          : { ...rect, selected: false, permanentSelection: false }
      );

      setItems(newItems);
      setUndoStack([...undoStack, newItems]);
    } catch (error) {
      console.error("Error parsing clipboard data:", error);
    }
  }, [items, undoStack]);

  const selectNextRect = useCallback(
    (e) => {
      const currRects = getCurrentRectangles(e);
      const smallestRect = getLargestRect(currRects, true);
      // Update the selected state of rectangles
      let newItems = items.map((rect) => {
        const selected = smallestRect && smallestRect.id === rect.id;
        return { ...rect, selected, permanentSelection: selected };
      });

      setItems(newItems);
    },
    [getCurrentRectangles, getLargestRect, items]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.metaKey && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo, redo]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.metaKey && event.key === "c") {
        handleCopySelected();
      } else if (event.metaKey && event.key === "v") {
        handlePaste();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCopySelected, handlePaste]);

  useLayoutEffect(() => {
    let animationFrameId;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      items.forEach((rect) => {
        const adjustedX = rect.x + viewOffset.x; // Apply view offset
        const adjustedY = rect.y + viewOffset.y; // Apply view offset

        ctx.strokeStyle = "black"; // Change border color to black
        ctx.strokeRect(adjustedX, adjustedY, rect?.width, rect?.height); // Draw rectangle border
      });

      selectedRects.forEach((selectedRect) => {
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]); // Adjust the numbers for different dash patterns
        ctx.strokeRect(
          selectedRect?.x + viewOffset.x,
          selectedRect?.y + viewOffset.y,
          selectedRect?.width,
          selectedRect?.height
        );
        ctx.setLineDash([]);
      });

      if (selecting) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          startPoint?.x,
          startPoint?.y,
          endPoint?.x - startPoint?.x,
          endPoint?.y - startPoint?.y
        );
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedRects, startPoint, endPoint, items, viewOffset, selecting]);

  return (
    <div className="flex">
      <canvas
        ref={canvasRef}
        width={selectedRects.length > 0 ? innerWidth - 200 : innerWidth}
        height={innerHeight}
        onMouseDown={handleMouseDown}
        onDoubleClick={selectNextRect}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      ></canvas>
      <div className="w-full p-2 flex flex-col gap-2">
        {selectedRects.length > 0 && (
          <>
            <Button onClick={handleCopySelected}>Copy</Button>
            <Button onClick={handlePaste}>Paste</Button>
            <hr />
            <Button onClick={handleRemoveSelected}>Delete</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
