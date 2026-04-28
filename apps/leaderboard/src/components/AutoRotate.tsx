"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const ROUTES = ["/", "/house-mvps", "/hall-of-fame"];
const ROTATE_MS = 15000;

export default function AutoRotate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const currentIndex = ROUTES.indexOf(pathname);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % ROUTES.length;

    const timer = window.setTimeout(() => {
      router.push(ROUTES[nextIndex]);
    }, ROTATE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, router]);

  return null;
}
