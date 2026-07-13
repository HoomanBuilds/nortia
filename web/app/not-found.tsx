import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><span>404</span><h1>This market is off the board.</h1><p>The fixture may have expired or the market address is invalid.</p><Link href="/markets">Return to markets</Link></main>;
}
