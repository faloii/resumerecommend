import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WantedFit - AI 기반 채용 공고 매칭",
  description: "이력서를 업로드하면 AI가 원티드 채용 공고 중 나와 가장 잘 맞는 Top 10 공고를 분석해 드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
