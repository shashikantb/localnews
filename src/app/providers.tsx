'use client';

import type { FC, PropsWithChildren } from 'react';
import { ThemeProvider } from 'next-themes';

export const Providers: FC<PropsWithChildren> = ({ children }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark', 'colorful']}
    >
      {children}
    </ThemeProvider>
  );
};
