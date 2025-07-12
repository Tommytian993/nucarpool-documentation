import "../styles/globals.css";
import type { AppProps } from "next/app";
import { Session } from "next-auth";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { SessionProvider } from "next-auth/react";
import Head from "next/head";
// trpc importfor type-safe api calls
import { trpc } from "../utils/trpc";

/**
 * root app component
 */
export function MyApp({
  // current page component
  Component, 
  // page props, including session and other props
  pageProps: { session, ...pageProps }, 
}: AppProps<{ session: Session }>) {
  return (
    <>
      <Head>
        {/* preconnect to google fonts (for performance) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
      </Head>
      
      {/* NextAuth Session Provider - provide auth state to the whole app */}
      <SessionProvider session={session} refetchOnWindowFocus={false}>
        {/* render current page component */}
        <Component {...pageProps} />
        {/* global toast container - for displaying messages */}
        <ToastContainer />
      </SessionProvider>
    </>
  );
}

// wrap app component with tRPC for type-safe api calls
export default trpc.withTRPC(MyApp);
