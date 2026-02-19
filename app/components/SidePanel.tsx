"use client";

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface DetectionItem {
  id: string;
  label: string;
  labelMyanmar: string;
  confidence: number;
  isActive: boolean;
}

interface SidePanelProps {
  detections?: Detection[];
}

// Burmese translation mapping
const burmeseLabels: Record<string, string> = {
  'right_thumb': 'ညာဖက်လက်မ',
  'right_forefinger': 'ညာဖက်လက်ညိုး', 
  'right_hand': 'ညာဖက်လက်',
  'left_thumb': 'ဘယ်ဖက်လက်မ',
  'left_hand': 'ဘယ်ဖက်လက်',
  'saung_instrument': 'စောင်း'
};

// English labels for display
const englishLabels: Record<string, string> = {
  'right_thumb': 'Right Thumb',
  'right_forefinger': 'Right Forefinger', 
  'right_hand': 'Right Hand',
  'left_thumb': 'Left Thumb',
  'left_hand': 'Left Hand',
  'saung_instrument': 'Saung Instrument'
};

// All possible classes for the inactive list
const allClasses = ['right_thumb', 'right_forefinger', 'right_hand', 'left_thumb', 'left_hand', 'saung_instrument'];

export default function SidePanel({ detections = [] }: SidePanelProps) {
  // Convert real detections to DetectionItem format
  const detectionItems: DetectionItem[] = allClasses.map((className, index) => {
    const detection = detections.find(d => d.class === className);
    return {
      id: `${index + 1}`,
      label: englishLabels[className] || className,
      labelMyanmar: burmeseLabels[className] || className,
      confidence: detection ? detection.confidence : 0,
      isActive: detection ? detection.confidence > 0.25 : false
    };
  });

  const activeDetections = detectionItems.filter((d) => d.isActive);
  const inactiveDetections = detectionItems.filter((d) => !d.isActive);

  return (
    <div className="h-full border-2 border-ink bg-paper shadow-retro flex flex-col">
      {/* Panel Header */}
      <div className="border-b-2 border-ink bg-paper-dark px-4 py-3">
        <h2 className="font-[var(--font-masterpiece)] text-lg font-bold text-ink">
          Detection Ledger
        </h2>
        <p className="font-mono text-xs text-ink opacity-60 mt-1 uppercase tracking-wider">
          Real-time Confidence Scores
        </p>
      </div>

      {/* Active Detections Section */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Header */}
        <div className="bg-ink px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-xs text-paper uppercase tracking-wider">
            Active ({activeDetections.length})
          </span>
          <div className="w-2 h-2 rounded-full bg-gold animate-blink" />
        </div>

        {/* Active Items */}
        <div className="divide-y-2 divide-ink">
          {activeDetections.map((item) => (
            <div
              key={item.id}
              className={`bg-ink px-4 py-3 flex items-center justify-between cursor-pointer transition-all duration-300 ${
                item.confidence > 0.85 ? 'active-glow' : ''
              } hover:bg-ink/90`}
            >
              <div>
                <p className="font-[var(--font-myanmar)] text-base font-medium text-paper">
                  {item.labelMyanmar}
                </p>
                <p className="font-mono text-xs text-paper opacity-60 mt-0.5">
                  {item.label}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-bold text-gold animate-shimmer" style={{ WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {(item.confidence * 100).toFixed(0)}%
                </p>
                <div className="w-16 h-1 bg-paper-dark mt-1 border border-paper">
                  <div
                    className="h-full bg-gold"
                    style={{ width: `${item.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Inactive Header */}
        <div className="bg-paper-dark px-4 py-2 border-t-2 border-ink">
          <span className="font-mono text-xs text-ink uppercase tracking-wider opacity-60">
            Inactive ({inactiveDetections.length})
          </span>
        </div>

        {/* Inactive Items */}
        <div className="divide-y divide-ink/30">
          {inactiveDetections.map((item) => (
            <div
              key={item.id}
              className="px-4 py-2 flex items-center justify-between opacity-50 ink-wash-hover cursor-pointer"
            >
              <div>
                <p className="font-[var(--font-myanmar)] text-sm text-ink opacity-70">
                  {item.labelMyanmar}
                </p>
                <p className="font-mono text-xs text-ink opacity-50 mt-0.5">
                  {item.label}
                </p>
              </div>
              <span className="font-mono text-xs text-ink opacity-40">--</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel Footer */}
      <div className="border-t-2 border-ink bg-paper-dark px-4 py-3">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-ink opacity-60">Total Classes</span>
          <span className="text-gold font-bold">{allClasses.length}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-xs mt-1">
          <span className="text-ink opacity-60">Detected</span>
          <span className="text-ink">{activeDetections.length}</span>
        </div>
      </div>
    </div>
  );
}
