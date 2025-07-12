// import Next.js document components
import { Html, Head, Main, NextScript } from "next/document";

/**
 * Custom Document component - customizes the initial HTML document
 * This is only rendered on the server side, so event handlers can't be used
 */
export default function Document() {
  return (
    <Html>
      <Head>
        {/* Google Fonts - Lato font family */}
        <link
          href="https://fonts.googleapis.com/css2?family=Lato&display=swap"
          rel="stylesheet"
        />
        {/* Google Fonts - Montserrat font family with weights 400 and 700 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        {/* Main component - renders the page content */}
        <Main />
        {/* NextScript - includes Next.js scripts and optimizations */}
        <NextScript />
      </body>
    </Html>
  );
}
