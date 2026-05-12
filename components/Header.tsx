import Link from "next/link";
import Image from "next/image";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import {searchStocks} from "@/lib/actions/finnhub.actions";
import type { StockWithWatchlistStatus } from "@/types/global";

const Header = async ({ user }: { user?: User }) => {
    let initialStocks: StockWithWatchlistStatus[] = [];
    try {
        initialStocks = await searchStocks();
    } catch (error) {
        // Gracefully handle API errors during build or when API is unavailable
        console.log('Stock search unavailable during build');
    }

    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                <Link href="/">
                    <div className="flex items-center gap-2 cursor-pointer">
                        <div className="h-8 w-8 overflow-hidden rounded-sm">
                            <Image src="/assets/icons/logo.svg" alt="BULL RUN logo" width={140} height={32} className="h-8 w-[140px] max-w-none" />
                        </div>
                        <span className="text-2xl font-semibold text-white">BULL RUN</span>
                    </div>
                </Link>
                <nav className="hidden sm:block">
                    <NavItems initialStocks={initialStocks} />
                </nav>

                <UserDropdown user={user} initialStocks={initialStocks} />
            </div>
        </header>
    )
}
export default Header
