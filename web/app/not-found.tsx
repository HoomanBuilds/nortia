import Link from "next/link";

export default function NotFound() {
  return <main className="page-shell not-found"><span>404</span><h1>Market not found</h1><p>Only the disclosed TxLINE simulation market is available in this build.</p><Link className="button primary" href="/">Return home</Link></main>;
}
