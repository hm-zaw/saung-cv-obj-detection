"use client";

interface BoundingBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  color?: string;
  showLabel?: boolean;
  className?: string;
}

export default function BoundingBox({
  x,
  y,
  width,
  height,
  label,
  confidence,
  color = "#C59D5F",
  showLabel = true,
  className = "",
}: BoundingBoxProps) {
  const confidencePercentage = Math.round(confidence * 100);
  const confidenceClass = confidence >= 0.9 ? "high-confidence" : 
                         confidence >= 0.7 ? "medium-confidence" : 
                         "low-confidence";

  return (
    <g className={`bounding-box ${confidenceClass} ${className}`}>
      {/* Main bounding box */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={color}
        strokeWidth="2"
        className="animate-flicker"
      />
      
      {/* Corner markers */}
      {/* Top-left corner */}
      <line
        x1={x}
        y1={y + 5}
        x2={x}
        y2={y - 5}
        stroke={color}
        strokeWidth="2"
      />
      <line
        x1={x - 5}
        y1={y}
        x2={x + 5}
        y2={y}
        stroke={color}
        strokeWidth="2"
      />
      
      {/* Top-right corner */}
      <line
        x1={x + width}
        y1={y + 5}
        x2={x + width}
        y2={y - 5}
        stroke={color}
        strokeWidth="2"
      />
      <line
        x1={x + width - 5}
        y1={y}
        x2={x + width + 5}
        y2={y}
        stroke={color}
        strokeWidth="2"
      />
      
      {/* Bottom-left corner */}
      <line
        x1={x}
        y1={y + height - 5}
        x2={x}
        y2={y + height + 5}
        stroke={color}
        strokeWidth="2"
      />
      <line
        x1={x - 5}
        y1={y + height}
        x2={x + 5}
        y2={y + height}
        stroke={color}
        strokeWidth="2"
      />
      
      {/* Bottom-right corner */}
      <line
        x1={x + width}
        y1={y + height - 5}
        x2={x + width}
        y2={y + height + 5}
        stroke={color}
        strokeWidth="2"
      />
      <line
        x1={x + width - 5}
        y1={y + height}
        x2={x + width + 5}
        y2={y + height}
        stroke={color}
        strokeWidth="2"
      />

      {/* Label */}
      {showLabel && (
        <>
          {/* Label background */}
          <rect
            x={x}
            y={y - 18}
            width={label.length * 8 + 40}
            height="18"
            fill={color}
            stroke="#1A1A1A"
            strokeWidth="1"
          />
          {/* Label text */}
          <text
            x={x + (label.length * 8 + 40) / 2}
            y={y - 6}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontSize="10"
            fill="#1A1A1A"
            fontWeight="bold"
          >
            {label} ({confidencePercentage}%)
          </text>
        </>
      )}
    </g>
  );
}
