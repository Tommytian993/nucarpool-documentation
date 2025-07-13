// Next.js document component imports
import { Html, Head, Main, NextScript } from "next/document";

/**
 * customized initial HTML document
 */
export default function Document() {
  return (
    <Html>
      <Head>
        {/* google fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Lato&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        {/* Main component and scripts */}
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
