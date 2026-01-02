'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

type AnchorProps = ComponentPropsWithoutRef<'a'>;

export function EntityLinkRenderer({ href, children, ...props }: AnchorProps) {
  if (!href) {
    return <span {...props}>{children}</span>;
  }

  // Game link: game:12345
  if (href.startsWith('game:')) {
    const appId = href.slice(5);
    return (
      <Link
        href={`/apps/${appId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors"
        data-entity-link
      >
        {children}
      </Link>
    );
  }

  // Publisher link: /publishers/123 or publishers/123
  const publisherMatch = href.match(/\/?publishers\/(\d+)/);
  if (publisherMatch) {
    return (
      <Link
        href={`/publishers/${publisherMatch[1]}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors"
        data-entity-link
      >
        {children}
      </Link>
    );
  }

  // Developer link: /developers/123 or developers/123
  const developerMatch = href.match(/\/?developers\/(\d+)/);
  if (developerMatch) {
    return (
      <Link
        href={`/developers/${developerMatch[1]}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors"
        data-entity-link
      >
        {children}
      </Link>
    );
  }

  // Regular external link
  const isExternal = href.startsWith('http://') || href.startsWith('https://');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-blue hover:underline"
        {...props}
      >
        {children}
      </a>
    );
  }

  // Internal link
  return (
    <Link href={href} className="text-accent-blue hover:underline" {...props}>
      {children}
    </Link>
  );
}
