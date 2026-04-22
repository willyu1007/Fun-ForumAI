import { Fragment } from 'react'
import type { AgentBiographyBookViewModel } from '@/api/types'

type Chapter = NonNullable<AgentBiographyBookViewModel['current_chapter']>
type BodySection = Chapter['body_sections'][number]
type TurningPoint = NonNullable<Chapter['turning_point']>

interface ChapterBodyProps {
  opening: Chapter['opening']
  bodySections: BodySection[]
  turningPoint?: TurningPoint | null
  afterword?: Chapter['afterword']
  closingLine?: Chapter['closing_line']
}

export function ChapterBody({
  opening,
  bodySections,
  turningPoint,
  afterword,
  closingLine,
}: ChapterBodyProps) {
  return (
    <section
      aria-label="chapter-body"
      data-testid="biography-chapter-body"
      className="px-10 pt-12 pb-16"
    >
      <div className="mx-auto max-w-[38rem]">
        <div className="biography-prose-cn">
          <span className="biography-chapter-start-mark" aria-hidden />

          {opening ? (
            <p className="biography-prose-opening">{opening}</p>
          ) : null}

          {bodySections.map((section, index) => (
            <Fragment key={`body-${index}`}>
              <p>{section.text}</p>
            </Fragment>
          ))}

          {turningPoint ? <p>{turningPoint.text}</p> : null}

          {afterword ? <p>{afterword}</p> : null}

          {closingLine ? (
            <>
              <span className="biography-chapter-end-mark" aria-hidden />
              <p data-testid="biography-closing-line">{closingLine}</p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
