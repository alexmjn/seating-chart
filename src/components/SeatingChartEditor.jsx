import React, { useState, useRef, useEffect } from 'react';

const SeatingChartEditor = () => {
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tempSelection, setTempSelection] = useState([]);
  const [justFinishedSelecting, setJustFinishedSelecting] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [clipboard, setClipboard] = useState([]);

  // Prevent context menu on canvas
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('contextmenu', handleContextMenu);
      return () => canvas.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSeats.length > 0) {
          saveUndoState(); // Save before delete
          deleteSelectedSeats();
        }
      }
      if (e.key === 'Escape') {
        setSelectedSeats([]);
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        }
        if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
        }
        if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeats, undoStack, clipboard, seats]);

  // Handle mouse wheel for zooming and scrolling
  const handleWheel = (e) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(3, zoom * zoomFactor));

      const zoomChange = newZoom / zoom;
      setPan({
        x: mouseX - (mouseX - pan.x) * zoomChange,
        y: mouseY - (mouseY - pan.y) * zoomChange
      });

      setZoom(newZoom);
    } else {
      setPan({
        x: pan.x - e.deltaX,
        y: pan.y - e.deltaY
      });
    }
  };

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom
    };
  };

  // Add a new seat at double-clicked position
  const addSeat = (e) => {
    if (isDragging || isResizing || isPanning || editingLabel || isSelecting) return;

    const coords = screenToCanvas(e.clientX, e.clientY);

    const newSeat = {
      id: Date.now(),
      x: coords.x,
      y: coords.y,
      width: 40,
      height: 10,
      label: '',
      type: 'seat'
    };

    setSeats([...seats, newSeat]);
  };

  // Handle canvas click (deselect all or start selection)
  const handleCanvasClick = (e) => {
    if (isDragging || isResizing || isPanning || editingLabel || isSelecting) return;

    // Don't clear selection if we just finished a selection drag
    if (justFinishedSelecting) return;

    if (!e.ctrlKey && !e.metaKey) {
      setSelectedSeats([]);
    }
  };

  // Start selection drag
  const startSelection = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isDragging || isResizing || isPanning || editingLabel) return;

    const coords = screenToCanvas(e.clientX, e.clientY);
    setIsSelecting(true);
    setSelectionBox({ x: coords.x, y: coords.y, width: 0, height: 0 });
    setDragStartPos(coords);
  };

  // Handle item selection with multi-select support
  // Handle item selection with multi-select support
  const handleItemSelect = (e, item) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Multi-select: toggle this item
      setSelectedSeats(prev => {
        if (prev.includes(item.id)) {
          return prev.filter(id => id !== item.id);
        } else {
          return [...prev, item.id];
        }
      });
    } else {
      // Single select: select only this item
      setSelectedSeats([item.id]);
    }
  };

  // Start dragging items
  const startDrag = (e, item) => {
    e.stopPropagation();
    e.preventDefault();

    const coords = screenToCanvas(e.clientX, e.clientY);
    setDragStartPos(coords);

    if (!selectedSeats.includes(item.id)) {
      if (e.ctrlKey || e.metaKey) {
        setSelectedSeats(prev => [...prev, item.id]);
      } else {
        setSelectedSeats([item.id]);
      }
    }

    setIsDragging(true);
    setDragOffset({
      x: coords.x - item.x,
      y: coords.y - item.y
    });
  };

  // Start resizing a seat
  const startResize = (e, seat) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setSelectedSeats([seat.id]);
  };

  // Handle mouse move for dragging, resizing, selecting, and panning
  const handleMouseMove = (e) => {
    const coords = screenToCanvas(e.clientX, e.clientY);

    if (isPanning) {
      setPan({
        x: pan.x + e.movementX,
        y: pan.y + e.movementY
      });
    } else if (isSelecting) {
      const newBox = {
        x: Math.min(dragStartPos.x, coords.x),
        y: Math.min(dragStartPos.y, coords.y),
        width: Math.abs(coords.x - dragStartPos.x),
        height: Math.abs(coords.y - dragStartPos.y)
      };
      setSelectionBox(newBox);

      if (newBox.width > 5 && newBox.height > 5) {
        const selectedIds = seats.filter(seat => {
          return seat.x < newBox.x + newBox.width &&
            seat.x + seat.width > newBox.x &&
            seat.y < newBox.y + newBox.height &&
            seat.y + seat.height > newBox.y;
        }).map(seat => seat.id);

        setSelectedSeats(selectedIds); // Back to direct update for visual feedback
        setTempSelection(selectedIds); // Also store in temp for later
      }
    } else if (isDragging && selectedSeats.length > 0) {
      const deltaX = coords.x - dragStartPos.x;
      const deltaY = coords.y - dragStartPos.y;

      setSeats(seats.map(seat =>
        selectedSeats.includes(seat.id)
          ? { ...seat, x: seat.x + deltaX, y: seat.y + deltaY }
          : seat
      ));

      setDragStartPos(coords);
    } else if (isResizing && selectedSeats.length === 1) {
      const selectedSeatData = seats.find(s => s.id === selectedSeats[0]);
      if (selectedSeatData) {
        const newWidth = Math.max(20, coords.x - selectedSeatData.x);
        const newHeight = Math.max(15, coords.y - selectedSeatData.y);

        setSeats(seats.map(seat =>
          seat.id === selectedSeats[0]
            ? { ...seat, width: newWidth, height: newHeight }
            : seat
        ));
      }
    }
  };

  // Stop dragging/resizing/panning/selecting
  // Stop dragging/resizing/panning/selecting
  const stopInteraction = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);

    if (isSelecting) {
      setJustFinishedSelecting(true);
      // Clear the flag after a short delay
      setTimeout(() => setJustFinishedSelecting(false), 100);
    }

    setIsSelecting(false);
    setSelectionBox({ x: 0, y: 0, width: 0, height: 0 });
    setTempSelection([]);
  };

  // Start panning
  const startPan = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
    } else if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isSelecting) {
      // Start selection if not clicking on any modifier keys
      // The SVG rect elements will stop propagation, so this only fires on empty space
      startSelection(e);
    }
  };

  // Orient selected items - align and distribute evenly
  const orientSelectedItems = () => {
    if (selectedSeats.length < 2) return;

    const selectedItems = seats.filter(s => selectedSeats.includes(s.id));

    // Calculate the spread to determine orientation
    const xPositions = selectedItems.map(s => s.x + s.width / 2);
    const yPositions = selectedItems.map(s => s.y + s.height / 2);
    const xSpread = Math.max(...xPositions) - Math.min(...xPositions);
    const ySpread = Math.max(...yPositions) - Math.min(...yPositions);

    if (xSpread > ySpread) {
      // Horizontal alignment - align Y, distribute X evenly
      const avgY = yPositions.reduce((sum, y) => sum + y, 0) / yPositions.length;
      const minX = Math.min(...xPositions);
      const maxX = Math.max(...xPositions);
      const spacing = selectedItems.length > 1 ? (maxX - minX) / (selectedItems.length - 1) : 0;

      // Sort by current X position and redistribute
      const sortedItems = selectedItems.sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2));

      setSeats(seats.map(seat => {
        const itemIndex = sortedItems.findIndex(s => s.id === seat.id);
        if (itemIndex !== -1) {
          const newCenterX = minX + (spacing * itemIndex);
          return {
            ...seat,
            x: newCenterX - seat.width / 2,
            y: avgY - seat.height / 2
          };
        }
        return seat;
      }));
    } else {
      // Vertical alignment - align X, distribute Y evenly
      const avgX = xPositions.reduce((sum, x) => sum + x, 0) / xPositions.length;
      const minY = Math.min(...yPositions);
      const maxY = Math.max(...yPositions);
      const spacing = selectedItems.length > 1 ? (maxY - minY) / (selectedItems.length - 1) : 0;

      // Sort by current Y position and redistribute
      const sortedItems = selectedItems.sort((a, b) => (a.y + a.height / 2) - (b.y + b.height / 2));

      setSeats(seats.map(seat => {
        const itemIndex = sortedItems.findIndex(s => s.id === seat.id);
        if (itemIndex !== -1) {
          const newCenterY = minY + (spacing * itemIndex);
          return {
            ...seat,
            x: avgX - seat.width / 2,
            y: newCenterY - seat.height / 2
          };
        }
        return seat;
      }));
    }
  };

  // Delete selected seats
  const deleteSelectedSeats = () => {
    setSeats(seats.filter(seat => !selectedSeats.includes(seat.id)));
    setSelectedSeats([]);
  };

  // Delete specific seat
  const deleteSeat = (seatId) => {
    setSeats(seats.filter(seat => seat.id !== seatId));
    setSelectedSeats(selectedSeats.filter(id => id !== seatId));
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.() ||
        containerRef.current?.webkitRequestFullscreen?.() ||
        containerRef.current?.mozRequestFullScreen?.();
    } else {
      document.exitFullscreen?.() ||
        document.webkitExitFullscreen?.() ||
        document.mozCancelFullScreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Add multiple seats in a row
  const addRow = () => {
    const startX = 50;
    const startY = seats.length > 0 ? Math.max(...seats.map(s => s.y)) + 40 : 50;
    const seatWidth = 40;
    const spacing = 10;
    const seatsInRow = 8;

    const newSeats = [];
    for (let i = 0; i < seatsInRow; i++) {
      newSeats.push({
        id: Date.now() + i,
        x: startX + i * (seatWidth + spacing),
        y: startY,
        width: 40,
        height: 10,
        label: '',
        type: 'seat'
      });
    }

    setSeats([...seats, ...newSeats]);
  };

  // Add sideways row (vertical orientation)
  const addSidewaysRow = () => {
    const startX = seats.length > 0 ? Math.max(...seats.map(s => s.x)) + 60 : 50;
    const startY = 50;
    const seatHeight = 40;
    const spacing = 10;
    const seatsInRow = 6;

    const newSeats = [];
    for (let i = 0; i < seatsInRow; i++) {
      newSeats.push({
        id: Date.now() + i,
        x: startX,
        y: startY + i * (seatHeight + spacing),
        width: 40,
        height: 10,
        label: '',
        type: 'seat'
      });
    }

    setSeats([...seats, ...newSeats]);
  };

  // Add circle arrangement
  const addCircle = () => {
    const centerX = 300;
    const centerY = 200;
    const radius = 100;
    const seatCount = 12;

    const newSeats = [];
    for (let i = 0; i < seatCount; i++) {
      const angle = (i * 2 * Math.PI) / seatCount;
      newSeats.push({
        id: Date.now() + i,
        x: centerX + radius * Math.cos(angle) - 20,
        y: centerY + radius * Math.sin(angle) - 10,
        width: 40,
        height: 10,
        label: '',
        type: 'seat'
      });
    }

    setSeats([...seats, ...newSeats]);
  };

  // Create template matching the uploaded image (enhanced)
  const createUploadedTemplate = () => {
    const originalSeats = [
      // Back row (7 seats)
      { "id": Date.now() + 1, "x": 47, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 2, "x": 97, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 3, "x": 146, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 4, "x": 196, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 5, "x": 245, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 6, "x": 295, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 7, "x": 347, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Top right section (5 seats)
      { "id": Date.now() + 8, "x": 519, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 9, "x": 577, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 10, "x": 634, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 11, "x": 692, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 12, "x": 749, "y": 51, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Additional top seats
      { "id": Date.now() + 13, "x": 505, "y": 120, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 14, "x": 594, "y": 120, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Left columns (4 columns with varying heights)
      { "id": Date.now() + 15, "x": 50, "y": 120, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 16, "x": 50, "y": 167, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 17, "x": 50, "y": 213, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 18, "x": 50, "y": 260, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 19, "x": 50, "y": 307, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 20, "x": 50, "y": 353, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 21, "x": 50, "y": 400, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 22, "x": 50, "y": 446, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 23, "x": 50, "y": 493, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 24, "x": 50, "y": 540, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 25, "x": 50, "y": 586, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Column 2
      { "id": Date.now() + 26, "x": 117, "y": 120, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 27, "x": 117, "y": 167, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 28, "x": 117, "y": 213, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 29, "x": 117, "y": 260, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 30, "x": 117, "y": 307, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 31, "x": 117, "y": 353, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 32, "x": 117, "y": 400, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 33, "x": 117, "y": 446, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 34, "x": 117, "y": 493, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 35, "x": 117, "y": 540, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 36, "x": 117, "y": 586, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Column 3
      { "id": Date.now() + 37, "x": 181, "y": 120, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 38, "x": 181, "y": 167, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 39, "x": 181, "y": 213, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 40, "x": 181, "y": 260, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 41, "x": 181, "y": 307, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 42, "x": 181, "y": 353, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 43, "x": 181, "y": 400, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 44, "x": 181, "y": 446, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 45, "x": 181, "y": 493, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 46, "x": 181, "y": 540, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 47, "x": 181, "y": 586, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Column 4
      { "id": Date.now() + 48, "x": 245, "y": 120, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 49, "x": 245, "y": 167, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 50, "x": 245, "y": 213, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 51, "x": 245, "y": 260, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 52, "x": 245, "y": 307, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 53, "x": 245, "y": 353, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 54, "x": 245, "y": 400, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 55, "x": 245, "y": 446, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 56, "x": 245, "y": 493, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 57, "x": 245, "y": 540, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 58, "x": 245, "y": 586, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Center sections (4 rows of 5 seats each)
      { "id": Date.now() + 59, "x": 383, "y": 235, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 60, "x": 446, "y": 235, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 61, "x": 518, "y": 235, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 62, "x": 585, "y": 235, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 63, "x": 653, "y": 235, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 64, "x": 383, "y": 290, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 65, "x": 452, "y": 292, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 66, "x": 518, "y": 290, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 67, "x": 585, "y": 290, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 68, "x": 653, "y": 290, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 69, "x": 383, "y": 345, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 70, "x": 452, "y": 343, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 71, "x": 518, "y": 345, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 72, "x": 585, "y": 345, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 73, "x": 653, "y": 345, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 74, "x": 383, "y": 399, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 75, "x": 453, "y": 399, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 76, "x": 518, "y": 399, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 77, "x": 585, "y": 399, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 78, "x": 653, "y": 399, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Bottom 5 rows (8 seats each)
      { "id": Date.now() + 79, "x": 332, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 80, "x": 382, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 81, "x": 433, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 82, "x": 483, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 83, "x": 533, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 84, "x": 583, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 85, "x": 633, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 86, "x": 683, "y": 521, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 87, "x": 332, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 88, "x": 382, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 89, "x": 433, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 90, "x": 483, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 91, "x": 533, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 92, "x": 583, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 93, "x": 633, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 94, "x": 683, "y": 589, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 95, "x": 332, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 96, "x": 382, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 97, "x": 433, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 98, "x": 483, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 99, "x": 533, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 100, "x": 583, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 101, "x": 633, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 102, "x": 683, "y": 657, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 103, "x": 332, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 104, "x": 383, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 105, "x": 434, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 106, "x": 484, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 107, "x": 535, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 108, "x": 586, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 109, "x": 636, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 110, "x": 687, "y": 726, "width": 40, "height": 10, "label": "", "type": "seat" },

      { "id": Date.now() + 111, "x": 333, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 112, "x": 384, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 113, "x": 434, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 114, "x": 484, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 115, "x": 534, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 116, "x": 585, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 117, "x": 635, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 118, "x": 685, "y": 796, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Right column (11 seats)
      { "id": Date.now() + 119, "x": 802, "y": 98, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 120, "x": 802, "y": 145, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 121, "x": 802, "y": 191, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 122, "x": 802, "y": 238, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 123, "x": 802, "y": 285, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 124, "x": 802, "y": 331, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 125, "x": 802, "y": 378, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 126, "x": 802, "y": 425, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 127, "x": 802, "y": 471, "width": 40, "height": 10, "label": "", "type": "seat" },
      { "id": Date.now() + 128, "x": 802, "y": 518, "width": 40, "height": 10, "label": "", "type": "seat" },

      // Table (center)
      { "id": Date.now() + 129, "x": 488, "y": 140, "width": 162, "height": 41, "label": "Table", "type": "table" },

      // Entrance
      { "id": Date.now() + 130, "x": 154, "y": 630, "width": 114, "height": 80, "label": "Entrance", "type": "table" },

      // Coffee Table
      { "id": Date.now() + 131, "x": 753, "y": 554, "width": 95, "height": 108, "label": "Coffee Table", "type": "coffee_table" }
    ];

    // Calculate bounds for rotation center
    const allX = originalSeats.map(s => s.x + s.width / 2);
    const allY = originalSeats.map(s => s.y + s.height / 2);
    const centerX = (Math.min(...allX) + Math.max(...allX)) / 2;
    const centerY = (Math.min(...allY) + Math.max(...allY)) / 2;

    // Rotate 180 degrees around center
    const newSeats = originalSeats.map(seat => ({
      ...seat,
      x: 2 * centerX - seat.x - seat.width,
      y: 2 * centerY - seat.y - seat.height
    }));

    setSeats(newSeats);
  };

  // Generate printable PDF with improved layout
  const generatePDF = () => {
    if (seats.length === 0) return;

    const printWindow = window.open('', '_blank');

    const padding = 60; // More padding for title space
    const minX = Math.min(...seats.map(s => s.x)) - padding;
    const maxX = Math.max(...seats.map(s => s.x + s.width)) + padding;
    const minY = Math.min(...seats.map(s => s.y)) - padding;
    const maxY = Math.max(...seats.map(s => s.y + s.height)) + padding;
    const chartWidth = maxX - minX;
    const chartHeight = maxY - minY;

    // Better scaling for maximum space usage
    const pageWidth = 1400; // Much wider
    const shareListWidth = 120; // Keep narrow
    const margin = 20; // Smaller margins
    const availableWidth = pageWidth - shareListWidth - (margin * 2);
    const availableHeight = 900; // Use more vertical space

    // More aggressive scaling
    const scaleX = availableWidth / chartWidth;
    const scaleY = availableHeight / chartHeight;
    const scale = Math.min(scaleX, scaleY, 2.0); // Allow up to 2x scaling

    const scaledWidth = chartWidth * scale;
    const scaledHeight = chartHeight * scale;

    const getItemColor = (type) => {
      switch (type) {
        case 'couch': return '#8b5cf6';
        case 'table': return '#10b981';
        case 'coffee_table': return '#f59e0b';
        default: return '#e5e7eb';
      }
    };

    const svgContent = `
      <svg width="${scaledWidth}" height="${scaledHeight}" viewBox="${minX} ${minY} ${chartWidth} ${chartHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .seat { fill: #e5e7eb; stroke: #6b7280; stroke-width: 2; }
          .furniture { stroke: #374151; stroke-width: 2; }
          .seat-text { font-family: Arial, sans-serif; font-size: 10px; text-anchor: middle; fill: #374151; }
          .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-anchor: middle; fill: #1f2937; }
          .subtitle { font-family: Arial, sans-serif; font-size: 11px; text-anchor: middle; fill: #374151; }
          .name-line { font-family: Arial, sans-serif; font-size: 7px; text-anchor: middle; fill: #666; }
        </style>
        
        <text x="${minX + chartWidth / 2}" y="${minY + 20}" class="title">AA Meeting Seating Chart</text>
        <text x="${minX + chartWidth / 2}" y="${minY + 35}" class="subtitle">Date: _____________ Meeting: _____________</text>
        
        ${seats.map((seat, index) => `
          <rect x="${seat.x}" y="${seat.y}" width="${seat.width}" height="${seat.height}" 
                rx="3" class="${seat.type === 'seat' ? 'seat' : 'furniture'}" 
                fill="${getItemColor(seat.type)}"/>
          <text x="${seat.x + seat.width / 2}" y="${seat.y + seat.height / 2 + 3}" class="seat-text">
            ${seat.label || (seat.type === 'seat' ? '' : seat.type)}
          </text>
          ${seat.type === 'seat' && !seat.label ? `
            <text x="${seat.x + seat.width / 2}" y="${seat.y - 8}" class="name-line">
              _______
            </text>
          ` : ''}
        `).join('')}
      </svg>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AA Meeting Seating Chart</title>
          <style>
            @page { size: landscape; margin: 0.1in; }
            body { 
              margin: 0; 
              padding: ${margin}px; 
              font-family: Arial, sans-serif; 
              background: white; 
              width: ${pageWidth}px;
              height: 100vh;
            }
            .container { 
              display: flex; 
              gap: ${margin}px; 
              width: 100%;
              height: 100%;
            }
            .chart-section { 
              flex: 1; 
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .share-section { 
              width: ${shareListWidth}px; 
              border-left: 2px solid #ccc; 
              padding-left: 15px; 
              flex-shrink: 0;
            }
            .share-list { 
              list-style: none; 
              padding: 0; 
              margin: 0; 
            }
            .share-list li { 
              border-bottom: 1px solid #ddd; 
              padding: 6px 0;  // Less compressed
              font-size: 11px; // Slightly larger
            }
            h3 { 
              margin-top: 0; 
              color: #1f2937; 
              border-bottom: 2px solid #1f2937; 
              padding-bottom: 5px;
              font-size: 15px; // Slightly larger
            }
            @media print { 
              body { margin: 0; padding: 15px; } 
              .container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="chart-section">
              ${svgContent}
            </div>
            <div class="share-section">
              <h3>Share</h3>
              <ul class="share-list">
                ${Array.from({ length: 17 }, (_, i) =>
      `<li>${i + 1}. _______________</li>`
    ).join('')}
              </ul>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Save and load functions
  const saveTemplate = () => {
    const template = {
      name: `AA Meeting Template - ${new Date().toLocaleDateString()}`,
      seats: seats,
      created: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seating-template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadTemplate = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const template = JSON.parse(event.target.result);
        if (template.seats) {
          setSeats(template.seats);
          setSelectedSeats([]);
        }
      } catch (error) {
        alert('Error loading template file');
      }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all items?')) {
      setSeats([]);
      setSelectedSeats([]);
    }
  };

  // Get item color for display
  const getItemColor = (item, isSelected) => {
    if (isSelected) return "#3b82f6";
    switch (item.type) {
      case 'couch': return '#8b5cf6';
      case 'table': return '#10b981';
      case 'coffee_table': return '#f59e0b';
      default: return '#e5e7eb';
    }
  };

  // Save state for undo
  const saveUndoState = () => {
    setUndoStack(prev => [...prev.slice(-9), seats]); // Keep last 10 states
  };

  // Undo function
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setSeats(previousState);
      setUndoStack(prev => prev.slice(0, -1));
      setSelectedSeats([]);
    }
  };

  // Copy selected items
  const handleCopy = () => {
    const selectedItems = seats.filter(seat => selectedSeats.includes(seat.id));
    if (selectedItems.length > 0) {
      setClipboard(selectedItems.map(item => ({
        ...item,
        id: null // Will get new ID when pasted
      })));
    }
  };

  // Paste items
  const handlePaste = () => {
    if (clipboard.length > 0) {
      const newItems = clipboard.map(item => ({
        ...item,
        id: Date.now() + Math.random(),
        x: item.x + 20, // Offset so you can see the copy
        y: item.y + 20
      }));
      setSeats([...seats, ...newItems]);
      setSelectedSeats(newItems.map(item => item.id));
    }
  };

  return (
    <div ref={containerRef} className={`w-full bg-gray-100 p-4 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>
      <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">AA Meeting Seating Chart Editor</h1>
            <button
              onClick={toggleFullscreen}
              className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {isFullscreen ? '⤓ Exit Fullscreen' : '⤢ Fullscreen'}
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 mb-2">
            <button onClick={createUploadedTemplate} className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 font-medium">
              Load Your Chart Template
            </button>
            <button onClick={addRow} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Add Row (8 seats)
            </button>
            <button onClick={addSidewaysRow} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Add Sideways Row (6 seats)
            </button>
            <button onClick={addCircle} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              Add Circle (12 seats)
            </button>
            <button
              onClick={orientSelectedItems}
              disabled={selectedSeats.length < 2}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
            >
              Orient Selected ({selectedSeats.length})
            </button>
            <button
              onClick={deleteSelectedSeats}
              disabled={selectedSeats.length === 0}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
            >
              Delete Selected ({selectedSeats.length})
            </button>
            <button onClick={clearAll} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Clear All
            </button>
            <button onClick={generatePDF} disabled={seats.length === 0} className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-400">
              Print/Save PDF
            </button>
            <button onClick={saveTemplate} className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
              Save Template
            </button>
            <label className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 cursor-pointer">
              Load Template
              <input type="file" accept=".json" onChange={loadTemplate} className="hidden" />
            </label>
          </div>

          <div className="text-sm text-gray-600">
            <p>• Double-click empty space: add seats • Drag empty space: select multiple • Ctrl+click: multi-select toggle</p>
            <p>• Mouse wheel: scroll • Ctrl+wheel: zoom • Shift+drag: pan • Shift+right-click: delete • Drag corner: resize</p>
            <p>• Double-click item: edit label • Ctrl+Z: undo • Ctrl+C/V: copy/paste • Delete key: remove selected</p>
            <p>• Selected: {selectedSeats.length} items • Zoom: {Math.round(zoom * 100)}%</p>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={handleCanvasClick}
            onDoubleClick={addSeat}
            onMouseMove={handleMouseMove}
            onMouseUp={stopInteraction}
            onMouseDown={startPan}
            onMouseLeave={stopInteraction}
            onWheel={handleWheel}
            style={{ cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : isResizing ? 'nw-resize' : isSelecting ? 'crosshair' : 'default' }}
          >
            {/* Grid background */}
            <defs>
              <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
                <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="#f0f0f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Transform group for zoom and pan */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Selection box */}
              {isSelecting && selectionBox.width > 0 && selectionBox.height > 0 && (
                <rect
                  x={selectionBox.x}
                  y={selectionBox.y}
                  width={selectionBox.width}
                  height={selectionBox.height}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  pointerEvents="none"
                />
              )}

              {/* Render seats and furniture */}
              {seats.map((item) => {
                const isSelected = selectedSeats.includes(item.id);
                return (
                  <g key={item.id}>
                    {/* Main rectangle */}
                    <rect
                      x={item.x}
                      y={item.y}
                      width={item.width}
                      height={item.height}
                      fill={getItemColor(item, isSelected)}
                      stroke={isSelected ? "#1d4ed8" : "#6b7280"}
                      strokeWidth={isSelected ? "3" : "2"}
                      rx="3"
                      className="cursor-move hover:opacity-80"
                      onMouseDown={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          // For Ctrl+click, handle selection immediately in mousedown
                          e.stopPropagation();
                          e.preventDefault();
                          if (selectedSeats.includes(item.id)) {
                            setSelectedSeats(prev => prev.filter(id => id !== item.id));
                          } else {
                            setSelectedSeats(prev => [...prev, item.id]);
                          }
                        } else {
                          startDrag(e, item);
                        }
                      }}
                      onClick={(e) => {
                        if (!(e.ctrlKey || e.metaKey)) {
                          handleItemSelect(e, item);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.shiftKey) {
                          // Shift+right-click to delete (safer)
                          saveUndoState();
                          deleteSeat(item.id);
                        } else {
                          // Regular right-click just selects the item
                          setSelectedSeats([item.id]);
                        }
                      }}
                    />

                    {/* Resize handle (only show for single selection) */}
                    {isSelected && selectedSeats.length === 1 && (
                      <rect
                        x={item.x + item.width - 5}
                        y={item.y + item.height - 5}
                        width="10"
                        height="10"
                        fill="#1d4ed8"
                        className="cursor-nw-resize"
                        onMouseDown={(e) => startResize(e, item)}
                      />
                    )}

                    {/* Label */}
                    {editingLabel === item.id ? (
                      <foreignObject x={item.x} y={item.y + item.height / 2 - 10} width={item.width} height="20">
                        <input
                          type="text"
                          defaultValue={item.label}
                          className="w-full text-xs text-center border-none outline-none bg-transparent"
                          onBlur={(e) => {
                            setSeats(seats.map(s => s.id === item.id ? { ...s, label: e.target.value } : s));
                            setEditingLabel(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setSeats(seats.map(s => s.id === item.id ? { ...s, label: e.target.value } : s));
                              setEditingLabel(null);
                            }
                          }}
                          autoFocus
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={item.x + item.width / 2}
                        y={item.y + item.height / 2 + 4}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#374151"
                        pointerEvents="none"
                      >
                        {item.label || (item.type === 'seat' ? (seats.indexOf(item) + 1) : item.type)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Info text when empty */}
              {seats.length === 0 && (
                <text
                  x="300"
                  y="200"
                  textAnchor="middle"
                  fontSize="18"
                  fill="#9ca3af"
                  pointerEvents="none"
                >
                  Double-click anywhere to add seats, or use the buttons above for quick layouts
                </text>
              )}
            </g>
          </svg>
        </div>

        {/* Status bar */}
        <div className="border-t p-2 bg-gray-50 text-sm text-gray-600 flex justify-between">
          <span>Total items: {seats.length} ({seats.filter(s => s.type === 'seat').length} seats, {seats.filter(s => s.type !== 'seat').length} furniture)</span>
          <span>{selectedSeats.length > 0 ? `${selectedSeats.length} items selected - drag to move, orient to align, resize with handle, right-click to delete` : 'Double-click to add items'}</span>
        </div>
      </div>
    </div>
  );
};

export default SeatingChartEditor;