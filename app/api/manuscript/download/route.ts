import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Document, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType, Packer } from 'docx'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const projectId = url.searchParams.get('project_id')
  const format = url.searchParams.get('format') || 'docx' // 'docx' | 'txt'

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = await createServiceClient()

  // Load project
  const { data: project } = await serviceSupabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('author_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Load all manuscript sections
  const { data: sections } = await serviceSupabase
    .from('manuscript_sections')
    .select('*')
    .eq('project_id', projectId)
    .order('chapter_number', { ascending: true })
    .order('section_number', { ascending: true })

  const allSections = sections || []
  const authorName = project.author_profile?.name || 'Author'
  const bookTitle = project.title || 'Untitled'

  if (format === 'txt') {
    let textContent = `${bookTitle}\nby ${authorName}\n\n`
    textContent += `${'='.repeat(60)}\n\n`

    let currentChapter = ''
    for (const section of allSections) {
      if (section.chapter_title !== currentChapter) {
        currentChapter = section.chapter_title
        textContent += `\n\n${'—'.repeat(60)}\n`
        textContent += `Chapter ${section.chapter_number}: ${section.chapter_title}\n`
        textContent += `${'—'.repeat(60)}\n\n`
      }

      textContent += `${section.section_title}\n\n`
      if (section.content && section.status !== 'placeholder') {
        textContent += `${section.content}\n\n`
      } else {
        textContent += `[Section not yet written]\n\n`
      }
    }

    return new Response(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${bookTitle.replace(/[^a-z0-9]/gi, '_')}_draft.txt"`,
      },
    })
  }

  // Build DOCX
  const docChildren: Paragraph[] = []

  // Title page
  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: bookTitle, bold: true, size: 52 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `by ${authorName}`, size: 32, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Draft — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, size: 22, color: '666666' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ children: [new PageBreak()] })
  )

  // Manuscript content
  let currentChapterId = ''

  for (const section of allSections) {
    // Chapter heading on new page
    if (section.chapter_id !== currentChapterId) {
      currentChapterId = section.chapter_id

      if (currentChapterId !== allSections[0]?.chapter_id) {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }))
      }

      docChildren.push(
        new Paragraph({
          text: `Chapter ${section.chapter_number}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: section.chapter_title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 600 },
        })
      )
    }

    // Section title
    docChildren.push(
      new Paragraph({
        text: section.section_title,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 },
      })
    )

    // Section content or placeholder
    if (section.content && section.status !== 'placeholder') {
      // Split into paragraphs
      const paragraphs = section.content.split('\n\n').filter((p: string) => p.trim())
      for (const para of paragraphs) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: para.trim(), size: 24 })],
            spacing: { before: 0, after: 240 },
            indent: { firstLine: 720 },
          })
        )
      }
    } else {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({
            text: '[This section has not yet been written]',
            italics: true,
            color: '999999',
            size: 22,
          })],
          spacing: { before: 0, after: 240 },
        })
      )
    }
  }

  const doc = new Document({
    creator: 'AIGhostwriter.org',
    title: bookTitle,
    description: `Draft manuscript by ${authorName}`,
    styles: {
      default: {
        document: {
          run: { font: 'Garamond', size: 24 },
          paragraph: { spacing: { line: 360 } }, // 1.5 line spacing
        },
      },
    },
    sections: [{ children: docChildren }],
  })

  const buffer = await Packer.toBuffer(doc)

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${bookTitle.replace(/[^a-z0-9]/gi, '_')}_draft.docx"`,
    },
  })
}
