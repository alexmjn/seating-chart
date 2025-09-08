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
          deleteSelectedSeats();
        }
      }
      if (e.key === 'Escape') {
        setSelectedSeats([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeats]);

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
      height: 20,
      label: '',
      type: 'seat'
    };
    
    setSeats([...seats, newSeat]);
  };

  // Handle canvas click (deselect all or start selection)
  const handleCanvasClick = (e) => {
    if (isDragging || isResizing || isPanning || editingLabel || isSelecting) return;
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
      
      const selectedIds = seats.filter(seat => {
        const seatCenterX = seat.x + seat.width / 2;
        const seatCenterY = seat.y + seat.height / 2;
        return seatCenterX >= newBox.x && 
               seatCenterX <= newBox.x + newBox.width &&
               seatCenterY >= newBox.y && 
               seatCenterY <= newBox.y + newBox.height;
      }).map(seat => seat.id);
      
      setSelectedSeats(selectedIds);
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
  const stopInteraction = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setIsSelecting(false);
    setSelectionBox({ x: 0, y: 0, width: 0, height: 0 });
  };

  // Start panning
  const startPan = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
    } else if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
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
        height: 20,
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
        height: 20,
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
        height: 20,
        label: '',
        type: 'seat'
      });
    }
    
    setSeats([...seats, ...newSeats]);
  };

  // Create template matching the uploaded image (enhanced)
  const createUploadedTemplate = () => {
    const newSeats = [];
    let id = Date.now();
    
    // Left side rows (9 rows alternating 6-7 seats)
    for (let row = 0; row < 9; row++) {
      const seatsInRow = row % 2 === 0 ? 7 : 6;
      const offsetX = row % 2 === 0 ? 50 : 75;
      
      for (let i = 0; i < seatsInRow; i++) {
        newSeats.push({
          id: id++,
          x: offsetX + i * 50,
          y: 60 + row * 40,
          width: 40,
          height: 20,
          label: '',
          type: 'seat'
        });
      }
    }
    
    // Right side vertical column (12 seats)
    for (let i = 0; i < 12; i++) {
      newSeats.push({
        id: id++,
        x: 450,
        y: 60 + i * 30,
        width: 40,
        height: 20,
        label: '',
        type: 'seat'
      });
    }
    
    // Additional sideways rows on the right
    for (let col = 0; col < 2; col++) {
      for (let i = 0; i < 8; i++) {
        newSeats.push({
          id: id++,
          x: 500 + col * 50,
          y: 80 + i * 35,
          width: 40,
          height: 20,
          label: '',
          type: 'seat'
        });
      }
    }
    
    // Bottom scattered seats
    const bottomPositions = [
      {x: 100, y: 430}, {x: 150, y: 450}, {x: 200, y: 430},
      {x: 250, y: 450}, {x: 300, y: 430}, {x: 350, y: 450}
    ];
    
    bottomPositions.forEach(pos => {
      newSeats.push({
        id: id++,
        x: pos.x,
        y: pos.y,
        width: 40,
        height: 20,
        label: '',
        type: 'seat'
      });
    });
    
    // Add coffee table (pre-placed)
    newSeats.push({
      id: id++,
      x: 250,
      y: 250,
      width: 80,
      height: 50,
      label: 'Coffee Table',
      type: 'coffee_table'
    });
    
    // Add entrance marker
    newSeats.push({
      id: id++,
      x: 50,
      y: 480,
      width: 100,
      height: 30,
      label: 'ENTRANCE',
      type: 'table'
    });
    
    setSeats(newSeats);
  };

  // Generate printable PDF with improved layout
  const generatePDF = () => {
    if (seats.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    
    const padding = 40;
    const minX = Math.min(...seats.map(s => s.x)) - padding;
    const maxX = Math.max(...seats.map(s => s.x + s.width)) + padding;
    const minY = Math.min(...seats.map(s => s.y)) - padding;
    const maxY = Math.max(...seats.map(s => s.y + s.height)) + padding;
    const chartWidth = maxX - minX;
    const chartHeight = maxY - minY;
    
    const pageWidth = 1000;
    const shareListWidth = 250;
    const margin = 40;
    const availableWidth = pageWidth - shareListWidth - (margin * 3);
    const availableHeight = 700;
    
    const scaleX = availableWidth / chartWidth;
    const scaleY = availableHeight / chartHeight;
    const scale = Math.min(scaleX, scaleY, 1.2);
    
    const scaledWidth = chartWidth * scale;
    const scaledHeight = chartHeight * scale;
    
    const getItemColor = (type) => {
      switch(type) {
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
          .title { font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; text-anchor: middle; fill: #1f2937; }
          .subtitle { font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; fill: #374151; }
          .name-line { font-family: Arial, sans-serif; font-size: 8px; text-anchor: middle; fill: #666; }
        </style>
        
        <text x="${minX + chartWidth/2}" y="${minY + 25}" class="title">AA Meeting Seating Chart</text>
        <text x="${minX + chartWidth/2}" y="${minY + 45}" class="subtitle">Date: _____________ Meeting: _____________</text>
        
        ${seats.map((seat, index) => `
          <rect x="${seat.x}" y="${seat.y}" width="${seat.width}" height="${seat.height}" 
                rx="3" class="${seat.type === 'seat' ? 'seat' : 'furniture'}" 
                fill="${getItemColor(seat.type)}"/>
          <text x="${seat.x + seat.width/2}" y="${seat.y + seat.height/2 + 3}" class="seat-text">
            ${seat.label || (seat.type === 'seat' ? '' : seat.type)}
          </text>
          ${seat.type === 'seat' && !seat.label ? `
            <text x="${seat.x + seat.width/2}" y="${seat.y - 10}" class="name-line">
              ___________
            </text>
          ` : ''}
        `).join('')}
      </svg>
    `;
    
    const seatCount = seats.filter(s => s.type === 'seat').length;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AA Meeting Seating Chart</title>
          <style>
            body { 
              margin: 0; 
              padding: ${margin}px; 
              font-family: Arial, sans-serif; 
              background: white; 
              width: ${pageWidth}px;
            }
            .container { 
              display: flex; 
              gap: ${margin}px; 
              width: 100%;
              height: auto;
            }
            .chart-section { 
              flex: 1; 
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
            }
            .chart-wrapper {
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }
            .share-section { 
              width: ${shareListWidth}px; 
              border-left: 2px solid #ccc; 
              padding-left: ${margin/2}px; 
              flex-shrink: 0;
            }
            .share-list { 
              list-style: none; 
              padding: 0; 
              margin: 0; 
            }
            .share-list li { 
              border-bottom: 1px solid #ddd; 
              padding: 14px 0; 
              font-size: 14px; 
            }
            h3 { 
              margin-top: 0; 
              color: #1f2937; 
              border-bottom: 2px solid #1f2937; 
              padding-bottom: 8px;
              font-size: 18px;
            }
            .note { 
              font-size: 12px; 
              color: #666; 
              margin-top: 20px; 
              text-align: center;
            }
            @media print { 
              body { margin: 0; padding: 20px; } 
              .container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="chart-section">
              <div class="chart-wrapper">
                ${svgContent}
              </div>
              <div class="note">
                Total seats: ${seatCount} | Names can be written above each seat
              </div>
            </div>
            <div class="share-section">
              <h3>Share</h3>
              <ul class="share-list">
                ${Array.from({length: Math.max(20, Math.ceil(seatCount / 2))}, (_, i) => 
                  `<li>${i + 1}. _________________________</li>`
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
    switch(item.type) {
      case 'couch': return '#8b5cf6';
      case 'table': return '#10b981';
      case 'coffee_table': return '#f59e0b';
      default: return '#e5e7eb';
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
            <p>• Double-click empty space to add seats • Drag empty space to select multiple • Ctrl+click for multi-select • Right-click to delete</p>
            <p>• Mouse wheel: scroll • Ctrl+wheel: zoom • Shift+click: pan • Double-click item: edit label • Drag corner to resize • Delete key: remove selected</p>
            <p>• Selected: {selectedSeats.length} items • Zoom: {Math.round(zoom * 100)}% • Orient: align and distribute selected items evenly</p>
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
                <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="#f0f0f0" strokeWidth="1"/>
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
                      onMouseDown={(e) => startDrag(e, item)}
                      onClick={(e) => handleItemSelect(e, item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteSeat(item.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setEditingLabel(item.id);
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
                      <foreignObject x={item.x} y={item.y + item.height/2 - 10} width={item.width} height="20">
                        <input
                          type="text"
                          defaultValue={item.label}
                          className="w-full text-xs text-center border-none outline-none bg-transparent"
                          onBlur={(e) => {
                            setSeats(seats.map(s => s.id === item.id ? {...s, label: e.target.value} : s));
                            setEditingLabel(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setSeats(seats.map(s => s.id === item.id ? {...s, label: e.target.value} : s));
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