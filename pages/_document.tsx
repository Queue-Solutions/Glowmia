import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=El+Messiri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        />
        <link rel="icon" href="/glowmia-favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/glowmia-favicon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
