import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Slack Guest Sentinel",
    description: "Detect and manage inactive Slack guests to save money.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
