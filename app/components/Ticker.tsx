"use client";

export default function Ticker() {
  const tickerText = "SYSTEM READY // WAITING FOR INPUT // SAUNG MODEL V.1.0 // MYANMAR HARP DETECTION INITIATED // ျမန္မာစောင်း အသံ စနစ္ // COMPUTER VISION ACTIVE // LOCAL INFERENCE RUNNING //";

  return (
    <div className="bg-ink border-b-2 border-ink z-40 overflow-hidden">
      <div className="py-2 flex animate-marquee whitespace-nowrap">
        {/* Duplicate content for seamless loop */}
        {[...Array(4)].map((_, i) => (
          <span
            key={i}
            className="font-mono text-sm text-gold uppercase tracking-wider mx-8"
          >
            {tickerText}
          </span>
        ))}
      </div>
    </div>
  );
}
