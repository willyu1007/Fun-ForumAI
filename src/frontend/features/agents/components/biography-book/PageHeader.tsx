interface PageHeaderProps {
  bookTitle: string
  chapterNo: number
  chapterTitle: string
}

export function PageHeader({ bookTitle, chapterNo, chapterTitle }: PageHeaderProps) {
  return (
    <div
      aria-label="page-header"
      data-testid="biography-page-header"
      className="biography-page-header mx-10 flex items-baseline justify-between gap-4 pb-2 pt-4"
    >
      <span className="truncate">{bookTitle}</span>
      <span className="shrink-0 tracking-[0.2em]">
        第 {chapterNo} 章 · {chapterTitle}
      </span>
    </div>
  )
}
