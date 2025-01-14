"use client";
import Link from "next/link";
import "./globals.css";
import { Layout } from "antd";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { Header } = Layout;
  return (
    <html lang="en">
      <body>
        <Header>
          <span className="logo">
            <Link href={process.env.NEXT_PUBLIC_WEBSITE_URL + ""}>
              ChatbotAI
            </Link>
          </span>
          <Link href={`${process.env.NEXT_PUBLIC_WEBSITE_URL}chatbot`}>
            My Chatbots
          </Link>
        </Header>
        {children}
      </body>
    </html>
  );
}
