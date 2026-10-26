import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Hackasandbox — Find, build and ship",description:"Discover hackathons, build full-stack apps, use BYOK inference and run projects in your self-hosted Hackasandbox. Ten RSS readers bring fresh developer updates every six hours."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
