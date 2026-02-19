import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Serif_Myanmar } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const notoSerifMyanmar = Noto_Serif_Myanmar({
  variable: "--font-myanmar-text",
  subsets: ["myanmar"],
  weight: ["400", "500", "600", "700"],
});

const masterpieceUniType = localFont({
  src: [
    {
      path: "../public/fonts/MasterpieceUniType.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-masterpiece",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: "PyinsaThikha | Myanmar Harp Detection System",
  description: "Computer vision showcase for Myanmar harp string and hand detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${jetbrainsMono.variable} ${notoSerifMyanmar.variable} ${masterpieceUniType.variable} antialiased min-h-screen relative`}
      >
        {/* Paper Texture Overlay */}
        <div className="fixed inset-0 paper-texture pointer-events-none" />
        <div className="fixed inset-0 paper-grid pointer-events-none z-0" />
        
        {/* CRT Scanline Overlay */}
        <div className="fixed inset-0 crt-scanlines pointer-events-none z-50" />
        
        {/* Main Content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
