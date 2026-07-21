import Link from "next/link";
import { NortiaMark } from "@/components/nortia-mark";

export default function NotFound() {
  return <main className="not-found"><span className="not-found-mark"><NortiaMark size={34} /></span><small>404</small><h1>This market is off the board.</h1><p>The fixture may have expired or the market address is invalid.</p><Link href="/markets">Return to markets</Link></main>;
}
