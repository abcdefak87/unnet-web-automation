import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  name: string
  href?: string
  current?: boolean
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index}>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
              {item.current ? (
                <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                  {item.name}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="ml-1 text-sm font-medium text-gray-700 md:ml-2">
                  {item.name}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}
